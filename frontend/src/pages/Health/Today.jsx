import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import Icon from "../../components/Icon.jsx";
import {
  FetchDailyLog,
  FetchHealthSettings,
  FetchWeeklySummary,
  FetchWeightHistory,
  UpdateDailySteps
} from "../../lib/healthApi.js";

const FormatDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ParseLocalDate = (value) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
};

const AddDays = (value, days) => {
  const base = typeof value === "string" ? ParseLocalDate(value) : new Date(value);
  base.setDate(base.getDate() + days);
  return FormatDate(base);
};

const DayMs = 24 * 60 * 60 * 1000;
const ToDayNumber = (value) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return Date.UTC(year, month - 1, day) / DayMs;
};

const ProgressClamp = (value, target) => {
  if (!target) {
    return { percent: 0, over: 0 };
  }
  const percent = Math.min(100, Math.round((value / target) * 100));
  const over = value > target ? value - target : 0;
  return { percent, over };
};

const FormatNumber = (value) => {
  if (value === null || value === undefined) return "0";
  return Number(value).toLocaleString();
};

const FormatMetricValue = (value, key) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  if (key === "Steps") {
    return `${FormatNumber(numeric)} steps`;
  }
  if (key === "Calories") {
    return `${FormatNumber(numeric)}kcal`;
  }
  return `${FormatNumber(numeric)}g`;
};

const NutrientLabels = {
  Calories: "Calories",
  Protein: "Protein",
  Steps: "Steps",
  Fibre: "Fibre",
  Carbs: "Carbs",
  Fat: "Fat",
  SaturatedFat: "Saturated fat",
  Sugar: "Sugar",
  Sodium: "Sodium"
};

const GetBarValue = (totals, log, key) => {
  if (!totals) return 0;
  if (key === "Calories") return totals.TotalCalories ?? totals.NetCalories ?? 0;
  if (key === "Protein") return totals.TotalProtein ?? 0;
  if (key === "Steps") return log?.Steps ?? 0;
  if (key === "Fibre") return totals.TotalFibre ?? 0;
  if (key === "Carbs") return totals.TotalCarbs ?? 0;
  if (key === "Fat") return totals.TotalFat ?? 0;
  if (key === "SaturatedFat") return totals.TotalSaturatedFat ?? 0;
  if (key === "Sugar") return totals.TotalSugar ?? 0;
  if (key === "Sodium") return totals.TotalSodium ?? 0;
  return 0;
};

const GetAdjustedCalorieTarget = (targets, log) => {
  const baseTarget = Number(targets?.DailyCalorieTarget ?? 0);
  if (!baseTarget) return 0;
  const steps = Number(log?.Steps ?? 0);
  const stepFactor =
    log?.StepKcalFactorOverride ?? Number(targets?.StepKcalFactor ?? 0);
  const adjustment = steps > 0 && stepFactor > 0 ? steps * stepFactor : 0;
  return Math.max(0, Math.round(baseTarget + adjustment));
};

const GetBarTarget = (targets, log, key) => {
  if (!targets) return 0;
  if (key === "Calories") return GetAdjustedCalorieTarget(targets, log);
  if (key === "Protein") return targets.ProteinTargetMax ?? targets.ProteinTargetMin ?? 0;
  if (key === "Steps") return targets.StepTarget ?? 0;
  if (key === "Fibre") return targets.FibreTarget ?? 0;
  if (key === "Carbs") return targets.CarbsTarget ?? 0;
  if (key === "Fat") return targets.FatTarget ?? 0;
  if (key === "SaturatedFat") return targets.SaturatedFatTarget ?? 0;
  if (key === "Sugar") return targets.SugarTarget ?? 0;
  if (key === "Sodium") return targets.SodiumTarget ?? 0;
  return 0;
};

const ShouldShowBar = (targets, key) => {
  if (!targets) return false;
  if (key === "Protein") return targets.ShowProteinOnToday !== false;
  if (key === "Steps") return targets.ShowStepsOnToday !== false;
  if (key === "Fibre") return targets.ShowFibreOnToday;
  if (key === "Carbs") return targets.ShowCarbsOnToday;
  if (key === "Fat") return targets.ShowFatOnToday;
  if (key === "SaturatedFat") return targets.ShowSaturatedFatOnToday;
  if (key === "Sugar") return targets.ShowSugarOnToday;
  if (key === "Sodium") return targets.ShowSodiumOnToday;
  return true;
};

const BuildWeeklySeries = (startDate, summary, target) => {
  const days = summary?.Days || [];
  const byDate = new Map(days.map((day) => [day.LogDate, day]));
  const series = [];
  const start = ParseLocalDate(startDate);

  for (let i = 0; i < 7; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const iso = FormatDate(current);
    const record = byDate.get(iso);
    series.push({
      Date: iso,
      Label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Calories: record?.TotalCalories ?? 0,
      Target: target ?? 0
    });
  }

  return series;
};

const BuildTrendLine = (entries) => {
  if (!entries || entries.length < 2) return null;
  const points = entries.map((entry) => ({
    x: ToDayNumber(entry.LogDate),
    y: Number(entry.WeightKg)
  }));
  const count = points.length;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / count;
  let numerator = 0;
  let denominator = 0;
  points.forEach((point) => {
    const dx = point.x - meanX;
    numerator += dx * (point.y - meanY);
    denominator += dx * dx;
  });
  if (!denominator) return null;
  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  return (dateValue) => intercept + slope * ToDayNumber(dateValue);
};

const BuildWeightDomain = (series) => {
  if (!series || series.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  series.forEach((entry) => {
    [entry.Weight, entry.Trend, entry.TargetPath].forEach((value) => {
      if (value == null || Number.isNaN(value)) return;
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  const baseRange = Math.max(0, max - min);
  const padding = Math.max(baseRange * 0.1, 2);
  let lower = min - padding;
  let upper = max + padding;
  let paddedRange = upper - lower;
  if (paddedRange < 10) {
    const extra = (10 - paddedRange) / 2;
    lower -= extra;
    upper += extra;
  }
  const step = 1;
  lower = Math.round(lower / step) * step;
  upper = Math.round(upper / step) * step;
  if (upper - lower < 10) {
    upper = lower + 10;
  }
  return [lower, upper];
};

const Today = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const today = useMemo(() => FormatDate(new Date()), []);
  const todayLabel = useMemo(() => {
    const parsed = ParseLocalDate(today);
    return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }, [today]);
  const startDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return FormatDate(date);
  }, []);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [targets, setTargets] = useState(null);
  const [log, setLog] = useState(null);
  const [totals, setTotals] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [goal, setGoal] = useState(null);
  const [showWeightChart, setShowWeightChart] = useState(true);
  const [showWeightProjection, setShowWeightProjection] = useState(true);
  const [weightRangeKey, setWeightRangeKey] = useState("30");
  const [weightGoalEnabled, setWeightGoalEnabled] = useState(false);
  const [weightGoalReady, setWeightGoalReady] = useState(false);
  const [weightHistory, setWeightHistory] = useState([]);
  const [weightHistoryStatus, setWeightHistoryStatus] = useState("idle");
  const [weightHistoryError, setWeightHistoryError] = useState("");
  const [stepsForm, setStepsForm] = useState({
    Steps: ""
  });
  const [weightForm, setWeightForm] = useState({ WeightKg: "" });
  const [stepsDate, setStepsDate] = useState(today);
  const [weightDate, setWeightDate] = useState(today);
  const [stepsLog, setStepsLog] = useState(null);
  const [weightLog, setWeightLog] = useState(null);
  const [stepsModalOpen, setStepsModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const stepsBackdropDown = useRef(false);
  const weightBackdropDown = useRef(false);
  const actionsMenuRef = useRef(null);
  const [trendsOpen, setTrendsOpen] = useState(() => {
    const stored = localStorage.getItem("health.trendsOpen");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return true;
  });

  const loadData = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      const [settings, dailyData, weeklyData] = await Promise.all([
        FetchHealthSettings(),
        FetchDailyLog(today),
        FetchWeeklySummary(startDate)
      ]);
      setTargets(settings.Targets);
      setGoal(settings.Goal || null);
      setShowWeightChart(settings.ShowWeightChartOnToday !== false);
      setShowWeightProjection(settings.ShowWeightProjectionOnToday !== false);
      setLog(dailyData.DailyLog);
      setTotals(dailyData.Totals || null);
      setWeeklySummary(weeklyData);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load today");
    }
  }, [startDate, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (weightGoalReady) {
      return;
    }
    const hasGoalEndDate = Boolean(goal?.EndDate && goal.EndDate >= today);
    setWeightGoalEnabled(hasGoalEndDate);
    setWeightGoalReady(true);
  }, [goal, today, weightGoalReady]);

  useEffect(() => {
    if (!goal?.EndDate || goal.EndDate < today) {
      setWeightGoalEnabled(false);
    }
  }, [goal, today]);

  useEffect(() => {
    const shouldOpenSteps = searchParams.get("steps") === "1";
    const shouldOpenWeight = searchParams.get("weight") === "1";
    if (shouldOpenSteps) {
      setError("");
      setStepsDate(today);
      setStepsModalOpen(true);
      loadStepsLog(today);
    }
    if (shouldOpenWeight) {
      setError("");
      setWeightDate(today);
      setWeightModalOpen(true);
      loadWeightLog(today);
    }
  }, [searchParams, today]);

  useEffect(() => {
    localStorage.setItem("health.trendsOpen", String(trendsOpen));
  }, [trendsOpen]);

  useEffect(() => {
    if (!stepsModalOpen && !weightModalOpen) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setStepsModalOpen(false);
        setWeightModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepsModalOpen, weightModalOpen]);

  useEffect(() => {
    if (!actionsMenuOpen) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActionsMenuOpen(false);
      }
    };
    const handleClick = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [actionsMenuOpen]);


  const loadStepsLog = async (dateValue) => {
    try {
      const data = await FetchDailyLog(dateValue);
      const dailyLog = data?.DailyLog || {
        Steps: 0,
        StepKcalFactorOverride: null,
        WeightKg: null
      };
      setStepsLog(dailyLog);
      setStepsForm({
        Steps: dailyLog.Steps ? String(dailyLog.Steps) : ""
      });
    } catch (err) {
      setError(err?.message || "Failed to load step log");
    }
  };

  const loadWeightLog = async (dateValue) => {
    try {
      const data = await FetchDailyLog(dateValue);
      const dailyLog = data?.DailyLog || {
        Steps: 0,
        StepKcalFactorOverride: null,
        WeightKg: null
      };
      setWeightLog(dailyLog);
      setWeightForm({
        WeightKg: dailyLog.WeightKg ? String(dailyLog.WeightKg) : ""
      });
    } catch (err) {
      setError(err?.message || "Failed to load weight log");
    }
  };

  const onStepsChange = (event) => {
    const { name, value } = event.target;
    setStepsForm((prev) => ({ ...prev, [name]: value }));
  };

  const openStepsModal = () => {
    setError("");
    setStepsDate(today);
    setStepsModalOpen(true);
    loadStepsLog(today);
  };

  const onWeightChange = (event) => {
    const { name, value } = event.target;
    setWeightForm((prev) => ({ ...prev, [name]: value }));
  };

  const openWeightModal = () => {
    setError("");
    setWeightDate(today);
    setWeightModalOpen(true);
    loadWeightLog(today);
  };

  const handleOverflowAction = (action) => {
    setActionsMenuOpen(false);
    action();
  };

  const submitSteps = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      const payload = {
        Steps: Number(stepsForm.Steps || 0),
        StepKcalFactorOverride: stepsLog?.StepKcalFactorOverride ?? null,
        WeightKg: null
      };
      await UpdateDailySteps(stepsDate, payload);
      await loadData();
      setStepsForm({ Steps: "" });
      setStepsModalOpen(false);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update steps");
    }
  };

  const submitWeight = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      const payload = {
        Steps: weightLog?.Steps ?? 0,
        StepKcalFactorOverride: weightLog?.StepKcalFactorOverride ?? null,
        WeightKg: weightForm.WeightKg ? Number(weightForm.WeightKg) : null
      };
      await UpdateDailySteps(weightDate, payload);
      await loadData();
      setWeightForm({ WeightKg: "" });
      setWeightModalOpen(false);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update weight");
    }
  };

  const barOrder = targets?.BarOrder || ["Calories", "Protein", "Steps"];
  const weeklySeries = useMemo(
    () => BuildWeeklySeries(startDate, weeklySummary, targets?.DailyCalorieTarget ?? 0),
    [startDate, weeklySummary, targets]
  );
  const goalEndDate = goal?.EndDate && goal.EndDate >= today ? goal.EndDate : null;
  const weightRangeOptions = [
    { key: "7", label: "7d" },
    { key: "30", label: "30d" },
    { key: "90", label: "90d" },
    { key: "all", label: "All" }
  ];
  const weightHistoryStartDate = useMemo(() => {
    if (weightRangeKey === "all") {
      return "1900-01-01";
    }
    const days = Number(weightRangeKey);
    return AddDays(today, -(days - 1));
  }, [today, weightRangeKey]);
  const earliestWeightDate = useMemo(() => {
    if (!weightHistory?.length) return null;
    return weightHistory.reduce((earliest, entry) => {
      if (!earliest || entry.LogDate < earliest) {
        return entry.LogDate;
      }
      return earliest;
    }, weightHistory[0]?.LogDate || null);
  }, [weightHistory]);
  const weightStartDate = useMemo(() => {
    if (weightRangeKey !== "all") {
      return weightHistoryStartDate;
    }
    if (earliestWeightDate) {
      return earliestWeightDate;
    }
    return AddDays(today, -29);
  }, [weightRangeKey, weightHistoryStartDate, earliestWeightDate, today]);
  const next7EndDate = useMemo(() => AddDays(today, 7), [today]);
  const next30EndDate = useMemo(() => AddDays(today, 30), [today]);
  const weightProjectionState = useMemo(() => {
    const history = [...(weightHistory || [])].sort((a, b) =>
      a.LogDate > b.LogDate ? 1 : -1
    );
    const historyToDate = history.filter((entry) => entry.LogDate <= today);
    const count = historyToDate.length;
    if (count < 2) {
      return {
        history,
        historyToDate,
        count,
        spanDays: 0,
        trendMode: "none"
      };
    }
    const first = historyToDate[0];
    const last = historyToDate[historyToDate.length - 1];
    const spanDays = Math.max(0, ToDayNumber(last.LogDate) - ToDayNumber(first.LogDate));
    if (count >= 7 && spanDays >= 14) {
      return {
        history,
        historyToDate,
        count,
        spanDays,
        trendMode: "full"
      };
    }
    if (count >= 4) {
      return {
        history,
        historyToDate,
        count,
        spanDays,
        trendMode: "full"
      };
    }
    return {
      history,
      historyToDate,
      count,
      spanDays,
      trendMode: "short"
    };
  }, [weightHistory, today]);
  const showGoalTarget = Boolean(weightGoalEnabled && goalEndDate);
  const weightEndDate = useMemo(() => {
    if (showGoalTarget && goalEndDate) {
      return AddDays(goalEndDate, 1);
    }
    if (weightProjectionState.count <= 2) {
      return next7EndDate;
    }
    return next30EndDate;
  }, [showGoalTarget, goalEndDate, next7EndDate, next30EndDate, weightProjectionState.count]);
  const weightHistoryEndDate = weightEndDate < today ? weightEndDate : today;

  const weightSeries = useMemo(() => {
    if (!weightStartDate || !weightEndDate) return [];
    const historyMap = new Map(
      weightProjectionState.history.map((entry) => [entry.LogDate, entry.WeightKg])
    );
    const lastEntry = weightProjectionState.historyToDate.length
      ? weightProjectionState.historyToDate[weightProjectionState.historyToDate.length - 1]
      : null;
    const lastWeightValue = lastEntry?.WeightKg ?? null;
    const targetStartDate = lastEntry?.LogDate ?? null;
    const trendLine =
      showWeightProjection && weightProjectionState.trendMode !== "none"
        ? BuildTrendLine(weightProjectionState.historyToDate)
        : null;
    const shortTrendEnd = AddDays(today, 7);
    const trendEndLimit =
      weightProjectionState.trendMode === "short" && shortTrendEnd < weightEndDate
        ? shortTrendEnd
        : weightEndDate;
    const targetWeightValue = goal?.TargetWeightKg ?? null;
    const targetEndDate = goalEndDate;
    const lineStartDay = targetStartDate ? ToDayNumber(targetStartDate) : null;
    const targetEndDay = targetEndDate ? ToDayNumber(targetEndDate) : null;
    const targetSlope =
      showWeightProjection &&
      showGoalTarget &&
      lastWeightValue !== null &&
      targetWeightValue !== null &&
      lineStartDay !== null &&
      targetEndDay !== null &&
      targetEndDay > lineStartDay
        ? (targetWeightValue - lastWeightValue) / (targetEndDay - lineStartDay)
        : null;

    const start = ParseLocalDate(weightStartDate);
    const end = ParseLocalDate(weightEndDate);
    const series = [];
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const iso = FormatDate(day);
      const entry = {
        Date: iso,
        Label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        Weight: historyMap.get(iso) ?? null
      };
      if (trendLine && iso >= today && iso <= trendEndLimit) {
        entry.Trend = Number(trendLine(iso).toFixed(2));
      }
      if (targetSlope !== null && targetStartDate && iso >= targetStartDate) {
        const dayNumber = ToDayNumber(iso);
        if (!targetEndDate || dayNumber <= targetEndDay) {
          entry.TargetPath = Number(
            (lastWeightValue + targetSlope * (dayNumber - lineStartDay)).toFixed(2)
          );
        }
      }
      series.push(entry);
    }
    return series;
  }, [
    weightStartDate,
    weightEndDate,
    weightProjectionState,
    showWeightProjection,
    showGoalTarget,
    goal,
    goalEndDate,
    today
  ]);
  const weightYAxisDomain = useMemo(() => BuildWeightDomain(weightSeries), [weightSeries]);
  const showTrendLine = showWeightProjection && weightProjectionState.trendMode !== "none";
  const trendLineDash =
    weightProjectionState.trendMode === "short" ? "2 6" : "6 6";
  const trendLineOpacity = weightProjectionState.trendMode === "short" ? 0.5 : 0.8;
  const showTargetPath = Boolean(
    showWeightProjection &&
      showGoalTarget &&
      goalEndDate &&
      goal?.TargetWeightKg != null &&
      weightProjectionState.historyToDate.length > 0
  );
  const targetDot = useMemo(() => {
    if (!showTargetPath || !goalEndDate || goal?.TargetWeightKg == null) {
      return null;
    }
    const label = ParseLocalDate(goalEndDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
    return {
      x: label,
      y: Number(goal.TargetWeightKg)
    };
  }, [goal, goalEndDate, showTargetPath]);
  useEffect(() => {
    if (!showWeightChart || !weightHistoryStartDate || !weightHistoryEndDate) {
      return;
    }
    const loadWeights = async () => {
      try {
        setWeightHistoryStatus("loading");
        setWeightHistoryError("");
        const data = await FetchWeightHistory(weightHistoryStartDate, weightHistoryEndDate);
        setWeightHistory(data?.Weights || []);
        setWeightHistoryStatus("ready");
      } catch (err) {
        setWeightHistoryStatus("error");
        setWeightHistoryError(err?.message || "Failed to load weight history");
      }
    };
    loadWeights();
  }, [showWeightChart, weightHistoryStartDate, weightHistoryEndDate]);
  const handleBarClick = (data) => {
    const dateValue = data?.payload?.Date;
    if (!dateValue) {
      return;
    }
    navigate(`/health/log?date=${encodeURIComponent(dateValue)}`);
  };

  const handleProgressAction = (key) => {
    if (key === "Steps") {
      openStepsModal();
      return;
    }
    navigate("/health/log");
  };

  return (
    <div className="health-grid">
      <section className="module-panel">
        <header className="module-panel-header">
          <div className="health-today-header">
            <h2>{todayLabel}</h2>
            <div className="health-actions">
              <Link className="button-pill" to="/health/log">
                Log a meal
              </Link>
              <div className="health-overflow health-actions-overflow" ref={actionsMenuRef}>
                <button
                  type="button"
                  className="icon-button is-secondary"
                  aria-label="More actions"
                  aria-expanded={actionsMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setActionsMenuOpen((prev) => !prev)}
                >
                  <Icon name="more" className="icon" />
                </button>
                {actionsMenuOpen ? (
                  <div className="health-overflow-menu" role="menu">
                    <button
                      type="button"
                      className="health-overflow-item"
                      role="menuitem"
                      onClick={() => handleOverflowAction(openStepsModal)}
                    >
                      Log steps
                    </button>
                    <button
                      type="button"
                      className="health-overflow-item"
                      role="menuitem"
                      onClick={() => handleOverflowAction(openWeightModal)}
                    >
                      Log weight
                    </button>
                  </div>
                ) : null}
              </div>
              <button type="button" className="module-link" onClick={openStepsModal}>
                Log steps
              </button>
              <button type="button" className="module-link" onClick={openWeightModal}>
                Log weight
              </button>
            </div>
          </div>
        </header>
        {status === "error" ? <p className="form-error">{error}</p> : null}
        <div className="health-progress-list">
          {barOrder.filter((key) => ShouldShowBar(targets, key)).map((key) => {
            const value = GetBarValue(totals, log, key);
            const target = GetBarTarget(targets, log, key);
            const { percent, over } = ProgressClamp(value, target);
            const deltaValue = target > 0 ? target - value : 0;
            const deltaLabel =
              target > 0
                ? `${FormatMetricValue(Math.abs(deltaValue), key)} ${deltaValue >= 0 ? "under" : "over"}`
                : "";
            const metaParts = [
              target > 0 ? `${Math.round((value / target) * 100)}% of target` : "",
              target > 0 ? deltaLabel : ""
            ].filter(Boolean);
            return (
              <button
                key={key}
                type="button"
                className="health-progress health-progress--action"
                onClick={() => handleProgressAction(key)}
              >
                <div className="health-progress-header">
                  <div>
                    <p className="health-progress-label">{NutrientLabels[key]}</p>
                    <p className="health-progress-value">
                      {FormatNumber(value)}
                      {target ? ` / ${FormatNumber(target)}` : ""}
                      {metaParts.length ? (
                        <span className="health-progress-meta-inline">
                          {metaParts.join(" • ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {over > 0 ? <span className="health-over">+{FormatNumber(over)}</span> : null}
                </div>
                <div className="health-progress-bar">
                  <div className="health-progress-fill" style={{ width: `${percent}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>Last 7 days</h3>
            <p>Calories with your daily target as a guide.</p>
          </div>
          <button
            type="button"
            className="health-trends-toggle"
            onClick={() => setTrendsOpen((prev) => !prev)}
            aria-expanded={trendsOpen}
          >
            Trends
            <span className={`health-trends-caret${trendsOpen ? " is-open" : ""}`}>▸</span>
          </button>
        </header>
        {trendsOpen ? (
          <div className="health-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklySeries} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="Label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-strong)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "0 12px 24px rgba(20, 16, 12, 0.18)"
                  }}
                  labelStyle={{ color: "var(--text)" }}
                />
                <Legend />
                <Bar
                  dataKey="Calories"
                  name="Calories"
                  fill="var(--chart-primary)"
                  radius={[10, 10, 0, 0]}
                  onClick={handleBarClick}
                />
                <Line
                  type="monotone"
                  dataKey="Target"
                  name="Target"
                  stroke="var(--text-soft)"
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </section>

      {showWeightChart ? (
        <section className="module-panel">
          <header className="module-panel-header">
            <div>
              <h3>Weight trend</h3>
              <p>Logged weights with goal and trend projections.</p>
            </div>
          </header>
          {weightHistoryError ? <p className="form-error">{weightHistoryError}</p> : null}
          {weightHistoryStatus === "loading" ? (
            <p>Loading weight history...</p>
          ) : (
            <div className="health-chart health-chart--weight">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weightSeries} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="Label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <YAxis
                    domain={weightYAxisDomain || undefined}
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-strong)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 12px 24px rgba(20, 16, 12, 0.18)"
                    }}
                    labelStyle={{ color: "var(--text)" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Weight"
                    name="Weight"
                    stroke="var(--health-weight)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  {showTrendLine ? (
                    <Line
                      type="monotone"
                      dataKey="Trend"
                      name="Trend"
                      stroke="var(--health-trend)"
                      strokeDasharray={trendLineDash}
                      strokeOpacity={trendLineOpacity}
                      dot={false}
                    />
                  ) : null}
                  {showTargetPath ? (
                    <Line
                      type="monotone"
                      dataKey="TargetPath"
                      name="Target 🎯"
                      stroke="var(--health-meal)"
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  ) : null}
                  {targetDot ? (
                    <ReferenceDot
                      x={targetDot.x}
                      y={targetDot.y}
                      r={6}
                      fill="var(--health-meal)"
                      stroke="var(--surface)"
                      strokeWidth={2}
                      isFront
                      label={({ x, y }) => (
                        <text
                          x={x}
                          y={y}
                          dy={-12}
                          textAnchor="middle"
                          fontSize="14"
                        >
                          🎯
                        </text>
                      )}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="health-chart-footer">
            <div className="health-chart-range">
              <span className="health-chart-note">Range</span>
              {weightRangeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`button-secondary-pill${weightRangeKey === option.key ? " is-active" : ""}`}
                  onClick={() => setWeightRangeKey(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`health-goal-toggle${showGoalTarget ? " is-active" : ""}`}
              onClick={() => setWeightGoalEnabled((prev) => !prev)}
              aria-pressed={showGoalTarget}
              aria-label="Toggle goal projection"
              disabled={!goalEndDate}
            >
              Goal
              <span className="health-goal-dot" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}
      {stepsModalOpen ? (
        <div
          className="modal-backdrop"
          data-health-modal-label="Log steps"
          onMouseDown={(event) => {
            stepsBackdropDown.current = event.target === event.currentTarget;
          }}
          onMouseUp={(event) => {
            if (stepsBackdropDown.current && event.target === event.currentTarget) {
              setStepsModalOpen(false);
            }
            stepsBackdropDown.current = false;
          }}
        >
          <div className="modal health-edit-modal" onClick={(event) => event.stopPropagation()}>
            <form onSubmit={submitSteps}>
              <div className="modal-header">
                <h3>Log steps</h3>
                <div className="modal-header-actions">
                  <button
                    type="submit"
                    className="icon-button is-primary"
                    aria-label="Save steps"
                    disabled={status === "saving"}
                  >
                    <Icon name="save" className="icon" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setStepsModalOpen(false)}
                    aria-label="Close modal"
                  >
                    <Icon name="close" className="icon" />
                  </button>
                </div>
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="form-grid">
                <label>
                  Steps
                  <input
                    type="number"
                    min="0"
                    name="Steps"
                    value={stepsForm.Steps}
                    onChange={onStepsChange}
                    placeholder={stepsLog?.Steps ?? 0}
                    autoFocus
                    required
                  />
                </label>
                <label>
                  Log date
                  <input
                    type="date"
                    name="StepsDate"
                    value={stepsDate}
                    onChange={(event) => {
                      setStepsDate(event.target.value);
                      loadStepsLog(event.target.value);
                    }}
                    max={today}
                    required
                  />
                </label>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {weightModalOpen ? (
        <div
          className="modal-backdrop"
          data-health-modal-label="Log weight"
          onMouseDown={(event) => {
            weightBackdropDown.current = event.target === event.currentTarget;
          }}
          onMouseUp={(event) => {
            if (weightBackdropDown.current && event.target === event.currentTarget) {
              setWeightModalOpen(false);
            }
            weightBackdropDown.current = false;
          }}
        >
          <div className="modal health-edit-modal" onClick={(event) => event.stopPropagation()}>
            <form onSubmit={submitWeight}>
              <div className="modal-header">
                <h3>Log weight</h3>
                <div className="modal-header-actions">
                  <button
                    type="submit"
                    className="icon-button is-primary"
                    aria-label="Save weight"
                    disabled={status === "saving"}
                  >
                    <Icon name="save" className="icon" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setWeightModalOpen(false)}
                    aria-label="Close modal"
                  >
                    <Icon name="close" className="icon" />
                  </button>
                </div>
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="form-grid">
                <label>
                  Weight (kg)
                  <input
                    type="number"
                    step="0.1"
                    name="WeightKg"
                    value={weightForm.WeightKg}
                    onChange={onWeightChange}
                    placeholder={weightLog?.WeightKg ?? ""}
                    autoFocus
                    required
                  />
                </label>
                <label>
                  Log date
                  <input
                    type="date"
                    name="WeightDate"
                    value={weightDate}
                    onChange={(event) => {
                      setWeightDate(event.target.value);
                      loadWeightLog(event.target.value);
                    }}
                    max={today}
                    required
                  />
                </label>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Today;
