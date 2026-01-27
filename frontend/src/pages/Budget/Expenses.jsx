import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GridCellKind } from "@glideapps/glide-data-grid";

import DataTable from "../../components/DataTable.jsx";
import { ExpenseGrid } from "../../components/ExpenseGrid.jsx";
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
  NormalizeExpenseTableState,
  RequiredExpenseColumns
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

const BuildSelectOptions = (values) => {
  const options = [{ value: "", label: "None" }];
  (values || []).forEach((value) => {
    const label = value || "None";
    const normalized = value || "";
    if (!options.some((option) => option.value === normalized)) {
      options.push({ value: normalized, label });
    }
  });
  return options;
};

const BudgetExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [types, setTypes] = useState([]);
  const [draftExpense, setDraftExpense] = useState(null);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseColumnsOpen, setExpenseColumnsOpen] = useState(false);
  const [filterPopover, setFilterPopover] = useState(null);
  const filterPopoverRef = useRef(null);
  const [expenseMenuOpen, setExpenseMenuOpen] = useState(false);
  const expensePanelRef = useRef(null);
  const expenseGridRef = useRef(null);
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
  const requiredExpenseKeys = useMemo(() => new Set(RequiredExpenseColumns), []);

  const loadExpenses = useCallback(async () => {
    const data = await FetchExpenses();
    setExpenses(data);
    return data;
  }, []);

  const loadAccounts = useCallback(async () => {
    const data = await FetchExpenseAccounts();
    setAccounts(data);
    return data;
  }, []);

  const loadTypes = useCallback(async () => {
    const data = await FetchExpenseTypes();
    setTypes(data);
    return data;
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      await Promise.all([loadExpenses(), loadAccounts(), loadTypes()]);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load expenses");
    }
  }, [loadAccounts, loadExpenses, loadTypes]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
        setFilterPopover(null);
        return;
      }
      if (
        event.target.closest(".dropdown") ||
        event.target.closest(".toolbar-button") ||
        event.target.closest(".filter-icon") ||
        event.target.closest(".expense-filter-dropdown") ||
        event.target.closest(".expense-filters-panel") ||
        event.target.closest(".filter-panel") ||
        event.target.closest(".grid-filter-popover")
      ) {
        return;
      }
      setExpenseColumnsOpen(false);
      setExpenseMenuOpen(false);
      setFilterPopover(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setExpenseColumnsOpen(false);
        setExpenseMenuOpen(false);
        setFilterPopover(null);
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
    if (!draftExpense) {
      return;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        setDraftExpense(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [draftExpense]);

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

  const displayExpenses = useMemo(() => {
    if (!draftExpense) {
      return sortedExpenses;
    }
    return [
      ...sortedExpenses,
      { ...draftExpense, __isDraft: true }
    ];
  }, [draftExpense, sortedExpenses]);

  const expenseSelectOptions = useMemo(
    () => ({
      Frequency: BuildSelectOptions(expenseFilterOptions?.Frequency || []),
      Account: BuildSelectOptions(expenseFilterOptions?.Account || []),
      Type: BuildSelectOptions(expenseFilterOptions?.Type || []),
      Cadence: BuildSelectOptions(expenseFilterOptions?.Cadence || [])
    }),
    [expenseFilterOptions]
  );

  const hasActiveFilters = useMemo(
    () => Object.values(expenseFilters).some((values) => values && values.length > 0),
    [expenseFilters]
  );

  const canReorder =
    !draftExpense &&
    !expenseSearch.trim() &&
    !hasActiveFilters &&
    (expenseTableState.Sort?.Key === "Order" || !expenseTableState.Sort?.Key);

  const visibleColumnKeys = expenseTableState.Columns.filter(
    (column) => column.Visible !== false
  ).map((column) => column.Key);
  const expenseTotalLabelKey =
    ["Order", "Label", "Amount", "Frequency", "Account", "Type"].find((key) =>
      visibleColumnKeys.includes(key)
    ) || null;

  const StartAddExpense = () => {
    expenseGridRef.current?.appendRow(0, true);
  };

  const BuildExpensePayloadFromExpense = (expense, overrides = {}) => {
    const next = { ...expense, ...overrides };
    const nextDueDate = next.NextDueDate || null;
    return {
      Label: String(next.Label || "").trim(),
      Amount: Number(next.Amount),
      Frequency: next.Frequency,
      Account: next.Account || null,
      Type: next.Type || null,
      NextDueDate: nextDueDate,
      Cadence: next.Cadence || null,
      Interval: next.Interval ? Number(next.Interval) : null,
      Month: nextDueDate ? new Date(nextDueDate).getMonth() + 1 : null,
      DayOfMonth: nextDueDate ? new Date(nextDueDate).getDate() : null,
      Enabled: Boolean(next.Enabled),
      Notes: next.Notes || null
    };
  };

  const isExpenseMissingRequired = useCallback(
    (key, value) => {
      if (!requiredExpenseKeys.has(key)) {
        return false;
      }
      if (key === "Label") {
        return !String(value || "").trim();
      }
      if (key === "Amount") {
        return !Number(value || 0);
      }
      if (key === "Frequency") {
        return !String(value || "").trim();
      }
      return false;
    },
    [requiredExpenseKeys]
  );

  const isExpenseReady = (expense) =>
    String(expense.Label || "").trim() && Number(expense.Amount) && expense.Frequency;

  const missingExpenseRequired = useMemo(() => {
    if (!draftExpense) {
      return [];
    }
    return RequiredExpenseColumns
      .filter((key) => isExpenseMissingRequired(key, draftExpense[key]))
      .map((key) => expenseColumnConfig[key]?.Label || key);
  }, [draftExpense, expenseColumnConfig, isExpenseMissingRequired]);

  const HandleExpenseCellEdited = async (expense, key, newValue) => {
    const nextValue =
      newValue?.kind === GridCellKind.Custom
        ? newValue?.data?.value ?? ""
        : newValue?.kind === GridCellKind.Number
          ? newValue.data
          : newValue?.data ?? "";
    const overrides = { [key]: nextValue };
    if (key === "Interval") {
      overrides.Interval = nextValue ? Number(nextValue) : null;
    }
    if (key === "Amount") {
      overrides.Amount = Number(nextValue || 0);
    }
    if (key === "NextDueDate") {
      overrides.NextDueDate = nextValue || null;
    }
    if (key === "Label" && typeof nextValue === "string") {
      overrides.Label = nextValue.trim();
    }

    if (expense.__isDraft) {
      const nextDraft = { ...expense, ...overrides };
      setDraftExpense(nextDraft);
      if (!isExpenseReady(nextDraft)) {
        return;
      }
      try {
        setStatus("saving");
        setError("");
        const payload = BuildExpensePayloadFromExpense(nextDraft);
        await CreateExpense(payload);
        setDraftExpense(null);
        await loadExpenses();
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Failed to add expense");
      } finally {
        setStatus("ready");
      }
      return;
    }

    try {
      setStatus("saving");
      setError("");
      const payload = BuildExpensePayloadFromExpense(expense, overrides);
      const updated = await UpdateExpense(expense.Id, payload);
      setExpenses((current) =>
        current.map((entry) => (entry.Id === updated.Id ? updated : entry))
      );
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update expense");
    } finally {
      setStatus("ready");
    }
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
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete expense");
    } finally {
      setStatus("ready");
    }
  };

  const ToggleExpenseColumnVisibility = (key) => {
    if (requiredExpenseKeys.has(key)) {
      return;
    }
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

  const HandleExpenseHeaderClick = (key) => {
    if (!key || key === "Actions") {
      return;
    }
    SetExpenseSort(key);
  };

  const HandleExpenseHeaderContextMenu = (key, event) => {
    if (!key || key === "Actions") {
      return;
    }
    if (!expenseFilterOptions?.[key]) {
      return;
    }
    event.preventDefault();
    const label = expenseColumnConfig[key]?.Label || key;
    setFilterPopover({ key, label, bounds: event.bounds });
  };

  const HandleExpenseColumnResize = (key, nextWidth) => {
    const minWidth = 60;
    const safeWidth = Math.max(minWidth, Math.round(nextWidth));
    setExpenseTableState((current) => ({
      ...current,
      Columns: current.Columns.map((column) =>
        column.Key === key ? { ...column, Width: safeWidth } : column
      )
    }));
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

  const HandleExpenseRowMoved = async (startIndex, endIndex) => {
    if (!canReorder || startIndex === endIndex) {
      return;
    }
    const ordered = [...sortedExpenses].map((expense) => expense.Id);
    if (
      startIndex < 0 ||
      endIndex < 0 ||
      startIndex >= ordered.length ||
      endIndex >= ordered.length
    ) {
      return;
    }
    const reordered = [...ordered];
    const [moved] = reordered.splice(startIndex, 1);
    reordered.splice(endIndex, 0, moved);
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
    }
  };

  const HandleExpenseRowAppended = useCallback(() => {
    if (draftExpense) {
      return "bottom";
    }
    const maxOrder = expenses.reduce(
      (acc, expense) => Math.max(acc, expense.DisplayOrder || 0),
      0
    );
    setDraftExpense({
      ...InitialExpenseForm,
      Id: "__draft__",
      DisplayOrder: maxOrder + 1
    });
    return "bottom";
  }, [draftExpense, expenses]);

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
            {draftExpense ? (
              <div className="grid-draft-banner grid-draft-banner--inline">
                <div>
                  <strong>Draft row in progress.</strong>{" "}
                  {missingExpenseRequired.length > 0
                    ? `Missing required: ${missingExpenseRequired.join(", ")}.`
                    : "All required fields are set. Press Enter to save."}
                </div>
                <button type="button" onClick={() => setDraftExpense(null)}>
                  Discard (Esc)
                </button>
              </div>
            ) : null}
            <div className="toolbar-flyout">
              <button
                type="button"
                className="toolbar-button"
                onClick={() => {
                  setExpenseColumnsOpen((prev) => !prev);
                  setExpenseMenuOpen(false);
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
                          checked={requiredExpenseKeys.has(column.Key) || column.Visible !== false}
                          onChange={() => ToggleExpenseColumnVisibility(column.Key)}
                          disabled={column.Locked || requiredExpenseKeys.has(column.Key)}
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
            <div className="toolbar-flyout">
              <button
                type="button"
                className="toolbar-button icon-only"
                aria-label="Table options"
                onClick={() => {
                  setExpenseMenuOpen((prev) => !prev);
                  setExpenseColumnsOpen(false);
                }}
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

        {filterPopover
          ? createPortal(
              <div
                className="grid-filter-popover"
                ref={filterPopoverRef}
                style={{
                  position: "fixed",
                  left: filterPopover.bounds?.x ?? 0,
                  top: (filterPopover.bounds?.y ?? 0) + (filterPopover.bounds?.height ?? 0) + 6
                }}
              >
                <div className="grid-filters-header">
                  <span>{filterPopover.label || filterPopover.key} filter</span>
                  <button type="button" onClick={() => setFilterPopover(null)}>
                    Close
                  </button>
                </div>
                <div className="grid-filter-options">
                  {(expenseFilterOptions?.[filterPopover.key] || []).length === 0 ? (
                    <div className="grid-filter-empty">No options</div>
                  ) : (
                    expenseFilterOptions[filterPopover.key].map((option) => (
                      <label key={option || "none"} className="grid-filter-option">
                        <input
                          type="checkbox"
                          checked={(expenseFilters[filterPopover.key] || []).includes(option)}
                          onChange={() => ToggleExpenseFilterValue(filterPopover.key, option)}
                        />
                        {option || "None"}
                      </label>
                    ))
                  )}
                </div>
                <div className="grid-filter-actions">
                  <button type="button" onClick={() => ClearExpenseFilter(filterPopover.key)}>
                    Clear
                  </button>
                </div>
              </div>,
              document.getElementById("portal") || document.body
            )
          : null}

        {displayExpenses.length === 0 ? (
          <div className="table-empty">
            <p>No expenses yet. Add a row to get started.</p>
            <button type="button" className="primary-button" onClick={StartAddExpense}>
              Add first expense
            </button>
          </div>
        ) : (
          <ExpenseGrid
            gridRef={expenseGridRef}
            expenseColumns={expenseTableState.Columns}
            displayExpenses={displayExpenses}
            expenseTotals={expenseTotals}
            expenseTotalLabelKey={expenseTotalLabelKey}
            selectOptions={expenseSelectOptions}
            sortState={expenseTableState.Sort}
            filterState={expenseFilters}
            canReorder={canReorder}
            onCellEdited={HandleExpenseCellEdited}
            onColumnResize={HandleExpenseColumnResize}
            onRowMoved={HandleExpenseRowMoved}
            onRowAppended={HandleExpenseRowAppended}
            onHeaderClicked={HandleExpenseHeaderClick}
            onHeaderContextMenu={HandleExpenseHeaderContextMenu}
            onDeleteExpense={(expense) => {
              if (expense.__isDraft) {
                setDraftExpense(null);
                return;
              }
              DeleteExpenseItem(expense.Id);
            }}
          />
        )}
      </div>


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
