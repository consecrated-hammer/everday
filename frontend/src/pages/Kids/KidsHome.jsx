import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  CreateKidsChoreEntry,
  FetchKidsChoreEntries,
  FetchKidsLedger,
  FetchKidsSummary
} from "../../lib/kidsApi.js";
import { FormatCurrency } from "../../lib/formatters.js";
import Icon from "../../components/Icon.jsx";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BuildToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);
};

const DisplayEntryType = (entryType) => {
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

const KidsHome = () => {
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ChoreId: "", EntryDate: BuildToday(), Notes: "" });
  const [showChoreModal, setShowChoreModal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [choreSearch, setChoreSearch] = useState("");
  const [rangeKey, setRangeKey] = useState("7d");

  const chores = summary?.AssignedChores || [];
  const balance = summary?.Balance ?? 0;

  const loadData = async () => {
    setStatus("loading");
    setError("");
    try {
      const [summaryData, entriesData, ledgerData] = await Promise.all([
        FetchKidsSummary(),
        FetchKidsChoreEntries(60, false),
        FetchKidsLedger(300)
      ]);
      setSummary(summaryData);
      setEntries(entriesData || []);
      setLedgerEntries(ledgerData?.Entries || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load kids summary.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showChoreModal) {
      return;
    }
    setError("");
    setShowNotes(false);
    setChoreSearch("");
  }, [showChoreModal]);

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSelectChore = (choreId) => {
    setForm((prev) => ({ ...prev, ChoreId: String(choreId) }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.ChoreId) {
      setError("Pick a chore to log.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await CreateKidsChoreEntry({
        ChoreId: Number(form.ChoreId),
        EntryDate: form.EntryDate,
        Notes: form.Notes || null
      });
      setForm((prev) => ({ ...prev, Notes: "" }));
      setShowChoreModal(false);
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save chore entry.");
    } finally {
      setStatus("ready");
    }
  };

  const recentChoreIds = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
    );
    const seen = new Set();
    const ids = [];
    sorted.forEach((entry) => {
      if (!seen.has(entry.ChoreId)) {
        seen.add(entry.ChoreId);
        ids.push(entry.ChoreId);
      }
    });
    return ids.slice(0, 6);
  }, [entries]);

  const recentChores = useMemo(() => {
    if (recentChoreIds.length === 0) {
      return [];
    }
    const choreMap = new Map(chores.map((chore) => [chore.Id, chore]));
    return recentChoreIds.map((id) => choreMap.get(id)).filter(Boolean);
  }, [chores, recentChoreIds]);

  const filteredChores = useMemo(() => {
    const query = choreSearch.trim().toLowerCase();
    if (!query) {
      return chores;
    }
    return chores.filter((chore) => chore.Label.toLowerCase().includes(query));
  }, [choreSearch, chores]);

  const isSaving = status === "saving";
  const selectedChoreId = form.ChoreId ? Number(form.ChoreId) : null;
  const useSearchPicker = chores.length > 8;
  const rangeOptions = [
    { Key: "7d", Label: "7d", Days: 7 },
    { Key: "30d", Label: "30d", Days: 30 },
    { Key: "90d", Label: "90d", Days: 90 }
  ];

  const BuildDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const rangeWindow = useMemo(() => {
    const match = rangeOptions.find((option) => option.Key === rangeKey) || rangeOptions[0];
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(end.getDate() - (match.Days - 1));
    return { start, end };
  }, [rangeKey]);

  const rangeDates = useMemo(() => {
    const dates = [];
    const cursor = new Date(rangeWindow.start);
    while (cursor <= rangeWindow.end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [rangeWindow]);

  const rangeEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      const entryDate = entry.EntryDate ? new Date(entry.EntryDate) : null;
      const created = entry.CreatedAt ? new Date(entry.CreatedAt) : null;
      const date = entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : created;
      if (!date || Number.isNaN(date.getTime())) {
        return false;
      }
      return date >= rangeWindow.start && date <= rangeWindow.end;
    });
  }, [ledgerEntries, rangeWindow]);

  const totalsByDate = useMemo(() => {
    const totals = new Map();
    rangeEntries.forEach((entry) => {
      const entryDate = entry.EntryDate ? new Date(entry.EntryDate) : null;
      const created = entry.CreatedAt ? new Date(entry.CreatedAt) : null;
      const date = entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : created;
      if (!date || Number.isNaN(date.getTime())) {
        return;
      }
      const key = BuildDateKey(date);
      const amount = Number(entry.Amount) || 0;
      totals.set(key, (totals.get(key) || 0) + amount);
    });
    return totals;
  }, [rangeEntries]);

  const summaryByDate = useMemo(() => {
    const summaryMap = new Map();
    rangeEntries.forEach((entry) => {
      const entryDate = entry.EntryDate ? new Date(entry.EntryDate) : null;
      const created = entry.CreatedAt ? new Date(entry.CreatedAt) : null;
      const date = entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : created;
      if (!date || Number.isNaN(date.getTime())) {
        return;
      }
      const key = BuildDateKey(date);
      const label = DisplayEntryType(entry.EntryType);
      const amount = Number(entry.Amount) || 0;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, new Map());
      }
      const typeTotals = summaryMap.get(key);
      typeTotals.set(label, (typeTotals.get(label) || 0) + amount);
    });
    const formattedMap = new Map();
    summaryMap.forEach((typeTotals, key) => {
      const rows = [...typeTotals.entries()]
        .filter(([, amount]) => amount !== 0)
        .map(([label, amount]) => ({ Label: label, Amount: amount }))
        .sort((a, b) => Math.abs(b.Amount) - Math.abs(a.Amount));
      if (rows.length) {
        formattedMap.set(key, rows);
      }
    });
    return formattedMap;
  }, [rangeEntries]);

  const balanceSeries = useMemo(() => {
    let running = balance;
    const balanceByDate = new Map();
    const datesDesc = [...rangeDates].sort((a, b) => b - a);
    datesDesc.forEach((date) => {
      const key = BuildDateKey(date);
      balanceByDate.set(key, running);
      running -= totalsByDate.get(key) || 0;
    });
    return rangeDates.map((date) => {
      const key = BuildDateKey(date);
      return {
        DateKey: key,
        DateLabel: date.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
        Balance: balanceByDate.get(key) ?? 0
      };
    });
  }, [balance, rangeDates, totalsByDate]);

  const FormatSigned = (amount) => {
    if (amount > 0) {
      return `+${FormatCurrency(amount)}`;
    }
    return FormatCurrency(amount);
  };

  const renderChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
      return null;
    }
    const datum = payload[0].payload;
    const summary = summaryByDate.get(datum.DateKey);
    return (
      <div className="kids-chart-tooltip">
        <div className="kids-chart-tooltip-date">{datum.DateLabel}</div>
        <div className="kids-chart-tooltip-balance">{FormatCurrency(datum.Balance)}</div>
        {summary ? (
          <div className="kids-chart-tooltip-list">
            {summary.map((row) => (
              <div className="kids-chart-tooltip-row" key={row.Label}>
                <span>{row.Label}</span>
                <span
                  className={`kids-chart-tooltip-amount${
                    row.Amount < 0 ? " is-negative" : " is-positive"
                  }`}
                >
                  {FormatSigned(row.Amount)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const earnedTotal = useMemo(() => {
    return rangeEntries.reduce((sum, entry) => {
      if (entry.EntryType !== "Chore") {
        return sum;
      }
      const amount = Number(entry.Amount) || 0;
      return amount > 0 ? sum + amount : sum;
    }, 0);
  }, [rangeEntries]);

  const spentTotal = useMemo(() => {
    const withdrawals = rangeEntries.filter(
      (entry) => entry.EntryType === "Withdrawal" && Number(entry.Amount) < 0
    );
    const source = withdrawals.length
      ? withdrawals
      : rangeEntries.filter((entry) => entry.EntryType !== "Chore" && Number(entry.Amount) < 0);
    return source.reduce((sum, entry) => sum + Math.abs(Number(entry.Amount) || 0), 0);
  }, [rangeEntries]);

  const BuildHistoryLink = (type) =>
    `/kids/history?range=${encodeURIComponent(rangeKey)}&type=${encodeURIComponent(type)}`;

  return (
    <div className="kids-home">
      <section className="kids-card kids-log-card">
        <button
          type="button"
          className="kids-card-button"
          onClick={() => setShowChoreModal(true)}
        >
          Log a chore
        </button>
      </section>

      <section className="kids-card kids-balance">
        <p className="kids-label">Available now</p>
        <h2 className="kids-balance-value">{FormatCurrency(balance)}</h2>
        <div className="kids-balance-chart" aria-label="Balance history">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={balanceSeries}>
              <XAxis
                dataKey="DateLabel"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
                tick={{ fontSize: 12, fill: "var(--kids-muted)" }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: "rgba(241, 138, 77, 0.25)", strokeWidth: 1 }}
                content={renderChartTooltip}
              />
              <Line
                type="monotone"
                dataKey="Balance"
                stroke="#f18a4d"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="kids-balance-summary">
          <div className="kids-range-toggle" role="group" aria-label="Select range">
            {rangeOptions.map((option) => (
              <button
                key={option.Key}
                type="button"
                className={`kids-range-button${rangeKey === option.Key ? " is-active" : ""}`}
                onClick={() => setRangeKey(option.Key)}
              >
                {option.Label}
              </button>
            ))}
          </div>
          <div className="kids-io-chips">
            <Link to={BuildHistoryLink("Chore")} className="kids-io-chip is-earned">
              Earned +{FormatCurrency(earnedTotal)}
            </Link>
            <Link to={BuildHistoryLink("Spent")} className="kids-io-chip is-spent">
              Spent -{FormatCurrency(spentTotal)}
            </Link>
          </div>
        </div>
      </section>

      <div className="kids-secondary-nav">
        <Link to="/kids/history" className="kids-outline-button">
          History
        </Link>
      </div>

      {error && !showChoreModal ? <p className="kids-error">{error}</p> : null}

      {showChoreModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowChoreModal(false)}
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
                  onClick={() => setShowChoreModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-log-form" onSubmit={onSubmit}>
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
                      {recentChores.length ? (
                        <div className="kids-chore-section">
                          <span className="kids-chore-section-title">Recent</span>
                          <div className="kids-chore-grid">
                            {recentChores.map((chore) => (
                              <button
                                key={`recent-${chore.Id}`}
                                type="button"
                                className={`kids-chore-button${
                                  selectedChoreId === chore.Id ? " is-selected" : ""
                                }`}
                                onClick={() => onSelectChore(chore.Id)}
                                aria-pressed={selectedChoreId === chore.Id}
                              >
                                <span>{chore.Label}</span>
                                <span>{FormatCurrency(chore.Amount)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="kids-chore-section">
                        <span className="kids-chore-section-title">All chores</span>
                        <div className="kids-chore-list">
                          {filteredChores.length === 0 ? (
                            <p className="kids-muted">No chores match your search.</p>
                          ) : (
                            filteredChores.map((chore) => (
                              <button
                                key={chore.Id}
                                type="button"
                                className={`kids-chore-row${
                                  selectedChoreId === chore.Id ? " is-selected" : ""
                                }`}
                                onClick={() => onSelectChore(chore.Id)}
                                aria-pressed={selectedChoreId === chore.Id}
                              >
                                <span>{chore.Label}</span>
                                <span>{FormatCurrency(chore.Amount)}</span>
                              </button>
                            ))
                          )}
                        </div>
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
                              selectedChoreId === chore.Id ? " is-selected" : ""
                            }`}
                            onClick={() => onSelectChore(chore.Id)}
                            aria-pressed={selectedChoreId === chore.Id}
                          >
                            <span>{chore.Label}</span>
                            <span>{FormatCurrency(chore.Amount)}</span>
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
                      value={form.EntryDate}
                      onChange={onFormChange}
                    />
                  </label>
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
                        value={form.Notes}
                        onChange={onFormChange}
                      />
                    </label>
                  )}
                </div>

                <div className="kids-log-actions">
                  <button type="submit" disabled={!form.ChoreId || isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
              {error ? <p className="kids-error">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KidsHome;
