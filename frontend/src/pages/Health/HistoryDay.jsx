import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
import SwipeableEntryRow from "../../components/SwipeableEntryRow.jsx";
import { DeleteMealEntry, FetchDailyLog } from "../../lib/healthApi.js";

const FormatDayLabel = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return date
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
};

const FormatAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
};

const CalculateEntryCalories = (entry) => {
  const calories = Number(entry?.CaloriesPerServing) * Number(entry?.Quantity);
  return Number.isFinite(calories) ? Math.round(calories) : 0;
};

const MealOrder = ["Breakfast", "Snack1", "Lunch", "Snack2", "Dinner", "Snack3"];

const FormatMealLabel = (value) => value.replace(/Snack(\d)/, "Snack $1");

const GroupEntriesByMeal = (entries) => {
  const grouped = entries.reduce((acc, entry) => {
    const key = entry.MealType;
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});
  Object.values(grouped).forEach((items) => items.sort((a, b) => a.SortOrder - b.SortOrder));
  return grouped;
};

const HistoryDay = () => {
  const navigate = useNavigate();
  const { date } = useParams();
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const pendingDeletesRef = useRef(new Map());

  const loadData = async () => {
    if (!date) {
      return;
    }
    try {
      setStatus("loading");
      setError("");
      const data = await FetchDailyLog(date);
      setEntries(data?.Entries || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load history day");
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      pendingDeletesRef.current.forEach((pending) => clearTimeout(pending.timeoutId));
      pendingDeletesRef.current.clear();
    };
  }, [date]);

  const scheduleDelete = (entry) => {
    const entryId = entry.MealEntryId;
    if (pendingDeletesRef.current.has(entryId)) {
      return;
    }
    const entryIndex = entries.findIndex((item) => item.MealEntryId === entryId);
    setEntries((prev) => prev.filter((item) => item.MealEntryId !== entryId));
    const timeoutId = window.setTimeout(async () => {
      try {
        await DeleteMealEntry(entryId);
      } catch (err) {
        setError(err?.message || "Failed to delete entry");
        await loadData();
      } finally {
        pendingDeletesRef.current.delete(entryId);
        setToast((prev) => (prev?.entryId === entryId ? null : prev));
      }
    }, 4500);
    pendingDeletesRef.current.set(entryId, { entry, entryIndex, timeoutId });
    setToast({ entryId, message: "Entry deleted" });
  };

  const undoDelete = () => {
    if (!toast?.entryId) {
      return;
    }
    const pending = pendingDeletesRef.current.get(toast.entryId);
    if (!pending) {
      setToast(null);
      return;
    }
    clearTimeout(pending.timeoutId);
    pendingDeletesRef.current.delete(toast.entryId);
    setEntries((prev) => {
      const next = [...prev];
      const index = pending.entryIndex >= 0 ? pending.entryIndex : 0;
      next.splice(Math.min(index, next.length), 0, pending.entry);
      return next;
    });
    setToast(null);
  };

  const groupedEntries = useMemo(() => GroupEntriesByMeal(entries), [entries]);
  const orderedGroups = useMemo(() => {
    const ordered = MealOrder.filter((meal) => groupedEntries[meal]?.length).map((meal) => ({
      meal,
      items: groupedEntries[meal]
    }));
    Object.entries(groupedEntries).forEach(([meal, items]) => {
      if (!MealOrder.includes(meal)) {
        ordered.push({ meal, items });
      }
    });
    return ordered;
  }, [groupedEntries]);

  const totalCalories = useMemo(
    () => entries.reduce((sum, entry) => sum + CalculateEntryCalories(entry), 0),
    [entries]
  );

  const onEditEntry = (entry) => {
    if (!date) {
      return;
    }
    navigate(`/health/log?date=${encodeURIComponent(date)}&edit=${entry.MealEntryId}&add=1`);
  };

  return (
    <section className="module-panel health-history-detail">
      <header className="module-panel-header health-history-detail-header">
        <div>
          <button
            type="button"
            className="text-button"
            onClick={() => navigate("/health/history")}
          >
            Back to history
          </button>
          <h2>{date ? FormatDayLabel(date) : "History"}</h2>
          <p>
            {entries.length} entries • {Math.round(totalCalories)} kcal
          </p>
        </div>
        <div className="module-panel-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              navigate(`/health/log?date=${encodeURIComponent(date || "")}&add=1`)
            }
            disabled={!date}
          >
            Add more
          </button>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {status === "loading" ? <p className="health-empty">Loading day...</p> : null}
      <div className="health-meal-list">
        {orderedGroups.length === 0 ? (
          <p className="health-empty">No entries for this day.</p>
        ) : (
          orderedGroups.map(({ meal, items }) => (
            <div key={meal} className="health-meal-group">
              <div className="health-meal-header">
                <h4>{FormatMealLabel(meal)}</h4>
                <span>{items.length} items</span>
              </div>
              <ul>
                {items.map((entry) => (
                  <li key={entry.MealEntryId}>
                    <SwipeableEntryRow
                      onEdit={() => onEditEntry(entry)}
                      onDelete={() => scheduleDelete(entry)}
                    >
                      <div className="health-entry-row health-entry-row--history">
                        <div className="health-entry-content">
                          <p>{entry.TemplateName || entry.FoodName || "Entry"}</p>
                          <span className="health-detail">
                            {FormatAmount(entry.DisplayQuantity ?? entry.Quantity)}{" "}
                            {entry.PortionLabel || entry.ServingDescription || "serving"}
                          </span>
                        </div>
                        <div className="health-entry-metrics">
                          <span className="health-entry-calories">
                            {CalculateEntryCalories(entry)} kcal
                          </span>
                        </div>
                        <div className="health-entry-actions-inline">
                          <button
                            type="button"
                            className="icon-button is-secondary"
                            aria-label="Edit entry"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditEntry(entry);
                            }}
                          >
                            <Icon name="edit" className="icon" />
                          </button>
                          <button
                            type="button"
                            className="icon-button is-danger"
                            aria-label="Delete entry"
                            onClick={(event) => {
                              event.stopPropagation();
                              scheduleDelete(entry);
                            }}
                          >
                            <Icon name="trash" className="icon" />
                          </button>
                        </div>
                      </div>
                    </SwipeableEntryRow>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      {toast ? (
        <div className="health-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          <button type="button" onClick={undoDelete}>
            Undo
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default HistoryDay;
