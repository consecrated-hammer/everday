import { useEffect, useMemo, useRef, useState } from "react";

import DataTable from "../../components/DataTable.jsx";
import Icon from "../../components/Icon.jsx";
import {
  CreateAllocationAccount,
  DeleteAllocationAccount,
  FetchAllocationAccounts,
  FetchExpenses,
  FetchIncomeStreams,
  UpdateAllocationAccount
} from "../../lib/budgetApi.js";
import { FormatCurrency } from "../../lib/formatters.js";

const ToNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const emptyAccountForm = {
  Name: "",
  Percent: 0,
  Enabled: true
};

const AllocationTableStorageKey = "budget-allocations-table";
const DefaultAllocationColumns = [
  { Key: "Account", Label: "Account", Locked: true, Width: 200 },
  { Key: "Percent", Label: "% Allocation", Align: "right", Width: 120 },
  { Key: "PerDay", Label: "Per day", Align: "right", Width: 110 },
  { Key: "PerWeek", Label: "Per week", Align: "right", Width: 110 },
  { Key: "PerFortnight", Label: "Per fortnight", Align: "right", Width: 130 },
  { Key: "PerMonth", Label: "Per month", Align: "right", Width: 120 },
  { Key: "PerYear", Label: "Per year", Align: "right", Width: 120 },
  { Key: "RoundedFortnight", Label: "Rounded per fortnight", Align: "right", Width: 160 },
  { Key: "PercentTo100", Label: "% to 100%", Align: "right", Width: 120 }
];

const BuildAllocationDefaultColumns = () => DefaultAllocationColumns.map((column) => ({ ...column }));

const MergeAllocationColumns = (storedColumns) => {
  const defaults = BuildAllocationDefaultColumns();
  if (!Array.isArray(storedColumns)) {
    return defaults;
  }
  const defaultMap = Object.fromEntries(defaults.map((column) => [column.Key, column]));
  const next = [];
  storedColumns.forEach((column) => {
    const base = defaultMap[column.Key];
    if (!base) {
      return;
    }
    next.push({
      ...base,
      ...column,
      Locked: base.Locked,
      Width: column.Width ?? base.Width,
      Visible: column.Visible ?? base.Visible
    });
    delete defaultMap[column.Key];
  });
  Object.values(defaultMap).forEach((column) => next.push(column));
  return next;
};

const BudgetAllocations = () => {
  const [incomeStreams, setIncomeStreams] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allocationAccounts, setAllocationAccounts] = useState([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitTargets, setSplitTargets] = useState([]);
  const [splitDraft, setSplitDraft] = useState(null);
  const [overageOpen, setOverageOpen] = useState(false);
  const [overageTargets, setOverageTargets] = useState([]);
  const [overageDraft, setOverageDraft] = useState(null);
  const [allocationPercentDrafts, setAllocationPercentDrafts] = useState({});
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountEditingId, setAccountEditingId] = useState(null);
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [allocationTableState, setAllocationTableState] = useState(() => {
    const stored = localStorage.getItem(AllocationTableStorageKey);
    if (!stored) {
      return { Columns: BuildAllocationDefaultColumns() };
    }
    try {
      const data = JSON.parse(stored);
      return { Columns: MergeAllocationColumns(data.Columns) };
    } catch (err) {
      return { Columns: BuildAllocationDefaultColumns() };
    }
  });
  const [allocationColumnsOpen, setAllocationColumnsOpen] = useState(false);
  const [allocationMenuOpen, setAllocationMenuOpen] = useState(false);
  const allocationTableRef = useRef(null);
  const allocationResizeRef = useRef(null);

  const loadAllocationAccounts = async () => {
    const data = await FetchAllocationAccounts();
    setAllocationAccounts(data);
    return data;
  };

  const loadData = async () => {
    try {
      setStatus("loading");
      setError("");
      const [incomeData, expenseData] = await Promise.all([
        FetchIncomeStreams(),
        FetchExpenses()
      ]);
      setIncomeStreams(incomeData);
      setExpenses(expenseData);
      await loadAllocationAccounts();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load allocation data");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSplitTargets((prev) =>
      prev.filter((id) => allocationAccounts.some((account) => account.Id === id && account.Enabled))
    );
    setOverageTargets((prev) =>
      prev.filter((id) => allocationAccounts.some((account) => account.Id === id && account.Enabled))
    );
  }, [allocationAccounts]);

  useEffect(() => {
    if (splitTargets.length === 0) {
      setSplitDraft(null);
    }
  }, [splitTargets.length]);

  useEffect(() => {
    if (overageTargets.length === 0) {
      setOverageDraft(null);
    }
  }, [overageTargets.length]);

  useEffect(() => {
    localStorage.setItem(
      AllocationTableStorageKey,
      JSON.stringify({ Columns: allocationTableState.Columns })
    );
  }, [allocationTableState.Columns]);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!allocationResizeRef.current) {
        return;
      }
      const { key, startX, startWidth } = allocationResizeRef.current;
      const delta = event.clientX - startX;
      const nextWidth = Math.max(80, startWidth + delta);
      setAllocationTableState((current) => ({
        ...current,
        Columns: current.Columns.map((column) =>
          column.Key === key ? { ...column, Width: nextWidth } : column
        )
      }));
    };
    const onMouseUp = () => {
      allocationResizeRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onClick = (event) => {
      if (!allocationTableRef.current || !allocationTableRef.current.contains(event.target)) {
        setAllocationColumnsOpen(false);
        setAllocationMenuOpen(false);
        return;
      }
      if (event.target.closest(".dropdown") || event.target.closest(".toolbar-button")) {
        return;
      }
      setAllocationColumnsOpen(false);
      setAllocationMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setAllocationColumnsOpen(false);
        setAllocationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const manualAllocations = useMemo(() => {
    return allocationAccounts
      .filter((account) => account.Enabled)
      .map((account) => ({ Id: account.Id, Key: account.Name, Percent: account.Percent }));
  }, [allocationAccounts]);

  const activeManualAllocations = useMemo(() => {
    if (overageDraft && overageTargets.length) {
      return overageDraft;
    }
    if (splitDraft && splitTargets.length) {
      return splitDraft;
    }
    return manualAllocations;
  }, [manualAllocations, overageDraft, overageTargets.length, splitDraft, splitTargets.length]);

  const totals = useMemo(() => {
    const incomeTotals = incomeStreams.reduce(
      (acc, stream) => {
        acc.PerDay += ToNumber(stream.NetPerDay);
        acc.PerWeek += ToNumber(stream.NetPerWeek);
        acc.PerFortnight += ToNumber(stream.NetPerFortnight);
        acc.PerMonth += ToNumber(stream.NetPerMonth);
        acc.PerYear += ToNumber(stream.NetPerYear);
        return acc;
      },
      { PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0 }
    );

    const expenseTotals = expenses.reduce(
      (acc, expense) => {
        if (!expense.Enabled) {
          return acc;
        }
        acc.PerDay += ToNumber(expense.PerDay);
        acc.PerWeek += ToNumber(expense.PerWeek);
        acc.PerFortnight += ToNumber(expense.PerFortnight);
        acc.PerMonth += ToNumber(expense.PerMonth);
        acc.PerYear += ToNumber(expense.PerYear);
        return acc;
      },
      { PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0 }
    );

    return {
      Income: incomeTotals,
      Expenses: expenseTotals,
      Difference: {
        PerDay: incomeTotals.PerDay - expenseTotals.PerDay,
        PerWeek: incomeTotals.PerWeek - expenseTotals.PerWeek,
        PerFortnight: incomeTotals.PerFortnight - expenseTotals.PerFortnight,
        PerMonth: incomeTotals.PerMonth - expenseTotals.PerMonth,
        PerYear: incomeTotals.PerYear - expenseTotals.PerYear
      }
    };
  }, [incomeStreams, expenses]);

  const baseAllocationSummary = useMemo(() => {
    const incomePerFortnight = totals.Income.PerFortnight || 0;
    const targetExpenseAllocation = incomePerFortnight
      ? totals.Expenses.PerFortnight / incomePerFortnight
      : 0;
    const manualTotal = manualAllocations.reduce(
      (sum, entry) => sum + ToNumber(entry.Percent) / 100,
      0
    );
    const totalAllocated = targetExpenseAllocation + manualTotal;
    const leftover = Math.max(0, 1 - totalAllocated);
    const overage = Math.max(0, totalAllocated - 1);
    return {
      TargetExpenseAllocation: targetExpenseAllocation,
      TotalAllocated: totalAllocated,
      Leftover: leftover,
      Overage: overage
    };
  }, [manualAllocations, totals]);

  const allocationSummary = useMemo(() => {
    const activeAllocations = activeManualAllocations;
    const incomePerFortnight = totals.Income.PerFortnight || 0;
    const targetExpenseAllocation = incomePerFortnight
      ? totals.Expenses.PerFortnight / incomePerFortnight
      : 0;
    const manualTotal = activeAllocations.reduce(
      (sum, entry) => sum + ToNumber(entry.Percent) / 100,
      0
    );
    const totalAllocated = targetExpenseAllocation + manualTotal;
    const leftover = Math.max(0, 1 - totalAllocated);
    const overage = Math.max(0, totalAllocated - 1);

    const buildRow = (name, percent, id = null) => {
      const perDay = totals.Income.PerDay * percent;
      const perWeek = totals.Income.PerWeek * percent;
      const perFortnight = totals.Income.PerFortnight * percent;
      const perMonth = totals.Income.PerMonth * percent;
      const perYear = totals.Income.PerYear * percent;
      const roundedFortnight = Math.round(perFortnight);
      const percentTo100 = incomePerFortnight ? roundedFortnight / incomePerFortnight : 0;
      return {
        Id: id,
        Name: name,
        Percent: percent,
        PerDay: perDay,
        PerWeek: perWeek,
        PerFortnight: perFortnight,
        PerMonth: perMonth,
        PerYear: perYear,
        RoundedFortnight: roundedFortnight,
        PercentTo100: percentTo100
      };
    };

    const rows = [
      buildRow("Leftover", leftover),
      buildRow("Daily Expenses", targetExpenseAllocation),
      ...activeAllocations.map((entry) =>
        buildRow(entry.Key, ToNumber(entry.Percent) / 100, entry.Id)
      )
    ];

    const totalRounded = rows
      .filter((row) => row.Name !== "Leftover")
      .reduce((sum, row) => sum + row.RoundedFortnight, 0);

    return {
      TargetExpenseAllocation: targetExpenseAllocation,
      TotalAllocated: totalAllocated,
      Leftover: leftover,
      Overage: overage,
      Rows: rows,
      TotalRow: buildRow("Total allocated", totalAllocated),
      TotalRounded: totalRounded,
      TotalRoundedPercent: incomePerFortnight ? totalRounded / incomePerFortnight : 0
    };
  }, [activeManualAllocations, totals]);

  const FormatPercent = (value) => `${(value * 100).toFixed(2)}%`;
  const manualKeys = manualAllocations.map((entry) => ({ Id: entry.Id, Name: entry.Key }));
  const overAllocated = allocationSummary.TotalAllocated > 1;

  const ApplySplitDraft = async () => {
    if (!splitDraft || splitDraft.length === 0) {
      setSplitOpen(false);
      setSplitTargets([]);
      setSplitDraft(null);
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const updates = splitDraft.map((entry) => {
        const account = allocationAccounts.find((item) => item.Id === entry.Id);
        if (!account) {
          return null;
        }
        return UpdateAllocationAccount(entry.Id, {
          Name: account.Name,
          Enabled: account.Enabled,
          Percent: ToNumber(entry.Percent)
        });
      });
      await Promise.all(updates.filter(Boolean));
      await loadAllocationAccounts();
      setSplitOpen(false);
      setSplitTargets([]);
      setSplitDraft(null);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save allocation split");
    } finally {
      setStatus("ready");
    }
  };

  const CancelSplitDraft = () => {
    setSplitOpen(false);
    setSplitTargets([]);
    setSplitDraft(null);
  };

  const UpdateSplitDraft = (nextTargets) => {
    setSplitTargets(nextTargets);
    if (nextTargets.length === 0) {
      setSplitDraft(null);
      return;
    }
    const extraShare = (baseAllocationSummary.Leftover * 100) / nextTargets.length;
    const nextDraft = manualAllocations.map((entry) =>
      nextTargets.includes(entry.Id)
        ? { ...entry, Percent: Number(entry.Percent) + extraShare }
        : entry
    );
    setSplitDraft(nextDraft);
  };

  const UpdateOverageDraft = (nextTargets) => {
    setOverageTargets(nextTargets);
    if (nextTargets.length === 0) {
      setOverageDraft(null);
      return;
    }
    const overageShare = (baseAllocationSummary.Overage * 100) / nextTargets.length;
    const nextDraft = manualAllocations.map((entry) =>
      nextTargets.includes(entry.Id)
        ? { ...entry, Percent: Math.max(0, Number(entry.Percent) - overageShare) }
        : entry
    );
    setOverageDraft(nextDraft);
  };

  const ApplyOverageDraft = async () => {
    if (!overageDraft || overageDraft.length === 0) {
      setOverageOpen(false);
      setOverageTargets([]);
      setOverageDraft(null);
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const updates = overageDraft.map((entry) => {
        const account = allocationAccounts.find((item) => item.Id === entry.Id);
        if (!account) {
          return null;
        }
        return UpdateAllocationAccount(entry.Id, {
          Name: account.Name,
          Enabled: account.Enabled,
          Percent: ToNumber(entry.Percent)
        });
      });
      await Promise.all(updates.filter(Boolean));
      await loadAllocationAccounts();
      setOverageOpen(false);
      setOverageTargets([]);
      setOverageDraft(null);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save overage reduction");
    } finally {
      setStatus("ready");
    }
  };

  const CancelOverageDraft = () => {
    setOverageOpen(false);
    setOverageTargets([]);
    setOverageDraft(null);
  };

  const onAccountChange = (event) => {
    const { name, value, type, checked } = event.target;
    setAccountForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const onAccountSubmit = async (event) => {
    event.preventDefault();
    const trimmed = accountForm.Name.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.toLowerCase();
    const hasDuplicate = allocationAccounts.some(
      (account) =>
        account.Id !== accountEditingId &&
        account.Name.trim().toLowerCase() === normalized
    );
    if (hasDuplicate) {
      setError("Account name already exists.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      if (accountEditingId) {
        await UpdateAllocationAccount(accountEditingId, {
          Name: trimmed,
          Enabled: accountForm.Enabled,
          Percent: ToNumber(accountForm.Percent)
        });
      } else {
        await CreateAllocationAccount({
          Name: trimmed,
          Enabled: accountForm.Enabled,
          Percent: 0
        });
      }
      setAccountForm(emptyAccountForm);
      setAccountEditingId(null);
      setAccountEditorOpen(false);
      await loadAllocationAccounts();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save account");
    } finally {
      setStatus("ready");
    }
  };

  const onEditAccount = (account) => {
    setAccountForm({ Name: account.Name, Enabled: account.Enabled, Percent: account.Percent });
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
      await DeleteAllocationAccount(account.Id);
      await loadAllocationAccounts();
      setSplitTargets((current) => current.filter((id) => id !== account.Id));
      setOverageTargets((current) => current.filter((id) => id !== account.Id));
      if (accountEditingId === account.Id) {
        onCancelAccount();
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete account");
    } finally {
      setStatus("ready");
    }
  };

  const ToggleAllocationColumnVisibility = (key) => {
    const column = allocationTableState.Columns.find((item) => item.Key === key);
    if (column?.Locked) {
      return;
    }
    setAllocationTableState((current) => ({
      ...current,
      Columns: current.Columns.map((item) =>
        item.Key === key ? { ...item, Visible: item.Visible === false } : item
      )
    }));
  };

  const ResetAllocationTableState = () => {
    setAllocationTableState({ Columns: BuildAllocationDefaultColumns() });
  };

  const MoveAllocationColumn = (key, direction) => {
    setAllocationTableState((current) => {
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

  const CanMoveAllocationColumn = (index, direction) => {
    const columns = allocationTableState.Columns;
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

  const accountColumns = [
    { key: "Name", label: "Account", sortable: true, width: 200 },
    { key: "Enabled", label: "Enabled", sortable: true, width: 120, render: (row) => (row.Enabled ? "Yes" : "No") }
  ];
  const allocationColumns = allocationTableState.Columns;
  const visibleAllocationColumns = allocationColumns.filter((column) => column.Visible !== false);
  const readOnlyRowNames = ["Leftover", "Daily Expenses"];

  return (
    <div className="module-panel allocation-panel">
      <header className="module-panel-header">
        <div>
          <h2>Allocations</h2>
          <p>Compare income to expenses and assign any remainder.</p>
        </div>
        <div className="module-panel-actions">
          <button type="button" className="primary-button" onClick={() => setAccountManagerOpen(true)}>
            Manage accounts
          </button>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {status === "loading" ? <p className="form-note">Loading allocations...</p> : null}

      <div className="allocation-table">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th className="allocation-number">Per day</th>
              <th className="allocation-number">Per week</th>
              <th className="allocation-number">Per fortnight</th>
              <th className="allocation-number">Per month</th>
              <th className="allocation-number">Per year</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="allocation-strong">Income</td>
              <td className="allocation-number">{FormatCurrency(totals.Income.PerDay)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Income.PerWeek)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Income.PerFortnight)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Income.PerMonth)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Income.PerYear)}</td>
            </tr>
            <tr>
              <td className="allocation-strong">Expenses</td>
              <td className="allocation-number">{FormatCurrency(totals.Expenses.PerDay)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Expenses.PerWeek)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Expenses.PerFortnight)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Expenses.PerMonth)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Expenses.PerYear)}</td>
            </tr>
            <tr className="allocation-row-muted">
              <td className="allocation-strong">Difference</td>
              <td className="allocation-number">{FormatCurrency(totals.Difference.PerDay)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Difference.PerWeek)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Difference.PerFortnight)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Difference.PerMonth)}</td>
              <td className="allocation-number">{FormatCurrency(totals.Difference.PerYear)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="allocation-summary">
        <div className="allocation-summary-grid">
          <div>
            <p className="allocation-label">Target expense allocation</p>
            <p className="allocation-value">{FormatPercent(allocationSummary.TargetExpenseAllocation)}</p>
          </div>
          <div>
            <p className="allocation-label">Total allocated</p>
            <p className={`allocation-value${overAllocated ? " is-warning" : ""}`}>
              {FormatPercent(allocationSummary.TotalAllocated)}
            </p>
          </div>
          <div>
            <p className="allocation-label">Leftover</p>
            <p className="allocation-value">{FormatPercent(allocationSummary.Leftover)}</p>
          </div>
        </div>
        <div className="allocation-actions">
          <span>Split leftover across target accounts.</span>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setSplitOpen(true);
              setSplitDraft(null);
              setSplitTargets([]);
              setOverageOpen(false);
              setOverageDraft(null);
              setOverageTargets([]);
            }}
          >
            Split leftover
          </button>
        </div>
        {overAllocated ? (
          <div className="allocation-actions">
            <span className="form-error">Total allocated exceeds 100%.</span>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setOverageOpen(true);
                setOverageDraft(null);
                setOverageTargets([]);
                setSplitOpen(false);
                setSplitDraft(null);
                setSplitTargets([]);
              }}
            >
              Reduce overage
            </button>
          </div>
        ) : null}
      </div>

      {splitOpen ? (
        <div className="allocation-split">
          <div className="allocation-split-header">
            <p className="allocation-label">Split leftover</p>
            <span className="allocation-meta">
              Leftover {FormatPercent(baseAllocationSummary.Leftover)}
            </span>
          </div>
          <div className="allocation-split-grid">
            {manualKeys.map((entry) => (
              <label key={entry.Id} className="allocation-checkbox">
                <input
                  type="checkbox"
                  checked={splitTargets.includes(entry.Id)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      UpdateSplitDraft([...splitTargets, entry.Id]);
                    } else {
                      UpdateSplitDraft(splitTargets.filter((item) => item !== entry.Id));
                    }
                  }}
                />
                <span>{entry.Name}</span>
              </label>
            ))}
          </div>
          {splitDraft && splitTargets.length ? (
            <p className="allocation-meta">
              Each selected account receives an extra{" "}
              {FormatPercent(baseAllocationSummary.Leftover / splitTargets.length)}.
            </p>
          ) : null}
          <div className="allocation-split-actions form-actions form-actions--icons">
            <button
              type="button"
              className="icon-button is-primary"
              onClick={ApplySplitDraft}
              disabled={!splitDraft || splitTargets.length === 0}
            >
              <span className="action-label">Save</span>
              <span className="action-icon">
                <Icon name="save" className="icon" />
              </span>
            </button>
            <button type="button" className="icon-button is-secondary" onClick={CancelSplitDraft}>
              <span className="action-label">Cancel</span>
              <span className="action-icon">
                <Icon name="close" className="icon" />
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {overageOpen ? (
        <div className="allocation-split">
          <div className="allocation-split-header">
            <p className="allocation-label">Reduce overage</p>
            <span className="allocation-meta">
              Overage {FormatPercent(baseAllocationSummary.Overage)}
            </span>
          </div>
          <div className="allocation-split-grid">
            {manualKeys.map((entry) => (
              <label key={entry.Id} className="allocation-checkbox">
                <input
                  type="checkbox"
                  checked={overageTargets.includes(entry.Id)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      UpdateOverageDraft([...overageTargets, entry.Id]);
                    } else {
                      UpdateOverageDraft(overageTargets.filter((item) => item !== entry.Id));
                    }
                  }}
                />
                <span>{entry.Name}</span>
              </label>
            ))}
          </div>
          {overageDraft && overageTargets.length ? (
            <p className="allocation-meta">
              Each selected account drops by{" "}
              {FormatPercent(baseAllocationSummary.Overage / overageTargets.length)}.
            </p>
          ) : null}
          <div className="allocation-split-actions form-actions form-actions--icons">
            <button
              type="button"
              className="icon-button is-primary"
              onClick={ApplyOverageDraft}
              disabled={!overageDraft || overageTargets.length === 0}
            >
              <span className="action-label">Save</span>
              <span className="action-icon">
                <Icon name="save" className="icon" />
              </span>
            </button>
            <button type="button" className="icon-button is-secondary" onClick={CancelOverageDraft}>
              <span className="action-label">Cancel</span>
              <span className="action-icon">
                <Icon name="close" className="icon" />
              </span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="allocation-table allocation-table-wide" ref={allocationTableRef}>
        <div className="table-toolbar">
          <div className="toolbar-left" />
          <div className="toolbar-right">
            <div className="toolbar-flyout">
              <button
                type="button"
                className="toolbar-button"
                onClick={() => {
                  setAllocationColumnsOpen((prev) => !prev);
                  setAllocationMenuOpen(false);
                }}
              >
                <Icon name="columns" className="icon" />
                Columns
              </button>
              {allocationColumnsOpen ? (
                <div className="dropdown columns-dropdown">
                  {allocationColumns.map((column, index) => (
                    <div key={column.Key} className="columns-row">
                      <label className="columns-label">
                        <input
                          type="checkbox"
                          checked={column.Visible !== false}
                          onChange={() => ToggleAllocationColumnVisibility(column.Key)}
                          disabled={column.Locked}
                        />
                        <span>{column.Label}</span>
                      </label>
                      <div className="columns-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => MoveAllocationColumn(column.Key, "up")}
                          disabled={!CanMoveAllocationColumn(index, "up")}
                          aria-label="Move column up"
                        >
                          <Icon name="sortUp" className="icon" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => MoveAllocationColumn(column.Key, "down")}
                          disabled={!CanMoveAllocationColumn(index, "down")}
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
                onClick={() => setAllocationMenuOpen((prev) => !prev)}
              >
                <Icon name="more" className="icon" />
              </button>
              {allocationMenuOpen ? (
                <div className="dropdown dropdown-right">
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      ResetAllocationTableState();
                      setAllocationMenuOpen(false);
                    }}
                  >
                    Reset to default
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {visibleAllocationColumns.map((column) => (
                  <th
                    key={column.Key}
                    className={column.Align === "right" ? "allocation-number" : ""}
                    style={{ width: column.Width }}
                  >
                    <span>{column.Label}</span>
                    <span
                      className="col-resizer"
                      onMouseDown={(event) => {
                        allocationResizeRef.current = {
                          key: column.Key,
                          startX: event.clientX,
                          startWidth: column.Width || 120
                        };
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allocationSummary.Rows.map((row) => {
                const manualIndex = manualAllocations.findIndex((entry) => entry.Id === row.Id);
                const isManual = manualIndex !== -1;
                const sourceAllocations = activeManualAllocations;
                const manualValue = isManual ? sourceAllocations[manualIndex]?.Percent : null;
                const draftValue = row.Id ? allocationPercentDrafts[row.Id] : undefined;
                const isReadOnlyRow = readOnlyRowNames.includes(row.Name);
                const rowClassName = isReadOnlyRow ? "allocation-row-readonly" : "";
                return (
                  <tr key={row.Name} className={rowClassName}>
                    {visibleAllocationColumns.map((column) => {
                      if (column.Key === "Account") {
                        return (
                          <td key={`${row.Name}-account`} className="allocation-strong">
                            {row.Name}
                          </td>
                        );
                      }
                      if (column.Key === "Percent") {
                        return (
                          <td key={`${row.Name}-percent`} className="allocation-number">
                            {isManual ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={draftValue ?? Number(manualValue ?? 0).toFixed(2)}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (!row.Id) {
                                    return;
                                  }
                                  setAllocationPercentDrafts((current) => ({
                                    ...current,
                                    [row.Id]: value
                                  }));
                                  setAllocationAccounts((current) =>
                                    current.map((entry) =>
                                      entry.Id === row.Id ? { ...entry, Percent: value } : entry
                                    )
                                  );
                                }}
                                onBlur={async () => {
                                  if (!row.Id) {
                                    return;
                                  }
                                  setAllocationPercentDrafts((current) => {
                                    const next = { ...current };
                                    delete next[row.Id];
                                    return next;
                                  });
                                  const account = allocationAccounts.find((entry) => entry.Id === row.Id);
                                  if (!account) {
                                    return;
                                  }
                                  try {
                                    setStatus("saving");
                                    setError("");
                                    await UpdateAllocationAccount(row.Id, {
                                      Name: account.Name,
                                      Enabled: account.Enabled,
                                      Percent: ToNumber(account.Percent)
                                    });
                                  } catch (err) {
                                    setStatus("error");
                                    setError(err?.message || "Failed to update allocation");
                                  } finally {
                                    setStatus("ready");
                                  }
                                }}
                                className="allocation-input"
                              />
                            ) : (
                              <span>{FormatPercent(row.Percent)}</span>
                            )}
                          </td>
                        );
                      }
                      if (column.Key === "PerDay") {
                        return (
                          <td key={`${row.Name}-perday`} className="allocation-number">
                            {FormatCurrency(row.PerDay)}
                          </td>
                        );
                      }
                      if (column.Key === "PerWeek") {
                        return (
                          <td key={`${row.Name}-perweek`} className="allocation-number">
                            {FormatCurrency(row.PerWeek)}
                          </td>
                        );
                      }
                      if (column.Key === "PerFortnight") {
                        return (
                          <td key={`${row.Name}-perfortnight`} className="allocation-number">
                            {FormatCurrency(row.PerFortnight)}
                          </td>
                        );
                      }
                      if (column.Key === "PerMonth") {
                        return (
                          <td key={`${row.Name}-permonth`} className="allocation-number">
                            {FormatCurrency(row.PerMonth)}
                          </td>
                        );
                      }
                      if (column.Key === "PerYear") {
                        return (
                          <td key={`${row.Name}-peryear`} className="allocation-number">
                            {FormatCurrency(row.PerYear)}
                          </td>
                        );
                      }
                      if (column.Key === "RoundedFortnight") {
                        return (
                          <td key={`${row.Name}-rounded`} className="allocation-number">
                            {FormatCurrency(row.RoundedFortnight)}
                          </td>
                        );
                      }
                      if (column.Key === "PercentTo100") {
                        return (
                          <td key={`${row.Name}-percentto100`} className="allocation-number">
                            {FormatPercent(row.PercentTo100)}
                          </td>
                        );
                      }
                      return null;
                    })}
                  </tr>
                );
              })}
              <tr className="allocation-row-muted allocation-total">
                {visibleAllocationColumns.map((column) => {
                  if (column.Key === "Account") {
                    return <td key="total-account">Total allocated</td>;
                  }
                  if (column.Key === "Percent") {
                    return (
                      <td key="total-percent" className="allocation-number">
                        {FormatPercent(allocationSummary.TotalAllocated)}
                      </td>
                    );
                  }
                  if (column.Key === "PerDay") {
                    return (
                      <td key="total-perday" className="allocation-number">
                        {FormatCurrency(allocationSummary.TotalRow.PerDay)}
                      </td>
                    );
                  }
                  if (column.Key === "PerWeek") {
                    return (
                      <td key="total-perweek" className="allocation-number">
                        {FormatCurrency(allocationSummary.TotalRow.PerWeek)}
                      </td>
                    );
                  }
                  if (column.Key === "PerFortnight") {
                    return (
                      <td key="total-perfortnight" className="allocation-number">
                        {FormatCurrency(allocationSummary.TotalRow.PerFortnight)}
                      </td>
                    );
                  }
                  if (column.Key === "PerMonth") {
                    return (
                      <td key="total-permonth" className="allocation-number">
                        {FormatCurrency(allocationSummary.TotalRow.PerMonth)}
                      </td>
                    );
                  }
                  if (column.Key === "PerYear") {
                    return (
                      <td key="total-peryear" className="allocation-number">
                        {FormatCurrency(allocationSummary.TotalRow.PerYear)}
                      </td>
                    );
                  }
                  if (column.Key === "RoundedFortnight") {
                    return (
                      <td key="total-rounded" className="allocation-number">
                        {FormatCurrency(allocationSummary.TotalRounded)}
                      </td>
                    );
                  }
                  if (column.Key === "PercentTo100") {
                    return (
                      <td key="total-percentto100" className="allocation-number">
                        {FormatPercent(allocationSummary.TotalRoundedPercent)}
                      </td>
                    );
                  }
                  return null;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {accountManagerOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Allocation accounts</h3>
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
                  <span className="action-label">Close</span>
                  <span className="action-icon">
                    <Icon name="close" className="icon" />
                  </span>
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-toolbar">
                <p>Set the accounts that receive leftover allocations.</p>
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
                tableKey="budget-allocation-accounts"
                columns={accountColumns}
                rows={allocationAccounts}
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
                <div className="form-actions">
                  <button type="submit">
                    {accountEditingId ? "Save changes" : "Add account"}
                  </button>
                  <button type="button" className="button-secondary" onClick={onCancelAccount}>
                    Cancel
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

export default BudgetAllocations;
