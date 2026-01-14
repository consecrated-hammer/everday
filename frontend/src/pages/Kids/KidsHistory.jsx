import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CreateKidsChoreEntry,
  FetchKidsChoreEntries,
  FetchKidsOverview
} from "../../lib/kidsApi.js";
import { FormatDate, FormatTime } from "../../lib/formatters.js";
import Icon from "../../components/Icon.jsx";
import { GetChoreEmoji, GetKidsHeaderEmoji } from "../../lib/kidsEmoji.js";

const TypeLabel = (value) => {
  switch (value) {
    case "Daily":
      return "Daily job";
    case "Habit":
      return "Habit";
    case "Bonus":
      return "Bonus task";
    default:
      return "Task";
  }
};

const StatusLabel = (value) => {
  switch (value) {
    case "Pending":
      return "Pending approval";
    case "Rejected":
      return "Rejected";
    case "Approved":
      return "Approved";
    default:
      return "";
  }
};

const Filters = [
  { Key: "all", Label: "All" },
  { Key: "Daily", Label: "Daily jobs" },
  { Key: "Habit", Label: "Habits" },
  { Key: "Bonus", Label: "Bonus tasks" },
  { Key: "pending", Label: "Pending approval" }
];

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

const FormatDateValue = (dateValue) => {
  if (!dateValue) {
    return "";
  }
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ShiftDateValue = (value, days) => {
  const dateValue = ParseDateValue(value);
  if (!dateValue) {
    return "";
  }
  const next = new Date(dateValue);
  next.setDate(next.getDate() + days);
  return FormatDateValue(next);
};

const IsBeforeDate = (value, compareTo) => {
  const dateValue = ParseDateValue(value);
  const compareValue = ParseDateValue(compareTo);
  if (!dateValue || !compareValue) {
    return false;
  }
  return dateValue.getTime() < compareValue.getTime();
};

const KidsHistory = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [chores, setChores] = useState([]);
  const [today, setToday] = useState("");
  const [allowedStart, setAllowedStart] = useState("");
  const [maxPastDate, setMaxPastDate] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ ChoreId: "", EntryDate: "", Notes: "" });
  const [logStatus, setLogStatus] = useState("idle");
  const [logError, setLogError] = useState("");
  const [choreSearch, setChoreSearch] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [toast, setToast] = useState("");
  const [dailySummaryByDate, setDailySummaryByDate] = useState({});
  const [expandedDates, setExpandedDates] = useState(new Set());
  const summaryLoadedRef = useRef(new Set());

  const loadHistory = async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await FetchKidsChoreEntries(50, false);
      setEntries(data || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load history.");
    }
  };

  const loadMeta = async () => {
    try {
      const data = await FetchKidsOverview();
      setChores(data?.Chores || []);
      const nextToday = data?.Today || data?.SelectedDate || "";
      setToday(nextToday);
      setAllowedStart(data?.AllowedStartDate || "");
      setMaxPastDate(nextToday ? ShiftDateValue(nextToday, -1) : "");
    } catch (err) {
      setChores([]);
    }
  };

  useEffect(() => {
    loadHistory();
    loadMeta();
  }, []);

  useEffect(() => {
    if (!entries.length) {
      return;
    }
    const uniqueDates = Array.from(
      new Set(entries.map((entry) => entry.EntryDate).filter(Boolean))
    );
    const pending = uniqueDates.filter((date) => !summaryLoadedRef.current.has(date));
    if (!pending.length) {
      return;
    }
    let cancelled = false;
    const loadSummaries = async () => {
      const results = await Promise.all(
        pending.map(async (dateValue) => {
          summaryLoadedRef.current.add(dateValue);
          try {
            const data = await FetchKidsOverview(dateValue);
            const choresForDate = data?.Chores || [];
            const entriesForDate = data?.Entries || [];
            const dailyChoreIds = new Set(
              choresForDate.filter((chore) => chore.Type === "Daily").map((chore) => chore.Id)
            );
            const total = dailyChoreIds.size;
            const done = entriesForDate.filter(
              (entry) => entry.Status === "Approved" && dailyChoreIds.has(entry.ChoreId)
            ).length;
            return [dateValue, { done, total }];
          } catch (err) {
            return null;
          }
        })
      );
      if (cancelled) {
        return;
      }
      const next = {};
      results.forEach((result) => {
        if (!result) {
          return;
        }
        const [dateValue, summary] = result;
        next[dateValue] = summary;
      });
      if (Object.keys(next).length) {
        setDailySummaryByDate((prev) => ({ ...prev, ...next }));
      }
    };
    loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  useEffect(() => {
    if (!showLogModal) {
      return;
    }
    setLogError("");
    setShowNotes(false);
    setChoreSearch("");
  }, [showLogModal]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (activeFilter === "pending") {
        return entry.Status === "Pending";
      }
      if (activeFilter === "all") {
        return true;
      }
      return entry.ChoreType === activeFilter;
    });
  }, [entries, activeFilter]);

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries];
    sorted.sort((a, b) => {
      const aDate = ParseDateValue(a.EntryDate)?.getTime() ?? 0;
      const bDate = ParseDateValue(b.EntryDate)?.getTime() ?? 0;
      if (aDate !== bDate) {
        return bDate - aDate;
      }
      const aTime = new Date(a.CreatedAt).getTime();
      const bTime = new Date(b.CreatedAt).getTime();
      return bTime - aTime;
    });
    return sorted;
  }, [filteredEntries]);

  const groupedEntries = useMemo(() => {
    const groups = [];
    sortedEntries.forEach((entry) => {
      const dateKey = entry.EntryDate || "";
      const label = dateKey ? FormatDate(dateKey) : "";
      const existing = groups.find((group) => group.DateKey === dateKey);
      if (existing) {
        existing.Items.push(entry);
      } else {
        groups.push({ Label: label, DateKey: dateKey, Items: [entry] });
      }
    });
    return groups;
  }, [sortedEntries]);

  const filteredChores = useMemo(() => {
    const query = choreSearch.trim().toLowerCase();
    if (!query) {
      return chores;
    }
    return chores.filter((chore) => chore.Label.toLowerCase().includes(query));
  }, [choreSearch, chores]);

  const useSearchPicker = chores.length > 8;
  const isSaving = logStatus === "saving";
  const canLogPast = Boolean(maxPastDate);

  const onOpenLogModal = () => {
    const defaultDate = maxPastDate || allowedStart || "";
    setLogForm({ ChoreId: "", EntryDate: defaultDate, Notes: "" });
    setShowLogModal(true);
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setLogForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSelectChore = (choreId) => {
    setLogForm((prev) => ({ ...prev, ChoreId: String(choreId) }));
  };

  const onToggleDate = (dateKey) => {
    if (!dateKey) {
      return;
    }
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const isBackdated =
    logForm.EntryDate && today && IsBeforeDate(logForm.EntryDate, today);

  const onSubmitLog = async (event) => {
    event.preventDefault();
    if (!logForm.ChoreId || !logForm.EntryDate) {
      setLogError("Pick a chore and date.");
      return;
    }
    if (today && !IsBeforeDate(logForm.EntryDate, today)) {
      setLogError("Pick a past date.");
      return;
    }
    setLogStatus("saving");
    setLogError("");
    try {
      await CreateKidsChoreEntry({
        ChoreId: Number(logForm.ChoreId),
        EntryDate: logForm.EntryDate,
        Notes: logForm.Notes || null
      });
      setShowLogModal(false);
      setToast("Sent for approval");
      await loadHistory();
    } catch (err) {
      setLogError(err?.message || "Unable to save chore entry.");
    } finally {
      setLogStatus("ready");
    }
  };

  return (
    <div className="kids-history-page">
      <header className="kids-history-appbar">
        <h2>{GetKidsHeaderEmoji("History")} History</h2>
        <button
          type="button"
          className="kids-appbar-button kids-appbar-pill"
          onClick={() => navigate("/kids")}
        >
          <Icon name="chevronLeft" className="icon" />
          Back
        </button>
      </header>

      {toast ? (
        <div className="kids-toast" role="status" aria-live="polite">
          <span>{toast}</span>
        </div>
      ) : null}

      <div className="kids-history-toolbar">
        <div className="kids-filter-row">
          {Filters.map((filter) => (
            <button
              key={filter.Key}
              type="button"
              className={`kids-pill${activeFilter === filter.Key ? " is-active" : ""}`}
              onClick={() => setActiveFilter(filter.Key)}
            >
              {filter.Label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="kids-primary-button kids-history-log-button"
          onClick={onOpenLogModal}
          disabled={!canLogPast}
        >
          Log past day
        </button>
      </div>

      {status === "loading" ? (
        <div className="kids-history-skeleton">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="kids-skeleton-row" />
          ))}
        </div>
      ) : null}

      {error ? <p className="kids-error">{error}</p> : null}

      {status !== "loading" && !error && sortedEntries.length === 0 ? (
        <div className="kids-history-empty">
          <p className="kids-muted">No history entries yet.</p>
        </div>
      ) : null}

      <div className="kids-history-list">
        {groupedEntries.map((group) => {
          const summary = group.DateKey ? dailySummaryByDate[group.DateKey] : null;
          const summaryText = summary
            ? summary.total > 0
              ? `${summary.done}/${summary.total} daily jobs done`
              : "No daily jobs"
            : "";
          const isComplete = summary && summary.total > 0 && summary.done === summary.total;
          const isIncomplete =
            summary && (summary.total === 0 || summary.done < summary.total);
          const isExpanded = group.DateKey ? expandedDates.has(group.DateKey) : true;
          return (
          <div key={group.DateKey || group.Label || "Unknown"} className="kids-history-group">
            <button
              type="button"
              className={`kids-history-date-row${
                isComplete ? " is-complete" : isIncomplete ? " is-incomplete" : ""
              }`}
              onClick={() => onToggleDate(group.DateKey)}
              aria-expanded={isExpanded}
            >
              <span className="kids-history-date">{group.Label}</span>
              {summaryText ? (
                <span className="kids-history-date-meta">{summaryText}</span>
              ) : null}
              <span className={`kids-history-date-chevron${isExpanded ? " is-open" : ""}`}>
                <Icon name="chevronDown" className="icon" />
              </span>
            </button>
            {isExpanded ? (
              <div className="kids-history-group-list">
                {group.Items.map((entry) => {
                const isExpanded = expandedId === entry.Id;
                const timeLabel = entry.CreatedAt ? FormatTime(entry.CreatedAt) : "-";
                const statusLabel = StatusLabel(entry.Status);
                const typeLabel = TypeLabel(entry.ChoreType);
                return (
                  <div key={entry.Id} className="kids-history-item">
                    <button
                      type="button"
                      className={`kids-history-row${isExpanded ? " is-expanded" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : entry.Id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="kids-history-row-main">
                        <span className="kids-history-title">
                          {GetChoreEmoji({ Id: entry.ChoreId, Type: entry.ChoreType })}{" "}
                          {entry.ChoreLabel}
                        </span>
                      </div>
                      <span className={`kids-history-chevron${isExpanded ? " is-open" : ""}`}>
                        <Icon name="chevronDown" className="icon" />
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="kids-history-details">
                        <div className="kids-history-detail-row">
                          <span className="kids-history-detail-label">Notes</span>
                          <span>{entry.Notes || "None"}</span>
                        </div>
                        <div className="kids-history-detail-row">
                          <span className="kids-history-detail-label">Logged</span>
                          <span>
                            {entry.CreatedAt
                              ? `${FormatDate(entry.CreatedAt)} ${timeLabel}`
                              : timeLabel}
                          </span>
                        </div>
                        <div className="kids-history-detail-row">
                          <span className="kids-history-detail-label">Type</span>
                          <span>{typeLabel}</span>
                        </div>
                        <div className="kids-history-detail-row">
                          <span className="kids-history-detail-label">Status</span>
                          <span>{statusLabel || "-"}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              </div>
            ) : null}
          </div>
        );})}
      </div>

      {showLogModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLogModal(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Log a chore</h3>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowLogModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-log-form" onSubmit={onSubmitLog}>
                <div className="kids-log-section">
                  <span className="kids-log-label">Chore</span>
                  {useSearchPicker ? (
                    <div className="kids-chore-picker">
                      <label className="kids-chore-search">
                        <Icon name="search" className="icon" />
                        <input
                          type="text"
                          placeholder="Search chores"
                          value={choreSearch}
                          onChange={(event) => setChoreSearch(event.target.value)}
                          aria-label="Search chores"
                        />
                      </label>
                      <div className="kids-chore-list">
                        {filteredChores.length === 0 ? (
                          <p className="kids-muted">No chores match your search.</p>
                        ) : (
                          filteredChores.map((chore) => (
                            <button
                              key={chore.Id}
                              type="button"
                              className={`kids-chore-row${
                                logForm.ChoreId === String(chore.Id) ? " is-selected" : ""
                              }`}
                              onClick={() => onSelectChore(chore.Id)}
                              aria-pressed={logForm.ChoreId === String(chore.Id)}
                            >
                              <span>{chore.Label}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="kids-chore-grid">
                      {chores.length === 0 ? (
                        <p className="kids-muted">No chores assigned yet.</p>
                      ) : (
                        chores.map((chore) => (
                          <button
                            key={chore.Id}
                            type="button"
                            className={`kids-chore-button${
                              logForm.ChoreId === String(chore.Id) ? " is-selected" : ""
                            }`}
                            onClick={() => onSelectChore(chore.Id)}
                            aria-pressed={logForm.ChoreId === String(chore.Id)}
                          >
                            <span>{chore.Label}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="kids-log-section">
                  <label className="kids-log-label">
                    <span>Date</span>
                    <input
                      type="date"
                      name="EntryDate"
                      value={logForm.EntryDate}
                      min={allowedStart}
                      max={maxPastDate}
                      onChange={onFormChange}
                    />
                  </label>
                  {isBackdated ? (
                    <span className="kids-pill kids-pill--muted">Needs parent approval</span>
                  ) : null}
                </div>

                <div className="kids-log-section">
                  {!showNotes ? (
                    <button
                      type="button"
                      className="kids-note-toggle"
                      onClick={() => setShowNotes(true)}
                    >
                      Add a note
                    </button>
                  ) : (
                    <label className="kids-log-label">
                      Notes
                      <textarea
                        name="Notes"
                        rows={3}
                        value={logForm.Notes}
                        onChange={onFormChange}
                      />
                    </label>
                  )}
                </div>

                <div className="kids-log-actions">
                  <button type="submit" disabled={!logForm.ChoreId || isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
              {logError ? <p className="kids-error">{logError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KidsHistory;
