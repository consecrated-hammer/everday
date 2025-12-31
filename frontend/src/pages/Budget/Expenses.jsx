import { useEffect, useMemo, useRef, useState } from "react";

import DataTable from "../../components/DataTable.jsx";
import { ExpenseTable } from "../../components/ExpenseTable.jsx";
import Icon from "../../components/Icon.jsx";
import {
  CreateExpense,
  CreateExpenseAccount,
  CreateExpenseType,
  DeleteExpense,
  DeleteExpenseAccount,
  DeleteExpenseType,
  FetchExpenseAccounts,
  FetchExpenseTypes,
  FetchExpenses,
  UpdateExpense,
  UpdateExpenseAccount,
  UpdateExpenseOrder,
  UpdateExpenseType
} from "../../lib/budgetApi.js";
import {
  DefaultExpenseTableState,
  NormalizeExpenseTableState
} from "../../lib/expenseTable.js";
import { ToNumber } from "../../lib/formatters.js";

const InitialExpenseForm = {
  Label: "",
  Amount: "",
  Frequency: "Monthly",
  Account: "",
  Type: "",
  NextDueDate: "",
  Cadence: "",
  Interval: "",
  Enabled: true,
  Notes: ""
};

const emptyAccountForm = {
  Name: "",
  Enabled: true
};

const emptyTypeForm = {
  Name: "",
  Enabled: true
};

const BuildExpenseStorageKey = (key) => `expense-table:${key}`;

const NormalizeFrequencyValue = (value) => String(value || "").toLowerCase();

const MatchFrequencyValue = (value) => {
  const normalized = NormalizeFrequencyValue(value);
  if (normalized === "annually" || normalized === "annual") {
    return "yearly";
  }
  if (normalized === "biweekly" || normalized === "bi-weekly") {
    return "fortnightly";
  }
  return normalized;
};

const ResolveExpensePeriodValue = (expense, periodKey, fallbackValue) => {
  if (MatchFrequencyValue(expense.Frequency) === periodKey) {
    return ToNumber(expense.Amount);
  }
  return ToNumber(fallbackValue);
};

const BudgetExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [types, setTypes] = useState([]);
  const [expenseForm, setExpenseForm] = useState(InitialExpenseForm);
  const [editExpenseForm, setEditExpenseForm] = useState(InitialExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState("add");
  const [spreadsheetMode, setSpreadsheetMode] = useState(false);
  const expenseAddLabelRef = useRef(null);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseColumnsOpen, setExpenseColumnsOpen] = useState(false);
  const [expenseActiveFilter, setExpenseActiveFilter] = useState(null);
  const [expenseMenuOpen, setExpenseMenuOpen] = useState(false);
  const expenseResizeRef = useRef({ key: null, startX: 0, startWidth: 0 });
  const [draggingExpenseId, setDraggingExpenseId] = useState(null);
  const [dragOverExpenseId, setDragOverExpenseId] = useState(null);
  const expensePanelRef = useRef(null);
  const [expenseTableState, setExpenseTableState] = useState(DefaultExpenseTableState);
  const [expenseTableLoaded, setExpenseTableLoaded] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountEditingId, setAccountEditingId] = useState(null);
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);
  const [typeEditingId, setTypeEditingId] = useState(null);
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const expenseTableKey = "budget-expenses";

  const loadExpenses = async () => {
    const data = await FetchExpenses();
    setExpenses(data);
    return data;
  };

  const loadAccounts = async () => {
    const data = await FetchExpenseAccounts();
    setAccounts(data);
    return data;
  };

  const loadTypes = async () => {
    const data = await FetchExpenseTypes();
    setTypes(data);
    return data;
  };

  const loadAll = async () => {
    try {
      setStatus("loading");
      setError("");
      await Promise.all([loadExpenses(), loadAccounts(), loadTypes()]);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load expenses");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(BuildExpenseStorageKey(expenseTableKey));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExpenseTableState(NormalizeExpenseTableState(parsed));
      } catch (err) {
        setExpenseTableState(DefaultExpenseTableState);
      }
    }
    setExpenseTableLoaded(true);
  }, [expenseTableKey]);

  useEffect(() => {
    if (!expenseTableLoaded) {
      return;
    }
    localStorage.setItem(
      BuildExpenseStorageKey(expenseTableKey),
      JSON.stringify(expenseTableState)
    );
  }, [expenseTableState, expenseTableKey, expenseTableLoaded]);

  useEffect(() => {
    const onClick = (event) => {
      if (!expensePanelRef.current || !expensePanelRef.current.contains(event.target)) {
        setExpenseColumnsOpen(false);
        setExpenseMenuOpen(false);
        setExpenseActiveFilter(null);
        return;
      }
      if (
        event.target.closest(".dropdown") ||
        event.target.closest(".toolbar-button") ||
        event.target.closest(".filter-icon") ||
        event.target.closest(".expense-filter-dropdown")
      ) {
        return;
      }
      setExpenseColumnsOpen(false);
      setExpenseMenuOpen(false);
      setExpenseActiveFilter(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setExpenseColumnsOpen(false);
        setExpenseMenuOpen(false);
        setExpenseActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!spreadsheetMode) {
      setEditingExpenseId(null);
      setEditExpenseForm(InitialExpenseForm);
    }
  }, [spreadsheetMode]);

  const expenseColumnConfig = useMemo(() => {
    return expenseTableState.Columns.reduce((acc, column) => {
      acc[column.Key] = column;
      return acc;
    }, {});
  }, [expenseTableState]);

  const expenseFilters = useMemo(() => expenseTableState.Filters || {}, [expenseTableState]);

  const filteredExpenses = useMemo(() => {
    const query = expenseSearch.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (expenseFilters.Frequency?.length && !expenseFilters.Frequency.includes(expense.Frequency)) {
        return false;
      }
      if (expenseFilters.Account?.length) {
        const accountValue = expense.Account ? expense.Account : "None";
        if (!expenseFilters.Account.includes(accountValue)) {
          return false;
        }
      }
      if (expenseFilters.Type?.length) {
        const typeValue = expense.Type ? expense.Type : "None";
        if (!expenseFilters.Type.includes(typeValue)) {
          return false;
        }
      }
      if (expenseFilters.Cadence?.length) {
        const cadenceValue = expense.Cadence ? expense.Cadence : "None";
        if (!expenseFilters.Cadence.includes(cadenceValue)) {
          return false;
        }
      }
      if (expenseFilters.Enabled?.length) {
        const enabledValue = expense.Enabled ? "Enabled" : "Disabled";
        if (!expenseFilters.Enabled.includes(enabledValue)) {
          return false;
        }
      }
      if (!query) {
        return true;
      }
      const haystack = [expense.Label, expense.Account, expense.Type, expense.Cadence, expense.Notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [expenses, expenseSearch, expenseFilters]);

  const expenseTotals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, expense) => {
        if (!expense.Enabled) {
          return acc;
        }
        acc.PerDay += ResolveExpensePeriodValue(expense, "daily", expense.PerDay);
        acc.PerWeek += ResolveExpensePeriodValue(expense, "weekly", expense.PerWeek);
        acc.PerFortnight += ResolveExpensePeriodValue(expense, "fortnightly", expense.PerFortnight);
        acc.PerMonth += ResolveExpensePeriodValue(expense, "monthly", expense.PerMonth);
        acc.PerYear += ResolveExpensePeriodValue(expense, "yearly", expense.PerYear);
        return acc;
      },
      { PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0 }
    );
  }, [filteredExpenses]);

  const expenseFilterOptions = useMemo(() => {
    const buildOptions = (excludeKey) => {
      return expenses.filter((expense) => {
        if (excludeKey !== "Frequency" && expenseFilters.Frequency?.length) {
          if (!expenseFilters.Frequency.includes(expense.Frequency)) {
            return false;
          }
        }
        if (excludeKey !== "Account" && expenseFilters.Account?.length) {
          const accountValue = expense.Account ? expense.Account : "None";
          if (!expenseFilters.Account.includes(accountValue)) {
            return false;
          }
        }
        if (excludeKey !== "Type" && expenseFilters.Type?.length) {
          const typeValue = expense.Type ? expense.Type : "None";
          if (!expenseFilters.Type.includes(typeValue)) {
            return false;
          }
        }
        if (excludeKey !== "Cadence" && expenseFilters.Cadence?.length) {
          const cadenceValue = expense.Cadence ? expense.Cadence : "None";
          if (!expenseFilters.Cadence.includes(cadenceValue)) {
            return false;
          }
        }
        if (excludeKey !== "Enabled" && expenseFilters.Enabled?.length) {
          const enabledValue = expense.Enabled ? "Enabled" : "Disabled";
          if (!expenseFilters.Enabled.includes(enabledValue)) {
            return false;
          }
        }
        return true;
      });
    };

    const frequencyValues = new Set();
    const accountValues = new Set();
    const typeValues = new Set();
    const cadenceValues = new Set();
    buildOptions("Frequency").forEach((expense) => frequencyValues.add(expense.Frequency));
    buildOptions("Account").forEach((expense) =>
      accountValues.add(expense.Account ? expense.Account : "None")
    );
    buildOptions("Type").forEach((expense) => typeValues.add(expense.Type ? expense.Type : "None"));
    buildOptions("Cadence").forEach((expense) =>
      cadenceValues.add(expense.Cadence ? expense.Cadence : "None")
    );
    return {
      Frequency: Array.from(frequencyValues).filter(Boolean).sort(),
      Account: Array.from(accountValues).sort(),
      Type: Array.from(typeValues).sort(),
      Cadence: Array.from(cadenceValues).sort(),
      Enabled: ["Enabled", "Disabled"]
    };
  }, [expenses, expenseFilters]);

  const sortedExpenses = useMemo(() => {
    const sortKey = expenseTableState.Sort?.Key || "Order";
    const direction = expenseTableState.Sort?.Direction === "desc" ? -1 : 1;
    const sorted = [...filteredExpenses];
    const normalize = (value) => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "number") {
        return value;
      }
      return String(value).toLowerCase();
    };
    const getSortValue = (expense) => {
      if (sortKey === "Order") {
        return expense.DisplayOrder ?? 0;
      }
      if (sortKey === "Amount") {
        return Number(expense.Amount || 0);
      }
      if (sortKey === "PerDay") {
        return Number(expense.PerDay || 0);
      }
      if (sortKey === "PerWeek") {
        return Number(expense.PerWeek || 0);
      }
      if (sortKey === "PerFortnight") {
        return Number(expense.PerFortnight || 0);
      }
      if (sortKey === "PerMonth") {
        return Number(expense.PerMonth || 0);
      }
      if (sortKey === "PerYear") {
        return Number(expense.PerYear || 0);
      }
      if (sortKey === "NextDueDate") {
        return expense.NextDueDate ? new Date(expense.NextDueDate).getTime() : 0;
      }
      if (sortKey === "Account") {
        return expense.Account ? expense.Account : "None";
      }
      if (sortKey === "Type") {
        return expense.Type ? expense.Type : "None";
      }
      if (sortKey === "Cadence") {
        return expense.Cadence ? expense.Cadence : "None";
      }
      if (sortKey === "Interval") {
        return expense.Interval ? Number(expense.Interval) : 0;
      }
      return expense[sortKey];
    };
    sorted.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (normalize(aValue) < normalize(bValue)) {
        return -1 * direction;
      }
      if (normalize(aValue) > normalize(bValue)) {
        return 1 * direction;
      }
      return 0;
    });
    return sorted;
  }, [filteredExpenses, expenseTableState]);

  const visibleColumnKeys = expenseTableState.Columns.filter(
    (column) => column.Visible !== false
  ).map((column) => column.Key);
  const expenseTotalLabelKey =
    ["Order", "Label", "Amount", "Frequency", "Account", "Type"].find((key) =>
      visibleColumnKeys.includes(key)
    ) || null;

  const StartAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm(InitialExpenseForm);
    setExpenseModalMode("add");
    setExpenseModalOpen(true);
  };

  const CloseExpenseModal = () => {
    if (expenseModalMode === "edit") {
      setEditingExpenseId(null);
      setEditExpenseForm(InitialExpenseForm);
    } else {
      setExpenseForm(InitialExpenseForm);
    }
    setExpenseModalOpen(false);
  };

  const StartEditExpense = (expense, openModal = true) => {
    setEditingExpenseId(expense.Id);
    setEditExpenseForm({
      Label: expense.Label,
      Amount: expense.Amount,
      Frequency: expense.Frequency,
      Account: expense.Account || "",
      Type: expense.Type || "",
      NextDueDate: expense.NextDueDate || "",
      Cadence: expense.Cadence || "",
      Interval: expense.Interval ? String(expense.Interval) : "",
      Enabled: expense.Enabled,
      Notes: expense.Notes || ""
    });
    if (openModal) {
      setExpenseModalMode("edit");
      setExpenseModalOpen(true);
    }
  };

  const HandleExpenseSubmit = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      const nextDueDate = expenseForm.NextDueDate || null;
      const payload = {
        Label: expenseForm.Label.trim(),
        Amount: Number(expenseForm.Amount),
        Frequency: expenseForm.Frequency,
        Account: expenseForm.Account || null,
        Type: expenseForm.Type || null,
        NextDueDate: nextDueDate,
        Cadence: expenseForm.Cadence || null,
        Interval: expenseForm.Interval ? Number(expenseForm.Interval) : null,
        Month: nextDueDate ? new Date(nextDueDate).getMonth() + 1 : null,
        DayOfMonth: nextDueDate ? new Date(nextDueDate).getDate() : null,
        Enabled: expenseForm.Enabled,
        Notes: expenseForm.Notes || null
      };
      await CreateExpense(payload);
      setExpenseForm(InitialExpenseForm);
      if (spreadsheetMode) {
        requestAnimationFrame(() => {
          expenseAddLabelRef.current?.focus();
        });
      }
      setExpenseModalOpen(false);
      await loadExpenses();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save expense");
    } finally {
      setStatus("ready");
    }
  };

  const SaveExpenseEdit = async (expenseId) => {
    try {
      setStatus("saving");
      setError("");
      const nextDueDate = editExpenseForm.NextDueDate || null;
      const payload = {
        Label: editExpenseForm.Label.trim(),
        Amount: Number(editExpenseForm.Amount),
        Frequency: editExpenseForm.Frequency,
        Account: editExpenseForm.Account || null,
        Type: editExpenseForm.Type || null,
        NextDueDate: nextDueDate,
        Cadence: editExpenseForm.Cadence || null,
        Interval: editExpenseForm.Interval ? Number(editExpenseForm.Interval) : null,
        Month: nextDueDate ? new Date(nextDueDate).getMonth() + 1 : null,
        DayOfMonth: nextDueDate ? new Date(nextDueDate).getDate() : null,
        Enabled: editExpenseForm.Enabled,
        Notes: editExpenseForm.Notes || null
      };
      await UpdateExpense(expenseId, payload);
      setEditingExpenseId(null);
      setEditExpenseForm(InitialExpenseForm);
      setExpenseModalOpen(false);
      await loadExpenses();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update expense");
    } finally {
      setStatus("ready");
    }
  };

  const CancelExpenseEdit = () => {
    if (expenseModalOpen) {
      CloseExpenseModal();
      return;
    }
    setEditingExpenseId(null);
    setEditExpenseForm(InitialExpenseForm);
  };

  const ToggleExpenseEnabled = async (expense) => {
    const payload = {
      Label: expense.Label,
      Amount: Number(expense.Amount),
      Frequency: expense.Frequency,
      Account: expense.Account,
      Type: expense.Type,
      NextDueDate: expense.NextDueDate,
      Cadence: expense.Cadence,
      Interval: expense.Interval,
      Month: expense.Month,
      DayOfMonth: expense.DayOfMonth,
      Enabled: !expense.Enabled,
      Notes: expense.Notes
    };
    await UpdateExpense(expense.Id, payload);
    await loadExpenses();
  };

  const DeleteExpenseItem = async (expenseId) => {
    if (!window.confirm("Delete this expense?")) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteExpense(expenseId);
      await loadExpenses();
      CloseExpenseModal();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete expense");
    } finally {
      setStatus("ready");
    }
  };

  const ToggleExpenseColumnVisibility = (key) => {
    const column = expenseColumnConfig[key];
    if (column?.Locked) {
      return;
    }
    setExpenseTableState((current) => ({
      ...current,
      Columns: current.Columns.map((item) =>
        item.Key === key ? { ...item, Visible: item.Visible === false } : item
      )
    }));
  };

  const ResetExpenseTableState = () => {
    setExpenseTableState(DefaultExpenseTableState);
  };

  const SetExpenseSort = (key) => {
    setExpenseTableState((current) => ({
      ...current,
      Sort: {
        Key: key,
        Direction:
          current.Sort?.Key === key && current.Sort?.Direction === "asc" ? "desc" : "asc"
      }
    }));
  };

  const StartExpenseColumnResize = (key, event) => {
    expenseResizeRef.current = {
      key,
      startX: event.clientX,
      startWidth: expenseColumnConfig[key]?.Width || 120
    };
    document.addEventListener("mousemove", HandleExpenseColumnResize);
    document.addEventListener("mouseup", StopExpenseColumnResize);
  };

  const HandleExpenseColumnResize = (event) => {
    const { key, startX, startWidth } = expenseResizeRef.current;
    if (!key) {
      return;
    }
    const delta = event.clientX - startX;
    const minWidth = 60;
    const nextWidth = Math.max(minWidth, startWidth + delta);
    setExpenseTableState((current) => ({
      ...current,
      Columns: current.Columns.map((column) =>
        column.Key === key ? { ...column, Width: nextWidth } : column
      )
    }));
  };

  const StopExpenseColumnResize = () => {
    expenseResizeRef.current = { key: null, startX: 0, startWidth: 0 };
    document.removeEventListener("mousemove", HandleExpenseColumnResize);
    document.removeEventListener("mouseup", StopExpenseColumnResize);
  };

  const ToggleExpenseFilterValue = (key, value) => {
    setExpenseTableState((current) => {
      const filters = current.Filters || {};
      const currentValues = filters[key] || [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return {
        ...current,
        Filters: {
          ...filters,
          [key]: nextValues
        }
      };
    });
  };

  const ClearExpenseFilter = (key) => {
    setExpenseTableState((current) => ({
      ...current,
      Filters: { ...(current.Filters || {}), [key]: [] }
    }));
  };

  const MoveExpenseColumn = (key, direction) => {
    setExpenseTableState((current) => {
      const columns = [...current.Columns];
      const index = columns.findIndex((column) => column.Key === key);
      if (index === -1 || columns[index].Locked) {
        return current;
      }
      const step = direction === "up" ? -1 : 1;
      let target = index + step;
      while (target >= 0 && target < columns.length && columns[target].Locked) {
        target += step;
      }
      if (target < 0 || target >= columns.length) {
        return current;
      }
      const nextColumns = [...columns];
      const [moved] = nextColumns.splice(index, 1);
      nextColumns.splice(target, 0, moved);
      return { ...current, Columns: nextColumns };
    });
  };

  const CanMoveExpenseColumn = (index, direction) => {
    const columns = expenseTableState.Columns;
    if (!columns[index] || columns[index].Locked) {
      return false;
    }
    const step = direction === "up" ? -1 : 1;
    let target = index + step;
    while (target >= 0 && target < columns.length && columns[target].Locked) {
      target += step;
    }
    return target >= 0 && target < columns.length;
  };

  const StartExpenseDrag = (expenseId, event) => {
    setDraggingExpenseId(expenseId);
    event.dataTransfer.effectAllowed = "move";
  };

  const HandleExpenseDragOver = (expenseId, event) => {
    event.preventDefault();
    if (draggingExpenseId && expenseId !== draggingExpenseId) {
      setDragOverExpenseId(expenseId);
    }
  };

  const HandleExpenseDragLeave = () => {
    setDragOverExpenseId(null);
  };

  const HandleExpenseDrop = async (expenseId, event) => {
    event.preventDefault();
    if (!draggingExpenseId || draggingExpenseId === expenseId) {
      setDragOverExpenseId(null);
      return;
    }
    const currentOrder = [...expenses]
      .sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0))
      .map((expense) => expense.Id);
    const fromIndex = currentOrder.indexOf(draggingExpenseId);
    const toIndex = currentOrder.indexOf(expenseId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const reordered = [...currentOrder];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    try {
      setStatus("saving");
      await UpdateExpenseOrder({ OrderedIds: reordered });
      const orderMap = reordered.reduce((acc, id, index) => {
        acc[id] = index + 1;
        return acc;
      }, {});
      setExpenses((current) =>
        current.map((expense) => ({
          ...expense,
          DisplayOrder: orderMap[expense.Id] || expense.DisplayOrder
        }))
      );
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to reorder expenses");
    } finally {
      setStatus("ready");
      setDragOverExpenseId(null);
      setDraggingExpenseId(null);
    }
  };

  const TrySubmitExpense = () => {
    if (!expenseForm.Label.trim() || !expenseForm.Amount) {
      return;
    }
    HandleExpenseSubmit({ preventDefault: () => {} });
  };

  const HandleExpenseAddKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      TrySubmitExpense();
    }
  };

  const HandleExpenseEditKeyDown = (event, expenseId) => {
    if (event.key === "Enter") {
      event.preventDefault();
      SaveExpenseEdit(expenseId);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      CancelExpenseEdit();
    }
  };

  const onAccountChange = (event) => {
    const { name, value, type, checked } = event.target;
    setAccountForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const onAccountSubmit = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      const payload = {
        Name: accountForm.Name.trim(),
        Enabled: accountForm.Enabled
      };
      if (accountEditingId) {
        await UpdateExpenseAccount(accountEditingId, payload);
      } else {
        await CreateExpenseAccount(payload);
      }
      setAccountForm(emptyAccountForm);
      setAccountEditingId(null);
      setAccountEditorOpen(false);
      await loadAccounts();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save account");
    } finally {
      setStatus("ready");
    }
  };

  const onEditAccount = (account) => {
    setAccountForm({ Name: account.Name, Enabled: account.Enabled });
    setAccountEditingId(account.Id);
    setAccountEditorOpen(true);
  };

  const onCancelAccount = () => {
    setAccountForm(emptyAccountForm);
    setAccountEditingId(null);
    setAccountEditorOpen(false);
  };

  const onDeleteAccount = async (account) => {
    if (!window.confirm(`Delete account "${account.Name}"?`)) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteExpenseAccount(account.Id);
      await loadAccounts();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete account");
    } finally {
      setStatus("ready");
    }
  };

  const onTypeChange = (event) => {
    const { name, value, type, checked } = event.target;
    setTypeForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const onTypeSubmit = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      const payload = {
        Name: typeForm.Name.trim(),
        Enabled: typeForm.Enabled
      };
      if (typeEditingId) {
        await UpdateExpenseType(typeEditingId, payload);
      } else {
        await CreateExpenseType(payload);
      }
      setTypeForm(emptyTypeForm);
      setTypeEditingId(null);
      setTypeEditorOpen(false);
      await loadTypes();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save type");
    } finally {
      setStatus("ready");
    }
  };

  const onEditType = (entry) => {
    setTypeForm({ Name: entry.Name, Enabled: entry.Enabled });
    setTypeEditingId(entry.Id);
    setTypeEditorOpen(true);
  };

  const onCancelType = () => {
    setTypeForm(emptyTypeForm);
    setTypeEditingId(null);
    setTypeEditorOpen(false);
  };

  const onDeleteType = async (entry) => {
    if (!window.confirm(`Delete type "${entry.Name}"?`)) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteExpenseType(entry.Id);
      await loadTypes();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete type");
    } finally {
      setStatus("ready");
    }
  };

  const accountColumns = [
    { key: "Name", label: "Account", sortable: true, width: 200 },
    { key: "Enabled", label: "Enabled", sortable: true, width: 120, render: (row) => (row.Enabled ? "Yes" : "No") }
  ];

  const typeColumns = [
    { key: "Name", label: "Type", sortable: true, width: 200 },
    { key: "Enabled", label: "Enabled", sortable: true, width: 120, render: (row) => (row.Enabled ? "Yes" : "No") }
  ];

  return (
    <div className="module-panel module-panel--stretch">
      <header className="module-panel-header">
        <div>
          <h2>Expenses</h2>
          <p>Review recurring expenses, accounts, and categories.</p>
        </div>
        <div className="module-panel-actions">
          <button type="button" className="primary-button" onClick={StartAddExpense}>
            Add expense
          </button>
          <button type="button" className="primary-button" onClick={() => setAccountManagerOpen(true)}>
            Manage accounts
          </button>
          <button type="button" className="primary-button" onClick={() => setTypeManagerOpen(true)}>
            Manage types
          </button>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-shell expense-table-panel" ref={expensePanelRef}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <div className="toolbar-search">
              <Icon name="search" className="icon" />
              <input
                placeholder="Search"
                value={expenseSearch}
                onChange={(event) => setExpenseSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="toolbar-right">
            <div className="toolbar-flyout">
              <button
                type="button"
                className="toolbar-button"
                onClick={() => {
                  setExpenseColumnsOpen((prev) => !prev);
                  setExpenseMenuOpen(false);
                  setExpenseActiveFilter(null);
                }}
              >
                <Icon name="columns" className="icon" />
                Columns
              </button>
              {expenseColumnsOpen ? (
                <div className="dropdown columns-dropdown">
                  {expenseTableState.Columns.map((column, index) => (
                    <div key={column.Key} className="columns-row">
                      <label className="columns-label">
                        <input
                          type="checkbox"
                          checked={column.Visible !== false}
                          onChange={() => ToggleExpenseColumnVisibility(column.Key)}
                          disabled={column.Locked}
                        />
                        <span>{column.Label || column.Key}</span>
                      </label>
                      <div className="columns-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => MoveExpenseColumn(column.Key, "up")}
                          disabled={!CanMoveExpenseColumn(index, "up")}
                          aria-label="Move column up"
                        >
                          <Icon name="sortUp" className="icon" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => MoveExpenseColumn(column.Key, "down")}
                          disabled={!CanMoveExpenseColumn(index, "down")}
                          aria-label="Move column down"
                        >
                          <Icon name="sortDown" className="icon" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="toolbar-toggle">
              <span>Quick edit</span>
              <span className="settings-switch-inline">
                <input
                  type="checkbox"
                  checked={spreadsheetMode}
                  onChange={(event) => setSpreadsheetMode(event.target.checked)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>
            <div className="toolbar-flyout">
              <button
                type="button"
                className="toolbar-button icon-only"
                aria-label="Table options"
                onClick={() => setExpenseMenuOpen((prev) => !prev)}
              >
                <Icon name="more" className="icon" />
              </button>
              {expenseMenuOpen ? (
                <div className="dropdown dropdown-right">
                  <button type="button" className="dropdown-item" onClick={ResetExpenseTableState}>
                    Reset to default
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {spreadsheetMode ? (
          <div className="expense-hint">
            <span>Quick edit is on. Click a row to edit.</span>
            <span>Enter saves. Esc cancels.</span>
          </div>
        ) : null}

        <ExpenseTable
          expenseColumns={expenseTableState.Columns}
          expenseTableState={expenseTableState}
          sortedExpenses={sortedExpenses}
          spreadsheetMode={spreadsheetMode}
          editingExpenseId={editingExpenseId}
          editExpenseForm={editExpenseForm}
          expenseForm={expenseForm}
          expenseAddLabelRef={expenseAddLabelRef}
          expenseAccounts={accounts}
          expenseTypes={types}
          expenseTotals={expenseTotals}
          expenseTotalLabelKey={expenseTotalLabelKey}
          expenseFilters={expenseFilters}
          expenseFilterOptions={expenseFilterOptions}
          activeFilterKey={expenseActiveFilter}
          onActivateFilter={(key) => {
            setExpenseColumnsOpen(false);
            setExpenseMenuOpen(false);
            setExpenseActiveFilter((current) => (current === key ? null : key));
          }}
          onToggleFilterValue={ToggleExpenseFilterValue}
          onClearFilter={ClearExpenseFilter}
          onSetSort={SetExpenseSort}
          onStartResize={StartExpenseColumnResize}
          onDragStart={StartExpenseDrag}
          onDragOver={HandleExpenseDragOver}
          onDragLeave={HandleExpenseDragLeave}
          onDrop={HandleExpenseDrop}
          draggingExpenseId={draggingExpenseId}
          dragOverExpenseId={dragOverExpenseId}
          onAddChange={(field, value) => setExpenseForm((prev) => ({ ...prev, [field]: value }))}
          onAddKeyDown={HandleExpenseAddKeyDown}
          onEditChange={(field, value) =>
            setEditExpenseForm((prev) => ({ ...prev, [field]: value }))
          }
          onEditKeyDown={HandleExpenseEditKeyDown}
          onStartEdit={StartEditExpense}
          onSaveEdit={SaveExpenseEdit}
          onCancelEdit={CancelExpenseEdit}
          onDelete={DeleteExpenseItem}
          onToggleEnabled={ToggleExpenseEnabled}
          onRequestQuickEdit={() => setSpreadsheetMode(true)}
        />
      </div>

      {expenseModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>{expenseModalMode === "edit" ? "Edit expense" : "Add expense"}</h3>
              <div className="modal-header-actions">
                <button type="button" className="icon-button" onClick={CloseExpenseModal} aria-label="Close">
                  <Icon name="close" className="icon action-icon" />
                  <span className="action-label">Close</span>
                </button>
              </div>
            </div>
            <form
              className="form-grid"
              onSubmit={(event) => {
                if (expenseModalMode === "edit") {
                  event.preventDefault();
                  SaveExpenseEdit(editingExpenseId);
                  return;
                }
                HandleExpenseSubmit(event);
              }}
            >
              <label>
                <span>Label</span>
                <input
                  name="Label"
                  value={expenseModalMode === "edit" ? editExpenseForm.Label : expenseForm.Label}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Label: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Label: value }));
                    }
                  }}
                  required
                />
              </label>
              <label>
                <span>Amount</span>
                <input
                  name="Amount"
                  type="number"
                  step="0.01"
                  value={expenseModalMode === "edit" ? editExpenseForm.Amount : expenseForm.Amount}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Amount: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Amount: value }));
                    }
                  }}
                  required
                />
              </label>
              <label>
                <span>Frequency</span>
                <select
                  name="Frequency"
                  value={
                    expenseModalMode === "edit" ? editExpenseForm.Frequency : expenseForm.Frequency
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Frequency: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Frequency: value }));
                    }
                  }}
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Fortnightly">Fortnightly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                </select>
              </label>
              <label>
                <span>Account</span>
                <select
                  name="Account"
                  value={expenseModalMode === "edit" ? editExpenseForm.Account : expenseForm.Account}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Account: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Account: value }));
                    }
                  }}
                >
                  <option value="">Select</option>
                  {accounts.map((account) => (
                    <option key={account.Id} value={account.Name}>
                      {account.Enabled ? account.Name : `${account.Name} (disabled)`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Type</span>
                <select
                  name="Type"
                  value={expenseModalMode === "edit" ? editExpenseForm.Type : expenseForm.Type}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Type: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Type: value }));
                    }
                  }}
                >
                  <option value="">Select</option>
                  {types.map((entry) => (
                    <option key={entry.Id} value={entry.Name}>
                      {entry.Enabled ? entry.Name : `${entry.Name} (disabled)`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Next due date</span>
                <input
                  name="NextDueDate"
                  type="date"
                  value={
                    expenseModalMode === "edit" ? editExpenseForm.NextDueDate : expenseForm.NextDueDate
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, NextDueDate: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, NextDueDate: value }));
                    }
                  }}
                />
              </label>
              <label>
                <span>Cadence</span>
                <select
                  name="Cadence"
                  value={expenseModalMode === "edit" ? editExpenseForm.Cadence : expenseForm.Cadence}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Cadence: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Cadence: value }));
                    }
                  }}
                >
                  <option value="">Select</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                  <option value="EveryNYears">Every N years</option>
                  <option value="OneOff">One-off</option>
                </select>
              </label>
              <label>
                <span>Every</span>
                <input
                  name="Interval"
                  type="number"
                  value={expenseModalMode === "edit" ? editExpenseForm.Interval : expenseForm.Interval}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Interval: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Interval: value }));
                    }
                  }}
                />
              </label>
              <label className="form-span">
                <span>Notes</span>
                <textarea
                  name="Notes"
                  value={expenseModalMode === "edit" ? editExpenseForm.Notes : expenseForm.Notes}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (expenseModalMode === "edit") {
                      setEditExpenseForm((prev) => ({ ...prev, Notes: value }));
                    } else {
                      setExpenseForm((prev) => ({ ...prev, Notes: value }));
                    }
                  }}
                  rows="3"
                />
              </label>
              {expenseModalMode === "edit" ? (
                <div className="form-switch-row form-span">
                  <span className="form-switch-label">Enabled</span>
                  <label className="settings-switch-inline">
                    <input
                      name="Enabled"
                      type="checkbox"
                      checked={editExpenseForm.Enabled}
                      onChange={(event) =>
                        setEditExpenseForm((prev) => ({ ...prev, Enabled: event.target.checked }))
                      }
                    />
                    <span className="switch-track" aria-hidden="true">
                      <span className="switch-thumb" />
                    </span>
                  </label>
                </div>
              ) : null}
              <div className="form-actions form-actions--icons">
                <button
                  type="submit"
                  className="icon-button is-primary"
                  disabled={status === "saving"}
                  aria-label={expenseModalMode === "edit" ? "Save expense" : "Add expense"}
                >
                  <Icon name="save" className="icon action-icon" />
                  <span className="action-label">{expenseModalMode === "edit" ? "Save" : "Add"}</span>
                </button>
                {expenseModalMode === "edit" ? (
                  <button
                    type="button"
                    className="icon-button is-danger"
                    onClick={() => DeleteExpenseItem(editingExpenseId)}
                    disabled={status === "saving"}
                    aria-label="Delete expense"
                  >
                    <Icon name="trash" className="icon action-icon" />
                    <span className="action-label">Delete</span>
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {accountManagerOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Expense accounts</h3>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setAccountManagerOpen(false);
                    onCancelAccount();
                  }}
                  aria-label="Close"
                >
                  <Icon name="close" className="icon action-icon" />
                  <span className="action-label">Close</span>
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-toolbar">
                <p>Organise expenses by payment source.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setAccountForm(emptyAccountForm);
                    setAccountEditingId(null);
                    setAccountEditorOpen(true);
                  }}
                >
                  Add account
                </button>
              </div>
              <DataTable
                tableKey="budget-expense-accounts"
                columns={accountColumns}
                rows={accounts}
                onEdit={onEditAccount}
                onDelete={onDeleteAccount}
              />
            </div>
            {accountEditorOpen ? (
              <form className="form-grid" onSubmit={onAccountSubmit}>
                <label>
                  <span>Name</span>
                  <input name="Name" value={accountForm.Name} onChange={onAccountChange} required />
                </label>
                <div className="form-switch-row">
                  <span className="form-switch-label">Enabled</span>
                  <label className="settings-switch-inline">
                    <input
                      name="Enabled"
                      type="checkbox"
                      checked={accountForm.Enabled}
                      onChange={onAccountChange}
                    />
                    <span className="switch-track" aria-hidden="true">
                      <span className="switch-thumb" />
                    </span>
                  </label>
                </div>
                <div className="form-actions form-actions--icons">
                  <button
                    type="submit"
                    className="icon-button is-primary"
                    disabled={status === "saving"}
                    aria-label={accountEditingId ? "Save account" : "Add account"}
                  >
                    <Icon name="save" className="icon action-icon" />
                    <span className="action-label">{accountEditingId ? "Save" : "Add"}</span>
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {typeManagerOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Expense types</h3>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setTypeManagerOpen(false);
                    onCancelType();
                  }}
                  aria-label="Close"
                >
                  <Icon name="close" className="icon action-icon" />
                  <span className="action-label">Close</span>
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-toolbar">
                <p>Group expenses by category.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setTypeForm(emptyTypeForm);
                    setTypeEditingId(null);
                    setTypeEditorOpen(true);
                  }}
                >
                  Add type
                </button>
              </div>
              <DataTable
                tableKey="budget-expense-types"
                columns={typeColumns}
                rows={types}
                onEdit={onEditType}
                onDelete={onDeleteType}
              />
            </div>
            {typeEditorOpen ? (
              <form className="form-grid" onSubmit={onTypeSubmit}>
                <label>
                  <span>Name</span>
                  <input name="Name" value={typeForm.Name} onChange={onTypeChange} required />
                </label>
                <div className="form-switch-row">
                  <span className="form-switch-label">Enabled</span>
                  <label className="settings-switch-inline">
                    <input
                      name="Enabled"
                      type="checkbox"
                      checked={typeForm.Enabled}
                      onChange={onTypeChange}
                    />
                    <span className="switch-track" aria-hidden="true">
                      <span className="switch-thumb" />
                    </span>
                  </label>
                </div>
                <div className="form-actions form-actions--icons">
                  <button
                    type="submit"
                    className="icon-button is-primary"
                    disabled={status === "saving"}
                    aria-label={typeEditingId ? "Save type" : "Add type"}
                  >
                    <Icon name="save" className="icon action-icon" />
                    <span className="action-label">{typeEditingId ? "Save" : "Add"}</span>
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BudgetExpenses;
