import { ToNumber } from "./formatters.js";

export const RatioEpsilon = 0.00005;
const NormalizeRatio = (value) => Math.round(value * 1000000) / 1000000;
export const NormalizeTotal = (value) => {
  const normalized = NormalizeRatio(value);
  return Math.abs(normalized - 1) <= RatioEpsilon ? 1 : normalized;
};
export const ClampNearZero = (value) => (Math.abs(value) <= RatioEpsilon ? 0 : value);
export const RoundPercentValue = (value) => Math.round(value * 100) / 100;
export const FormatPercent = (value) => `${(value * 100).toFixed(2)}%`;

export const BuildBudgetTotals = (incomeStreams, expenses) => {
  const incomeTotals = incomeStreams.reduce(
    (acc, stream) => {
      acc.PerDay += ToNumber(stream.NetPerDay);
      acc.PerWeek += ToNumber(stream.NetPerWeek);
      acc.PerFortnight += ToNumber(stream.NetPerFortnight);
      acc.PerMonth += ToNumber(stream.NetPerMonth);
      acc.PerYear += ToNumber(stream.NetPerYear);
      return acc;
    },
    { PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0 }
  );

  const expenseTotals = expenses.reduce(
    (acc, expense) => {
      if (!expense.Enabled) {
        return acc;
      }
      acc.PerDay += ToNumber(expense.PerDay);
      acc.PerWeek += ToNumber(expense.PerWeek);
      acc.PerFortnight += ToNumber(expense.PerFortnight);
      acc.PerMonth += ToNumber(expense.PerMonth);
      acc.PerYear += ToNumber(expense.PerYear);
      return acc;
    },
    { PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0 }
  );

  return {
    Income: incomeTotals,
    Expenses: expenseTotals,
    Difference: {
      PerDay: incomeTotals.PerDay - expenseTotals.PerDay,
      PerWeek: incomeTotals.PerWeek - expenseTotals.PerWeek,
      PerFortnight: incomeTotals.PerFortnight - expenseTotals.PerFortnight,
      PerMonth: incomeTotals.PerMonth - expenseTotals.PerMonth,
      PerYear: incomeTotals.PerYear - expenseTotals.PerYear
    }
  };
};

export const BuildManualAllocations = (allocationAccounts) =>
  allocationAccounts
    .filter((account) => account.Enabled)
    .map((account) => ({ Id: account.Id, Key: account.Name, Percent: account.Percent }));

export const BuildAllocationBaseSummary = (totals, manualAllocations) => {
  const incomePerFortnight = totals.Income.PerFortnight || 0;
  const targetExpenseAllocation = incomePerFortnight
    ? totals.Expenses.PerFortnight / incomePerFortnight
    : 0;
  const manualTotal = manualAllocations.reduce(
    (sum, entry) => sum + ToNumber(entry.Percent) / 100,
    0
  );
  const totalAllocated = NormalizeTotal(targetExpenseAllocation + manualTotal);
  const leftover = ClampNearZero(Math.max(0, 1 - totalAllocated));
  const overage = ClampNearZero(Math.max(0, totalAllocated - 1));
  return {
    TargetExpenseAllocation: targetExpenseAllocation,
    TotalAllocated: totalAllocated,
    Leftover: leftover,
    Overage: overage
  };
};

export const BuildAllocationSummary = (totals, activeAllocations) => {
  const incomePerFortnight = totals.Income.PerFortnight || 0;
  const targetExpenseAllocation = incomePerFortnight
    ? totals.Expenses.PerFortnight / incomePerFortnight
    : 0;
  const manualTotal = activeAllocations.reduce(
    (sum, entry) => sum + ToNumber(entry.Percent) / 100,
    0
  );
  const totalAllocated = NormalizeTotal(targetExpenseAllocation + manualTotal);
  const leftover = ClampNearZero(Math.max(0, 1 - totalAllocated));
  const overage = ClampNearZero(Math.max(0, totalAllocated - 1));

  const buildRow = (name, percent, id = null) => {
    const perDay = totals.Income.PerDay * percent;
    const perWeek = totals.Income.PerWeek * percent;
    const perFortnight = totals.Income.PerFortnight * percent;
    const perMonth = totals.Income.PerMonth * percent;
    const perYear = totals.Income.PerYear * percent;
    const roundedFortnight = Math.round(perFortnight);
    const percentTo100 = incomePerFortnight ? roundedFortnight / incomePerFortnight : 0;
    return {
      Id: id,
      Name: name,
      Percent: percent,
      PerDay: perDay,
      PerWeek: perWeek,
      PerFortnight: perFortnight,
      PerMonth: perMonth,
      PerYear: perYear,
      RoundedFortnight: roundedFortnight,
      PercentTo100: percentTo100
    };
  };

  const rows = [
    buildRow("Leftover", leftover),
    buildRow("Daily Expenses", targetExpenseAllocation),
    ...activeAllocations.map((entry) => buildRow(entry.Key, ToNumber(entry.Percent) / 100, entry.Id))
  ];

  const totalRounded = rows
    .filter((row) => row.Name !== "Leftover")
    .reduce((sum, row) => sum + row.RoundedFortnight, 0);

  return {
    TargetExpenseAllocation: targetExpenseAllocation,
    TotalAllocated: totalAllocated,
    Leftover: leftover,
    Overage: overage,
    Rows: rows,
    TotalRow: buildRow("Total allocated", totalAllocated),
    TotalRounded: totalRounded,
    TotalRoundedPercent: incomePerFortnight ? totalRounded / incomePerFortnight : 0
  };
};
