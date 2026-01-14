import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  ApproveKidsChoreEntry,
  CreateParentChore,
  CreateParentKidChoreEntry,
  CreateKidDeposit,
  CreateKidStartingBalance,
  CreateKidWithdrawal,
  DeleteParentChore,
  DeleteParentKidChoreEntry,
  FetchKidLedger,
  FetchKidChoreEntries,
  FetchKidDayDetail,
  FetchKidMonthOverview,
  FetchKidMonthSummary,
  FetchKidsPendingApprovals,
  FetchLinkedKids,
  FetchParentChores,
  FetchPocketMoneyRule,
  RejectKidsChoreEntry,
  SetChoreAssignments,
  UpdateParentChore,
  UpdateParentKidChoreEntry,
  UpdatePocketMoneyRule
} from "../../lib/kidsApi.js";
import { FormatCurrency, NormalizeAmountInput } from "../../lib/formatters.js";
import { BuildKidsTotals } from "../../lib/kidsTotals.js";
import Icon from "../../components/Icon.jsx";

const BuildToday = () => new Date().toISOString().slice(0, 10);

const BuildMonthCursor = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const BuildMonthParam = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const BuildDateKey = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const BuildMonthLabel = (dateValue) =>
  dateValue.toLocaleDateString("en-AU", { month: "short", year: "numeric" });

const BuildDayLabel = (dateValue) =>
  new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

const BuildShortDate = (dateValue) =>
  new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short"
  });

const MoneyEntryTypes = new Set(["Deposit", "Withdrawal", "StartingBalance"]);

const MoneyTypeLabel = (value) => {
  switch (value) {
    case "Deposit":
      return "Deposit";
    case "Withdrawal":
      return "Withdrawal";
    case "StartingBalance":
      return "Balance adjustment";
    default:
      return "Money";
  }
};

const BuildMoneyForm = () => ({
  EntryType: "StartingBalance",
  EntryDate: BuildToday(),
  Amount: "",
  Narrative: "Balance adjustment",
  Notes: ""
});

const BuildDateTimeLabel = (dateValue) =>
  new Date(dateValue).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

const EmptyChoreForm = () => ({
  Label: "",
  Type: "Daily",
  Amount: "",
  SortOrder: "0",
  IsActive: true,
  KidUserIds: [],
  StartDate: BuildToday(),
  EndDate: ""
});

const BuildEntryForm = (dateValue) => ({
  EntryId: null,
  EntryDate: dateValue || BuildToday(),
  Type: "Daily",
  ChoreId: "",
  Amount: "",
  Notes: "",
  Status: ""
});

const TypeLabel = (value) => {
  switch (value) {
    case "Daily":
      return "Daily jobs";
    case "Habit":
      return "Habits";
    case "Bonus":
      return "Bonus tasks";
    default:
      return value || "-";
  }
};

const BuildKidName = (kid) => kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`;

const KidsAdmin = () => {
  const location = useLocation();

  const [kids, setKids] = useState([]);
  const [activeKidId, setActiveKidId] = useState(null);
  const [requestedKidId, setRequestedKidId] = useState(null);
  const [activeTab, setActiveTab] = useState("month");
  const [monthCursor, setMonthCursor] = useState(BuildMonthCursor);
  const [monthSummary, setMonthSummary] = useState(null);
  const [monthOverview, setMonthOverview] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalsLoaded, setApprovalsLoaded] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [chores, setChores] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerBalance, setLedgerBalance] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const [approvalFilterType, setApprovalFilterType] = useState("all");
  const [approvalRangeStart, setApprovalRangeStart] = useState("");
  const [approvalRangeEnd, setApprovalRangeEnd] = useState("");
  const [approvalExpanded, setApprovalExpanded] = useState({});

  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [historyEntryExpandedId, setHistoryEntryExpandedId] = useState(null);

  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [allowanceForm, setAllowanceForm] = useState({ Amount: "40", StartDate: BuildToday() });

  const [showMoneyModal, setShowMoneyModal] = useState(false);
  const [moneyForm, setMoneyForm] = useState(BuildMoneyForm());
  const [moneyStatus, setMoneyStatus] = useState("idle");
  const [moneyError, setMoneyError] = useState("");

  const [showChoresModal, setShowChoresModal] = useState(false);
  const [showChoreForm, setShowChoreForm] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [choreForm, setChoreForm] = useState(EmptyChoreForm());
  const [choreSearch, setChoreSearch] = useState("");
  const [choreFilter, setChoreFilter] = useState("all");
  const [returnToChoresModal, setReturnToChoresModal] = useState(false);

  const [showDayDrawer, setShowDayDrawer] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [dayDetail, setDayDetail] = useState(null);
  const [dayStatus, setDayStatus] = useState("idle");

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState(BuildEntryForm(BuildToday()));
  const [entryDetail, setEntryDetail] = useState(null);

  const todayKey = BuildDateKey(new Date());
  const monthParam = useMemo(() => BuildMonthParam(monthCursor), [monthCursor]);
  const currentMonth = BuildMonthCursor();
  const isCurrentMonth =
    monthCursor.getFullYear() === currentMonth.getFullYear() &&
    monthCursor.getMonth() === currentMonth.getMonth();

  const loadBaseData = async () => {
    setStatus("loading");
    setError("");
    try {
      const [kidsList, choreList] = await Promise.all([
        FetchLinkedKids(),
        FetchParentChores()
      ]);
      setKids(kidsList || []);
      setChores(choreList || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load kids admin data.");
    }
  };

  const loadMonthData = async () => {
    if (!activeKidId) {
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const [summary, overview] = await Promise.all([
        FetchKidMonthSummary(activeKidId, monthParam),
        FetchKidMonthOverview(activeKidId, monthParam)
      ]);
      setMonthSummary(summary);
      setMonthOverview(overview);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load month data.");
    }
  };

  const loadApprovals = async () => {
    if (!activeKidId) {
      setPendingApprovals([]);
      setApprovalsLoaded(false);
      return;
    }
    setStatus("loading");
    setError("");
    setApprovalsLoaded(false);
    try {
      const approvals = await FetchKidsPendingApprovals({
        kidId: activeKidId
      });
      setPendingApprovals(approvals || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load approvals.");
      setPendingApprovals([]);
    } finally {
      setApprovalsLoaded(true);
    }
  };

  const loadHistory = async () => {
    if (!activeKidId) {
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const data = await FetchKidChoreEntries(activeKidId, 500, false);
      setHistoryEntries(data || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load history.");
    }
  };

  const loadLedger = async () => {
    if (!activeKidId) {
      return;
    }
    try {
      const data = await FetchKidLedger(activeKidId, 500);
      setLedgerEntries(data?.Entries || []);
      setLedgerBalance(data?.Balance ?? null);
    } catch (err) {
      setLedgerEntries([]);
      setLedgerBalance(null);
    }
  };

  const loadDayDetail = async (dateValue) => {
    if (!activeKidId || !dateValue) {
      return;
    }
    setDayStatus("loading");
    try {
      const detail = await FetchKidDayDetail(activeKidId, dateValue);
      setDayDetail(detail);
      setDayStatus("ready");
    } catch (err) {
      setDayStatus("error");
      setError(err?.message || "Unable to load day detail.");
    }
  };

  const refreshDayAndMonth = async (dateValue) => {
    await Promise.all([loadMonthData(), loadDayDetail(dateValue)]);
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const kidParam = params.get("kid");
    setRequestedKidId(kidParam ? Number(kidParam) : null);
    const hash = location.hash.replace("#", "");
    if (hash === "kids-history") {
      setActiveTab("history");
    } else if (hash === "kids-approvals") {
      setActiveTab("approvals");
    } else if (hash === "kids-chores") {
      setActiveTab("chores");
    }
  }, [location.search, location.hash]);

  useEffect(() => {
    if (kids.length === 0) {
      setActiveKidId(null);
      return;
    }
    if (requestedKidId && kids.some((kid) => kid.KidUserId === requestedKidId)) {
      setActiveKidId(requestedKidId);
      return;
    }
    if (!activeKidId || !kids.some((kid) => kid.KidUserId === activeKidId)) {
      setActiveKidId(kids[0].KidUserId);
    }
  }, [kids, requestedKidId, activeKidId]);

  useEffect(() => {
    loadMonthData();
  }, [activeKidId, monthParam]);

  useEffect(() => {
    loadLedger();
  }, [activeKidId]);

  useEffect(() => {
    if (!activeKidId) {
      setPendingApprovals([]);
      setApprovalsLoaded(false);
      return;
    }
    loadApprovals();
  }, [activeKidId]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, activeKidId, monthParam]);

  useEffect(() => {
    if (activeTab === "approvals") {
      loadApprovals();
    }
  }, [activeTab, activeKidId]);

  useEffect(() => {
    if (selectedDay) {
      loadDayDetail(selectedDay);
    }
  }, [selectedDay, activeKidId]);

  useEffect(() => {
    if (activeTab === "approvals" && approvalsLoaded && pendingApprovals.length === 0) {
      setActiveTab("month");
    }
  }, [activeTab, approvalsLoaded, pendingApprovals.length]);

  useEffect(() => {
    if (!showEntryModal || !activeKidId || !entryForm.EntryDate) {
      return;
    }
    const loadEntryDetail = async () => {
      try {
        const detail = await FetchKidDayDetail(activeKidId, entryForm.EntryDate);
        setEntryDetail(detail);
      } catch (err) {
        setEntryDetail(null);
      }
    };
    loadEntryDetail();
  }, [showEntryModal, activeKidId, entryForm.EntryDate]);

  useEffect(() => {
    const handler = (event) => {
      if (event.target.closest(".kids-admin-chore-menu")) {
        return;
      }
      document
        .querySelectorAll(".kids-admin-chore-menu[open]")
        .forEach((menu) => menu.removeAttribute("open"));
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const kidOptions = useMemo(
    () =>
      kids.map((kid) => ({
        Id: kid.KidUserId,
        Name: BuildKidName(kid)
      })),
    [kids]
  );

  const activeKid = useMemo(
    () => kids.find((kid) => kid.KidUserId === activeKidId) || null,
    [kids, activeKidId]
  );

  const overviewByDate = useMemo(() => {
    const map = {};
    (monthOverview?.Days || []).forEach((day) => {
      map[day.Date] = day;
    });
    return map;
  }, [monthOverview]);

  const calendarCells = useMemo(() => {
    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    const startOffset = (start.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ isEmpty: true, key: `empty-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateValue = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
      const dateKey = BuildDateKey(dateValue);
      const data = overviewByDate[dateKey];
      const dailyTotal = data?.DailyTotal || 0;
      const dailyDone = data?.DailyDone || 0;
      let statusText = "";
      let statusTone = "";
      let statusIcon = "";
      if (dailyTotal > 0) {
        if (dailyDone >= dailyTotal) {
          statusText = "Done";
          statusTone = "done";
        } else if (dateKey === todayKey) {
          statusText = "WIP";
          statusTone = "progress";
        } else if (dateKey < todayKey) {
          statusText = "Missed";
          statusTone = "missed";
        }
      } else if (dateKey <= todayKey) {
        statusText = "N/A";
        if (dateKey === todayKey) {
          statusTone = "progress";
        } else {
          statusTone = "missed";
        }
      }
      if (statusText === "Done") {
        statusIcon = "check";
      } else if (statusText === "Missed") {
        statusIcon = "close";
      } else if (statusText === "WIP") {
        statusIcon = "reset";
      } else if (statusText === "No chores available") {
        statusIcon = "info";
      }
      cells.push({
        isEmpty: false,
        key: dateKey,
        dateKey,
        dayNumber: day,
        statusText,
        statusTone,
        statusIcon,
        bonusTotal: data?.BonusApprovedTotal || 0,
        pendingCount: data?.PendingCount || 0
      });
    }
    return cells;
  }, [monthCursor, overviewByDate, todayKey]);

  const choresForKid = useMemo(() => {
    if (!activeKidId) {
      return [];
    }
    return chores.filter((chore) => (chore.AssignedKidIds || []).includes(activeKidId));
  }, [chores, activeKidId]);

  const groupedChores = useMemo(() => {
    const filtered = chores
      .filter((chore) => {
        if (!choreSearch.trim()) {
          return true;
        }
        return chore.Label.toLowerCase().includes(choreSearch.trim().toLowerCase());
      })
      .filter((chore) => chore.Label);

    const groups = {
      Daily: [],
      Habit: [],
      Bonus: []
    };

    filtered.forEach((chore) => {
      if (groups[chore.Type]) {
        groups[chore.Type].push(chore);
      }
    });

    Object.keys(groups).forEach((type) => {
      groups[type] = groups[type].sort((a, b) => {
        if ((a.SortOrder || 0) !== (b.SortOrder || 0)) {
          return (a.SortOrder || 0) - (b.SortOrder || 0);
        }
        return a.Label.localeCompare(b.Label);
      });
    });

    return groups;
  }, [chores, choreSearch]);

  const choreCounts = useMemo(() => {
    const counts = {
      Daily: 0,
      Habit: 0,
      Bonus: 0,
      Disabled: 0
    };
    chores.forEach((chore) => {
      if (chore.IsActive === false) {
        counts.Disabled += 1;
      }
      if (chore.Type === "Daily") {
        counts.Daily += 1;
      } else if (chore.Type === "Habit") {
        counts.Habit += 1;
      } else if (chore.Type === "Bonus") {
        counts.Bonus += 1;
      }
    });
    return counts;
  }, [chores]);

  const assignedToActiveCount = useMemo(() => {
    if (!activeKidId) {
      return 0;
    }
    return chores.filter((chore) => (chore.AssignedKidIds || []).includes(activeKidId)).length;
  }, [chores, activeKidId]);

  const visibleChoreGroups = useMemo(() => {
    const disabledChores = [
      ...groupedChores.Daily,
      ...groupedChores.Habit,
      ...groupedChores.Bonus
    ].filter((chore) => chore.IsActive === false);
    if (choreFilter === "Daily") {
      return [["Daily", groupedChores.Daily]];
    }
    if (choreFilter === "Habit") {
      return [["Habit", groupedChores.Habit]];
    }
    if (choreFilter === "Bonus") {
      return [["Bonus", groupedChores.Bonus]];
    }
    if (choreFilter === "disabled") {
      return [["Disabled", disabledChores]];
    }
    return [
      ["Daily", groupedChores.Daily],
      ["Habit", groupedChores.Habit],
      ["Bonus", groupedChores.Bonus]
    ];
  }, [groupedChores, choreFilter, chores]);

  const filteredApprovals = useMemo(() => {
    return pendingApprovals.filter((entry) => {
      if (approvalFilterType !== "all" && entry.ChoreType !== approvalFilterType) {
        return false;
      }
      if (approvalRangeStart && entry.EntryDate < approvalRangeStart) {
        return false;
      }
      if (approvalRangeEnd && entry.EntryDate > approvalRangeEnd) {
        return false;
      }
      return true;
    });
  }, [pendingApprovals, approvalFilterType, approvalRangeStart, approvalRangeEnd]);

  const approvalsByDate = useMemo(() => {
    const grouped = {};
    filteredApprovals.forEach((entry) => {
      grouped[entry.EntryDate] = grouped[entry.EntryDate] || [];
      grouped[entry.EntryDate].push(entry);
    });
    return grouped;
  }, [filteredApprovals]);

  const approvalsDates = useMemo(() => {
    return Object.keys(approvalsByDate).sort(
      (a, b) =>
        new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()
    );
  }, [approvalsByDate]);

  const monthStartKey =
    monthSummary?.MonthStart ||
    BuildDateKey(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1));
  const monthEndKey =
    monthSummary?.MonthEnd ||
    BuildDateKey(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0));
  const ledgerCutoffKey = isCurrentMonth ? todayKey : monthEndKey;

  const ledgerTotals = useMemo(() => {
    if (!ledgerEntries.length) {
      return { moneyIn: 0, moneyOut: 0 };
    }
    const startTime = new Date(`${monthStartKey}T00:00:00`).getTime();
    const endTime = new Date(`${ledgerCutoffKey}T23:59:59`).getTime();
    return ledgerEntries.reduce(
      (acc, entry) => {
        const entryTime = new Date(`${entry.EntryDate}T00:00:00`).getTime();
        if (Number.isNaN(entryTime) || entryTime < startTime || entryTime > endTime) {
          return acc;
        }
        const amount = Number(entry.Amount || 0);
        if (amount >= 0) {
          acc.moneyIn += amount;
        } else {
          acc.moneyOut += Math.abs(amount);
        }
        return acc;
      },
      { moneyIn: 0, moneyOut: 0 }
    );
  }, [ledgerEntries, monthStartKey, ledgerCutoffKey]);

  const manualLedgerEntries = useMemo(
    () => ledgerEntries.filter((entry) => MoneyEntryTypes.has(entry.EntryType)),
    [ledgerEntries]
  );

  const totals = useMemo(
    () =>
      BuildKidsTotals({
        TodayKey: todayKey,
        MonthStartKey: monthStartKey,
        MonthEndKey: monthEndKey,
        MonthlyAllowance: monthSummary?.MonthlyAllowance ?? 0,
        DailySlice: monthSummary?.DailySlice ?? 0,
        OverviewDays: monthOverview?.Days || [],
        LedgerEntries: ledgerEntries,
        IsCurrentMonth: isCurrentMonth
      }),
    [
      todayKey,
      monthStartKey,
      monthEndKey,
      monthSummary,
      monthOverview,
      ledgerEntries,
      isCurrentMonth
    ]
  );

  const currentTotalDisplay = totals.CurrentTotal;
  const projectedTotalDisplay = totals.ProjectedTotal;
  const choreEntriesForMonth = useMemo(() => {
    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    return historyEntries.filter((entry) => {
      const entryDate = new Date(`${entry.EntryDate}T00:00:00`);
      return entryDate >= start && entryDate <= end;
    });
  }, [historyEntries, monthCursor]);

  const ledgerEntriesForMonth = useMemo(() => {
    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    return manualLedgerEntries.filter((entry) => {
      const entryDate = new Date(`${entry.EntryDate}T00:00:00`);
      return entryDate >= start && entryDate <= end;
    });
  }, [manualLedgerEntries, monthCursor]);

  const historyItems = useMemo(() => {
    const choreItems = choreEntriesForMonth.map((entry) => ({
      Kind: "chore",
      Key: `chore-${entry.Id}`,
      Id: entry.Id,
      EntryDate: entry.EntryDate,
      CreatedAt: entry.CreatedAt,
      Title: entry.ChoreLabel,
      ChoreType: entry.ChoreType,
      Status: entry.Status,
      ChoreId: entry.ChoreId,
      Notes: entry.Notes,
      Amount: entry.Amount
    }));
    const ledgerItems = ledgerEntriesForMonth.map((entry) => ({
      Kind: "ledger",
      Key: `ledger-${entry.Id}`,
      Id: entry.Id,
      EntryDate: entry.EntryDate,
      CreatedAt: entry.CreatedAt,
      Title: entry.Narrative?.trim() || MoneyTypeLabel(entry.EntryType),
      EntryType: entry.EntryType,
      Notes: entry.Notes,
      Amount: entry.Amount,
      CreatedByName: entry.CreatedByName
    }));
    return [...choreItems, ...ledgerItems];
  }, [choreEntriesForMonth, ledgerEntriesForMonth]);

  const filteredHistory = useMemo(() => {
    return historyItems.filter((entry) => {
      if (historyFilter === "Money") {
        return entry.Kind === "ledger";
      }
      if (entry.Kind === "ledger") {
        return historyFilter === "all";
      }
      if (historyFilter === "Daily") {
        return entry.ChoreType === "Daily";
      }
      if (historyFilter === "Habit") {
        return entry.ChoreType === "Habit";
      }
      if (historyFilter === "Bonus") {
        return entry.ChoreType === "Bonus";
      }
      if (historyFilter === "Pending") {
        return entry.Status === "Pending";
      }
      if (historyFilter === "Approved") {
        return entry.Status === "Approved";
      }
      if (historyFilter === "Rejected") {
        return entry.Status === "Rejected";
      }
      return true;
    });
  }, [historyItems, historyFilter]);

  const sortedHistory = useMemo(() => {
    const sorted = [...filteredHistory];
    sorted.sort((a, b) => {
      if (a.EntryDate !== b.EntryDate) {
        return a.EntryDate > b.EntryDate ? -1 : 1;
      }
      const aTime = new Date(a.CreatedAt).getTime();
      const bTime = new Date(b.CreatedAt).getTime();
      return bTime - aTime;
    });
    return sorted;
  }, [filteredHistory]);

  const historyByDate = useMemo(() => {
    const grouped = {};
    sortedHistory.forEach((entry) => {
      grouped[entry.EntryDate] = grouped[entry.EntryDate] || [];
      grouped[entry.EntryDate].push(entry);
    });
    return grouped;
  }, [sortedHistory]);

  const historyDates = useMemo(() => {
    return Object.keys(historyByDate).sort(
      (a, b) =>
        new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()
    );
  }, [historyByDate]);

  const entryByChoreId = useMemo(() => {
    const map = new Map();
    (dayDetail?.Entries || []).forEach((entry) => {
      map.set(entry.ChoreId, entry);
    });
    return map;
  }, [dayDetail]);

  const availableChoresByType = useMemo(() => {
    if (showEntryModal && entryDetail && entryDetail.Date === entryForm.EntryDate) {
      return {
        Daily: entryDetail.DailyJobs || [],
        Habit: entryDetail.Habits || [],
        Bonus: entryDetail.BonusTasks || []
      };
    }
    if (!showEntryModal && dayDetail && dayDetail.Date === selectedDay) {
      return {
        Daily: dayDetail.DailyJobs || [],
        Habit: dayDetail.Habits || [],
        Bonus: dayDetail.BonusTasks || []
      };
    }
    const active = choresForKid.filter((chore) => chore.IsActive !== false);
    return {
      Daily: active.filter((chore) => chore.Type === "Daily"),
      Habit: active.filter((chore) => chore.Type === "Habit"),
      Bonus: active.filter((chore) => chore.Type === "Bonus")
    };
  }, [showEntryModal, entryDetail, entryForm.EntryDate, dayDetail, selectedDay, choresForKid]);

  const openAllowanceModal = async () => {
    if (!activeKidId) {
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const rule = await FetchPocketMoneyRule(activeKidId);
      setAllowanceForm({
        Amount: rule?.Amount ? String(rule.Amount) : "40",
        StartDate: rule?.StartDate || BuildToday()
      });
      setShowAllowanceModal(true);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load allowance.");
    }
  };

  const openMoneyModal = () => {
    setMoneyForm(BuildMoneyForm());
    setMoneyError("");
    setShowMoneyModal(true);
  };

  const closeMoneyModal = () => {
    setShowMoneyModal(false);
    setMoneyStatus("idle");
    setMoneyError("");
  };

  const onMoneyFormChange = (event) => {
    const { name, value } = event.target;
    setMoneyForm((prev) => {
      if (name === "EntryType") {
        const previousDefault = MoneyTypeLabel(prev.EntryType);
        const nextDefault = MoneyTypeLabel(value);
        const shouldUpdateNarrative = !prev.Narrative || prev.Narrative === previousDefault;
        return {
          ...prev,
          EntryType: value,
          Narrative: shouldUpdateNarrative ? nextDefault : prev.Narrative
        };
      }
      if (name === "Amount") {
        return { ...prev, Amount: NormalizeAmountInput(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const onSaveMoney = async (event) => {
    event.preventDefault();
    if (!activeKidId) {
      return;
    }
    const amountValue = Number(moneyForm.Amount || 0);
    if (!amountValue || amountValue <= 0) {
      setMoneyError("Enter an amount.");
      return;
    }
    if (!moneyForm.EntryDate) {
      setMoneyError("Select a date.");
      return;
    }
    if (!moneyForm.Narrative.trim()) {
      setMoneyError("Add a label.");
      return;
    }
    setMoneyStatus("saving");
    setMoneyError("");
    try {
      const payload = {
        Amount: amountValue,
        EntryDate: moneyForm.EntryDate,
        Narrative: moneyForm.Narrative.trim(),
        Notes: moneyForm.Notes?.trim() || null
      };
      if (moneyForm.EntryType === "Deposit") {
        await CreateKidDeposit(activeKidId, payload);
      } else if (moneyForm.EntryType === "Withdrawal") {
        await CreateKidWithdrawal(activeKidId, payload);
      } else {
        await CreateKidStartingBalance(activeKidId, payload);
      }
      closeMoneyModal();
      loadLedger();
      if (activeTab === "history") {
        loadHistory();
      }
    } catch (err) {
      setMoneyError(err?.message || "Unable to save entry.");
    } finally {
      setMoneyStatus("idle");
    }
  };

  const openChoreForm = (chore = null, returnToList = false) => {
    if (chore) {
      setEditingChore(chore);
      setChoreForm({
        Label: chore.Label,
        Type: chore.Type,
        Amount: chore.Amount ? String(chore.Amount) : "",
        SortOrder: String(chore.SortOrder || 0),
        IsActive: chore.IsActive !== false,
        KidUserIds: chore.AssignedKidIds || [],
        StartDate: chore.StartDate || BuildToday(),
        EndDate: chore.EndDate || ""
      });
    } else {
      setEditingChore(null);
      setChoreForm(EmptyChoreForm());
    }
    if (returnToList) {
      setShowChoresModal(false);
      setReturnToChoresModal(true);
    } else {
      setReturnToChoresModal(false);
    }
    setShowChoreForm(true);
  };

  const closeChoreForm = () => {
    setShowChoreForm(false);
    setEditingChore(null);
    setChoreForm(EmptyChoreForm());
    if (returnToChoresModal) {
      setShowChoresModal(true);
      setReturnToChoresModal(false);
    }
  };

  const onChoreFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setChoreForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onToggleKidAssignment = (kidId) => {
    setChoreForm((prev) => {
      const existing = new Set(prev.KidUserIds || []);
      if (existing.has(kidId)) {
        existing.delete(kidId);
      } else {
        existing.add(kidId);
      }
      return { ...prev, KidUserIds: Array.from(existing) };
    });
  };

  const onSaveChore = async (event) => {
    event.preventDefault();
    if (!choreForm.Label.trim()) {
      setError("Chore name is required.");
      return;
    }
    if (choreForm.Type === "Bonus" && Number(choreForm.Amount || 0) <= 0) {
      setError("Bonus amount is required.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const payload = {
        Label: choreForm.Label.trim(),
        Type: choreForm.Type,
        Amount: choreForm.Type === "Bonus" ? Number(choreForm.Amount || 0) : 0,
        SortOrder: Number(choreForm.SortOrder || 0),
        IsActive: choreForm.IsActive,
        StartDate: choreForm.StartDate || null,
        EndDate: choreForm.EndDate || null
      };
      let saved = null;
      if (editingChore) {
        saved = await UpdateParentChore(editingChore.Id, payload);
      } else {
        saved = await CreateParentChore(payload);
      }
      if (saved?.Id) {
        await SetChoreAssignments(saved.Id, { KidUserIds: choreForm.KidUserIds || [] });
      }
      closeChoreForm();
      await loadBaseData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save chore.");
    } finally {
      setStatus("ready");
    }
  };

  const onDeleteChore = async (chore) => {
    const confirmed = window.confirm(
      "Disable this chore? It will be hidden from kids but kept for history."
    );
    if (!confirmed) {
      return;
    }
    try {
      await DeleteParentChore(chore.Id);
      await loadBaseData();
    } catch (err) {
      setError(err?.message || "Unable to delete chore.");
    }
  };

  const closeChoreMenu = (event) => {
    const menu = event.currentTarget.closest(".kids-admin-chore-menu");
    if (menu) {
      menu.removeAttribute("open");
    }
  };

  const onToggleChoreActive = async (chore) => {
    setStatus("saving");
    setError("");
    try {
      await UpdateParentChore(chore.Id, { IsActive: !chore.IsActive });
      await loadBaseData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to update chore.");
    } finally {
      setStatus("ready");
    }
  };

  const onSaveAllowance = async (event) => {
    event.preventDefault();
    if (!activeKidId) {
      return;
    }
    const amountValue = Number(allowanceForm.Amount || 0);
    if (!amountValue || Number.isNaN(amountValue)) {
      setError("Monthly allowance is required.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const payload = {
        Amount: amountValue,
        Frequency: "monthly",
        DayOfMonth: 1,
        DayOfWeek: 0,
        StartDate: allowanceForm.StartDate || BuildToday(),
        IsActive: true
      };
      await UpdatePocketMoneyRule(activeKidId, payload);
      setShowAllowanceModal(false);
      await loadMonthData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save allowance.");
    } finally {
      setStatus("ready");
    }
  };

  const onApprovalAction = async (entryId, action) => {
    setStatus("saving");
    setError("");
    try {
      if (action === "approve") {
        await ApproveKidsChoreEntry(entryId);
      } else {
        await RejectKidsChoreEntry(entryId);
      }
      await loadApprovals();
      await loadMonthData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to update approval.");
    } finally {
      setStatus("ready");
    }
  };

  const onApproveDateGroup = async (dateKey) => {
    const entries = approvalsByDate[dateKey] || [];
    if (entries.length === 0) {
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await Promise.all(entries.map((entry) => ApproveKidsChoreEntry(entry.Id)));
      await loadApprovals();
      await loadMonthData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to approve items.");
    } finally {
      setStatus("ready");
    }
  };

  const openDay = (dateKey) => {
    setSelectedDay(dateKey);
    setShowDayDrawer(true);
  };

  const closeDayDrawer = () => {
    setShowDayDrawer(false);
  };

  const onToggleDayChore = async (chore) => {
    if (!activeKidId || !selectedDay) {
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const entry = entryByChoreId.get(chore.Id);
      if (entry) {
        if (entry.Status === "Approved") {
          await DeleteParentKidChoreEntry(activeKidId, entry.Id);
        } else {
          await UpdateParentKidChoreEntry(activeKidId, entry.Id, { Status: "Approved" });
        }
      } else {
        await CreateParentKidChoreEntry(activeKidId, {
          ChoreId: chore.Id,
          EntryDate: selectedDay,
          Notes: ""
        });
      }
      await refreshDayAndMonth(selectedDay);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to update chore.");
    } finally {
      setStatus("ready");
    }
  };

  const openEntryModal = (options = {}) => {
    const targetDate = options.dateValue || selectedDay || BuildToday();
    const entry = options.entry || null;
    const entryType = entry?.ChoreType || options.type || "Daily";
    setSelectedDay(targetDate);
    setShowDayDrawer(false);
    setEntryDetail(null);
    if (entry) {
      setEntryForm({
        EntryId: entry.Id,
        EntryDate: entry.EntryDate,
        Type: entryType,
        ChoreId: String(entry.ChoreId),
        Amount: entry.Amount ? String(entry.Amount) : "",
        Notes: entry.Notes || "",
        Status: entry.Status
      });
    } else {
      setEntryForm({
        EntryId: null,
        EntryDate: targetDate,
        Type: entryType,
        ChoreId: options.choreId ? String(options.choreId) : "",
        Amount: options.amount ? String(options.amount) : "",
        Notes: "",
        Status: ""
      });
    }
    setShowEntryModal(true);
  };

  const onEntryFormChange = (event) => {
    const { name, value } = event.target;
    setEntryForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "Type" ? { ChoreId: "", Amount: "" } : null)
    }));
  };

  const onSaveEntry = async (event) => {
    event.preventDefault();
    if (!activeKidId) {
      return;
    }
    if (!entryForm.ChoreId) {
      setError("Chore is required.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const payload = {
        ChoreId: Number(entryForm.ChoreId),
        EntryDate: entryForm.EntryDate,
        Notes: entryForm.Notes || null
      };
      if (entryForm.Type === "Bonus") {
        payload.Amount = Number(entryForm.Amount || 0);
      }
      if (entryForm.EntryId) {
        const updatePayload = {
          EntryDate: entryForm.EntryDate,
          Notes: entryForm.Notes || null
        };
        if (entryForm.Type === "Bonus") {
          updatePayload.Amount = Number(entryForm.Amount || 0);
        }
        if (entryForm.Status) {
          updatePayload.Status = entryForm.Status;
        }
        await UpdateParentKidChoreEntry(activeKidId, entryForm.EntryId, updatePayload);
      } else {
        await CreateParentKidChoreEntry(activeKidId, payload);
      }
      setShowEntryModal(false);
      await refreshDayAndMonth(entryForm.EntryDate);
      if (activeTab === "history") {
        await loadHistory();
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save entry.");
    } finally {
      setStatus("ready");
    }
  };

  const onDeleteEntry = async (entry) => {
    if (!activeKidId) {
      return;
    }
    const confirmed = window.confirm("Delete this entry? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await DeleteParentKidChoreEntry(activeKidId, entry.Id);
      await refreshDayAndMonth(entry.EntryDate);
      if (activeTab === "history") {
        await loadHistory();
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to delete entry.");
    } finally {
      setStatus("ready");
    }
  };

  const toggleApprovalGroup = (dateKey) => {
    setApprovalExpanded((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  const toggleHistoryGroup = (dateKey) => {
    setHistoryExpanded((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  const handleMonthChange = (delta) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const monthTitle = BuildMonthLabel(monthCursor);
  const activeKidName = activeKid ? BuildKidName(activeKid) : "Kid";
  const dayPendingCount = selectedDay ? overviewByDate[selectedDay]?.PendingCount || 0 : 0;
  const hasApprovals = approvalsLoaded && pendingApprovals.length > 0;

  return (
    <div className="kids-admin-container">
      <div className="kids-admin">
        <header className="kids-admin-header">
          <div className="kids-admin-header-copy">
            <h1>Kids portal</h1>
            <p className="lede">Approvals, month summary, and chore setup.</p>
            {kids.length ? (
              <div className="kids-admin-switcher">
                {kids.length <= 4 ? (
                  kids.map((kid) => (
                    <button
                      key={kid.KidUserId}
                      type="button"
                      className={`kids-admin-tab${activeKidId === kid.KidUserId ? " is-active" : ""}`}
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

        <div className="kids-admin-tabs" role="tablist" aria-label="Kids admin sections">
          {[
            { key: "month", label: "Month" },
            { key: "history", label: "History" },
            { key: "chores", label: "Chores" },
            ...(hasApprovals ? [{ key: "approvals", label: "Approvals" }] : [])
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`kids-admin-tab-button${activeTab === tab.key ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {activeTab === "month" ? (
          <section className="kids-admin-month">
            <div className="kids-admin-month-header">
              <div className="kids-admin-month-picker">
                <button type="button" className="icon-button" onClick={() => handleMonthChange(-1)}>
                  <Icon name="chevronLeft" className="icon" />
                </button>
                <span className="kids-admin-month-label">{monthTitle}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleMonthChange(1)}
                  disabled={isCurrentMonth}
                >
                  <Icon name="chevronRight" className="icon" />
                </button>
              </div>
              <div className="kids-admin-month-actions">
                <button
                  type="button"
                  className="button-secondary-pill"
                  onClick={openAllowanceModal}
                  disabled={!activeKidId}
                >
                  Edit allowance
                </button>
                <button type="button" className="primary-button" onClick={openMoneyModal}>
                  Log money
                </button>
              </div>
            </div>

            <div className="kids-admin-month-layout">
              <section className="kids-admin-card kids-admin-summary-card">
                <div>
                  <h3>Month summary</h3>
                  <p className="text-muted">{activeKidName}</p>
                </div>
                <div className="kids-admin-summary-grid">
                  <div>
                    <span className="kids-admin-summary-label">Base allowance</span>
                    <span className="kids-admin-summary-value">
                      {monthSummary ? FormatCurrency(monthSummary.MonthlyAllowance) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="kids-admin-summary-label">Money in</span>
                    <span className="kids-admin-summary-value">
                      {monthSummary ? FormatCurrency(ledgerTotals.moneyIn) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="kids-admin-summary-label">Money out</span>
                    <span className="kids-admin-summary-value">
                      {monthSummary ? FormatCurrency(ledgerTotals.moneyOut) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="kids-admin-summary-label">Missed days</span>
                    <span className="kids-admin-summary-value">
                      {monthSummary
                        ? `${monthSummary.MissedDays} (${FormatCurrency(monthSummary.MissedDeduction)})`
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="kids-admin-summary-label">Bonus approved</span>
                    <span className="kids-admin-summary-value">
                      {monthSummary ? FormatCurrency(monthSummary.ApprovedBonusTotal) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="kids-admin-summary-label">Bonus pending</span>
                    <span className="kids-admin-summary-value">
                      {monthSummary ? FormatCurrency(monthSummary.PendingBonusTotal) : "-"}
                    </span>
                  </div>
                </div>
                <div className="kids-admin-summary-divider" />
                <div className="kids-admin-summary-current">
                  <span>Current total</span>
                  <strong>{monthSummary ? FormatCurrency(currentTotalDisplay) : "-"}</strong>
                </div>
                <div className="kids-admin-summary-total">
                  <span>Projected total</span>
                  <strong>
                    {monthSummary ? FormatCurrency(projectedTotalDisplay) : "-"}
                  </strong>
                </div>
              </section>

              <section className="kids-admin-card kids-admin-calendar-card">
                <div className="kids-admin-calendar-header">
                  <h3>Calendar</h3>
                  <p className="text-muted">Tap a day to edit entries.</p>
                </div>
                <div className="kids-admin-calendar-grid">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                    <div key={label} className="kids-admin-calendar-head">
                      {label}
                    </div>
                  ))}
                  {calendarCells.map((cell) =>
                    cell.isEmpty ? (
                      <div key={cell.key} className="kids-admin-day is-empty" />
                    ) : (
                      <button
                        key={cell.key}
                        type="button"
                        className={`kids-admin-day${cell.key === todayKey ? " is-today" : ""}${
                          cell.statusTone ? ` is-${cell.statusTone}` : ""
                        }`}
                        onClick={() => openDay(cell.dateKey)}
                      >
                        <div className="kids-admin-day-top">
                          <span className="kids-admin-day-number">{cell.dayNumber}</span>
                          {cell.pendingCount ? (
                            <span className="kids-admin-day-pending">!</span>
                          ) : null}
                        </div>
                        {cell.statusText ? (
                          <span className={`kids-admin-day-status is-${cell.statusTone}`}>
                            <span className="kids-admin-day-status-text">{cell.statusText}</span>
                            {cell.statusIcon ? (
                              <span className="kids-admin-day-status-icon" aria-hidden="true">
                                <Icon name={cell.statusIcon} className="icon" />
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {cell.bonusTotal ? (
                          <span className="kids-admin-day-bonus">
                            +{FormatCurrency(cell.bonusTotal)}
                          </span>
                        ) : null}
                      </button>
                    )
                  )}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeTab === "approvals" ? (
          <section className="kids-admin-card kids-admin-approvals">
            <div className="kids-admin-card-header">
              <div>
                <h2>Approvals</h2>
                <p className="text-muted">Review backdated chores.</p>
              </div>
            </div>
            <div className="kids-admin-approval-filters">
              <label>
                <span>Type</span>
                <select
                  value={approvalFilterType}
                  onChange={(event) => setApprovalFilterType(event.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="Daily">Daily jobs</option>
                  <option value="Habit">Habits</option>
                  <option value="Bonus">Bonus tasks</option>
                </select>
              </label>
              <label>
                <span>Date from</span>
                <input
                  type="date"
                  value={approvalRangeStart}
                  onChange={(event) => setApprovalRangeStart(event.target.value)}
                />
              </label>
              <label>
                <span>Date to</span>
                <input
                  type="date"
                  value={approvalRangeEnd}
                  onChange={(event) => setApprovalRangeEnd(event.target.value)}
                />
              </label>
            </div>

            {approvalsDates.length === 0 ? (
              <p className="text-muted">No pending approvals right now.</p>
            ) : (
              <div className="kids-admin-approval-groups">
                {approvalsDates.map((dateKey) => {
                  const entries = approvalsByDate[dateKey] || [];
                  const isOpen = approvalExpanded[dateKey] || false;
                  return (
                    <div key={dateKey} className="kids-admin-approval-group">
                      <div className="kids-admin-approval-group-header">
                        <button
                          type="button"
                          className="kids-admin-approval-toggle"
                          onClick={() => toggleApprovalGroup(dateKey)}
                        >
                          <span>{BuildDayLabel(dateKey)}</span>
                          <span className="kids-pill kids-pill--muted">{entries.length}</span>
                          <Icon
                            name="chevronDown"
                            className={`icon${isOpen ? " is-up" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          className="kids-outline-button"
                          onClick={() => onApproveDateGroup(dateKey)}
                          disabled={status === "saving"}
                        >
                          Approve all for this date
                        </button>
                      </div>
                      {isOpen ? (
                        <div className="kids-admin-approval-list">
                          {entries.map((entry) => (
                            <div key={entry.Id} className="kids-admin-approval-card">
                              <div>
                                <div className="kids-admin-approval-title">
                                  <span>{entry.ChoreLabel}</span>
                                  <span className="kids-pill">{TypeLabel(entry.ChoreType)}</span>
                                </div>
                                <p className="kids-muted">
                                  {entry.KidName} • {entry.EntryDate} • Logged {BuildDateTimeLabel(entry.CreatedAt)}
                                  {entry.Amount ? ` • ${FormatCurrency(entry.Amount)}` : ""}
                                </p>
                                {entry.Notes ? (
                                  <p className="kids-admin-approval-notes">{entry.Notes}</p>
                                ) : null}
                              </div>
                              <div className="kids-admin-approval-actions">
                                <button
                                  type="button"
                                  className="kids-outline-button"
                                  onClick={() => onApprovalAction(entry.Id, "reject")}
                                  disabled={status === "saving"}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="kids-primary-button"
                                  onClick={() => onApprovalAction(entry.Id, "approve")}
                                  disabled={status === "saving"}
                                >
                                  Approve
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="kids-admin-card kids-admin-history-view">
            <div className="kids-admin-history-header">
              <div className="kids-admin-month-picker">
                <button type="button" className="icon-button" onClick={() => handleMonthChange(-1)}>
                  <Icon name="chevronLeft" className="icon" />
                </button>
                <span className="kids-admin-month-label">{monthTitle}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleMonthChange(1)}
                  disabled={isCurrentMonth}
                >
                  <Icon name="chevronRight" className="icon" />
                </button>
              </div>
              <div className="kids-admin-history-filters">
                {[
                  { key: "all", label: "All" },
                  { key: "Daily", label: "Daily jobs" },
                  { key: "Habit", label: "Habits" },
                  { key: "Bonus", label: "Bonus tasks" },
                  { key: "Money", label: "Money" },
                  { key: "Pending", label: "Pending approval" },
                  { key: "Approved", label: "Approved" },
                  { key: "Rejected", label: "Rejected" }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`kids-filter-chip${historyFilter === filter.key ? " is-active" : ""}`}
                    onClick={() => setHistoryFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {historyDates.length === 0 ? (
              <p className="text-muted">No history entries for this month.</p>
            ) : (
              <div className="kids-admin-history-groups">
                {historyDates.map((dateKey) => {
                  const entries = historyByDate[dateKey] || [];
                  const overview = overviewByDate[dateKey];
                  const dailyTotal = overview?.DailyTotal || 0;
                  const dailyDone = overview?.DailyDone || 0;
                  const dailySummary = dailyTotal
                    ? `${dailyDone}/${dailyTotal} daily jobs done`
                    : "No daily jobs";
                  const bonusTotal = overview?.BonusApprovedTotal || 0;
                  const pendingCount = overview?.PendingCount || 0;
                  const isPastOrToday = dateKey <= todayKey;
                  let dayTone = "";
                  if (isPastOrToday) {
                    if (dailyTotal > 0) {
                      dayTone = dailyDone >= dailyTotal ? "done" : "missed";
                    } else {
                      dayTone = "missed";
                    }
                  }
                  const isOpen = historyExpanded[dateKey] || false;

                  return (
                    <div key={dateKey} className="kids-admin-history-group">
                      <div
                        className={`kids-admin-history-day-header${
                          dayTone ? ` is-${dayTone}` : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="kids-admin-history-day-toggle"
                          onClick={() => toggleHistoryGroup(dateKey)}
                        >
                          <div className="kids-admin-history-day-main">
                            <span className="kids-admin-history-date">
                              {BuildDayLabel(dateKey)}
                            </span>
                            {pendingCount ? (
                              <span className="kids-admin-day-pending">!</span>
                            ) : null}
                          </div>
                          <span className="kids-admin-history-date-meta">{dailySummary}</span>
                          {bonusTotal ? (
                            <span className="kids-admin-history-day-bonus">
                              +{FormatCurrency(bonusTotal)}
                            </span>
                          ) : null}
                          <Icon
                            name="chevronDown"
                            className={`icon${isOpen ? " is-up" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => openEntryModal({ dateValue: dateKey })}
                        >
                          Add entry
                        </button>
                      </div>
                      {isOpen ? (
                        <div className="kids-history-group-list">
                          {entries.map((entry) => {
                            const isEntryExpanded = historyEntryExpandedId === entry.Key;
                            const isLedger = entry.Kind === "ledger";
                            const amountValue = Number(entry.Amount || 0);
                            const showAmount = Number.isFinite(amountValue) && amountValue !== 0;
                            const amountLabel = FormatCurrency(amountValue);
                            return (
                              <div key={entry.Key} className="kids-history-item">
                                <button
                                  type="button"
                                  className={`kids-history-row${
                                    isEntryExpanded ? " is-expanded" : ""
                                  }`}
                                  onClick={() =>
                                    setHistoryEntryExpandedId(isEntryExpanded ? null : entry.Key)
                                  }
                                  aria-expanded={isEntryExpanded}
                                >
                                  <div className="kids-history-row-main">
                                    <span className="kids-history-title">{entry.Title}</span>
                                    {showAmount ? (
                                      <span
                                        className={`kids-history-amount kids-history-inline-amount${
                                          amountValue < 0 ? " is-negative" : ""
                                        }`}
                                      >
                                        {amountLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span
                                    className={`kids-history-chevron${
                                      isEntryExpanded ? " is-open" : ""
                                    }`}
                                  >
                                    <Icon name="chevronDown" className="icon" />
                                  </span>
                                </button>
                                {isEntryExpanded ? (
                                  <div className="kids-history-details">
                                    <div className="kids-history-detail-row">
                                      <span className="kids-history-detail-label">Notes</span>
                                      <span>{entry.Notes || "None"}</span>
                                    </div>
                                    <div className="kids-history-detail-row">
                                      <span className="kids-history-detail-label">Logged</span>
                                      <span>{BuildDateTimeLabel(entry.CreatedAt)}</span>
                                    </div>
                                    <div className="kids-history-detail-row">
                                      <span className="kids-history-detail-label">Type</span>
                                      <span>
                                        {isLedger
                                          ? MoneyTypeLabel(entry.EntryType)
                                          : TypeLabel(entry.ChoreType)}
                                      </span>
                                    </div>
                                    {!isLedger ? (
                                      <div className="kids-history-detail-row">
                                        <span className="kids-history-detail-label">Status</span>
                                        <span>{entry.Status || "-"}</span>
                                      </div>
                                    ) : null}
                                    {!isLedger ? (
                                      <div className="kids-admin-history-actions">
                                        <button
                                          type="button"
                                          className="button-secondary-pill"
                                          onClick={() => openEntryModal({ entry })}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="button-secondary-pill"
                                          onClick={() => onDeleteEntry(entry)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "chores" ? (
          <section className="kids-admin-card kids-admin-chores-view">
            <div className="kids-admin-card-header">
              <div>
                <h2>Chores</h2>
                <p className="text-muted">Daily jobs, habits, and bonus tasks.</p>
              </div>
              <button type="button" className="primary-button" onClick={() => setShowChoresModal(true)}>
                Manage chores
              </button>
            </div>
            <div className="kids-admin-chores-summary">
              <div>
                <span className="kids-admin-summary-label">Daily jobs</span>
                <span className="kids-admin-summary-value">{choreCounts.Daily}</span>
              </div>
              <div>
                <span className="kids-admin-summary-label">Habits</span>
                <span className="kids-admin-summary-value">{choreCounts.Habit}</span>
              </div>
              <div>
                <span className="kids-admin-summary-label">Bonus tasks</span>
                <span className="kids-admin-summary-value">{choreCounts.Bonus}</span>
              </div>
              <div>
                <span className="kids-admin-summary-label">Disabled</span>
                <span className="kids-admin-summary-value">{choreCounts.Disabled}</span>
              </div>
              <div>
                <span className="kids-admin-summary-label">Assigned to {activeKidName}</span>
                <span className="kids-admin-summary-value">{assignedToActiveCount}</span>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {showChoresModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowChoresModal(false)}>
          <div className="modal kids-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Manage chores</h3>
                <p className="text-muted">Search, filter, and edit chores.</p>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="button-secondary-pill"
                  onClick={() => openChoreForm(null, true)}
                >
                  Add chore
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowChoresModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>

            <div className="kids-admin-chore-controls">
              <input
                type="search"
                placeholder="Search chores"
                value={choreSearch}
                onChange={(event) => setChoreSearch(event.target.value)}
              />
              <div className="kids-admin-chore-filters">
                {[
                  { key: "all", label: "All" },
                  { key: "Daily", label: "Daily jobs" },
                  { key: "Habit", label: "Habits" },
                  { key: "Bonus", label: "Bonus tasks" },
                  { key: "disabled", label: "Disabled" }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`kids-filter-chip${choreFilter === filter.key ? " is-active" : ""}`}
                    onClick={() => setChoreFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="kids-admin-chore-list">
              {visibleChoreGroups.map(([type, list]) => (
                <details key={type} open className="kids-admin-chore-group">
                  <summary className="kids-admin-chore-group-header">
                    <span>{type === "Disabled" ? "Disabled chores" : TypeLabel(type)}</span>
                    <span className="kids-pill kids-pill--muted">{list.length}</span>
                  </summary>
                  {list.length === 0 ? (
                    <p className="text-muted">No chores in this section.</p>
                  ) : (
                    list.map((chore) => (
                      <div key={chore.Id} className="kids-admin-chore-row">
                        <div>
                          <div className="kids-admin-chore-name">{chore.Label}</div>
                          <div className="kids-admin-chore-row-meta">
                            <span className="kids-pill">{TypeLabel(chore.Type)}</span>
                            {chore.IsActive === false ? (
                              <span className="kids-pill kids-pill--muted">Disabled</span>
                            ) : null}
                            <span className="kids-admin-chore-assignees">
                              {(chore.AssignedKidIds || []).length
                                ? kids
                                    .filter((kid) =>
                                      (chore.AssignedKidIds || []).includes(kid.KidUserId)
                                    )
                                    .map((kid) => kid.FirstName || kid.Username)
                                    .join(", ")
                                : "Unassigned"}
                            </span>
                          </div>
                        </div>
                        <div className="kids-admin-chore-meta">
                          <span className="kids-admin-chore-amount">
                            {chore.Type === "Bonus" ? FormatCurrency(chore.Amount) : ""}
                          </span>
                          <label className="form-switch">
                            <input
                              type="checkbox"
                              checked={chore.IsActive !== false}
                              onChange={() => onToggleChoreActive(chore)}
                            />
                            <span className="switch-track">
                              <span className="switch-thumb" />
                            </span>
                          </label>
                          <div className="kids-admin-chore-actions">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Edit ${chore.Label}`}
                              onClick={() => openChoreForm(chore, true)}
                            >
                              <Icon name="edit" className="icon" />
                            </button>
                            <button
                              type="button"
                              className="icon-button is-danger"
                              aria-label={`Disable ${chore.Label}`}
                              onClick={() => onDeleteChore(chore)}
                            >
                              <Icon name="trash" className="icon" />
                            </button>
                          </div>
                          <details className="kids-admin-chore-menu">
                            <summary className="icon-button" aria-label="More actions">
                              <Icon name="more" className="icon" />
                            </summary>
                            <div className="kids-admin-chore-menu-list">
                              <button
                                type="button"
                                onClick={(event) => {
                                  closeChoreMenu(event);
                                  openChoreForm(chore, true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  closeChoreMenu(event);
                                  onDeleteChore(chore);
                                }}
                              >
                                Disable
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))
                  )}
                </details>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showAllowanceModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAllowanceModal(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Monthly allowance</h3>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowAllowanceModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-admin-form" onSubmit={onSaveAllowance}>
                <label>
                  <span>Monthly allowance</span>
                  <input
                    value={allowanceForm.Amount}
                    onChange={(event) =>
                      setAllowanceForm((prev) => ({
                        ...prev,
                        Amount: NormalizeAmountInput(event.target.value)
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={allowanceForm.StartDate}
                    onChange={(event) =>
                      setAllowanceForm((prev) => ({
                        ...prev,
                        StartDate: event.target.value
                      }))
                    }
                  />
                </label>
                <div className="kids-admin-form-wide">
                  <button type="submit" className="primary-button" disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save allowance"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {showMoneyModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeMoneyModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Log money</h3>
                {ledgerBalance !== null ? (
                  <p className="text-muted">Current balance: {FormatCurrency(ledgerBalance)}</p>
                ) : null}
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeMoneyModal}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-admin-form" onSubmit={onSaveMoney}>
                <label>
                  <span>Type</span>
                  <select name="EntryType" value={moneyForm.EntryType} onChange={onMoneyFormChange}>
                    <option value="StartingBalance">Balance adjustment</option>
                    <option value="Deposit">Deposit</option>
                    <option value="Withdrawal">Withdrawal</option>
                  </select>
                </label>
                <label>
                  <span>Amount</span>
                  <input name="Amount" value={moneyForm.Amount} onChange={onMoneyFormChange} />
                </label>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    name="EntryDate"
                    value={moneyForm.EntryDate}
                    onChange={onMoneyFormChange}
                  />
                </label>
                <label>
                  <span>Label</span>
                  <input
                    name="Narrative"
                    value={moneyForm.Narrative}
                    onChange={onMoneyFormChange}
                  />
                </label>
                <label className="kids-admin-form-wide">
                  <span>Notes</span>
                  <textarea
                    name="Notes"
                    rows={3}
                    value={moneyForm.Notes}
                    onChange={onMoneyFormChange}
                  />
                </label>
                {moneyError ? <p className="form-error">{moneyError}</p> : null}
                <div className="kids-admin-form-wide">
                  <button type="submit" className="primary-button" disabled={moneyStatus === "saving"}>
                    {moneyStatus === "saving" ? "Saving..." : "Save entry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {showChoreForm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeChoreForm}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingChore ? "Edit chore" : "New chore"}</h3>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeChoreForm}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-admin-form" onSubmit={onSaveChore}>
                <label>
                  <span>Name</span>
                  <input name="Label" value={choreForm.Label} onChange={onChoreFormChange} />
                </label>
                <label>
                  <span>Type</span>
                  <select name="Type" value={choreForm.Type} onChange={onChoreFormChange}>
                    <option value="Daily">Daily jobs</option>
                    <option value="Habit">Habits</option>
                    <option value="Bonus">Bonus tasks</option>
                  </select>
                </label>
                {choreForm.Type === "Bonus" ? (
                  <label>
                    <span>Amount</span>
                    <input
                      name="Amount"
                      value={choreForm.Amount}
                      onChange={(event) =>
                        setChoreForm((prev) => ({
                          ...prev,
                          Amount: NormalizeAmountInput(event.target.value)
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    name="StartDate"
                    value={choreForm.StartDate}
                    onChange={onChoreFormChange}
                  />
                </label>
                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    name="EndDate"
                    value={choreForm.EndDate}
                    onChange={onChoreFormChange}
                  />
                </label>
                <label>
                  <span>Display order</span>
                  <input name="SortOrder" value={choreForm.SortOrder} onChange={onChoreFormChange} />
                </label>
                <label className="kids-admin-toggle">
                  <input
                    type="checkbox"
                    name="IsActive"
                    checked={choreForm.IsActive}
                    onChange={onChoreFormChange}
                  />
                  <span>Enabled</span>
                </label>

                <div className="kids-admin-assignees">
                  <span className="kids-admin-hint">Assign to kids</span>
                  <div className="kids-admin-tags">
                    {kids.map((kid) => (
                      <label key={kid.KidUserId} className="kids-admin-tag">
                        <input
                          type="checkbox"
                          checked={choreForm.KidUserIds.includes(kid.KidUserId)}
                          onChange={() => onToggleKidAssignment(kid.KidUserId)}
                        />
                        <span>{kid.FirstName || kid.Username}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="kids-admin-form-wide">
                  <button type="submit" className="primary-button" disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {showDayDrawer ? (
        <div
          className="kids-admin-drawer-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeDayDrawer}
        >
          <div className="kids-admin-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="kids-admin-drawer-header">
              <div>
                <h3>{BuildDayLabel(selectedDay)}</h3>
                {dayPendingCount ? (
                  <span className="kids-pill kids-pill--muted">
                    Pending approvals: {dayPendingCount}
                  </span>
                ) : null}
              </div>
              <button type="button" className="icon-button" onClick={closeDayDrawer}>
                <Icon name="close" className="icon" />
              </button>
            </div>

            {dayStatus === "loading" ? (
              <p className="text-muted">Loading day...</p>
            ) : (
              <div className="kids-admin-drawer-body">
                <section className="kids-admin-drawer-section">
                  <h4>Daily jobs</h4>
                  {(dayDetail?.DailyJobs || []).length === 0 ? (
                    <p className="text-muted">No daily jobs for this date.</p>
                  ) : (
                    (dayDetail?.DailyJobs || []).map((chore) => {
                      const entry = entryByChoreId.get(chore.Id);
                      const isActive = entry && entry.Status !== "Rejected";
                      return (
                        <button
                          key={chore.Id}
                          type="button"
                          className="kids-admin-day-row"
                          onClick={() => onToggleDayChore(chore)}
                          aria-pressed={isActive}
                        >
                          <span>{chore.Label}</span>
                          <span className={`kids-chore-toggle${isActive ? " is-on" : ""}`} />
                        </button>
                      );
                    })
                  )}
                </section>

                <section className="kids-admin-drawer-section">
                  <h4>Habits</h4>
                  {(dayDetail?.Habits || []).length === 0 ? (
                    <p className="text-muted">No habits for this date.</p>
                  ) : (
                    (dayDetail?.Habits || []).map((chore) => {
                      const entry = entryByChoreId.get(chore.Id);
                      const isActive = entry && entry.Status !== "Rejected";
                      return (
                        <button
                          key={chore.Id}
                          type="button"
                          className="kids-admin-day-row"
                          onClick={() => onToggleDayChore(chore)}
                          aria-pressed={isActive}
                        >
                          <span>{chore.Label}</span>
                          <span className={`kids-chore-toggle${isActive ? " is-on" : ""}`} />
                        </button>
                      );
                    })
                  )}
                </section>

                <section className="kids-admin-drawer-section">
                  <div className="kids-admin-drawer-section-header">
                    <h4>Bonus tasks</h4>
                    <button
                      type="button"
                      className="button-secondary-pill"
                      onClick={() => openEntryModal({ type: "Bonus", dateValue: selectedDay })}
                    >
                      Add bonus task
                    </button>
                  </div>
                  {(dayDetail?.Entries || []).filter((entry) => entry.ChoreType === "Bonus").length === 0 ? (
                    <p className="text-muted">No bonus tasks logged.</p>
                  ) : (
                    (dayDetail?.Entries || [])
                      .filter((entry) => entry.ChoreType === "Bonus")
                      .map((entry) => (
                        <div key={entry.Id} className="kids-admin-bonus-row">
                          <div>
                            <span>{entry.ChoreLabel}</span>
                            <div className="kids-admin-bonus-meta">
                              <span className="kids-pill">{entry.Status}</span>
                              <span className="kids-pill kids-pill--muted">
                                {FormatCurrency(entry.Amount)}
                              </span>
                            </div>
                          </div>
                          <div className="kids-admin-bonus-actions">
                            <button
                              type="button"
                              className="button-secondary-pill"
                              onClick={() => openEntryModal({ entry })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button-secondary-pill"
                              onClick={() => onDeleteEntry(entry)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </section>

                <div className="kids-admin-drawer-actions">
                  <button
                    type="button"
                    className="kids-outline-button"
                    onClick={() => openEntryModal({ dateValue: selectedDay })}
                  >
                    Add entry
                  </button>
                  <button type="button" className="kids-primary-button" onClick={closeDayDrawer}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showEntryModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEntryModal(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{entryForm.EntryId ? "Edit entry" : "Add entry"}</h3>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowEntryModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-admin-form" onSubmit={onSaveEntry}>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    name="EntryDate"
                    value={entryForm.EntryDate}
                    onChange={onEntryFormChange}
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select
                    name="Type"
                    value={entryForm.Type}
                    onChange={onEntryFormChange}
                    disabled={Boolean(entryForm.EntryId)}
                  >
                    <option value="Daily">Daily jobs</option>
                    <option value="Habit">Habits</option>
                    <option value="Bonus">Bonus tasks</option>
                  </select>
                </label>
                <label>
                  <span>Chore</span>
                  <select
                    name="ChoreId"
                    value={entryForm.ChoreId}
                    onChange={onEntryFormChange}
                    disabled={Boolean(entryForm.EntryId)}
                  >
                    <option value="" disabled>
                      Select chore
                    </option>
                    {(availableChoresByType[entryForm.Type] || []).map((chore) => (
                      <option key={chore.Id} value={chore.Id}>
                        {chore.Label}
                      </option>
                    ))}
                  </select>
                </label>
                {entryForm.Type === "Bonus" ? (
                  <label>
                    <span>Amount</span>
                    <input
                      name="Amount"
                      value={entryForm.Amount}
                      onChange={(event) =>
                        setEntryForm((prev) => ({
                          ...prev,
                          Amount: NormalizeAmountInput(event.target.value)
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label className="kids-admin-form-wide">
                  <span>Note</span>
                  <input name="Notes" value={entryForm.Notes} onChange={onEntryFormChange} />
                </label>
                <div className="kids-admin-form-wide">
                  <button type="submit" className="primary-button" disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save entry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KidsAdmin;
