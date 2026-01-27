import { useMemo } from "react";

import { DataEditor } from "@glideapps/glide-data-grid";

import { useGlideTheme } from "../hooks/useGlideTheme.js";
import { BuildGridHeight, DefaultGridMetrics } from "../lib/glideTableUtils.js";

export const GlideTable = ({
  gridRef,
  columns,
  rows,
  getCellContent,
  onCellClicked,
  onCellEdited,
  onHeaderClicked,
  onHeaderContextMenu,
  onColumnResize,
  onRowMoved,
  onRowAppended,
  gridSelection,
  onGridSelectionChange,
  cellActivationBehavior = "second-click",
  rowMarkers = { kind: "checkbox", width: 40 },
  rowSelectionMode = "multi",
  overscrollX = 48,
  customRenderers,
  trailingRowOptions = { hint: "", sticky: true, targetColumn: 1 },
  onKeyDown,
  theme,
  metrics,
  extraRows = 1,
  className,
  width = "100%",
  height
}) => {
  const gridTheme = useGlideTheme();
  const mergedTheme = theme || gridTheme;
  const mergedMetrics = useMemo(() => ({ ...DefaultGridMetrics, ...metrics }), [metrics]);
  const resolvedHeight = height ??
    BuildGridHeight({ rows, metrics: mergedMetrics, extraRows });

  return (
    <DataEditor
      ref={gridRef}
      columns={columns}
      rows={rows}
      getCellContent={getCellContent}
      onCellClicked={onCellClicked}
      onCellEdited={onCellEdited}
      onHeaderClicked={onHeaderClicked}
      onHeaderContextMenu={onHeaderContextMenu}
      onColumnResize={onColumnResize}
      onRowMoved={onRowMoved}
      onRowAppended={onRowAppended}
      gridSelection={gridSelection}
      onGridSelectionChange={onGridSelectionChange}
      cellActivationBehavior={cellActivationBehavior}
      rowMarkers={rowMarkers}
      rowSelectionMode={rowSelectionMode}
      overscrollX={overscrollX}
      customRenderers={customRenderers}
      trailingRowOptions={trailingRowOptions}
      onKeyDown={onKeyDown}
      theme={mergedTheme}
      headerHeight={mergedMetrics.headerHeight}
      rowHeight={mergedMetrics.rowHeight}
      className={className}
      width={width}
      height={resolvedHeight}
    />
  );
};
