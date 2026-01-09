import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { FetchKidsLedger } from "../../lib/kidsApi.js";
import { FormatCurrency, FormatDate, FormatTime } from "../../lib/formatters.js";
import Icon from "../../components/Icon.jsx";

const DisplayType = (entryType) => {
  switch (entryType) {
    case "Chore":
      return "Chore";
    case "Withdrawal":
      return "Spent";
    case "StartingBalance":
      return "Adjustment";
    case "Deposit":
    case "PocketMoney":
      return "Parent added";
    default:
      return "Update";
  }
};

const BuildEntryDateTime = (entry) => {
  const created = entry.CreatedAt ? new Date(entry.CreatedAt) : null;
  if (created && !Number.isNaN(created.getTime())) {
    return created;
  }
  const entryDate = entry.EntryDate ? new Date(entry.EntryDate) : null;
  if (entryDate && !Number.isNaN(entryDate.getTime())) {
    return entryDate;
  }
  return new Date();
};

const BuildDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (dateStart.getTime() === todayStart.getTime()) {
    return "Today";
  }
  if (dateStart.getTime() === yesterdayStart.getTime()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
};

const DefaultFilters = {
  From: "",
  To: "",
  Type: "all",
  Sort: "desc"
};

const KidsHistory = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initFromParams = useRef(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [filters, setFilters] = useState(DefaultFilters);
  const [draftFilters, setDraftFilters] = useState(DefaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadLedger = async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await FetchKidsLedger(200);
      setEntries(data?.Entries || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load history.");
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  useEffect(() => {
    if (initFromParams.current) {
      return;
    }
    const range = searchParams.get("range");
    const type = searchParams.get("type");
    const nextFilters = { ...DefaultFilters };
    const ranges = { "7d": 7, "30d": 30, "90d": 90 };
    if (range && ranges[range]) {
      const days = ranges[range];
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(end);
      start.setDate(end.getDate() - (days - 1));
      nextFilters.From = start.toISOString().slice(0, 10);
      nextFilters.To = end.toISOString().slice(0, 10);
    }
    if (type) {
      nextFilters.Type = type;
    }
    if (nextFilters.From || nextFilters.To || nextFilters.Type !== "all") {
      setFilters(nextFilters);
      setDraftFilters(nextFilters);
    }
    initFromParams.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!showFilters) {
      return;
    }
    setDraftFilters(filters);
  }, [showFilters, filters]);

  useEffect(() => {
    setExpandedId(null);
  }, [filters, entries]);

  const filtersActive =
    filters.From || filters.To || filters.Type !== "all" || filters.Sort !== "desc";

  const typeOptions = useMemo(() => {
    const order = ["Chore", "Parent added", "Spent", "Adjustment", "Update"];
    const available = new Set(entries.map((entry) => DisplayType(entry.EntryType)));
    const options = order.filter((type) => available.has(type));
    if (filters.Type !== "all" && !options.includes(filters.Type)) {
      options.unshift(filters.Type);
    }
    return options;
  }, [entries, filters.Type]);

  const filteredEntries = useMemo(() => {
    const fromDate = filters.From ? new Date(filters.From) : null;
    const toDate = filters.To ? new Date(filters.To) : null;
    if (fromDate) {
      fromDate.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }
    return entries.filter((entry) => {
      if (filters.Type !== "all" && DisplayType(entry.EntryType) !== filters.Type) {
        return false;
      }
      const entryDate = BuildEntryDateTime(entry);
      if (fromDate && entryDate < fromDate) {
        return false;
      }
      if (toDate && entryDate > toDate) {
        return false;
      }
      return true;
    });
  }, [entries, filters]);

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries];
    sorted.sort((a, b) => {
      const aTime = BuildEntryDateTime(a).getTime();
      const bTime = BuildEntryDateTime(b).getTime();
      return filters.Sort === "asc" ? aTime - bTime : bTime - aTime;
    });
    return sorted;
  }, [filteredEntries, filters.Sort]);

  const groupedEntries = useMemo(() => {
    const groups = [];
    sortedEntries.forEach((entry) => {
      const date = BuildEntryDateTime(entry);
      const label = BuildDateLabel(date) || FormatDate(date);
      const existing = groups.find((group) => group.Label === label);
      if (existing) {
        existing.Items.push(entry);
      } else {
        groups.push({ Label: label, Items: [entry] });
      }
    });
    return groups;
  }, [sortedEntries]);

  const onDraftChange = (event) => {
    const { name, value } = event.target;
    setDraftFilters((prev) => ({ ...prev, [name]: value }));
  };

  const onApplyFilters = () => {
    setFilters(draftFilters);
    setShowFilters(false);
  };

  const onClearFilters = () => {
    setFilters(DefaultFilters);
    setDraftFilters(DefaultFilters);
  };

  const amountLabel = (amount) => {
    if (amount === 0) {
      return FormatCurrency(0);
    }
    const formatted = FormatCurrency(Math.abs(amount));
    return amount > 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="kids-history-page">
      <header className="kids-history-appbar">
        <button
          type="button"
          className="kids-appbar-button"
          onClick={() => navigate("/kids")}
        >
          <Icon name="chevronLeft" className="icon" />
          Back
        </button>
        <h2>History</h2>
        <button
          type="button"
          className="kids-appbar-button is-primary"
          onClick={() => setShowFilters(true)}
        >
          <Icon name="filter" className="icon" />
          Filter
        </button>
      </header>

      {filtersActive ? (
        <div className="kids-filter-pill">
          <span>Filters active</span>
          <button type="button" onClick={onClearFilters}>
            Clear
          </button>
        </div>
      ) : null}

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
          <p className="kids-muted">
            {filtersActive ? "No entries match your filters." : "No history entries yet."}
          </p>
          {filtersActive ? (
            <button type="button" className="kids-outline-button" onClick={onClearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="kids-history-list">
        {groupedEntries.map((group) => (
          <div key={group.Label || "Unknown"} className="kids-history-group">
            <div className="kids-history-date">{group.Label}</div>
            <div className="kids-history-group-list">
              {group.Items.map((entry) => {
                const isExpanded = expandedId === entry.Id;
                const timeLabel = entry.CreatedAt ? FormatTime(entry.CreatedAt) : "-";
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
                          {entry.Narrative || DisplayType(entry.EntryType)}
                        </span>
                        <span className="kids-history-time">{timeLabel}</span>
                      </div>
                      <div className="kids-history-row-meta">
                        <span className={`kids-history-amount${entry.Amount < 0 ? " is-negative" : ""}`}>
                          {amountLabel(entry.Amount)}
                        </span>
                        <span className="kids-history-chip">{DisplayType(entry.EntryType)}</span>
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
                          <span className="kids-history-detail-label">Type</span>
                          <span>{DisplayType(entry.EntryType)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {showFilters ? (
        <div
          className="kids-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowFilters(false)}
        >
          <div className="kids-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="kids-sheet-header">
              <h3>Filter history</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
              >
                <Icon name="close" className="icon" />
              </button>
            </div>
            <div className="kids-sheet-body">
              <label>
                <span>From</span>
                <input type="date" name="From" value={draftFilters.From} onChange={onDraftChange} />
              </label>
              <label>
                <span>To</span>
                <input type="date" name="To" value={draftFilters.To} onChange={onDraftChange} />
              </label>
              <label>
                <span>Type</span>
                <select name="Type" value={draftFilters.Type} onChange={onDraftChange}>
                  <option value="all">All types</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select name="Sort" value={draftFilters.Sort} onChange={onDraftChange}>
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </label>
            </div>
            <div className="kids-sheet-actions">
              <button type="button" className="kids-outline-button" onClick={onClearFilters}>
                Clear
              </button>
              <button type="button" className="kids-primary-button" onClick={onApplyFilters}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KidsHistory;
