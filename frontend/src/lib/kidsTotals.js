const ParseDateValue = (value) => {
  if (!value) {
    return null;
  }
  const parts = String(value).split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const BuildDayDiff = (startKey, endKey) => {
  const start = ParseDateValue(startKey);
  const end = ParseDateValue(endKey);
  if (!start || !end) {
    return 0;
  }
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

const BuildDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ShiftDateKey = (dateKey, dayOffset) => {
  const date = ParseDateValue(dateKey);
  if (!date) {
    return "";
  }
  date.setDate(date.getDate() + dayOffset);
  return BuildDateKey(date);
};

const ClampNonNegative = (value) => Math.max(Number(value || 0), 0);

const BuildBalanceAsOf = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return () => 0;
  }
  return (dateKey) => {
    const cutoffTime = ParseDateValue(dateKey)?.getTime();
    if (!cutoffTime) {
      return 0;
    }
    return entries.reduce((acc, entry) => {
      const entryTime = ParseDateValue(entry.EntryDate)?.getTime();
      if (!entryTime || entryTime > cutoffTime) {
        return acc;
      }
      return acc + Number(entry.Amount || 0);
    }, 0);
  };
};

const BuildProjectionAtCutoff = ({
  ProjectionPoints,
  OverviewDays,
  CutoffKey,
  DailySlice
}) => {
  if (Array.isArray(ProjectionPoints) && ProjectionPoints.length > 0) {
    const projectionByDate = new Map();
    ProjectionPoints.forEach((point) => {
      projectionByDate.set(point.Date, Number(point.Amount || 0));
    });
    if (projectionByDate.has(CutoffKey)) {
      return projectionByDate.get(CutoffKey) ?? 0;
    }
    return Number(ProjectionPoints[ProjectionPoints.length - 1]?.Amount || 0);
  }
  if (!Array.isArray(OverviewDays) || OverviewDays.length === 0) {
    return 0;
  }
  const dailySliceValue = Number(DailySlice || 0);
  return OverviewDays.reduce((acc, day) => {
    if (day.Date > CutoffKey) {
      return acc;
    }
    const isDone = day.DailyTotal === 0 || day.DailyDone >= day.DailyTotal;
    if (isDone) {
      acc += dailySliceValue;
    }
    if (day.BonusApprovedTotal) {
      acc += Number(day.BonusApprovedTotal);
    }
    return acc;
  }, 0);
};

export const BuildKidsTotals = ({
  TodayKey,
  MonthStartKey,
  MonthEndKey,
  MonthlyAllowance,
  DailySlice,
  ProjectionPoints = [],
  OverviewDays = [],
  LedgerEntries = [],
  IsCurrentMonth = true
}) => {
  const cutoffKey = IsCurrentMonth ? TodayKey : MonthEndKey;
  const balanceAsOf = BuildBalanceAsOf(LedgerEntries);
  const openingBalanceKey = ShiftDateKey(MonthStartKey, -1);
  const openingBalance = ClampNonNegative(balanceAsOf(openingBalanceKey) ?? 0);
  const balanceAtCutoff = balanceAsOf(cutoffKey) ?? 0;
  const monthLedgerTotal = balanceAtCutoff - (balanceAsOf(openingBalanceKey) ?? 0);
  const dailySliceValue = Number(DailySlice || 0);
  const projectionAtCutoff = BuildProjectionAtCutoff({
    ProjectionPoints,
    OverviewDays,
    CutoffKey: cutoffKey,
    DailySlice: dailySliceValue
  });
  const currentTotal = ClampNonNegative(openingBalance + monthLedgerTotal + projectionAtCutoff);
  const daysInMonth = BuildDayDiff(MonthStartKey, MonthEndKey) + 1;
  const remainingDays = IsCurrentMonth ? Math.max(0, BuildDayDiff(cutoffKey, MonthEndKey)) : 0;
  const monthlyAllowanceValue = Number(MonthlyAllowance || 0);
  const allowanceRemainder = Math.max(
    0,
    monthlyAllowanceValue - dailySliceValue * daysInMonth
  );
  const projectedTotal = Math.max(
    currentTotal +
      dailySliceValue * remainingDays +
      (remainingDays > 0 ? allowanceRemainder : 0),
    0
  );

  let series = [];
  if (Array.isArray(ProjectionPoints) && ProjectionPoints.length > 0) {
    const projectionByDate = new Map();
    ProjectionPoints.forEach((point) => {
      projectionByDate.set(point.Date, Number(point.Amount || 0));
    });
    const cutoffTime = ParseDateValue(cutoffKey)?.getTime() ?? null;
    const finalDate =
      ProjectionPoints[ProjectionPoints.length - 1]?.Date || MonthEndKey || cutoffKey;
    const totalDaysAhead =
      cutoffTime !== null
        ? Math.max(0, BuildDayDiff(cutoffKey, finalDate))
        : 0;
    const remainderPerDay = totalDaysAhead > 0 ? allowanceRemainder / totalDaysAhead : 0;
    series = ProjectionPoints.map((point) => {
      const pointDate = point.Date;
      const pointTime = ParseDateValue(pointDate)?.getTime() ?? null;
      const isOnOrBeforeCutoff =
        cutoffTime !== null && pointTime !== null ? pointTime <= cutoffTime : true;
      const isOnOrAfterCutoff =
        cutoffTime !== null && pointTime !== null ? pointTime >= cutoffTime : false;
      const daysAhead =
        cutoffTime !== null && pointTime !== null
          ? Math.round((pointTime - cutoffTime) / 86400000)
          : 0;
      const pointProjection =
        projectionByDate.get(pointDate) ?? Number(point.Amount || 0);
      const balanceAtPoint = balanceAsOf(pointDate) ?? 0;
      const monthLedgerAtPoint = balanceAtPoint - (balanceAsOf(openingBalanceKey) ?? 0);
      return {
        DateKey: pointDate,
        ActualAmount: isOnOrBeforeCutoff
          ? ClampNonNegative(openingBalance + monthLedgerAtPoint + pointProjection)
          : null,
        ProjectedAmount: isOnOrAfterCutoff
          ? ClampNonNegative(
              currentTotal + dailySliceValue * daysAhead + remainderPerDay * daysAhead
            )
          : null
      };
    });
  }

  return {
    CurrentTotal: currentTotal,
    ProjectedTotal: projectedTotal,
    Series: series
  };
};
