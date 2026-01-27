export const DefaultGridMetrics = {
  headerHeight: 36,
  rowHeight: 40,
  maxHeight: 560
};

export const BuildGridHeight = ({ rows, metrics = DefaultGridMetrics, extraRows = 1 }) => {
  const safeRows = Number.isFinite(rows) ? rows : 0;
  const safeExtra = Number.isFinite(extraRows) ? extraRows : 0;
  const target = metrics.headerHeight + metrics.rowHeight * (safeRows + safeExtra) + 2;
  return Math.min(metrics.maxHeight, target);
};

export const BuildColumnTitle = ({
  label,
  isRequired = false,
  isSorted = false,
  sortDirection = "asc",
  hasFilter = false
}) => {
  const requiredIndicator = isRequired ? " *" : "";
  const filterIndicator = hasFilter ? " [f]" : "";
  const sortIndicator = isSorted ? (sortDirection === "desc" ? " ↓" : " ↑") : "";
  return `${label}${requiredIndicator}${filterIndicator}${sortIndicator}`;
};
