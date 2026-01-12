import { useEffect, useMemo, useState } from "react";

import {
  FetchAllocationAccounts,
  FetchExpenses,
  FetchIncomeStreams
} from "../../../lib/budgetApi.js";
import {
  BuildAllocationBaseSummary,
  BuildBudgetTotals,
  BuildManualAllocations,
  FormatPercent
} from "../../../lib/budgetSummary.js";

const BudgetCurrencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const FormatBudgetCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return BudgetCurrencyFormatter.format(Number(value));
};

const BudgetWidget = () => {
  const [incomeStreams, setIncomeStreams] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allocationAccounts, setAllocationAccounts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setStatus("loading");
        setError("");
        const [incomeData, expenseData, allocationData] = await Promise.all([
          FetchIncomeStreams(),
          FetchExpenses(),
          FetchAllocationAccounts()
        ]);
        setIncomeStreams(incomeData || []);
        setExpenses(expenseData || []);
        setAllocationAccounts(allocationData || []);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Unable to load budget snapshot.");
      }
    };
    load();
  }, []);

  const totals = useMemo(
    () => BuildBudgetTotals(incomeStreams, expenses),
    [incomeStreams, expenses]
  );
  const manualAllocations = useMemo(
    () => BuildManualAllocations(allocationAccounts),
    [allocationAccounts]
  );
  const allocationSummary = useMemo(
    () => BuildAllocationBaseSummary(totals, manualAllocations),
    [manualAllocations, totals]
  );

  const incomePerFortnight = totals.Income.PerFortnight || 0;
  const expensePerFortnight = totals.Expenses.PerFortnight || 0;
  const allocatedPerFortnight = incomePerFortnight * allocationSummary.TotalAllocated;
  const leftoverAmount = incomePerFortnight * allocationSummary.Leftover;
  const leftoverPercent = allocationSummary.Leftover;

  return (
    <div className="widget-body">
      {status === "loading" ? <p className="text-muted">Loading budget snapshot...</p> : null}
      {status === "error" ? <p className="form-error">{error}</p> : null}
      {status === "ready" ? (
        <>
          <div className="budget-snapshot dashboard-panel">
            <p className="budget-helper">Per fortnight snapshot</p>
            <div className="budget-row">
              <span className="metric-label">Income</span>
              <span className="metric-value">{FormatBudgetCurrency(incomePerFortnight)}</span>
            </div>
            <div className="budget-row">
              <span className="metric-label">Expenses</span>
              <span className="metric-value">{FormatBudgetCurrency(expensePerFortnight)}</span>
            </div>
            <div className="budget-row">
              <span className="metric-label">Total allocated</span>
              <span className="metric-value">{FormatBudgetCurrency(allocatedPerFortnight)}</span>
            </div>
            <div className="budget-row budget-row-strong">
              <span className="metric-label">Leftover ({FormatPercent(leftoverPercent)})</span>
              <span className="metric-value">{FormatBudgetCurrency(leftoverAmount)}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default BudgetWidget;
