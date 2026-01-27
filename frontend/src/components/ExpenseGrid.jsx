import { useCallback, useMemo, useState } from "react";

import { CompactSelection, GridCellKind } from "@glideapps/glide-data-grid";

import { FormatCurrency } from "../lib/formatters.js";
import { useGlideTheme } from "../hooks/useGlideTheme.js";
import { BuildColumnTitle } from "../lib/glideTableUtils.js";
import { RequiredExpenseColumns } from "../lib/expenseTable.js";
import { GlideTable } from "./GlideTable.jsx";
import { BuildDateCell, BuildSelectCell, GlideCustomRenderer } from "./GlideCustomCells.jsx";

const ColumnLabels = {
  Order: "#",
  Label: "Expense",
  Amount: "Amount",
  Frequency: "Frequency",
  Account: "Account",
  Type: "Type",
  PerDay: "Per day",
  PerWeek: "Per week",
  PerFortnight: "Per fortnight",
  PerMonth: "Per month",
  PerYear: "Per year",
  NextDueDate: "Next due",
  Cadence: "Cadence",
  Interval: "Every",
  Actions: "Actions"
};

const EditableColumnKeys = new Set([
  "Label",
  "Amount",
  "Frequency",
  "Account",
  "Type",
  "NextDueDate",
  "Cadence",
  "Interval"
]);

const NumericColumnKeys = new Set([
  "Amount",
  "PerDay",
  "PerWeek",
  "PerFortnight",
  "PerMonth",
  "PerYear",
  "Interval"
]);

const RequiredColumnKeys = new Set(RequiredExpenseColumns);

const NormalizeFrequency = (value) => String(value || "").toLowerCase();

const MatchFrequency = (value) => {
  const normalized = NormalizeFrequency(value);
  if (normalized === "annually" || normalized === "annual") {
    return "yearly";
  }
  if (normalized === "biweekly" || normalized === "bi-weekly") {
    return "fortnightly";
  }
  return normalized;
};

const DisplayExpensePerValue = (expense, periodKey, perValue) => {
  const frequency = MatchFrequency(expense.Frequency);
  if (frequency === periodKey) {
    return FormatCurrency(expense.Amount);
  }
  return FormatCurrency(perValue);
};

const BuildTextCell = (
  value,
  { readonly = true, align = "left", allowOverlay = false, themeOverride } = {}
) => {
  const display = value ?? "";
  const selectionRange = !readonly && allowOverlay ? String(display).length : undefined;
  return {
    kind: GridCellKind.Text,
    data: display,
    displayData: display,
    allowOverlay,
    readonly,
    contentAlign: align,
    selectionRange,
    themeOverride
  };
};

const BuildNumberCell = (
  value,
  display,
  { readonly = true, allowOverlay = false, themeOverride } = {}
) => {
  const displayValue = display ?? "";
  const selectionRange = !readonly && allowOverlay ? String(displayValue).length : undefined;
  return {
    kind: GridCellKind.Number,
    data: value === "" || value === null || value === undefined ? undefined : Number(value),
    displayData: displayValue,
    allowOverlay,
    readonly,
    contentAlign: "right",
    selectionRange,
    themeOverride
  };
};

export const ExpenseGrid = ({
  gridRef,
  expenseColumns,
  displayExpenses,
  expenseTotals,
  expenseTotalLabelKey,
  selectOptions,
  sortState,
  filterState,
  canReorder,
  onCellEdited,
  onColumnResize,
  onRowMoved,
  onRowAppended,
  onHeaderClicked,
  onHeaderContextMenu,
  onDeleteExpense
}) => {
  const sortKey = sortState?.Key;
  const sortDirection = sortState?.Direction;
  const activeFilters = useMemo(() => filterState || {}, [filterState]);
  const gridTheme = useGlideTheme();
  const requiredCellTheme = useMemo(() => ({ bgCell: gridTheme.accentLight }), [gridTheme]);
  const visibleColumns = useMemo(
    () =>
      (expenseColumns || []).filter(
        (column) => column.Visible !== false || RequiredColumnKeys.has(column.Key)
      ),
    [expenseColumns]
  );

  const gridColumns = useMemo(
    () =>
      visibleColumns.map((column) => ({
        id: column.Key,
        title: BuildColumnTitle({
          label: column.Label || ColumnLabels[column.Key] || column.Key,
          isRequired: RequiredColumnKeys.has(column.Key),
          isSorted: Boolean(sortKey && column.Key === sortKey),
          sortDirection,
          hasFilter: (activeFilters[column.Key] || []).length > 0
        }),
        width: column.Width || 120
      })),
    [visibleColumns, sortKey, sortDirection, activeFilters]
  );

  const columnKeys = useMemo(() => gridColumns.map((column) => column.id ?? column.title), [gridColumns]);

  const [gridSelection, setGridSelection] = useState({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty()
  });

  const rowCount = displayExpenses.length + 1;

  const getCellContent = useCallback(
    ([col, row]) => {
      const columnKey = columnKeys[col];
      if (!columnKey) {
        return BuildTextCell("");
      }
      const isTotalRow = row >= displayExpenses.length;
      if (isTotalRow) {
        if (columnKey === expenseTotalLabelKey) {
          return BuildTextCell("Total", { readonly: true });
        }
        if (columnKey === "PerDay") {
          return BuildNumberCell(expenseTotals.PerDay, FormatCurrency(expenseTotals.PerDay));
        }
        if (columnKey === "PerWeek") {
          return BuildNumberCell(expenseTotals.PerWeek, FormatCurrency(expenseTotals.PerWeek));
        }
        if (columnKey === "PerFortnight") {
          return BuildNumberCell(
            expenseTotals.PerFortnight,
            FormatCurrency(expenseTotals.PerFortnight)
          );
        }
        if (columnKey === "PerMonth") {
          return BuildNumberCell(expenseTotals.PerMonth, FormatCurrency(expenseTotals.PerMonth));
        }
        if (columnKey === "PerYear") {
          return BuildNumberCell(expenseTotals.PerYear, FormatCurrency(expenseTotals.PerYear));
        }
        return BuildTextCell("");
      }

      const expense = displayExpenses[row];
      const isDraft = Boolean(expense?.__isDraft);
      const isMissingRequired = (key, value) => {
        if (!RequiredColumnKeys.has(key)) {
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
      };
      const requiredTheme =
        isDraft && isMissingRequired(columnKey, expense?.[columnKey]) ? requiredCellTheme : undefined;
      const isEditable = EditableColumnKeys.has(columnKey) && !isTotalRow;
      const allowOverlay = Boolean(isEditable);
      if (columnKey === "Order") {
        return BuildTextCell(String(expense.DisplayOrder ?? 0), { readonly: true, align: "center" });
      }
      if (columnKey === "Label") {
        return BuildTextCell(expense.Label ?? "", {
          readonly: !isEditable,
          allowOverlay,
          themeOverride: requiredTheme
        });
      }
      if (columnKey === "Amount") {
        return BuildNumberCell(expense.Amount, FormatCurrency(expense.Amount), {
          readonly: !isEditable,
          allowOverlay,
          themeOverride: requiredTheme
        });
      }
      if (columnKey === "Frequency") {
        if (!isEditable) {
          return BuildTextCell(expense.Frequency ?? "", {
            readonly: true,
            themeOverride: requiredTheme
          });
        }
        return BuildSelectCell({
          value: expense.Frequency ?? "",
          display: expense.Frequency ?? "",
          options: selectOptions?.Frequency || [],
          multiple: false,
          themeOverride: requiredTheme
        });
      }
      if (columnKey === "Account") {
        if (!isEditable) {
          return BuildTextCell(expense.Account || "-", { readonly: true });
        }
        return BuildSelectCell({
          value: expense.Account || "",
          display: expense.Account || "None",
          options: selectOptions?.Account || [],
          multiple: false
        });
      }
      if (columnKey === "Type") {
        if (!isEditable) {
          return BuildTextCell(expense.Type || "-", { readonly: true });
        }
        return BuildSelectCell({
          value: expense.Type || "",
          display: expense.Type || "None",
          options: selectOptions?.Type || [],
          multiple: false
        });
      }
      if (columnKey === "PerDay") {
        return BuildNumberCell(expense.PerDay, DisplayExpensePerValue(expense, "daily", expense.PerDay));
      }
      if (columnKey === "PerWeek") {
        return BuildNumberCell(expense.PerWeek, DisplayExpensePerValue(expense, "weekly", expense.PerWeek));
      }
      if (columnKey === "PerFortnight") {
        return BuildNumberCell(
          expense.PerFortnight,
          DisplayExpensePerValue(expense, "fortnightly", expense.PerFortnight)
        );
      }
      if (columnKey === "PerMonth") {
        return BuildNumberCell(
          expense.PerMonth,
          DisplayExpensePerValue(expense, "monthly", expense.PerMonth)
        );
      }
      if (columnKey === "PerYear") {
        return BuildNumberCell(
          expense.PerYear,
          DisplayExpensePerValue(expense, "yearly", expense.PerYear)
        );
      }
      if (columnKey === "NextDueDate") {
        if (!isEditable) {
          const display = expense.NextDueDate || "-";
          return BuildTextCell(display, { readonly: true });
        }
        return BuildDateCell(expense.NextDueDate || "", expense.NextDueDate || "");
      }
      if (columnKey === "Cadence") {
        if (!isEditable) {
          return BuildTextCell(expense.Cadence || "-", { readonly: true });
        }
        return BuildSelectCell({
          value: expense.Cadence || "",
          display: expense.Cadence || "None",
          options: selectOptions?.Cadence || [],
          multiple: false
        });
      }
      if (columnKey === "Interval") {
        return BuildNumberCell(expense.Interval ?? "", expense.Interval ? String(expense.Interval) : "-", {
          readonly: !isEditable,
          allowOverlay
        });
      }
      if (columnKey === "Actions") {
        return BuildTextCell("🗑", { readonly: true, align: "center" });
      }
      const isNumeric = NumericColumnKeys.has(columnKey);
      return isNumeric
        ? BuildNumberCell(expense[columnKey], String(expense[columnKey] ?? ""))
        : BuildTextCell(String(expense[columnKey] ?? ""));
    },
    [columnKeys, expenseTotalLabelKey, expenseTotals, displayExpenses, selectOptions, requiredCellTheme]
  );

  const handleCellClicked = useCallback(
    ([col, row], _event) => {
      if (row >= displayExpenses.length) {
        return;
      }
      const columnKey = columnKeys[col];
      const expense = displayExpenses[row];
      if (columnKey === "Actions") {
        onDeleteExpense?.(expense);
      }
    },
    [columnKeys, displayExpenses, onDeleteExpense]
  );

  const handleCellEdited = useCallback(
    (cell, newValue) => {
      const [col, row] = cell;
      if (row >= displayExpenses.length) {
        return;
      }
      const columnKey = columnKeys[col];
      if (!EditableColumnKeys.has(columnKey)) {
        return;
      }
      onCellEdited?.(displayExpenses[row], columnKey, newValue);
    },
    [columnKeys, onCellEdited, displayExpenses]
  );

  return (
    <div className="glide-grid-frame expense-grid-frame">
      <GlideTable
        gridRef={gridRef}
        columns={gridColumns}
        rows={rowCount}
        getCellContent={getCellContent}
        onCellClicked={handleCellClicked}
        onCellEdited={handleCellEdited}
        onHeaderClicked={(col) => onHeaderClicked?.(columnKeys[col])}
        onHeaderContextMenu={(colIndex, event) =>
          onHeaderContextMenu?.(columnKeys[colIndex], event)
        }
        onColumnResize={(column, newSize, colIndex) => {
          const key = columnKeys[colIndex];
          if (key) {
            onColumnResize?.(key, newSize);
          }
        }}
        onRowMoved={canReorder ? onRowMoved : undefined}
        onRowAppended={onRowAppended}
        gridSelection={gridSelection}
        onGridSelectionChange={setGridSelection}
        customRenderers={[GlideCustomRenderer]}
        theme={gridTheme}
        extraRows={1}
        className="glide-grid"
      />
    </div>
  );
};
