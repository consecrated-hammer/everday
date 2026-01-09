import { useEffect, useMemo, useRef, useState } from "react";

import {
  CreateKidDeposit,
  CreateKidStartingBalance,
  CreateKidWithdrawal,
  CreateParentChore,
  DeleteParentChore,
  FetchKidLedger,
  FetchLinkedKids,
  FetchParentChores,
  FetchPocketMoneyRule,
  SetChoreAssignments,
  UpdateParentChore,
  UpdatePocketMoneyRule
} from "../../lib/kidsApi.js";
import { FormatCurrency, FormatDate, FormatTime } from "../../lib/formatters.js";
import Icon from "../../components/Icon.jsx";

const BuildToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);
};

const EmptyTransaction = () => ({
  Type: "Deposit",
  Amount: "",
  EntryDate: BuildToday(),
  Narrative: "",
  Notes: ""
});

const EmptyRule = () => ({
  Amount: "",
  Frequency: "weekly",
  DayOfWeek: "0",
  DayOfMonth: "1",
  StartDate: BuildToday(),
  IsActive: true,
  LastPostedOn: null
});

const KidsAdmin = () => {
  const [kids, setKids] = useState([]);
  const [kidLedgers, setKidLedgers] = useState({});
  const [kidRules, setKidRules] = useState({});
  const [transactionForms, setTransactionForms] = useState({});
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeKidId, setActiveKidId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [choreForm, setChoreForm] = useState({ Label: "", Amount: "", KidUserIds: [] });
  const [showChoreModal, setShowChoreModal] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [chores, setChores] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilterKid, setHistoryFilterKid] = useState("all");
  const [historyFilterType, setHistoryFilterType] = useState("all");
  const [historyShowDeleted, setHistoryShowDeleted] = useState(false);
  const [historyFilterOpen, setHistoryFilterOpen] = useState(false);
  const [historySort, setHistorySort] = useState({ Key: "When", Direction: "desc" });
  const historyFilterRef = useRef(null);

  const loadData = async () => {
    setStatus("loading");
    setError("");
    try {
      const kidsList = await FetchLinkedKids();
      setKids(kidsList);

      const ledgerResults = await Promise.all(
        kidsList.map((kid) => FetchKidLedger(kid.KidUserId, 500))
      );
      const ledgerMap = {};
      kidsList.forEach((kid, index) => {
        ledgerMap[kid.KidUserId] = ledgerResults[index];
      });
      setKidLedgers(ledgerMap);

      const ruleResults = await Promise.all(
        kidsList.map((kid) => FetchPocketMoneyRule(kid.KidUserId))
      );
      const ruleMap = {};
      kidsList.forEach((kid, index) => {
        const rule = ruleResults[index];
        ruleMap[kid.KidUserId] = rule
          ? {
              Amount: String(rule.Amount || ""),
              Frequency: rule.Frequency || "weekly",
              DayOfWeek: rule.DayOfWeek !== null && rule.DayOfWeek !== undefined ? String(rule.DayOfWeek) : "0",
              DayOfMonth: rule.DayOfMonth ? String(rule.DayOfMonth) : "1",
              StartDate: rule.StartDate || BuildToday(),
              IsActive: rule.IsActive !== false,
              LastPostedOn: rule.LastPostedOn || null
            }
          : EmptyRule();
      });
      setKidRules(ruleMap);

      const formMap = {};
      kidsList.forEach((kid) => {
        formMap[kid.KidUserId] = EmptyTransaction();
      });
      setTransactionForms(formMap);

      const choreList = await FetchParentChores();
      setChores(choreList || []);

      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load kids data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (kids.length === 0) {
      setActiveKidId(null);
      return;
    }
    if (!activeKidId || !kids.some((kid) => kid.KidUserId === activeKidId)) {
      setActiveKidId(kids[0].KidUserId);
    }
  }, [kids, activeKidId]);

  useEffect(() => {
    setShowTransactionModal(false);
    setShowScheduleModal(false);
    setShowChoreModal(false);
    setEditingChore(null);
  }, [activeKidId]);

  useEffect(() => {
    if (activeKidId) {
      setHistoryFilterKid(String(activeKidId));
    }
  }, [activeKidId]);

  useEffect(() => {
    if (!historyFilterOpen) {
      return;
    }
    const handleClick = (event) => {
      if (!historyFilterRef.current) {
        return;
      }
      if (!historyFilterRef.current.contains(event.target)) {
        setHistoryFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [historyFilterOpen]);

  const kidOptions = useMemo(
    () =>
      kids.map((kid) => ({
        Id: kid.KidUserId,
        Name: kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`
      })),
    [kids]
  );

  const activeKid = useMemo(
    () => kids.find((kid) => kid.KidUserId === activeKidId) || null,
    [kids, activeKidId]
  );

  const activeKidName = activeKid ? activeKid.FirstName || activeKid.Username : "Kid";
  const activeKidLedger = activeKid ? kidLedgers[activeKid.KidUserId] : null;
  const activeRule = activeKid ? kidRules[activeKid.KidUserId] || EmptyRule() : EmptyRule();
  const activeForm = activeKid ? transactionForms[activeKid.KidUserId] || EmptyTransaction() : EmptyTransaction();
  const isBalanceAdjustment = activeForm.Type === "StartingBalance";
  const isEditingChore = Boolean(editingChore);

  const latestEntry = useMemo(() => {
    if (!activeKidLedger?.Entries?.length) {
      return null;
    }
    return [...activeKidLedger.Entries].sort(
      (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
    )[0];
  }, [activeKidLedger]);

  const latestEntryLabel = latestEntry
    ? `${FormatDate(latestEntry.CreatedAt)} · ${FormatTime(latestEntry.CreatedAt)}`
    : "-";
  const latestEnteredBy = latestEntry?.CreatedByName || (latestEntry ? `User ${latestEntry.CreatedByUserId}` : "-");

  const NormalizeDate = (value) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };

  const AddDays = (value, days) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };

  const DaysInMonth = (year, monthIndex) => {
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  const WeekdayIndex = (value) => {
    return (value.getDay() + 6) % 7;
  };

  const NextWeekly = (afterDate, dayOfWeek) => {
    const delta = (dayOfWeek - WeekdayIndex(afterDate) + 7) % 7;
    return AddDays(afterDate, delta === 0 ? 7 : delta);
  };

  const NextFortnightly = (afterDate, anchorDate) => {
    if (afterDate < anchorDate) {
      return anchorDate;
    }
    const deltaDays = Math.floor((afterDate - anchorDate) / 86400000);
    const remainder = deltaDays % 14;
    if (remainder === 0) {
      return AddDays(afterDate, 14);
    }
    return AddDays(afterDate, 14 - remainder);
  };

  const NextMonthly = (afterDate, dayOfMonth) => {
    const year = afterDate.getFullYear();
    const monthIndex = afterDate.getMonth() + 1;
    const targetYear = monthIndex > 11 ? year + 1 : year;
    const targetMonth = monthIndex > 11 ? 0 : monthIndex;
    const day = Math.min(dayOfMonth, DaysInMonth(targetYear, targetMonth));
    return new Date(targetYear, targetMonth, day);
  };

  const FirstMonthly = (startDate, dayOfMonth) => {
    const day = Math.min(dayOfMonth, DaysInMonth(startDate.getFullYear(), startDate.getMonth()));
    const candidate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
    if (candidate < startDate) {
      return NextMonthly(startDate, dayOfMonth);
    }
    return candidate;
  };

  const NextPocketMoneyRun = (rule) => {
    if (!rule || !rule.IsActive || !rule.Amount) {
      return null;
    }
    const startDate = NormalizeDate(rule.StartDate);
    if (!startDate) {
      return null;
    }
    const today = NormalizeDate(new Date());
    const dayOfWeek = Number(rule.DayOfWeek);
    const dayOfMonth = Number(rule.DayOfMonth);
    let nextDate = null;
    let anchorDate = startDate;

    if (rule.Frequency === "weekly") {
      if (Number.isNaN(dayOfWeek)) {
        return null;
      }
      if (rule.LastPostedOn) {
        const lastPosted = NormalizeDate(rule.LastPostedOn);
        nextDate = lastPosted ? NextWeekly(lastPosted, dayOfWeek) : startDate;
      } else {
        nextDate = startDate;
        if (WeekdayIndex(nextDate) !== dayOfWeek) {
          nextDate = NextWeekly(AddDays(nextDate, -1), dayOfWeek);
        }
      }
    } else if (rule.Frequency === "fortnightly") {
      if (Number.isNaN(dayOfWeek)) {
        return null;
      }
      if (WeekdayIndex(anchorDate) !== dayOfWeek) {
        anchorDate = NextWeekly(AddDays(anchorDate, -1), dayOfWeek);
      }
      if (rule.LastPostedOn) {
        const lastPosted = NormalizeDate(rule.LastPostedOn);
        nextDate = lastPosted ? NextFortnightly(lastPosted, anchorDate) : anchorDate;
      } else {
        nextDate = anchorDate;
      }
    } else if (rule.Frequency === "monthly") {
      if (Number.isNaN(dayOfMonth)) {
        return null;
      }
      if (rule.LastPostedOn) {
        const lastPosted = NormalizeDate(rule.LastPostedOn);
        nextDate = lastPosted ? NextMonthly(lastPosted, dayOfMonth) : FirstMonthly(startDate, dayOfMonth);
      } else {
        nextDate = FirstMonthly(startDate, dayOfMonth);
      }
    }

    if (!nextDate) {
      return null;
    }
    while (nextDate < today) {
      if (rule.Frequency === "weekly") {
        nextDate = NextWeekly(nextDate, dayOfWeek);
      } else if (rule.Frequency === "fortnightly") {
        nextDate = NextFortnightly(nextDate, anchorDate);
      } else {
        nextDate = NextMonthly(nextDate, dayOfMonth);
      }
    }
    return nextDate;
  };

  const runningBalanceMap = useMemo(() => {
    const map = new Map();
    kids.forEach((kid) => {
      const ledger = kidLedgers[kid.KidUserId]?.Entries || [];
      const sorted = [...ledger].sort((a, b) => {
        const aDate = new Date(a.EntryDate).getTime();
        const bDate = new Date(b.EntryDate).getTime();
        if (aDate !== bDate) {
          return aDate - bDate;
        }
        const aCreated = new Date(a.CreatedAt).getTime();
        const bCreated = new Date(b.CreatedAt).getTime();
        return aCreated - bCreated;
      });
      let total = 0;
      sorted.forEach((entry) => {
        total += Number(entry.Amount) || 0;
        map.set(entry.Id, total);
      });
    });
    return map;
  }, [kids, kidLedgers]);

  const historyEntries = useMemo(() => {
    return kids.flatMap((kid) => {
      const ledger = kidLedgers[kid.KidUserId]?.Entries || [];
      const kidName = kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`;
      return ledger.map((entry) => ({
        ...entry,
        KidUserId: kid.KidUserId,
        KidName: kidName,
        RunningBalance: runningBalanceMap.get(entry.Id) ?? null,
        CreatedByName: entry.CreatedByName || null
      }));
    });
  }, [kids, kidLedgers, runningBalanceMap]);

  const historyTypes = useMemo(() => {
    const types = new Set();
    historyEntries.forEach((entry) => {
      if (entry.EntryType) {
        types.add(entry.EntryType);
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [historyEntries]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return historyEntries.filter((entry) => {
      if (!historyShowDeleted && entry.IsDeleted) {
        return false;
      }
      if (historyFilterKid !== "all" && String(entry.KidUserId) !== historyFilterKid) {
        return false;
      }
      if (historyFilterType !== "all" && entry.EntryType !== historyFilterType) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        entry.KidName,
        entry.EntryType,
        entry.Narrative,
        entry.Notes,
        entry.CreatedByName,
        String(entry.Amount),
        entry.RunningBalance !== null ? String(entry.RunningBalance) : null,
        FormatCurrency(entry.Amount),
        entry.RunningBalance !== null ? FormatCurrency(entry.RunningBalance) : null,
        FormatDate(entry.EntryDate),
        FormatTime(entry.CreatedAt)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [
    historyEntries,
    historyFilterKid,
    historyFilterType,
    historySearch,
    historyShowDeleted
  ]);

  const BuildEntryDateTime = (entry) => {
    const entryDate = new Date(entry.EntryDate);
    const created = new Date(entry.CreatedAt);
    if (Number.isNaN(entryDate.getTime())) {
      return created;
    }
    if (Number.isNaN(created.getTime())) {
      return entryDate;
    }
    const combined = new Date(entryDate);
    combined.setHours(
      created.getHours(),
      created.getMinutes(),
      created.getSeconds(),
      created.getMilliseconds()
    );
    return combined;
  };

  const sortedHistory = useMemo(() => {
    const sorted = [...filteredHistory];
    const direction = historySort.Direction === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      let valueA = "";
      let valueB = "";
      switch (historySort.Key) {
        case "Kid":
          valueA = a.KidName || "";
          valueB = b.KidName || "";
          break;
        case "Type":
          valueA = a.EntryType || "";
          valueB = b.EntryType || "";
          break;
        case "Narrative":
          valueA = a.Narrative || "";
          valueB = b.Narrative || "";
          break;
        case "EnteredBy":
          valueA = a.CreatedByName || "";
          valueB = b.CreatedByName || "";
          break;
        case "When":
          valueA = BuildEntryDateTime(a).getTime();
          valueB = BuildEntryDateTime(b).getTime();
          break;
        case "Amount":
          valueA = Number(a.Amount) || 0;
          valueB = Number(b.Amount) || 0;
          break;
        case "Balance":
          valueA = Number(a.RunningBalance) || 0;
          valueB = Number(b.RunningBalance) || 0;
          break;
        default:
          valueA = BuildEntryDateTime(a).getTime();
          valueB = BuildEntryDateTime(b).getTime();
      }
      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * direction;
      }
      return String(valueA).localeCompare(String(valueB)) * direction;
    });
    return sorted;
  }, [filteredHistory, historySort]);

  const SetHistorySort = (key) => {
    setHistorySort((prev) => {
      if (prev.Key === key) {
        return { Key: key, Direction: prev.Direction === "asc" ? "desc" : "asc" };
      }
      return { Key: key, Direction: "desc" };
    });
  };

  const HistorySortIcon = ({ columnKey }) => {
    if (historySort.Key !== columnKey) {
      return null;
    }
    return (
      <Icon name={historySort.Direction === "asc" ? "sortUp" : "sortDown"} className="icon" />
    );
  };

  const onTransactionChange = (kidId, event) => {
    const { name, value } = event.target;
    setTransactionForms((prev) => ({
      ...prev,
      [kidId]: { ...prev[kidId], [name]: value }
    }));
  };

  const submitTransaction = async (kidId) => {
    const form = transactionForms[kidId];
    if (!form || !form.Amount || !form.Narrative) {
      setError("Add an amount and a short note.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const payload = {
        Amount: Number(form.Amount),
        EntryDate: form.EntryDate,
        Narrative: form.Narrative,
        Notes: form.Notes || null
      };
      if (form.Type === "Deposit") {
        await CreateKidDeposit(kidId, payload);
      } else if (form.Type === "Withdrawal") {
        await CreateKidWithdrawal(kidId, payload);
      } else {
        await CreateKidStartingBalance(kidId, payload);
      }
      await loadData();
      setShowTransactionModal(false);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to add transaction.");
    } finally {
      setStatus("ready");
    }
  };

  const onRuleChange = (kidId, event) => {
    const { name, value, type, checked } = event.target;
    setKidRules((prev) => ({
      ...prev,
      [kidId]: {
        ...prev[kidId],
        [name]: type === "checkbox" ? checked : value
      }
    }));
  };

  const saveRule = async (kidId) => {
    const rule = kidRules[kidId] || EmptyRule();
    if (!rule.Amount) {
      setError("Set a pocket money amount.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await UpdatePocketMoneyRule(kidId, {
        Amount: Number(rule.Amount),
        Frequency: rule.Frequency,
        DayOfWeek: rule.Frequency !== "monthly" ? Number(rule.DayOfWeek) : null,
        DayOfMonth: rule.Frequency === "monthly" ? Number(rule.DayOfMonth) : null,
        StartDate: rule.StartDate,
        IsActive: rule.IsActive
      });
      await loadData();
      setShowScheduleModal(false);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save pocket money.");
    } finally {
      setStatus("ready");
    }
  };

  const onChoreChange = (event) => {
    const { name, value } = event.target;
    setChoreForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetChoreForm = () => {
    setChoreForm({ Label: "", Amount: "", KidUserIds: [] });
  };

  const openChoreModal = (chore = null) => {
    const assigned = Array.isArray(chore?.AssignedKidIds)
      ? chore.AssignedKidIds.map((kidId) => Number(kidId))
      : [];
    setEditingChore(chore);
    setChoreForm({
      Label: chore?.Label || "",
      Amount: chore?.Amount ? String(chore.Amount) : "",
      KidUserIds: assigned
    });
    setShowChoreModal(true);
  };

  const closeChoreModal = () => {
    setShowChoreModal(false);
    setEditingChore(null);
    resetChoreForm();
  };

  const onChoreKidToggle = (kidId) => {
    setChoreForm((prev) => {
      const nextIds = new Set(prev.KidUserIds);
      if (nextIds.has(kidId)) {
        nextIds.delete(kidId);
      } else {
        nextIds.add(kidId);
      }
      return { ...prev, KidUserIds: Array.from(nextIds) };
    });
  };

  const onSaveChore = async (event) => {
    event.preventDefault();
    if (!choreForm.Label || !choreForm.Amount) {
      setError("Add a chore name and amount.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      if (editingChore) {
        await UpdateParentChore(editingChore.Id, {
          Label: choreForm.Label,
          Amount: Number(choreForm.Amount)
        });
        await SetChoreAssignments(editingChore.Id, { KidUserIds: choreForm.KidUserIds });
      } else {
        const chore = await CreateParentChore({
          Label: choreForm.Label,
          Amount: Number(choreForm.Amount),
          IsActive: true
        });
        if (choreForm.KidUserIds.length > 0) {
          await SetChoreAssignments(chore.Id, { KidUserIds: choreForm.KidUserIds });
        }
      }
      await loadData();
      closeChoreModal();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save chore.");
    } finally {
      setStatus("ready");
    }
  };

  const onDeleteChore = async (chore) => {
    if (!chore) {
      return;
    }
    if (!window.confirm(`Delete "${chore.Label}"?`)) {
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await DeleteParentChore(chore.Id);
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to delete chore.");
    } finally {
      setStatus("ready");
    }
  };

  const pocketNextRun = NextPocketMoneyRun(activeRule);
  const pocketNextLabel = pocketNextRun ? FormatDate(pocketNextRun) : "-";
  const pocketAmountLabel = activeRule?.Amount ? FormatCurrency(activeRule.Amount) : "-";

  return (
    <div className="app-shell app-shell--wide">
      <div className="kids-admin-container">
        <div className="kids-admin">
          <header className="kids-admin-header">
            <div className="kids-admin-header-copy">
              <p className="eyebrow">Kids money</p>
              <h1>Balances, chores, and schedules</h1>
              <p className="lede">Quick visibility without the kids touching the main UI.</p>
              {kids.length ? (
                <div className="kids-admin-switcher">
                  {kids.length <= 4 ? (
                    kids.map((kid) => (
                      <button
                        key={kid.KidUserId}
                        type="button"
                        className={`kids-admin-tab${
                          activeKidId === kid.KidUserId ? " is-active" : ""
                        }`}
                        onClick={() => setActiveKidId(kid.KidUserId)}
                      >
                        {kid.FirstName || kid.Username}
                      </button>
                    ))
                  ) : (
                    <select
                      aria-label="Select kid"
                      value={activeKidId || ""}
                      onChange={(event) => setActiveKidId(Number(event.target.value))}
                    >
                      <option value="" disabled>
                        Select kid
                      </option>
                      {kidOptions.map((kid) => (
                        <option key={kid.Id} value={kid.Id}>
                          {kid.Name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}
            </div>
          </header>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="kids-admin-layout">
            <aside className="kids-admin-rail">
              <section className="kids-admin-card kids-admin-card--balance">
                <div className="kids-admin-card-header">
                  <div>
                    <h3>Balance</h3>
                    <p className="text-muted">{activeKidName}</p>
                  </div>
                  <div className="kids-admin-balance-actions">
                    <div className="kids-admin-balance">
                      {activeKidLedger ? FormatCurrency(activeKidLedger.Balance) : "-"}
                    </div>
                    <button
                      type="button"
                      className="button-secondary-pill"
                      onClick={() => (activeKid ? setShowTransactionModal(true) : null)}
                      disabled={!activeKid}
                    >
                      Add update
                    </button>
                  </div>
                </div>
                <div className="kids-admin-meta">
                  <div className="kids-admin-meta-row">
                    <span>Last update</span>
                    <span>{latestEntryLabel}</span>
                  </div>
                  <div className="kids-admin-meta-row">
                    <span>Entered by</span>
                    <span>{latestEnteredBy}</span>
                  </div>
                </div>
              </section>

              <section className="kids-admin-card">
                <div className="kids-admin-card-header">
                  <div>
                    <h3>Pocket money</h3>
                    <p className="text-muted">Next run and amount.</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary-pill"
                    onClick={() =>
                      activeKid ? setShowScheduleModal(true) : null
                    }
                    disabled={!activeKid}
                  >
                    Edit schedule
                  </button>
                </div>
                <div className="kids-admin-meta">
                  <div className="kids-admin-meta-row">
                    <span>Next run</span>
                    <span>{pocketNextLabel}</span>
                  </div>
                  <div className="kids-admin-meta-row">
                    <span>Amount</span>
                    <span>{pocketAmountLabel}</span>
                  </div>
                </div>
              </section>

              <section className="kids-admin-card kids-admin-card--chores">
                <div className="kids-admin-card-header">
                  <div>
                    <h3>Chores</h3>
                    <p className="text-muted">Rates set once per chore.</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary-pill"
                    onClick={() => openChoreModal()}
                  >
                    Add chore
                  </button>
                </div>
                {chores.length > 0 ? (
                  <div className="kids-admin-mini-table">
                    <div className="kids-admin-mini-row kids-admin-mini-header">
                      <span>Chore</span>
                      <span>Rate</span>
                      <span className="kids-admin-mini-actions">Actions</span>
                    </div>
                    {chores.map((chore) => (
                      <div key={chore.Id} className="kids-admin-mini-row">
                        <span>{chore.Label}</span>
                        <span>{FormatCurrency(chore.Amount)}</span>
                        <span className="kids-admin-mini-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => openChoreModal(chore)}
                            aria-label={`Edit ${chore.Label}`}
                          >
                            <Icon name="edit" className="icon" />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => onDeleteChore(chore)}
                            aria-label={`Delete ${chore.Label}`}
                          >
                            <Icon name="trash" className="icon" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No chores created yet.</p>
                )}
              </section>
            </aside>

            <div className="kids-admin-main">
              <section className="kids-admin-history">
                <div className="kids-admin-card-header">
                  <div>
                    <h2>Full history</h2>
                    <p className="text-muted">Search, filter, and sort every transaction.</p>
                  </div>
                </div>
                <div className="table-shell">
                  <div className="table-toolbar">
                    <div className="toolbar-left">
                      <div className="toolbar-search">
                        <Icon name="search" className="icon" />
                        <input
                          placeholder="Search history"
                          value={historySearch}
                          onChange={(event) => setHistorySearch(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="toolbar-right">
                      <div className="toolbar-flyout" ref={historyFilterRef}>
                        <button
                          type="button"
                          className="toolbar-button"
                          onClick={() => setHistoryFilterOpen((prev) => !prev)}
                        >
                          <Icon name="filter" className="icon" />
                          Filters
                        </button>
                        {historyFilterOpen ? (
                          <div className="dropdown history-filter-dropdown">
                            <label>
                              <span>Kid</span>
                              <select
                                value={historyFilterKid}
                                onChange={(event) => {
                                  setHistoryFilterKid(event.target.value);
                                  setHistoryFilterOpen(false);
                                }}
                              >
                                <option value="all">All kids</option>
                                {kidOptions.map((kid) => (
                                  <option key={kid.Id} value={String(kid.Id)}>
                                    {kid.Name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Type</span>
                              <select
                                value={historyFilterType}
                                onChange={(event) => {
                                  setHistoryFilterType(event.target.value);
                                  setHistoryFilterOpen(false);
                                }}
                              >
                                <option value="all">All types</option>
                                {historyTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="history-filter-toggle">
                              <input
                                type="checkbox"
                                checked={historyShowDeleted}
                                onChange={(event) => setHistoryShowDeleted(event.target.checked)}
                              />
                              <span>Show deleted</span>
                            </label>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("Kid")}
                            >
                              <span className="th-content">
                                Kid
                                <HistorySortIcon columnKey="Kid" />
                              </span>
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("Type")}
                            >
                              <span className="th-content">
                                Type
                                <HistorySortIcon columnKey="Type" />
                              </span>
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("Narrative")}
                            >
                              <span className="th-content">
                                Note
                                <HistorySortIcon columnKey="Narrative" />
                              </span>
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("When")}
                            >
                              <span className="th-content">
                                Date/time
                                <HistorySortIcon columnKey="When" />
                              </span>
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("EnteredBy")}
                            >
                              <span className="th-content">
                                Entered by
                                <HistorySortIcon columnKey="EnteredBy" />
                              </span>
                            </button>
                          </th>
                          <th className="cell-number">
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("Amount")}
                            >
                              <span className="th-content">
                                Amount
                                <HistorySortIcon columnKey="Amount" />
                              </span>
                            </button>
                          </th>
                          <th className="cell-number">
                            <button
                              type="button"
                              className="th-button"
                              onClick={() => SetHistorySort("Balance")}
                            >
                              <span className="th-content">
                                Balance
                                <HistorySortIcon columnKey="Balance" />
                              </span>
                            </button>
                          </th>
                          <th className="cell-center">
                            <span className="th-content">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedHistory.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-muted">
                              No history entries yet.
                            </td>
                          </tr>
                        ) : (
                          sortedHistory.map((entry) => (
                            <tr key={`${entry.KidUserId}-${entry.Id}`}>
                              <td>{entry.KidName}</td>
                              <td>{entry.EntryType}</td>
                              <td>{entry.Narrative || "-"}</td>
                              <td>
                                {FormatDate(entry.EntryDate)} · {FormatTime(entry.CreatedAt)}
                              </td>
                              <td>{entry.CreatedByName || `User ${entry.CreatedByUserId}`}</td>
                              <td className="cell-number">{FormatCurrency(entry.Amount)}</td>
                              <td className="cell-number">
                                {entry.RunningBalance !== null
                                  ? FormatCurrency(entry.RunningBalance)
                                  : "-"}
                              </td>
                              <td className="cell-center">
                                <button
                                  type="button"
                                  className="icon-button"
                                  title={
                                    entry.Narrative || entry.Notes
                                      ? `${entry.Narrative || ""}${entry.Notes ? ` · ${entry.Notes}` : ""}`
                                      : "No details"
                                  }
                                  aria-label="View details"
                                >
                                  <Icon name="more" className="icon" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="kids-admin-history-mobile">
                    {sortedHistory.length === 0 ? (
                      <p className="text-muted">No history entries yet.</p>
                    ) : (
                      sortedHistory.map((entry) => (
                        <details
                          key={`mobile-${entry.KidUserId}-${entry.Id}`}
                          className="history-mobile-row"
                        >
                          <summary className="history-mobile-summary">
                            <div className="history-mobile-main">
                              <span className="history-mobile-kid">{entry.KidName}</span>
                              <span className="history-mobile-type">{entry.EntryType}</span>
                            </div>
                            <div className="history-mobile-meta">
                              <span>
                                {FormatDate(entry.EntryDate)} · {FormatTime(entry.CreatedAt)}
                              </span>
                              <span className={entry.Amount < 0 ? "text-negative" : "text-positive"}>
                                {FormatCurrency(entry.Amount)}
                              </span>
                            </div>
                            <div className="history-mobile-balance">
                              Balance{" "}
                              {entry.RunningBalance !== null ? FormatCurrency(entry.RunningBalance) : "-"}
                            </div>
                          </summary>
                          <div className="history-mobile-details">
                            <div className="history-mobile-detail-row">
                              <span className="history-mobile-label">Time</span>
                              <span>{FormatTime(entry.CreatedAt)}</span>
                            </div>
                            <div className="history-mobile-detail-row">
                              <span className="history-mobile-label">Entered by</span>
                              <span>{entry.CreatedByName || `User ${entry.CreatedByUserId}`}</span>
                            </div>
                            <div className="history-mobile-detail-row">
                              <span className="history-mobile-label">Note</span>
                              <span>{entry.Narrative || "-"}</span>
                            </div>
                            <div className="history-mobile-detail-row">
                              <span className="history-mobile-label">Details</span>
                              <span>{entry.Notes || "-"}</span>
                            </div>
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          {showTransactionModal ? (
            <div
              className="modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={() => setShowTransactionModal(false)}
            >
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h3>Add update</h3>
                    <p>Deposits, withdrawals, and balance adjustments.</p>
                  </div>
                  <div className="modal-header-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShowTransactionModal(false)}
                      aria-label="Close modal"
                    >
                      <Icon name="close" className="icon" />
                    </button>
                  </div>
                </div>
                <div className="modal-body">
                  {activeKid ? (
                    <div className="kids-admin-form">
                      <label>
                        <span>Type</span>
                        <select
                          name="Type"
                          value={activeForm.Type}
                          onChange={(event) => onTransactionChange(activeKid.KidUserId, event)}
                        >
                          <option value="Deposit">Deposit</option>
                          <option value="Withdrawal">Withdrawal</option>
                          <option value="StartingBalance">Balance adjustment</option>
                        </select>
                      </label>
                      <label>
                        <span>{isBalanceAdjustment ? "Set balance to" : "Amount"}</span>
                        {isBalanceAdjustment ? (
                          <span className="text-muted kids-admin-hint">
                            We will calculate the change to reach this balance.
                          </span>
                        ) : null}
                        <input
                          name="Amount"
                          value={activeForm.Amount}
                          onChange={(event) => onTransactionChange(activeKid.KidUserId, event)}
                          placeholder={isBalanceAdjustment ? "50.00" : "0.00"}
                        />
                      </label>
                      <label>
                        <span>Date</span>
                        <input
                          type="date"
                          name="EntryDate"
                          value={activeForm.EntryDate}
                          onChange={(event) => onTransactionChange(activeKid.KidUserId, event)}
                        />
                      </label>
                      <label className="kids-admin-form-wide">
                        <span>Note</span>
                        <input
                          name="Narrative"
                          value={activeForm.Narrative}
                          onChange={(event) => onTransactionChange(activeKid.KidUserId, event)}
                          placeholder="Example: Robux, birthday cash"
                        />
                      </label>
                      <label className="kids-admin-form-wide">
                        <span>Details (optional)</span>
                        <input
                          name="Notes"
                          value={activeForm.Notes}
                          onChange={(event) => onTransactionChange(activeKid.KidUserId, event)}
                        />
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => submitTransaction(activeKid.KidUserId)}
                        disabled={status === "saving"}
                      >
                        Add update
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted">Create a kid profile to start tracking money.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {showScheduleModal ? (
            <div
              className="modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={() => setShowScheduleModal(false)}
            >
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h3>Pocket money schedule</h3>
                    <p>Control cadence and auto credits.</p>
                  </div>
                  <div className="modal-header-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShowScheduleModal(false)}
                      aria-label="Close modal"
                    >
                      <Icon name="close" className="icon" />
                    </button>
                  </div>
                </div>
                <div className="modal-body">
                  {activeKid ? (
                    <div className="kids-admin-form">
                      <label>
                        <span>Amount</span>
                        <input
                          name="Amount"
                          value={activeRule.Amount}
                          onChange={(event) => onRuleChange(activeKid.KidUserId, event)}
                          placeholder="0.00"
                        />
                      </label>
                      <label>
                        <span>Frequency</span>
                        <select
                          name="Frequency"
                          value={activeRule.Frequency}
                          onChange={(event) => onRuleChange(activeKid.KidUserId, event)}
                        >
                          <option value="weekly">Weekly</option>
                          <option value="fortnightly">Fortnightly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </label>
                      {activeRule.Frequency === "monthly" ? (
                        <label>
                          <span>Day of month</span>
                          <input
                            name="DayOfMonth"
                            value={activeRule.DayOfMonth}
                            onChange={(event) => onRuleChange(activeKid.KidUserId, event)}
                          />
                        </label>
                      ) : (
                        <label>
                          <span>Day of week</span>
                          <select
                            name="DayOfWeek"
                            value={activeRule.DayOfWeek}
                            onChange={(event) => onRuleChange(activeKid.KidUserId, event)}
                          >
                            <option value="0">Monday</option>
                            <option value="1">Tuesday</option>
                            <option value="2">Wednesday</option>
                            <option value="3">Thursday</option>
                            <option value="4">Friday</option>
                            <option value="5">Saturday</option>
                            <option value="6">Sunday</option>
                          </select>
                        </label>
                      )}
                      <label>
                        <span>Start date</span>
                        <input
                          type="date"
                          name="StartDate"
                          value={activeRule.StartDate}
                          onChange={(event) => onRuleChange(activeKid.KidUserId, event)}
                        />
                      </label>
                      <label className="kids-admin-toggle">
                        <input
                          type="checkbox"
                          name="IsActive"
                          checked={activeRule.IsActive}
                          onChange={(event) => onRuleChange(activeKid.KidUserId, event)}
                        />
                        <span>Active</span>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => saveRule(activeKid.KidUserId)}
                        disabled={status === "saving"}
                      >
                        Save schedule
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted">Create a kid profile to set a schedule.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {showChoreModal ? (
            <div
              className="modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={closeChoreModal}
            >
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h3>{isEditingChore ? "Edit chore" : "Add chore"}</h3>
                    <p>{isEditingChore ? "Update the chore details." : "Create a new chore."}</p>
                  </div>
                  <div className="modal-header-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={closeChoreModal}
                      aria-label="Close modal"
                    >
                      <Icon name="close" className="icon" />
                    </button>
                  </div>
                </div>
                <div className="modal-body">
                  <form className="kids-admin-form" onSubmit={onSaveChore}>
                    <label>
                      <span>Chore name</span>
                      <input name="Label" value={choreForm.Label} onChange={onChoreChange} />
                    </label>
                    <label>
                      <span>Amount</span>
                      <input name="Amount" value={choreForm.Amount} onChange={onChoreChange} />
                    </label>
                    <div className="kids-admin-assignees">
                      <span>Assign to</span>
                      <div className="kids-admin-tags">
                        {kidOptions.map((kid) => (
                          <label key={kid.Id} className="kids-admin-tag">
                            <input
                              type="checkbox"
                              checked={choreForm.KidUserIds.includes(kid.Id)}
                              onChange={() => onChoreKidToggle(kid.Id)}
                            />
                            <span>{kid.Name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="primary-button" disabled={status === "saving"}>
                      {isEditingChore ? "Save chore" : "Create chore"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default KidsAdmin;
