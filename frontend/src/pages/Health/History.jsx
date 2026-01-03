import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { FetchDailyLog } from "../../lib/healthApi.js";

const FormatDate = (value) => value.toISOString().slice(0, 10);
const FormatDayLabel = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return date
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
};
const FormatEntryCount = (value) => `${value} ${value === 1 ? "entry" : "entries"}`;

const BuildDateRange = (offsetDays, count) => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < count; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offsetDays - i);
    dates.push(FormatDate(date));
  }
  return dates;
};

const CalculateEntryCalories = (entry) => {
  const calories = Number(entry?.CaloriesPerServing) * Number(entry?.Quantity);
  return Number.isFinite(calories) ? calories : 0;
};

const RangeOptions = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "all", label: "All", days: null }
];

const PageSize = 14;

const History = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState("7d");
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const activeRange = RangeOptions.find((option) => option.key === range);
  const rangeDays = activeRange?.days ?? null;

  const loadDays = async (nextOffset, count) => {
    try {
      setStatus("loading");
      setError("");
      const dates = BuildDateRange(nextOffset, count);
      const results = await Promise.all(
        dates.map(async (date) => {
          try {
            const data = await FetchDailyLog(date);
            return { date, data };
          } catch {
            return { date, data: null };
          }
        })
      );
      setDays((prev) => (nextOffset === 0 ? results : [...prev, ...results]));
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load history");
    }
  };

  useEffect(() => {
    setOffset(0);
    const count = rangeDays ?? PageSize;
    loadDays(0, count);
  }, [range]);

  const onLoadMore = () => {
    const count = rangeDays ?? PageSize;
    const nextOffset = offset + count;
    setOffset(nextOffset);
    loadDays(nextOffset, count);
  };

  const summaries = useMemo(
    () =>
      days.map(({ date, data }) => {
        const entries = data?.Entries || [];
        const totalCalories = Math.round(
          data?.Summary?.TotalCalories ?? entries.reduce((sum, entry) => sum + CalculateEntryCalories(entry), 0)
        );
        const mealCounts = entries.reduce(
          (acc, entry) => {
            const mealType = entry.MealType || "";
            if (mealType.startsWith("Snack")) {
              acc.Snack += 1;
            } else if (acc[mealType] !== undefined) {
              acc[mealType] += 1;
            }
            return acc;
          },
          { Breakfast: 0, Lunch: 0, Dinner: 0, Snack: 0 }
        );
        const previewItems = entries
          .slice(0, 2)
          .map((entry) => entry.TemplateName || entry.FoodName || "Entry");
        const remainingCount = Math.max(entries.length - previewItems.length, 0);
        return {
          date,
          entries,
          totalCalories,
          entryCount: entries.length,
          mealCounts,
          previewItems,
          remainingCount
        };
      }),
    [days]
  );

  return (
    <section className="module-panel">
      <header className="module-panel-header">
        <div>
          <h2>History</h2>
          <p>Review and revisit previous days.</p>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {status === "loading" && days.length === 0 ? (
        <p className="health-empty">Loading history...</p>
      ) : null}
      <div className="health-history-filters">
        {RangeOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`health-filter-chip${range === option.key ? " is-active" : ""}`}
            onClick={() => setRange(option.key)}
            disabled={status === "loading" && range === option.key}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="health-history-list">
        {summaries.map((summary) => {
          const mealSummary = [
            FormatEntryCount(summary.entryCount),
            summary.mealCounts.Breakfast ? `Breakfast ${summary.mealCounts.Breakfast}` : null,
            summary.mealCounts.Lunch ? `Lunch ${summary.mealCounts.Lunch}` : null,
            summary.mealCounts.Dinner ? `Dinner ${summary.mealCounts.Dinner}` : null,
            summary.mealCounts.Snack ? `Snack ${summary.mealCounts.Snack}` : null
          ]
            .filter(Boolean)
            .join(" • ");
          return (
            <button
              key={summary.date}
              type="button"
              className="health-history-card"
              onClick={() => navigate(`/health/history/${encodeURIComponent(summary.date)}`)}
            >
              <div className="health-history-card-header">
                <span>{FormatDayLabel(summary.date)}</span>
                <span className="health-history-card-kcal">{summary.totalCalories} kcal</span>
              </div>
              {summary.entryCount ? (
                <>
                  <div className="health-history-card-subtitle">{mealSummary}</div>
                  {summary.previewItems.length ? (
                    <div className="health-history-preview">
                      {summary.previewItems.map((item, index) => (
                        <span
                          key={`${summary.date}-preview-${index}`}
                          className="health-history-preview-item"
                        >
                          {item}
                        </span>
                      ))}
                      {summary.remainingCount ? (
                        <span className="health-history-preview-more">
                          +{summary.remainingCount} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="health-history-card-empty">No entries</div>
              )}
            </button>
          );
        })}
      </div>
      {rangeDays === null ? (
        <div className="form-actions">
          <button type="button" onClick={onLoadMore}>
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default History;
