import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  CreateKidsChoreEntry,
  DeleteKidsChoreEntry,
  FetchKidsLedger,
  FetchKidsOverview
} from "../../lib/kidsApi.js";
import { GetChoreEmoji, GetKidsHeaderEmoji } from "../../lib/kidsEmoji.js";
import { FormatCurrency } from "../../lib/formatters.js";
import { BuildKidsTotals } from "../../lib/kidsTotals.js";
import { LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const FormatAxisLabel = (value, includeMonth) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = date.getDate();
  if (day === 1 || includeMonth) {
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  }
  return String(day);
};

const FormatTooltipLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

const FormatCurrencyRounded = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(Number(value)));
};

const ParseDateValue = (value) => {
  if (!value) {
    return null;
  }
  const parts = value.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const KidsHome = () => {
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [busyChoreId, setBusyChoreId] = useState(null);

  const loadOverview = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await FetchKidsOverview();
      setOverview(data);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load chores.");
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const loadLedger = async () => {
      try {
        const data = await FetchKidsLedger(200);
        setLedgerEntries(data?.Entries || []);
      } catch (err) {
        setLedgerEntries([]);
      }
    };
    loadLedger();
  }, [loadOverview]);

  const chores = useMemo(() => overview?.Chores || [], [overview]);
  const entries = useMemo(() => overview?.Entries || [], [overview]);
  const projection = useMemo(() => overview?.Projection || [], [overview]);
  const today = overview?.Today || overview?.SelectedDate || "";
  const dayProtected = overview?.DayProtected ?? false;
  const dailySlice = Number(overview?.DailySlice ?? 0);
  const monthStart = overview?.MonthStart || projection[0]?.Date || "";
  const monthEnd = overview?.MonthEnd || projection[projection.length - 1]?.Date || "";
  const monthlyAllowance = Number(overview?.MonthlyAllowance || 40);

  const entryByChoreId = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      map.set(entry.ChoreId, entry);
    });
    return map;
  }, [entries]);

  const dailyJobs = useMemo(
    () => chores.filter((chore) => chore.Type === "Daily"),
    [chores]
  );
  const habits = useMemo(
    () => chores.filter((chore) => chore.Type === "Habit"),
    [chores]
  );
  const bonusTasks = useMemo(
    () => chores.filter((chore) => chore.Type === "Bonus"),
    [chores]
  );
  const habitsDone = useMemo(() => {
    if (habits.length === 0) {
      return true;
    }
    return habits.every((chore) => {
      const entry = entryByChoreId.get(chore.Id);
      return entry?.Status === "Approved";
    });
  }, [habits, entryByChoreId]);

  const onToggleChore = async (chore) => {
    if (!today) {
      return;
    }
    setBusyChoreId(chore.Id);
    setError("");
    try {
      const entry = entryByChoreId.get(chore.Id);
      if (entry) {
        await DeleteKidsChoreEntry(entry.Id);
      } else {
        await CreateKidsChoreEntry({
          ChoreId: chore.Id,
          EntryDate: today,
          Notes: null
        });
      }
      await loadOverview();
    } catch (err) {
      setError(err?.message || "Unable to update chore.");
    } finally {
      setBusyChoreId(null);
    }
  };

  const totals = useMemo(
    () =>
      BuildKidsTotals({
        TodayKey: today,
        MonthStartKey: monthStart,
        MonthEndKey: monthEnd,
        MonthlyAllowance: monthlyAllowance,
        DailySlice: dailySlice,
        ProjectionPoints: projection,
        LedgerEntries: ledgerEntries,
        IsCurrentMonth: true
      }),
    [
      today,
      monthStart,
      monthEnd,
      monthlyAllowance,
      dailySlice,
      projection,
      ledgerEntries
    ]
  );

  const projectionSeries = useMemo(
    () =>
      totals.Series.map((point) => ({
        ...point,
        TooltipLabel: FormatTooltipLabel(point.DateKey)
      })),
    [totals.Series]
  );

  const currentBalance = totals.CurrentTotal;

  const availableBalance = currentBalance;

  const filteredProjectionSeries = useMemo(() => {
    if (!projectionSeries.length) {
      return projectionSeries;
    }
    return projectionSeries.map((point, index) => ({
      ...point,
      AxisLabel: FormatAxisLabel(point.DateKey, index === 0)
    }));
  }, [projectionSeries]);

  const labelPlan = useMemo(() => {
    const total = filteredProjectionSeries.length;
    const lastProjectedIndex = total ? total - 1 : -1;
    let lastActualIndex = -1;
    for (let i = total - 1; i >= 0; i -= 1) {
      if (filteredProjectionSeries[i].ActualAmount !== null) {
        lastActualIndex = i;
        break;
      }
    }
    const hideActualForOverlap =
      lastActualIndex >= 0 && lastProjectedIndex >= 0
        ? lastProjectedIndex - lastActualIndex <= 2
        : false;
    return {
      firstIndex: total ? 0 : -1,
      lastActualIndex,
      lastProjectedIndex,
      hideActualForOverlap
    };
  }, [filteredProjectionSeries]);

  const ledgerTotals = useMemo(() => {
    const startDate = overview?.MonthStart || projectionSeries[0]?.DateKey || "";
    if (!startDate || !today) {
      return { earned: 0, spent: 0 };
    }
    const startTime = ParseDateValue(startDate)?.getTime() ?? 0;
    const endTime = ParseDateValue(today)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ledgerEntries.reduce(
      (acc, entry) => {
        const dateValue = ParseDateValue(entry.EntryDate);
        if (!dateValue) {
          return acc;
        }
        const time = dateValue.getTime();
        if (time < startTime || time > endTime) {
          return acc;
        }
        const amount = Number(entry.Amount || 0);
        if (amount >= 0) {
          acc.earned += amount;
        } else {
          acc.spent += amount;
        }
        return acc;
      },
      { earned: 0, spent: 0 }
    );
  }, [ledgerEntries, overview, projectionSeries, today]);

  const earnedLabel = `+${FormatCurrency(ledgerTotals.earned)}`;
  const spentLabel = `-${FormatCurrency(Math.abs(ledgerTotals.spent))}`;

  const renderChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
      return null;
    }
    const datum = payload[0].payload;
    const activeValue =
      payload.find((entry) => entry.value !== null && entry.value !== undefined)?.value ??
      datum.ActualAmount ??
      datum.ProjectedAmount ??
      0;
    return (
      <div className="kids-chart-tooltip">
        <div className="kids-chart-tooltip-date">
          {datum.TooltipLabel || FormatTooltipLabel(datum.DateKey)}
        </div>
        <div className="kids-chart-tooltip-balance">{FormatCurrency(activeValue)}</div>
      </div>
    );
  };

  const renderActualLabel = ({ index, value, x, y }) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (labelPlan.hideActualForOverlap && index === labelPlan.lastActualIndex) {
      return null;
    }
    const isFirst = index === labelPlan.firstIndex;
    const isLastActual = index === labelPlan.lastActualIndex && !labelPlan.hideActualForOverlap;
    if (!isFirst && !isLastActual) {
      return null;
    }
    const isLast = index === labelPlan.lastProjectedIndex;
    const anchor = isFirst ? "start" : isLast ? "end" : "middle";
    const dx = isFirst ? 8 : isLast ? -8 : 0;
    return (
      <text
        x={x}
        y={y}
        dx={dx}
        dy={-8}
        textAnchor={anchor}
        fill="var(--kids-ink)"
        fontSize="12"
      >
        {FormatCurrencyRounded(value)}
      </text>
    );
  };

  const renderProjectedLabel = ({ index, value, x, y }) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (index !== labelPlan.lastProjectedIndex) {
      return null;
    }
    const anchor = index === labelPlan.firstIndex ? "start" : "end";
    const dx = index === labelPlan.firstIndex ? 8 : -8;
    return (
      <text
        x={x}
        y={y}
        dx={dx}
        dy={-8}
        textAnchor={anchor}
        fill="var(--kids-ink)"
        fontSize="12"
      >
        {FormatCurrencyRounded(value)}
      </text>
    );
  };

  return (
    <div className="kids-home">
      <section className="kids-card kids-balance-now">
        <div className="kids-balance-now-header">
          <p className="kids-label">{GetKidsHeaderEmoji("AvailableNow")} Available now</p>
        </div>
        <div className="kids-balance-now-row">
          <div className="kids-balance-value">{FormatCurrency(availableBalance)}</div>
          <div className="kids-balance-now-meta">
            <span className="kids-balance-meta-title">This month</span>
            <span className="kids-balance-meta is-earned">In {earnedLabel}</span>
            <span className="kids-balance-meta is-spent">Out {spentLabel}</span>
          </div>
        </div>
      </section>

      <section className="kids-card kids-chores-card">
        <div className="kids-chores-section is-daily">
          <div className="kids-chores-section-header">
            <div className="kids-chores-section-title">
              <h4>{GetKidsHeaderEmoji("DailyJobs")} Daily jobs</h4>
              <span className="kids-chores-status">
                {dayProtected ? "Done for today!" : "In progress..."}
              </span>
            </div>
          </div>
          <div className="kids-chores-section-body">
            {dailyJobs.length === 0 ? (
              <p className="kids-muted">No daily jobs set yet.</p>
            ) : (
              dailyJobs.map((chore) => {
                const emoji = GetChoreEmoji(chore);
                const choreLabel = emoji ? `${emoji} ${chore.Label}` : chore.Label;
                const entry = entryByChoreId.get(chore.Id);
                const isComplete = entry?.Status === "Approved";
                const isPending = entry?.Status === "Pending";
                const isRejected = entry?.Status === "Rejected";
                const isActive = isComplete || isPending;
                return (
                  <button
                    key={chore.Id}
                    type="button"
                    className="kids-chore-row"
                    onClick={() => onToggleChore(chore)}
                    aria-pressed={isActive}
                    disabled={busyChoreId === chore.Id}
                  >
                    <div className="kids-chore-row-main">
                      <span className="kids-chore-label">{choreLabel}</span>
                      {isPending ? (
                        <span className="kids-pill kids-pill--muted">Pending approval</span>
                      ) : isRejected ? (
                        <span className="kids-pill kids-pill--muted">Rejected</span>
                      ) : null}
                    </div>
                    <span className="kids-chore-check" aria-hidden="true">
                      {isActive ? "✅" : "⬜️"}
                    </span>
                    <span className={`kids-chore-toggle${isActive ? " is-on" : ""}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="kids-chores-divider" />
        <div className="kids-chores-section is-habits">
          <div className="kids-chores-section-header">
            <div className="kids-chores-section-title">
              <h4>{GetKidsHeaderEmoji("Habits")} Habits</h4>
              <span className="kids-chores-status">
                {habitsDone ? "Done for today!" : "In progress..."}
              </span>
            </div>
          </div>
          <div className="kids-chores-section-body">
            {habits.length === 0 ? (
              <p className="kids-muted">No habits set yet.</p>
            ) : (
              habits.map((chore) => {
                const emoji = GetChoreEmoji(chore);
                const choreLabel = emoji ? `${emoji} ${chore.Label}` : chore.Label;
                const entry = entryByChoreId.get(chore.Id);
                const isComplete = entry?.Status === "Approved";
                const isPending = entry?.Status === "Pending";
                const isRejected = entry?.Status === "Rejected";
                const isActive = isComplete || isPending;
                return (
                  <button
                    key={chore.Id}
                    type="button"
                    className="kids-chore-row"
                    onClick={() => onToggleChore(chore)}
                    aria-pressed={isActive}
                    disabled={busyChoreId === chore.Id}
                  >
                    <div className="kids-chore-row-main">
                      <span className="kids-chore-label">{choreLabel}</span>
                      {isPending ? (
                        <span className="kids-pill kids-pill--muted">Pending approval</span>
                      ) : isRejected ? (
                        <span className="kids-pill kids-pill--muted">Rejected</span>
                      ) : null}
                    </div>
                    <span className="kids-chore-check" aria-hidden="true">
                      {isActive ? "✅" : "⬜️"}
                    </span>
                    <span className={`kids-chore-toggle${isActive ? " is-on" : ""}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="kids-chores-divider" />
        <div className="kids-chores-section is-bonus">
          <div className="kids-chores-section-header">
            <div>
              <h4>{GetKidsHeaderEmoji("BonusTasks")} Bonus tasks</h4>
            </div>
          </div>
          <div className="kids-chores-section-body">
            {bonusTasks.length === 0 ? (
              <p className="kids-muted">No bonus tasks set yet.</p>
            ) : (
              bonusTasks.map((chore) => {
                const emoji = GetChoreEmoji(chore);
                const choreLabel = emoji ? `${emoji} ${chore.Label}` : chore.Label;
                const entry = entryByChoreId.get(chore.Id);
                const isComplete = entry?.Status === "Approved";
                const isPending = entry?.Status === "Pending";
                const isRejected = entry?.Status === "Rejected";
                const isActive = isComplete || isPending;
                const amountLabel = chore.Amount ? ` (${FormatCurrency(chore.Amount)})` : "";
                return (
                  <button
                    key={chore.Id}
                    type="button"
                    className="kids-chore-row"
                    onClick={() => onToggleChore(chore)}
                    aria-pressed={isActive}
                    disabled={busyChoreId === chore.Id}
                  >
                    <div className="kids-chore-row-main">
                      <span className="kids-chore-label">{`${choreLabel}${amountLabel}`}</span>
                      {isPending ? (
                        <span className="kids-pill kids-pill--muted">Pending approval</span>
                      ) : isRejected ? (
                        <span className="kids-pill kids-pill--muted">Rejected</span>
                      ) : null}
                    </div>
                    <span className="kids-chore-check" aria-hidden="true">
                      {isActive ? "✅" : "⬜️"}
                    </span>
                    <span className={`kids-chore-toggle${isActive ? " is-on" : ""}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="kids-card kids-balance">
        <p className="kids-label">{GetKidsHeaderEmoji("ThisMonth")} This month</p>
        <div className="kids-balance-chart" aria-label="Monthly projection">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredProjectionSeries} margin={{ top: 18, left: 8, right: 8 }}>
              <XAxis
                dataKey="AxisLabel"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
                tick={{ fontSize: 12, fill: "var(--kids-muted)" }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: "rgba(241, 138, 77, 0.25)", strokeWidth: 1 }}
                content={renderChartTooltip}
              />
              <Line
                type="monotone"
                dataKey="ActualAmount"
                stroke="#f18a4d"
                strokeWidth={2.5}
                dot={false}
              >
                <LabelList dataKey="ActualAmount" content={renderActualLabel} />
              </Line>
              <Line
                type="monotone"
                dataKey="ProjectedAmount"
                stroke="#f18a4d"
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
              >
                <LabelList dataKey="ProjectedAmount" content={renderProjectedLabel} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="kids-balance-summary" />
      </section>

      <div className="kids-secondary-nav">
        <Link to="/kids/history" className="kids-outline-button">
          History
        </Link>
      </div>

      {status === "loading" ? <p className="kids-muted">Loading chores...</p> : null}
      {error ? <p className="kids-error">{error}</p> : null}
    </div>
  );
};

export default KidsHome;
