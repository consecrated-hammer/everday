export const DefaultExpenseColumns = [
  { Key: "Order", Label: "Order", Visible: true, Width: 56, Locked: true },
  { Key: "Label", Label: "Expense", Visible: true, Width: 220 },
  { Key: "Amount", Label: "Amount", Visible: true, Width: 140 },
  { Key: "Frequency", Label: "Frequency", Visible: true, Width: 140 },
  { Key: "Account", Label: "Account", Visible: false, Width: 160 },
  { Key: "Type", Label: "Type", Visible: false, Width: 160 },
  { Key: "PerDay", Label: "Per day", Visible: false, Width: 120 },
  { Key: "PerWeek", Label: "Per week", Visible: false, Width: 120 },
  { Key: "PerFortnight", Label: "Per fortnight", Visible: true, Width: 150 },
  { Key: "PerMonth", Label: "Per month", Visible: true, Width: 150 },
  { Key: "PerYear", Label: "Per year", Visible: true, Width: 150 },
  { Key: "NextDueDate", Label: "Next due", Visible: true, Width: 150 },
  { Key: "Cadence", Label: "Cadence", Visible: false, Width: 140 },
  { Key: "Interval", Label: "Every", Visible: false, Width: 100 },
  { Key: "Actions", Label: "Actions", Visible: true, Width: 120, Locked: true }
];

export const DefaultExpenseTableState = {
  Columns: DefaultExpenseColumns,
  Sort: { Key: "Order", Direction: "asc" },
  Filters: {}
};

export const NormalizeExpenseTableState = (state) => {
  if (!state || !Array.isArray(state.Columns)) {
    return DefaultExpenseTableState;
  }
  const savedMap = state.Columns.reduce((acc, column) => {
    if (column?.Key) {
      acc[column.Key] = column;
    }
    return acc;
  }, {});
  const mergedColumns = DefaultExpenseColumns.map((column) => {
    const saved = savedMap[column.Key] || {};
    return {
      ...column,
      Visible: saved.Visible ?? column.Visible,
      Width: saved.Width ?? column.Width
    };
  });
  return {
    Columns: mergedColumns,
    Sort: state.Sort || DefaultExpenseTableState.Sort,
    Filters: state.Filters || {}
  };
};
