import {
  FormatAmountInput,
  FormatCurrency,
  FormatDate,
  NormalizeAmountInput
} from "../lib/formatters.js";
import Icon from "./Icon.jsx";

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
  Actions: ""
};

const NumericColumnKeys = new Set([
  "Amount",
  "PerDay",
  "PerWeek",
  "PerFortnight",
  "PerMonth",
  "PerYear",
  "Interval"
]);

const BuildCellClass = (key, baseClass = "expense-cell") =>
  NumericColumnKeys.has(key) ? `${baseClass} expense-cell-number` : baseClass;

export const ExpenseTable = ({
  expenseColumns,
  expenseTableState,
  sortedExpenses,
  spreadsheetMode,
  editingExpenseId,
  editExpenseForm,
  expenseForm,
  expenseAddLabelRef,
  expenseAccounts,
  expenseTypes,
  expenseTotals,
  expenseTotalLabelKey,
  expenseFilters,
  expenseFilterOptions,
  activeFilterKey,
  onActivateFilter,
  onToggleFilterValue,
  onClearFilter,
  onSetSort,
  onStartResize,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingExpenseId,
  dragOverExpenseId,
  onAddChange,
  onAddKeyDown,
  onEditChange,
  onEditKeyDown,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleEnabled,
  onRequestQuickEdit
}) => {
  const columns = expenseColumns || expenseTableState.Columns || [];
  const visibleColumns = columns.filter((column) => column.Visible !== false);
  const labelColumnWidth = columns.find((column) => column.Key === "Label")?.Width || 220;
  const maxLabelChars = Math.max(3, Math.floor((labelColumnWidth - 12) / 7));
  const filterableKeys = new Set(["Frequency", "Account", "Type", "Cadence"]);

  const DisplayExpensePerValue = (expense, periodKey, perValue) => {
    const frequency = MatchFrequency(expense.Frequency);
    if (frequency === periodKey) {
      return FormatCurrency(expense.Amount);
    }
    return FormatCurrency(perValue);
  };

  const renderSortIcon = (key) => {
    if (expenseTableState.Sort?.Key !== key) {
      return <Icon name="sort" className="sort-icon" />;
    }
    return expenseTableState.Sort?.Direction === "asc" ? (
      <Icon name="sortUp" className="sort-icon" />
    ) : (
      <Icon name="sortDown" className="sort-icon" />
    );
  };

  const renderFilterDropdown = (key) => {
    if (activeFilterKey !== key) {
      return null;
    }
    const options = expenseFilterOptions?.[key] || [];
    return (
      <div className="expense-filter-dropdown">
        <div className="expense-filter-dropdown-header">
          <span>{ColumnLabels[key] || key}</span>
          <button type="button" onClick={() => onClearFilter(key)}>
            Clear
          </button>
        </div>
        <div className="expense-filter-dropdown-body">
          {options.length === 0 ? (
            <div className="expense-filter-empty">No options</div>
          ) : (
            options.map((option) => (
              <label key={option} className="expense-filter-option">
                <input
                  type="checkbox"
                  checked={(expenseFilters[key] || []).includes(option)}
                  onChange={() => onToggleFilterValue(key, option)}
                />
                {option || "None"}
              </label>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderHeaderCell = (column) => {
    const key = column.Key;
    if (key === "Actions") {
      return <th key={key} className="expense-head" />;
    }
    const isNumeric = NumericColumnKeys.has(key);
    const label = ColumnLabels[key] || key;
    const headerContent = (
      <button type="button" className="th-button" onClick={() => onSetSort(key)}>
        <span>{label}</span>
        {renderSortIcon(key)}
      </button>
    );
    if (filterableKeys.has(key)) {
      return (
        <th key={key} className={`expense-head${isNumeric ? " expense-head-number" : ""}`}>
          <div className="th-actions">
            {headerContent}
            <button
              type="button"
              className={`filter-icon${(expenseFilters[key] || []).length ? " is-active" : ""}`}
              onClick={() => onActivateFilter(key)}
              aria-label={`${label} filter`}
            >
              <Icon name="filter" className="icon" />
            </button>
          </div>
          {renderFilterDropdown(key)}
          <div className="col-resizer" onMouseDown={(event) => onStartResize(key, event)} />
        </th>
      );
    }
    return (
      <th
        key={key}
        className={
          key === "Order"
            ? "expense-head expense-head-center"
            : `expense-head${isNumeric ? " expense-head-number" : ""}`
        }
      >
        {headerContent}
        <div className="col-resizer" onMouseDown={(event) => onStartResize(key, event)} />
      </th>
    );
  };

  const renderAddCell = (key) => {
    if (!spreadsheetMode) {
      return null;
    }
    if (key === "Order") {
      return <td key={key} className="expense-cell expense-cell-center" />;
    }
    if (key === "Label") {
      return (
        <td key={key} className="expense-cell">
          <input
            ref={expenseAddLabelRef}
            type="text"
            value={expenseForm.Label}
            onChange={(event) => onAddChange("Label", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          />
        </td>
      );
    }
    if (key === "Amount") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          <input
            type="text"
            inputMode="decimal"
            value={FormatAmountInput(expenseForm.Amount)}
            onChange={(event) => onAddChange("Amount", NormalizeAmountInput(event.target.value))}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          />
        </td>
      );
    }
    if (key === "Frequency") {
      return (
        <td key={key} className="expense-cell">
          <select
            value={expenseForm.Frequency}
            onChange={(event) => onAddChange("Frequency", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          >
            <option>Weekly</option>
            <option>Fortnightly</option>
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Annually</option>
          </select>
        </td>
      );
    }
    if (key === "Account") {
      return (
        <td key={key} className="expense-cell">
          <select
            value={expenseForm.Account}
            onChange={(event) => onAddChange("Account", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          >
            <option value="">Select</option>
            {expenseAccounts.map((account) => (
              <option key={account.Id} value={account.Name}>
                {account.Enabled ? account.Name : `${account.Name} (disabled)`}
              </option>
            ))}
          </select>
        </td>
      );
    }
    if (key === "Type") {
      return (
        <td key={key} className="expense-cell">
          <select
            value={expenseForm.Type}
            onChange={(event) => onAddChange("Type", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          >
            <option value="">Select</option>
            {expenseTypes.map((entry) => (
              <option key={entry.Id} value={entry.Name}>
                {entry.Enabled ? entry.Name : `${entry.Name} (disabled)`}
              </option>
            ))}
          </select>
        </td>
      );
    }
    if (key === "PerDay" || key === "PerWeek" || key === "PerFortnight" || key === "PerMonth" || key === "PerYear") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          -
        </td>
      );
    }
    if (key === "NextDueDate") {
      return (
        <td key={key} className="expense-cell">
          <input
            type="date"
            value={expenseForm.NextDueDate}
            onChange={(event) => onAddChange("NextDueDate", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          />
        </td>
      );
    }
    if (key === "Cadence") {
      return (
        <td key={key} className="expense-cell">
          <select
            value={expenseForm.Cadence}
            onChange={(event) => onAddChange("Cadence", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          >
            <option value="">Select</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Annually">Annually</option>
            <option value="EveryNYears">Every N years</option>
            <option value="OneOff">One-off</option>
          </select>
        </td>
      );
    }
    if (key === "Interval") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          <input
            type="number"
            min="1"
            value={expenseForm.Interval}
            onChange={(event) => onAddChange("Interval", event.target.value)}
            onKeyDown={onAddKeyDown}
            className="expense-input"
          />
        </td>
      );
    }
    return <td key={key} className="expense-cell" />;
  };

  const renderRowCell = (key, expense, isEditing) => {
    if (key === "Order") {
      return (
        <td key={key} className="expense-cell expense-cell-center">
          {expense.DisplayOrder ?? 0}
        </td>
      );
    }
    if (key === "Label") {
      return (
        <td key={key} className="expense-cell">
          {isEditing ? (
            <input
              type="text"
              value={editExpenseForm.Label}
              onChange={(event) => onEditChange("Label", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            />
          ) : (
            <span title={expense.Label}>
              {expense.Label?.length > maxLabelChars
                ? `${expense.Label.slice(0, maxLabelChars)}…`
                : expense.Label}
            </span>
          )}
        </td>
      );
    }
    if (key === "Amount") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {isEditing ? (
            <input
              type="text"
              inputMode="decimal"
              value={FormatAmountInput(editExpenseForm.Amount)}
              onChange={(event) => onEditChange("Amount", NormalizeAmountInput(event.target.value))}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            />
          ) : (
            FormatCurrency(expense.Amount)
          )}
        </td>
      );
    }
    if (key === "Frequency") {
      return (
        <td key={key} className="expense-cell">
          {isEditing ? (
            <select
              value={editExpenseForm.Frequency}
              onChange={(event) => onEditChange("Frequency", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            >
              <option>Weekly</option>
              <option>Fortnightly</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Annually</option>
            </select>
          ) : (
            expense.Frequency
          )}
        </td>
      );
    }
    if (key === "Account") {
      return (
        <td key={key} className="expense-cell">
          {isEditing ? (
            <select
              value={editExpenseForm.Account}
              onChange={(event) => onEditChange("Account", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            >
              <option value="">Select</option>
              {expenseAccounts.map((account) => (
                <option key={account.Id} value={account.Name}>
                  {account.Enabled ? account.Name : `${account.Name} (disabled)`}
                </option>
              ))}
            </select>
          ) : (
            expense.Account || "-"
          )}
        </td>
      );
    }
    if (key === "Type") {
      return (
        <td key={key} className="expense-cell">
          {isEditing ? (
            <select
              value={editExpenseForm.Type}
              onChange={(event) => onEditChange("Type", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            >
              <option value="">Select</option>
              {expenseTypes.map((entry) => (
                <option key={entry.Id} value={entry.Name}>
                  {entry.Enabled ? entry.Name : `${entry.Name} (disabled)`}
                </option>
              ))}
            </select>
          ) : (
            expense.Type || "-"
          )}
        </td>
      );
    }
    if (key === "PerDay") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {DisplayExpensePerValue(expense, "daily", expense.PerDay)}
        </td>
      );
    }
    if (key === "PerWeek") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {DisplayExpensePerValue(expense, "weekly", expense.PerWeek)}
        </td>
      );
    }
    if (key === "PerFortnight") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {DisplayExpensePerValue(expense, "fortnightly", expense.PerFortnight)}
        </td>
      );
    }
    if (key === "PerMonth") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {DisplayExpensePerValue(expense, "monthly", expense.PerMonth)}
        </td>
      );
    }
    if (key === "PerYear") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {DisplayExpensePerValue(expense, "yearly", expense.PerYear)}
        </td>
      );
    }
    if (key === "NextDueDate") {
      return (
        <td key={key} className="expense-cell">
          {isEditing ? (
            <input
              type="date"
              value={editExpenseForm.NextDueDate}
              onChange={(event) => onEditChange("NextDueDate", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            />
          ) : (
            FormatDate(expense.NextDueDate)
          )}
        </td>
      );
    }
    if (key === "Cadence") {
      return (
        <td key={key} className="expense-cell">
          {isEditing ? (
            <select
              value={editExpenseForm.Cadence}
              onChange={(event) => onEditChange("Cadence", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            >
              <option value="">Select</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
              <option value="EveryNYears">Every N years</option>
              <option value="OneOff">One-off</option>
            </select>
          ) : (
            expense.Cadence || "-"
          )}
        </td>
      );
    }
    if (key === "Interval") {
      return (
        <td key={key} className={BuildCellClass(key)}>
          {isEditing ? (
            <input
              type="number"
              min="1"
              value={editExpenseForm.Interval}
              onChange={(event) => onEditChange("Interval", event.target.value)}
              onKeyDown={(event) => onEditKeyDown(event, expense.Id)}
              className="expense-input"
            />
          ) : (
            expense.Interval || "-"
          )}
        </td>
      );
    }
    if (key === "Actions") {
      const showDetails = [expense.Account, expense.Type, expense.Notes].some(Boolean);
      return (
        <td key={key} className="expense-cell">
          <div className="expense-actions">
            {showDetails ? (
              <div className="expense-detail">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="View expense details"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Icon name="info" className="icon" />
                </button>
                <div className="expense-detail-popover">
                  <div>
                    <span>Account:</span> {expense.Account || "None"}
                  </div>
                  <div>
                    <span>Type:</span> {expense.Type || "None"}
                  </div>
                  <div>
                    <span>Notes:</span> {expense.Notes || "None"}
                  </div>
                </div>
              </div>
            ) : null}
            {spreadsheetMode && isEditing ? (
              <>
                <button
                  type="button"
                  className="icon-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSaveEdit(expense.Id);
                  }}
                  aria-label="Save expense"
                >
                  <Icon name="save" className="icon" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancelEdit();
                  }}
                  aria-label="Cancel edit"
                >
                  <Icon name="close" className="icon" />
                </button>
                <button
                  type="button"
                  className="icon-button is-danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(expense.Id);
                  }}
                  aria-label="Delete expense"
                >
                  <Icon name="trash" className="icon" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="icon-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartEdit(expense, !spreadsheetMode);
                  }}
                  aria-label="Edit expense"
                >
                  <Icon name="edit" className="icon" />
                </button>
                <button
                  type="button"
                  className="icon-button is-danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(expense.Id);
                  }}
                  aria-label="Delete expense"
                >
                  <Icon name="trash" className="icon" />
                </button>
              </>
            )}
            {!spreadsheetMode ? (
              <label
                className="settings-switch-inline expense-toggle"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={expense.Enabled}
                  onChange={() => onToggleEnabled(expense)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </label>
            ) : null}
          </div>
        </td>
      );
    }
    return <td key={key} className="expense-cell" />;
  };

  const renderTotalCell = (key) => {
    if (key === "PerDay") {
      return <td key={key} className={BuildCellClass(key)}>{FormatCurrency(expenseTotals.PerDay)}</td>;
    }
    if (key === "PerWeek") {
      return <td key={key} className={BuildCellClass(key)}>{FormatCurrency(expenseTotals.PerWeek)}</td>;
    }
    if (key === "PerFortnight") {
      return <td key={key} className={BuildCellClass(key)}>{FormatCurrency(expenseTotals.PerFortnight)}</td>;
    }
    if (key === "PerMonth") {
      return <td key={key} className={BuildCellClass(key)}>{FormatCurrency(expenseTotals.PerMonth)}</td>;
    }
    if (key === "PerYear") {
      return <td key={key} className={BuildCellClass(key)}>{FormatCurrency(expenseTotals.PerYear)}</td>;
    }
    if (key === expenseTotalLabelKey) {
      return <td key={key} className="expense-cell">Total</td>;
    }
    return <td key={key} className="expense-cell" />;
  };

  return (
    <div className="expense-table-shell">
      <div className="table-wrap">
        <table className="expense-table">
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.Key} style={{ width: `${column.Width || 120}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>{visibleColumns.map((column) => renderHeaderCell(column))}</tr>
          </thead>
          <tbody>
            {spreadsheetMode ? (
              <tr className="expense-row expense-row-add">
                {visibleColumns.map((column) => renderAddCell(column.Key))}
              </tr>
            ) : null}
            {sortedExpenses.map((expense) => {
              const isEditing = editingExpenseId === expense.Id && spreadsheetMode;
              return (
                <tr
                  key={expense.Id}
                  draggable
                  onDragStart={(event) => onDragStart(expense.Id, event)}
                  onDragOver={(event) => onDragOver(expense.Id, event)}
                  onDragLeave={onDragLeave}
                  onDrop={(event) => onDrop(expense.Id, event)}
                  onClick={() => {
                    if (spreadsheetMode && !isEditing) {
                      onStartEdit(expense, false);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!spreadsheetMode && onRequestQuickEdit) {
                      onRequestQuickEdit();
                    }
                    onStartEdit(expense, false);
                  }}
                  className={`expense-row${draggingExpenseId === expense.Id ? " is-dragging" : ""}${
                    dragOverExpenseId === expense.Id ? " is-drag-over" : ""
                  }`}
                >
                  {visibleColumns.map((column) => renderRowCell(column.Key, expense, isEditing))}
                </tr>
              );
            })}
            <tr className="expense-row expense-total-row">
              {visibleColumns.map((column) => renderTotalCell(column.Key))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
