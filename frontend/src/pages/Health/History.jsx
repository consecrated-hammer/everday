import { useEffect, useMemo, useState } from "react";

import { FetchDailyLog } from "../../lib/healthApi.js";

const FormatDate = (value) => value.toISOString().slice(0, 10);
const FormatAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
};

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

const History = () => {
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadDays = async (nextOffset) => {
    try {
      setStatus("loading");
      setError("");
      const dates = BuildDateRange(nextOffset, 7);
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
    loadDays(0);
  }, []);

  const onLoadMore = () => {
    const nextOffset = offset + 7;
    setOffset(nextOffset);
    loadDays(nextOffset);
  };

  return (
    <section className="module-panel">
      <header className="module-panel-header">
        <div>
          <h2>History</h2>
          <p>Review and revisit previous days.</p>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="health-history">
        {days.map(({ date, data }) => (
          <div key={date} className="health-history-day">
            <div className="health-history-header">
              <h4>{date}</h4>
              <span>{data?.Summary?.TotalCalories || 0} kcal</span>
            </div>
            {data?.Entries?.length ? (
              <ul>
                {data.Entries.map((entry) => (
                  <li key={entry.MealEntryId}>
                    <span>{entry.MealType}</span>
                    <span>{entry.FoodName}</span>
                    <span>
                      {FormatAmount(entry.DisplayQuantity ?? entry.Quantity)}{" "}
                      {entry.PortionLabel || entry.ServingDescription || "serving"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="health-empty">No entries logged.</p>
            )}
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" onClick={onLoadMore}>
          Load more
        </button>
      </div>
    </section>
  );
};

export default History;
