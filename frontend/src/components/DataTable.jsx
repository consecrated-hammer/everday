import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "./Icon.jsx";
import { FormatCurrency, FormatNumber } from "../lib/formatters.js";

const DefaultSort = { key: null, direction: "asc" };

const BuildStorageKey = (tableKey) => `datatable:${tableKey}`;

const GetUniqueValues = (rows, key) => {
  const values = rows.map((row) => row[key]).filter((value) => value !== null && value !== undefined);
  return Array.from(new Set(values)).map((value) => String(value)).sort();
};

const DataTable = ({ columns, rows, tableKey, onEdit, onDelete, headerAddon }) => {
  const tableRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState(DefaultSort);
  const [filters, setFilters] = useState({});
  const [visibleColumns, setVisibleColumns] = useState(() =>
    Object.fromEntries(columns.map((column) => [column.key, true]))
  );
  const [columnWidths, setColumnWidths] = useState(() =>
    Object.fromEntries(columns.map((column) => [column.key, column.width || 180]))
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterOpenFor, setFilterOpenFor] = useState(null);
  const resizing = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(BuildStorageKey(tableKey));
    if (!stored) {
      return;
    }
    try {
      const data = JSON.parse(stored);
      if (data.sort) setSort(data.sort);
      if (data.filters) setFilters(data.filters);
      if (data.visibleColumns) {
        const defaults = Object.fromEntries(columns.map((column) => [column.key, true]));
        setVisibleColumns({ ...defaults, ...data.visibleColumns });
      }
      if (data.columnWidths) {
        const defaults = Object.fromEntries(columns.map((column) => [column.key, column.width || 180]));
        setColumnWidths({ ...defaults, ...data.columnWidths });
      }
    } catch (error) {
      // Ignore corrupt storage.
    }
  }, [tableKey]);

  useEffect(() => {
    const payload = { sort, filters, visibleColumns, columnWidths };
    localStorage.setItem(BuildStorageKey(tableKey), JSON.stringify(payload));
  }, [sort, filters, visibleColumns, columnWidths, tableKey]);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!resizing.current) {
        return;
      }
      const { key, startX, startWidth } = resizing.current;
      const delta = event.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [key]: Math.max(100, startWidth + delta)
      }));
    };
    const onMouseUp = () => {
      resizing.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const sortedFilteredRows = useMemo(() => {
    let result = [...rows];
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter((row) =>
        columns.some((column) => {
          const value = row[column.key];
          if (value === null || value === undefined) {
            return false;
          }
          return String(value).toLowerCase().includes(query);
        })
      );
    }
    Object.entries(filters).forEach(([key, selected]) => {
      if (!selected || selected.length === 0) {
        return;
      }
      result = result.filter((row) => selected.includes(String(row[key] ?? "")));
    });
    if (sort.key) {
      result.sort((a, b) => {
        const aVal = a[sort.key];
        const bVal = b[sort.key];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const order = sort.direction === "asc" ? 1 : -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return order * (aVal - bVal);
        }
        return order * String(aVal).localeCompare(String(bVal));
      });
    }
    return result;
  }, [rows, filters, sort, searchTerm, columns]);

  const visibleDefs = columns.filter((column) => visibleColumns[column.key]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return DefaultSort;
    });
  };

  const toggleFilterValue = (key, value) => {
    setFilters((prev) => {
      const selected = new Set(prev[key] || []);
      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }
      return { ...prev, [key]: Array.from(selected) };
    });
  };

  const resetDefaults = () => {
    setSort(DefaultSort);
    setFilters({});
    setVisibleColumns(Object.fromEntries(columns.map((column) => [column.key, true])));
    setColumnWidths(Object.fromEntries(columns.map((column) => [column.key, column.width || 180])));
  };

  useEffect(() => {
    const onClick = (event) => {
      if (!tableRef.current || !tableRef.current.contains(event.target)) {
        setMenuOpen(false);
        setColumnsOpen(false);
        setFilterOpenFor(null);
        return;
      }
      if (
        event.target.closest(".dropdown") ||
        event.target.closest(".toolbar-button") ||
        event.target.closest(".filter-icon")
      ) {
        return;
      }
      setMenuOpen(false);
      setColumnsOpen(false);
      setFilterOpenFor(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setColumnsOpen(false);
        setFilterOpenFor(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const renderCell = (column, row) => {
    if (column.render) {
      return column.render(row);
    }
    const value = row[column.key];
    if (column.isCurrency) {
      return FormatCurrency(value);
    }
    if (typeof value === "number") {
      return FormatNumber(value);
    }
    return String(value ?? "");
  };

  const getCellClassName = (column, value) => {
    const isNumeric = column.align === "right" || column.isCurrency || typeof value === "number";
    return isNumeric ? "cell-number" : "";
  };

  const renderSortIcon = (key) => {
    if (sort.key !== key) return "↕";
    return sort.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div className="table-shell" ref={tableRef}>
      <div className="table-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-search">
            <input
              placeholder="Search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <div className="toolbar-flyout">
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setColumnsOpen((prev) => !prev)}
            >
              <Icon name="columns" className="icon" />
              Columns
            </button>
            {columnsOpen ? (
              <div className="dropdown">
                {columns.map((column) => (
                  <label key={column.key} className="dropdown-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns[column.key]}
                      onChange={() =>
                        setVisibleColumns((prev) => ({ ...prev, [column.key]: !prev[column.key] }))
                      }
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="toolbar-flyout">
            <button
              type="button"
              className="toolbar-button icon-only"
              aria-label="Table options"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <Icon name="more" className="icon" />
            </button>
            {menuOpen ? (
              <div className="dropdown dropdown-right">
                <button type="button" className="dropdown-item" onClick={resetDefaults}>
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
            {headerAddon ? (
              <tr className="table-header-addon">
                <th colSpan={visibleDefs.length + 1}>
                  <div className="table-header-addon-content">{headerAddon}</div>
                </th>
              </tr>
            ) : null}
            <tr>
              {visibleDefs.map((column) => (
                <th
                  key={column.key}
                  className={column.align === "right" || column.isCurrency ? "cell-number" : ""}
                  style={{ width: columnWidths[column.key] }}
                >
                  <div className="th-content">
                    <span className="th-actions">
                      <button
                        type="button"
                        className={`th-button${column.sortable ? "" : " is-disabled"}`}
                        onClick={() => column.sortable && toggleSort(column.key)}
                      >
                        <span>{column.label}</span>
                        {column.sortable ? (
                          <span className={`sort-icon sort-${sort.key === column.key ? sort.direction : "none"}`}>
                            {renderSortIcon(column.key)}
                          </span>
                        ) : null}
                      </button>
                      {column.filterable ? (
                        <button
                          type="button"
                          className="filter-icon"
                          aria-label={`Filter ${column.label}`}
                          onClick={() => setFilterOpenFor(filterOpenFor === column.key ? null : column.key)}
                        >
                          <Icon name="filter" className="icon" />
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <span
                    className="col-resizer"
                    onMouseDown={(event) => {
                      resizing.current = {
                        key: column.key,
                        startX: event.clientX,
                        startWidth: columnWidths[column.key]
                      };
                    }}
                  />
                  {filterOpenFor === column.key ? (
                    <div className="dropdown">
                      {GetUniqueValues(rows, column.key).map((value) => (
                        <label key={value} className="dropdown-item">
                          <input
                            type="checkbox"
                            checked={(filters[column.key] || []).includes(value)}
                            onChange={() => toggleFilterValue(column.key, value)}
                          />
                          <span>{value}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedFilteredRows.map((row) => (
              <tr key={row.Id}>
                {visibleDefs.map((column) => (
                  <td
                    key={`${row.Id}-${column.key}`}
                    className={getCellClassName(column, row[column.key])}
                  >
                    {renderCell(column, row)}
                  </td>
                ))}
                <td className="actions-col">
                  <div className="table-actions">
                    <button type="button" className="icon-button" onClick={() => onEdit(row)} aria-label="Edit">
                      <Icon name="edit" className="icon" />
                    </button>
                    <button type="button" className="icon-button is-danger" onClick={() => onDelete(row)} aria-label="Delete">
                      <Icon name="trash" className="icon" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedFilteredRows.length === 0 ? (
              <tr>
                <td colSpan={visibleDefs.length + 1} className="empty-cell">
                  No results.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
