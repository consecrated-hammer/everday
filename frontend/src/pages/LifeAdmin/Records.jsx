import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CompactSelection, GridCellKind } from "@glideapps/glide-data-grid";

import {
  CreateLifeRecord,
  DeleteLifeRecord,
  UpdateLifeRecord,
  UpdateLifeRecordOrder
} from "../../lib/lifeAdminApi.js";
import Icon from "../../components/Icon.jsx";
import {
  BuildDateCell,
  BuildDateRangeCell,
  BuildSelectCell,
  GlideCustomRenderer
} from "../../components/GlideCustomCells.jsx";
import { GlideTable } from "../../components/GlideTable.jsx";
import { useGlideTheme } from "../../hooks/useGlideTheme.js";
import { BuildColumnTitle } from "../../lib/glideTableUtils.js";
import { useLifeAdminCatalog } from "../../hooks/useLifeAdminCatalog.js";
import { useLifeAdminFields } from "../../hooks/useLifeAdminFields.js";
import { useLifeAdminRecords } from "../../hooks/useLifeAdminRecords.js";

const ActiveCategoryStorageKey = "life-admin.records.activeCategoryId";

const ParseLocalDate = (value) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
};

const DaysInMonth = (year, month) => new Date(year, month, 0).getDate();

const BuildDateRangeText = (value) => {
  if (!value || typeof value !== "object") {
    return "";
  }
  const start = value.StartDate;
  const end = value.EndDate;
  if (start && end) {
    return `${start} to ${end}`;
  }
  if (start && !end) {
    return `${start} to Current`;
  }
  return end || "";
};

const BuildDateRangeDuration = (startIso, endIso) => {
  if (!startIso) {
    return "";
  }
  const start = ParseLocalDate(startIso);
  const end = endIso ? ParseLocalDate(endIso) : new Date();
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (endDate < start) {
    return "";
  }
  let years = endDate.getFullYear() - start.getFullYear();
  let months = endDate.getMonth() - start.getMonth();
  let days = endDate.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = endDate.getMonth() - 1;
    const prevYear = prevMonth < 0 ? endDate.getFullYear() - 1 : endDate.getFullYear();
    const prevMonthNumber = prevMonth < 0 ? 12 : prevMonth + 1;
    days += DaysInMonth(prevYear, prevMonthNumber);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(", ");
};

const BuildSelectOptions = (entries, { valueKey = "Id", labelKey = "Name" } = {}) => {
  const options = [{ value: "", label: "None" }];
  (entries || []).forEach((entry) => {
    const value = entry?.[valueKey];
    const label = entry?.[labelKey] ?? value;
    const normalized = value === null || value === undefined ? "" : String(value);
    if (!options.some((option) => option.value === normalized)) {
      options.push({ value: normalized, label: String(label ?? "") });
    }
  });
  return options;
};

const Records = () => {
  const { categories, dropdowns, people, status, error } = useLifeAdminCatalog();
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const { fields } = useLifeAdminFields(activeCategoryId);
  const {
    records,
    recordError,
    recordStatus,
    recordLookups,
    dropdownOptions,
    reloadRecords,
    setRecords
  } =
    useLifeAdminRecords(activeCategoryId, fields);
  const [actionStatus, setActionStatus] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState({ key: "SortOrder", direction: "asc" });
  const [filters, setFilters] = useState({});
  const [visibleColumns, setVisibleColumns] = useState({});
  const [columnWidths, setColumnWidths] = useState({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterPopover, setFilterPopover] = useState(null);
  const filterPopoverRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftRecord, setDraftRecord] = useState(null);
  const [gridSelection, setGridSelection] = useState({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty()
  });
  const gridTheme = useGlideTheme();
  const gridRef = useRef(null);
  const gridShellRef = useRef(null);
  const selectAllRef = useRef(null);

  useEffect(() => {
    if (activeCategoryId) {
      return;
    }
    if (categories.length === 0) {
      return;
    }
    const stored = localStorage.getItem(ActiveCategoryStorageKey);
    const match = stored
      ? categories.find((category) => String(category.Id) === stored)
      : null;
    if (match) {
      setActiveCategoryId(match.Id);
      return;
    }
    setActiveCategoryId(categories[0].Id);
  }, [categories, activeCategoryId]);

  useEffect(() => {
    if (!activeCategoryId) {
      return;
    }
    localStorage.setItem(ActiveCategoryStorageKey, String(activeCategoryId));
  }, [activeCategoryId]);

  useEffect(() => {
    if (!activeCategoryId || categories.length === 0) {
      return;
    }
    const exists = categories.some((category) => category.Id === activeCategoryId);
    if (!exists) {
      setActiveCategoryId(categories[0]?.Id || null);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    setDraftRecord(null);
    setSearchTerm("");
    setColumnsOpen(false);
    setMenuOpen(false);
  }, [activeCategoryId, fields]);

  useEffect(() => {
    const available = new Set(records.map((record) => record.Id));
    setSelectedIds((prev) => prev.filter((id) => available.has(id)));
  }, [records]);

  const activeCategory = useMemo(
    () => categories.find((entry) => entry.Id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const personMap = useMemo(() => {
    const map = {};
    people.forEach((person) => {
      map[person.Id] = person.Name;
    });
    return map;
  }, [people]);

  const dropdownLabelMap = useMemo(() => {
    const map = {};
    dropdowns.forEach((dropdown) => {
      const options = dropdownOptions[dropdown.Id] || [];
      options.forEach((option) => {
        map[option.Id] = option.Label;
      });
    });
    return map;
  }, [dropdowns, dropdownOptions]);

  const recordLabelMap = useMemo(() => {
    const map = {};
    Object.values(recordLookups).forEach((items) => {
      items.forEach((item) => {
        map[item.Id] = item.Title;
      });
    });
    return map;
  }, [recordLookups]);

  const defaultVisibleColumns = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.Key, true])),
    [fields]
  );

  const defaultColumnWidths = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.Key, 200])),
    [fields]
  );

  const personValueMap = useMemo(() => {
    const map = {};
    people.forEach((person) => {
      if (person.Name) {
        map[person.Name.toLowerCase()] = person.Id;
      }
      map[String(person.Id)] = person.Id;
    });
    return map;
  }, [people]);

  const dropdownValueMap = useMemo(() => {
    const map = {};
    dropdowns.forEach((dropdown) => {
      const lookup = {};
      const options = dropdownOptions[dropdown.Id] || [];
      options.forEach((option) => {
        lookup[String(option.Id)] = option.Id;
        if (option.Label) {
          lookup[option.Label.toLowerCase()] = option.Id;
        }
      });
      map[dropdown.Id] = lookup;
    });
    return map;
  }, [dropdowns, dropdownOptions]);

  const recordValueMap = useMemo(() => {
    const map = {};
    Object.entries(recordLookups).forEach(([categoryId, items]) => {
      const lookup = {};
      items.forEach((item) => {
        lookup[String(item.Id)] = item.Id;
        if (item.Title) {
          lookup[item.Title.toLowerCase()] = item.Id;
        }
      });
      map[categoryId] = lookup;
    });
    return map;
  }, [recordLookups]);

  const selectOptionsByField = useMemo(() => {
    const options = {};
    fields.forEach((field) => {
      if (field.FieldType === "Dropdown") {
        const list = dropdownOptions[field.DropdownId] || [];
        options[field.Key] = BuildSelectOptions(list, { valueKey: "Id", labelKey: "Label" });
      } else if (field.FieldType === "Person") {
        options[field.Key] = BuildSelectOptions(people, { valueKey: "Id", labelKey: "Name" });
      } else if (field.FieldType === "RecordLink") {
        const list = recordLookups[field.LinkedCategoryId] || [];
        options[field.Key] = BuildSelectOptions(list, { valueKey: "Id", labelKey: "Title" });
      }
    });
    return options;
  }, [fields, dropdownOptions, people, recordLookups]);

  const prefsKey = useMemo(
    () => `glide-table:life-admin-records-${activeCategoryId || "all"}`,
    [activeCategoryId]
  );

  useEffect(() => {
    const stored = localStorage.getItem(prefsKey);
    if (!stored) {
      setVisibleColumns(defaultVisibleColumns);
      setColumnWidths(defaultColumnWidths);
      setSort({ key: "SortOrder", direction: "asc" });
      setFilters({});
      setPrefsLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      const storedVisible = parsed.visibleColumns || {};
      const storedWidths = parsed.columnWidths || {};
      const nextVisible = { ...defaultVisibleColumns, ...storedVisible };
      const nextWidths = { ...defaultColumnWidths, ...storedWidths };
      setVisibleColumns(nextVisible);
      setColumnWidths(nextWidths);
      const nextSort = parsed.sort || { key: "SortOrder", direction: "asc" };
      setSort(
        nextSort?.key && defaultVisibleColumns[nextSort.key] !== undefined
          ? nextSort
          : { key: "SortOrder", direction: "asc" }
      );
      setFilters(parsed.filters || {});
    } catch (err) {
      setVisibleColumns(defaultVisibleColumns);
      setColumnWidths(defaultColumnWidths);
      setSort({ key: "SortOrder", direction: "asc" });
      setFilters({});
    }
    setPrefsLoaded(true);
  }, [defaultColumnWidths, defaultVisibleColumns, prefsKey]);

  useEffect(() => {
    if (!prefsLoaded) {
      return;
    }
    const payload = {
      sort,
      filters,
      visibleColumns,
      columnWidths
    };
    localStorage.setItem(prefsKey, JSON.stringify(payload));
  }, [sort, filters, visibleColumns, columnWidths, prefsKey, prefsLoaded]);

  useEffect(() => {
    const onClick = (event) => {
      if (!gridShellRef.current || !gridShellRef.current.contains(event.target)) {
        setColumnsOpen(false);
        setMenuOpen(false);
        setFilterPopover(null);
        return;
      }
      if (
        event.target.closest(".dropdown") ||
        event.target.closest(".toolbar-button") ||
        event.target.closest(".filter-panel") ||
        event.target.closest(".grid-filter-popover")
      ) {
        return;
      }
      setColumnsOpen(false);
      setMenuOpen(false);
      setFilterPopover(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setColumnsOpen(false);
        setMenuOpen(false);
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
    if (!draftRecord) {
      return;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        setDraftRecord(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [draftRecord]);

  const onAddRecord = () => {
    if (!activeCategoryId) {
      setActionError("Select a category to add records.");
      return;
    }
    gridRef.current?.appendRow(0, true);
  };

  const onDeleteRecord = useCallback(
    async (record) => {
      if (!window.confirm("Delete this record?")) {
        return;
      }
      try {
        setActionStatus("saving");
        setActionError("");
        await DeleteLifeRecord(record.Id);
        await reloadRecords();
        setActionStatus("ready");
      } catch (err) {
        setActionStatus("error");
        setActionError(err?.message || "Failed to delete record");
      }
    },
    [reloadRecords]
  );

  const formatValue = useCallback((field, value) => {
    if (value === null || value === undefined) {
      return "";
    }
    if (field.FieldType === "Dropdown") {
      if (Array.isArray(value)) {
        return value.map((entry) => dropdownLabelMap[entry] || entry).join(", ");
      }
      return dropdownLabelMap[value] || value;
    }
    if (field.FieldType === "Person") {
      if (Array.isArray(value)) {
        return value.map((entry) => personMap[entry] || entry).join(", ");
      }
      return personMap[value] || value;
    }
    if (field.FieldType === "RecordLink") {
      if (Array.isArray(value)) {
        return value.map((entry) => recordLabelMap[entry] || entry).join(", ");
      }
      return recordLabelMap[value] || value;
    }
    if (field.FieldType === "Date") {
      return String(value || "");
    }
    if (field.FieldType === "DateRange" && value && typeof value === "object") {
      return BuildDateRangeText(value);
    }
    if (field.FieldType === "Boolean") {
      return value ? "Yes" : "No";
    }
    return value;
  }, [dropdownLabelMap, personMap, recordLabelMap]);

  const buildRow = useCallback(
    (record, { isDraft = false } = {}) => {
      const row = {
        Id: record.Id,
        SortOrder: record.SortOrder ?? 0,
        Record: record,
        __isDraft: isDraft
      };
      fields.forEach((field) => {
        row[field.Key] = formatValue(field, record.Data?.[field.Key]);
        row[`__raw_${field.Key}`] = record.Data?.[field.Key];
      });
      return row;
    },
    [fields, formatValue]
  );

  const dataRows = useMemo(() => records.map((record) => buildRow(record)), [records, buildRow]);

  const filterOptions = useMemo(() => {
    const options = {};
    fields.forEach((field) => {
      const values = dataRows
        .map((row) => String(row[field.Key] ?? ""))
        .filter((value) => value !== "");
      options[field.Key] = Array.from(new Set(values)).sort();
    });
    return options;
  }, [dataRows, fields]);

  const searchableKeys = useMemo(() => fields.map((field) => field.Key), [fields]);

  const filteredRows = useMemo(() => {
    let next = [...dataRows];
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      next = next.filter((row) =>
        searchableKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(query))
      );
    }
    Object.entries(filters).forEach(([key, selected]) => {
      if (!selected || selected.length === 0) {
        return;
      }
      next = next.filter((row) => selected.includes(String(row[key] ?? "")));
    });
    return next;
  }, [dataRows, searchTerm, searchableKeys, filters]);

  const sortedRows = useMemo(() => {
    if (!sort.key) {
      return filteredRows;
    }
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aValue = a[sort.key];
      const bValue = b[sort.key];
      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      const order = sort.direction === "asc" ? 1 : -1;
      if (typeof aValue === "number" && typeof bValue === "number") {
        return order * (aValue - bValue);
      }
      return order * String(aValue).localeCompare(String(bValue));
    });
    return sorted;
  }, [filteredRows, sort]);

  const hasRecords = sortedRows.length > 0;
  const allSelected = hasRecords && sortedRows.every((record) => selectedSet.has(record.Id));
  const hasSelected = selectedIds.length > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasSelected && !allSelected;
    }
  }, [hasSelected, allSelected]);

  const onToggleSelectAll = (event) => {
    const checked = event.target.checked;
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(sortedRows.map((record) => record.Id));
  };

  const onRemoveSelected = async () => {
    if (!hasSelected) {
      return;
    }
    const count = selectedIds.length;
    if (!window.confirm(`Remove ${count} record${count === 1 ? "" : "s"}?`)) {
      return;
    }
    try {
      setActionStatus("saving");
      setActionError("");
      await Promise.all(selectedIds.map((recordId) => DeleteLifeRecord(recordId)));
      setSelectedIds([]);
      await reloadRecords();
      setActionStatus("ready");
    } catch (err) {
      setActionStatus("error");
      setActionError(err?.message || "Failed to remove selected records");
    }
  };

  const draftRow = useMemo(() => {
    if (!draftRecord) {
      return null;
    }
    return buildRow(
      {
        Id: draftRecord.Id,
        Data: draftRecord.Data || {},
        SortOrder: draftRecord.SortOrder ?? 0
      },
      { isDraft: true }
    );
  }, [draftRecord, buildRow]);

  const displayRows = useMemo(() => {
    const rows = [...sortedRows];
    if (draftRow) {
      rows.push(draftRow);
    }
    return rows;
  }, [sortedRows, draftRow]);

  const showGrid = displayRows.length > 0;

  const fieldMap = useMemo(
    () =>
      fields.reduce((acc, field) => {
        acc[field.Key] = field;
        return acc;
      }, {}),
    [fields]
  );

  const isEmptyValue = useCallback(
    (value) =>
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0),
    []
  );

  const requiredCellTheme = useMemo(() => ({ bgCell: gridTheme.accentLight }), [gridTheme]);

  const isMissingRequired = useCallback(
    (field, value) => {
      if (!field?.IsRequired) {
        return false;
      }
      if (field.FieldType === "DateRange") {
        return !value?.StartDate;
      }
      return isEmptyValue(value);
    },
    [isEmptyValue]
  );

  const missingRequiredFields = useMemo(() => {
    if (!draftRecord) {
      return [];
    }
    const data = draftRecord.Data || {};
    return fields
      .filter((field) => field.IsRequired && isMissingRequired(field, data[field.Key]))
      .map((field) => field.Name);
  }, [draftRecord, fields, isMissingRequired]);

  const gridColumns = useMemo(() => {
    const rowColumn = {
      id: "__rownum",
      title: BuildColumnTitle({
        label: "Row #",
        isSorted: sort.key === "SortOrder",
        sortDirection: sort.direction
      }),
      width: 72
    };
    const dynamic = fields
      .filter((field) => visibleColumns[field.Key] !== false || field.IsRequired)
      .map((field) => ({
        id: field.Key,
        title: BuildColumnTitle({
          label: field.Name,
          isRequired: field.IsRequired,
          isSorted: sort.key === field.Key,
          sortDirection: sort.direction,
          hasFilter: (filters[field.Key] || []).length > 0
        }),
        width: columnWidths[field.Key] || 200
      }));
    return [
      rowColumn,
      ...dynamic,
      { id: "__actions", title: "Actions", width: 96 }
    ];
  }, [fields, visibleColumns, columnWidths, sort, filters]);

  const columnKeys = useMemo(
    () => gridColumns.map((column) => column.id ?? column.title),
    [gridColumns]
  );

  const rowIndexById = useMemo(() => {
    const map = new Map();
    displayRows.forEach((row, index) => {
      if (!row.__isDraft) {
        map.set(row.Id, index);
      }
    });
    return map;
  }, [displayRows]);

  useEffect(() => {
    let nextRows = CompactSelection.empty();
    const rowIndexes = selectedIds
      .map((id) => rowIndexById.get(id))
      .filter((index) => index !== undefined)
      .sort((a, b) => a - b);
    rowIndexes.forEach((index) => {
      nextRows = nextRows.add(index);
    });
    setGridSelection((prev) => {
      if (prev.rows.equals(nextRows)) {
        return prev;
      }
      return { ...prev, rows: nextRows };
    });
  }, [rowIndexById, selectedIds]);

  const buildTextCell = useCallback(
    (value, { align = "left", readonly = true, allowOverlay = false, themeOverride } = {}) => {
      const display = value ?? "";
      const selectionRange = !readonly && allowOverlay ? String(display).length : undefined;
      return {
        kind: GridCellKind.Text,
        data: String(display),
        displayData: String(display),
        allowOverlay,
        readonly,
        contentAlign: align,
        selectionRange,
        themeOverride
      };
    },
    []
  );

  const buildNumberCell = useCallback(
    (value, { readonly = true, allowOverlay = true, themeOverride } = {}) => {
      const display = value === null || value === undefined ? "" : String(value);
      const selectionRange = !readonly && allowOverlay ? display.length : undefined;
      return {
        kind: GridCellKind.Number,
        data: value === "" || value === null || value === undefined ? undefined : Number(value),
        displayData: display,
        allowOverlay,
        readonly,
        contentAlign: "right",
        selectionRange,
        themeOverride
      };
    },
    []
  );

  const getCellContent = useCallback(
    ([col, row]) => {
      const columnKey = columnKeys[col];
      const rowData = displayRows[row];
      if (!columnKey || !rowData) {
        return buildTextCell("");
      }
      const isDraft = Boolean(rowData.__isDraft);
      if (columnKey === "__rownum") {
        return buildNumberCell(rowData.SortOrder ?? 0, { readonly: true });
      }
      if (columnKey === "__actions") {
        return buildTextCell("🗑", { align: "center" });
      }
      const field = fieldMap[columnKey];
      if (!field) {
        return buildTextCell(String(rowData[columnKey] ?? ""));
      }
      const rawValue = rowData[`__raw_${field.Key}`];
      const highlightRequired = isDraft && isMissingRequired(field, rawValue);
      const requiredTheme = highlightRequired ? requiredCellTheme : undefined;
      if (field.FieldType === "Date") {
        return {
          ...BuildDateCell(rawValue || "", rawValue || ""),
          themeOverride: requiredTheme
        };
      }
      if (field.FieldType === "DateRange") {
        const display = rowData[field.Key];
        const duration = BuildDateRangeDuration(rawValue?.StartDate, rawValue?.EndDate);
        if (!display) {
          return {
            ...BuildDateRangeCell({
              start: rawValue?.StartDate,
              end: rawValue?.EndDate,
              display: ""
            }),
            themeOverride: requiredTheme
          };
        }
        const displayText = duration ? `${display} (${duration})` : display;
        return {
          ...BuildDateRangeCell({
            start: rawValue?.StartDate,
            end: rawValue?.EndDate,
            display: displayText
          }),
          themeOverride: requiredTheme
        };
      }
      if (field.FieldType === "Number" || field.FieldType === "Currency") {
        return buildNumberCell(rawValue, { readonly: false, themeOverride: requiredTheme });
      }
      if (field.FieldType === "Boolean") {
        return {
          kind: GridCellKind.Boolean,
          data: Boolean(rawValue),
          allowOverlay: false,
          readonly: false,
          themeOverride: requiredTheme
        };
      }
      if (field.FieldType === "Dropdown" || field.FieldType === "Person" || field.FieldType === "RecordLink") {
        return {
          ...BuildSelectCell({
            value: rawValue,
            display: rowData[field.Key] || "",
            options: selectOptionsByField[field.Key] || [],
            multiple: Boolean(field.IsMulti)
          }),
          themeOverride: requiredTheme
        };
      }
      return buildTextCell(rowData[field.Key], {
        readonly: false,
        allowOverlay: true,
        themeOverride: requiredTheme
      });
    },
    [
      buildTextCell,
      buildNumberCell,
      columnKeys,
      fieldMap,
      displayRows,
      selectOptionsByField,
      isMissingRequired,
      requiredCellTheme
    ]
  );

  const handleHeaderClick = useCallback(
    (colIndex) => {
      const columnKey = columnKeys[colIndex];
      if (!columnKey) {
        return;
      }
      if (columnKey === "__rownum") {
        setSort((prev) => {
          if (prev.key !== "SortOrder") return { key: "SortOrder", direction: "asc" };
          return { key: "SortOrder", direction: prev.direction === "asc" ? "desc" : "asc" };
        });
        return;
      }
      if (!fieldMap[columnKey]) {
        return;
      }
      setSort((prev) => {
        if (prev.key !== columnKey) return { key: columnKey, direction: "asc" };
        if (prev.direction === "asc") return { key: columnKey, direction: "desc" };
        return { key: "SortOrder", direction: "asc" };
      });
    },
    [columnKeys, fieldMap]
  );

  const handleHeaderContextMenu = useCallback(
    (colIndex, event) => {
      const columnKey = columnKeys[colIndex];
      const field = fieldMap[columnKey];
      if (!columnKey || !field) {
        return;
      }
      event.preventDefault();
      setFilterPopover({ key: columnKey, label: field.Name, bounds: event.bounds });
    },
    [columnKeys, fieldMap]
  );

  const handleCellClicked = useCallback(
    ([col, row], _event) => {
      const columnKey = columnKeys[col];
      const rowData = displayRows[row];
      if (!rowData) {
        return;
      }
      if (columnKey === "__actions") {
        onDeleteRecord(rowData.Record);
      }
    },
    [columnKeys, onDeleteRecord, displayRows]
  );

  const handleSelectionChange = useCallback(
    (selection) => {
      setGridSelection(selection);
      const nextIds = selection.rows
        .toArray()
        .map((index) => displayRows[index])
        .filter((row) => row && !row.__isDraft)
        .map((row) => row.Id);
      setSelectedIds(nextIds);
    },
    [displayRows]
  );

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((values) => values && values.length > 0),
    [filters]
  );

  const canReorder =
    !draftRecord && !searchTerm && !hasActiveFilters && (sort.key === "SortOrder" || !sort.key);

  const handleRowMoved = useCallback(
    async (startIndex, endIndex) => {
      if (!canReorder || !activeCategoryId || startIndex === endIndex) {
        return;
      }
      if (startIndex < 0 || endIndex < 0 || startIndex >= sortedRows.length || endIndex >= sortedRows.length) {
        return;
      }
      const orderedIds = sortedRows.map((row) => row.Id);
      const reordered = [...orderedIds];
      const [moved] = reordered.splice(startIndex, 1);
      reordered.splice(endIndex, 0, moved);
      try {
        setActionStatus("saving");
        setActionError("");
        await UpdateLifeRecordOrder(activeCategoryId, reordered);
        await reloadRecords();
      } catch (err) {
        setActionStatus("error");
        setActionError(err?.message || "Failed to reorder records");
      } finally {
        setActionStatus("ready");
      }
    },
    [activeCategoryId, canReorder, reloadRecords, sortedRows]
  );

  const handleRowAppended = useCallback(() => {
    if (!activeCategoryId || draftRecord) {
      return "bottom";
    }
    const maxSort = records.reduce((acc, record) => Math.max(acc, record.SortOrder || 0), 0);
    setDraftRecord({
      Id: "__draft__",
      SortOrder: maxSort + 1,
      Data: {}
    });
    return "bottom";
  }, [activeCategoryId, draftRecord, records]);

  const handleColumnResize = useCallback((key, nextWidth) => {
    if (!key) {
      return;
    }
    setColumnWidths((prev) => ({
      ...prev,
      [key]: Math.max(120, Math.round(nextWidth))
    }));
  }, []);

  const toggleColumnVisibility = useCallback(
    (key) => {
      const field = fieldMap[key];
      if (field?.IsRequired) {
        return;
      }
      setVisibleColumns((prev) => ({
        ...prev,
        [key]: prev[key] === false
      }));
    },
    [fieldMap]
  );

  const toggleFilterValue = useCallback((key, value) => {
    setFilters((prev) => {
      const selected = new Set(prev[key] || []);
      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }
      return { ...prev, [key]: Array.from(selected) };
    });
  }, []);

  const clearFilter = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: [] }));
  }, []);

  const resetDefaults = useCallback(() => {
    setVisibleColumns(defaultVisibleColumns);
    setColumnWidths(defaultColumnWidths);
    setSort({ key: "SortOrder", direction: "asc" });
    setFilters({});
  }, [defaultColumnWidths, defaultVisibleColumns]);

  const parseDateRangeInput = (value) => {
    if (value && typeof value === "object") {
      const start = value.start ?? value.StartDate ?? "";
      const end = value.end ?? value.EndDate ?? "";
      if (!start && !end) {
        return null;
      }
      return {
        StartDate: start || null,
        EndDate: end || null
      };
    }
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }
    const splitToken = text.includes(" to ") ? " to " : text.includes(" - ") ? " - " : null;
    if (!splitToken) {
      return { StartDate: text, EndDate: null };
    }
    const [start, end] = text.split(splitToken).map((part) => part.trim());
    return {
      StartDate: start || null,
      EndDate: end || null
    };
  };

  const resolveLookupValues = (inputValue, lookupMap, isMulti) => {
    const tokens = Array.isArray(inputValue)
      ? inputValue.map((token) => String(token).trim()).filter(Boolean)
      : String(inputValue || "")
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean);
    if (tokens.length === 0) {
      return { value: isMulti ? [] : null };
    }
    const resolved = [];
    for (const token of tokens) {
      const match = lookupMap[token.toLowerCase()] ?? lookupMap[token];
      if (!match) {
        return { error: `Could not find "${token}".` };
      }
      resolved.push(match);
    }
    return { value: isMulti ? resolved : resolved[0] };
  };

  const isRecordReady = useCallback(
    (data) =>
      fields.every((field) => {
        if (!field.IsRequired) {
          return true;
        }
        const value = data[field.Key];
        if (field.FieldType === "DateRange") {
          return value && value.StartDate;
        }
        return !isEmptyValue(value);
      }),
    [fields, isEmptyValue]
  );

  const handleCellEdited = useCallback(
    async (cell, newValue) => {
      const [col, row] = cell;
      const columnKey = columnKeys[col];
      if (!columnKey || columnKey === "__actions") {
        return;
      }
      const rowData = displayRows[row];
      if (!rowData) {
        return;
      }
      const field = fieldMap[columnKey];
      if (!field) {
        return;
      }

      const incomingValue =
        newValue?.kind === GridCellKind.Custom ? newValue?.data?.value : newValue?.data;

      let normalizedValue = null;
      if (field.FieldType === "Number" || field.FieldType === "Currency") {
        normalizedValue = incomingValue ?? null;
      } else if (field.FieldType === "Boolean") {
        normalizedValue = Boolean(incomingValue);
      } else if (field.FieldType === "DateRange") {
        normalizedValue = parseDateRangeInput(incomingValue);
      } else if (field.FieldType === "Date") {
        normalizedValue = incomingValue ? String(incomingValue) : null;
      } else if (field.FieldType === "Dropdown") {
        const lookup = dropdownValueMap[field.DropdownId] || {};
        const resolved = resolveLookupValues(incomingValue, lookup, field.IsMulti);
        if (resolved.error) {
          setActionError(resolved.error);
          return;
        }
        normalizedValue = resolved.value;
      } else if (field.FieldType === "Person") {
        const resolved = resolveLookupValues(incomingValue, personValueMap, field.IsMulti);
        if (resolved.error) {
          setActionError(resolved.error);
          return;
        }
        normalizedValue = resolved.value;
      } else if (field.FieldType === "RecordLink") {
        const lookup = recordValueMap[field.LinkedCategoryId] || {};
        const resolved = resolveLookupValues(incomingValue, lookup, field.IsMulti);
        if (resolved.error) {
          setActionError(resolved.error);
          return;
        }
        normalizedValue = resolved.value;
      } else {
        normalizedValue = incomingValue ?? "";
      }

      if (rowData.__isDraft) {
        const nextData = {
          ...(draftRecord?.Data || {}),
          [field.Key]: normalizedValue
        };
        setDraftRecord((prev) => (prev ? { ...prev, Data: nextData } : prev));
        if (!activeCategoryId || !isRecordReady(nextData)) {
          return;
        }
        try {
          setActionStatus("saving");
          setActionError("");
          await CreateLifeRecord(activeCategoryId, { Data: nextData });
          setDraftRecord(null);
          await reloadRecords();
        } catch (err) {
          setActionStatus("error");
          setActionError(err?.message || "Failed to add record");
        } finally {
          setActionStatus("ready");
        }
        return;
      }

      const nextData = { ...(rowData.Record.Data || {}) };
      if (isEmptyValue(normalizedValue)) {
        delete nextData[field.Key];
      } else {
        nextData[field.Key] = normalizedValue;
      }
      try {
        setActionStatus("saving");
        setActionError("");
        const updated = await UpdateLifeRecord(rowData.Record.Id, { Data: nextData });
        setRecords((current) =>
          current.map((record) => (record.Id === updated.Id ? updated : record))
        );
      } catch (err) {
        setActionStatus("error");
        setActionError(err?.message || "Failed to update record");
      } finally {
        setActionStatus("ready");
      }
    },
    [
      activeCategoryId,
      columnKeys,
      displayRows,
      draftRecord,
      dropdownValueMap,
      fieldMap,
      isRecordReady,
      personValueMap,
      recordValueMap,
      reloadRecords,
      setRecords,
      isEmptyValue
    ]
  );

  return (
    <div className="module-panel module-panel--stretch life-admin-records">
      <div className="module-panel-header">
        <div>
          <h3>Records</h3>
          <p className="lede">Track life admin records by category.</p>
        </div>
        <div className="module-panel-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onAddRecord}
            disabled={!activeCategory}
          >
            Add record
          </button>
        </div>
      </div>
      {status === "loading" ? <p className="form-note">Loading catalog.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {recordError ? <p className="form-error">{recordError}</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}
      {categories.length > 0 ? (
        <div
          className="life-admin-tabs life-admin-tabs--underline"
          role="tablist"
          aria-label="Life admin categories"
        >
          {categories.map((category) => {
            const isActive = category.Id === activeCategoryId;
            return (
              <button
                key={category.Id}
                type="button"
                className={`life-admin-tab${isActive ? " is-active" : ""}`}
                onClick={() => setActiveCategoryId(category.Id)}
                aria-pressed={isActive}
              >
                {category.Name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="form-note">No categories yet. Add one in Settings.</p>
      )}
      {!activeCategory ? (
        <p className="form-note">Choose a category to start logging records.</p>
      ) : (
        <>
          <div className="income-table-section">
            <div className="income-table-header">
              <h4>{activeCategory.Name} records</h4>
              <p>{activeCategory.Description || "Latest entries appear first."}</p>
            </div>
            {recordStatus === "loading" ? (
              <p className="form-note">Loading records.</p>
            ) : (
              <div className="glide-grid-shell life-admin-grid-shell" ref={gridShellRef}>
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
                    {draftRecord ? (
                      <div className="grid-draft-banner grid-draft-banner--inline">
                        <div>
                          <strong>Draft row in progress.</strong>{" "}
                          {missingRequiredFields.length > 0
                            ? `Missing required: ${missingRequiredFields.join(", ")}.`
                            : "All required fields are set. Press Enter to save."}
                        </div>
                        <button type="button" onClick={() => setDraftRecord(null)}>
                          Discard (Esc)
                        </button>
                      </div>
                    ) : null}
                    <div className="toolbar-flyout">
                      <button
                        type="button"
                        className="toolbar-button"
                        onClick={() => {
                          setColumnsOpen((prev) => !prev);
                          setMenuOpen(false);
                        }}
                      >
                        <Icon name="columns" className="icon" />
                        Columns
                      </button>
                      {columnsOpen ? (
                        <div className="dropdown columns-dropdown">
                          {fields.map((field) => (
                            <label key={field.Key} className="dropdown-item">
                              <input
                                type="checkbox"
                                checked={field.IsRequired || visibleColumns[field.Key] !== false}
                                onChange={() => toggleColumnVisibility(field.Key)}
                                disabled={field.IsRequired}
                              />
                              <span>{field.Name}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="table-header-addon-content">
                      <label>
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={onToggleSelectAll}
                          disabled={!hasRecords || actionStatus === "saving"}
                        />
                        <span>Select all</span>
                      </label>
                      <button
                        type="button"
                        className="toolbar-button is-danger"
                        onClick={onRemoveSelected}
                        disabled={!hasSelected || actionStatus === "saving"}
                      >
                        Remove selected records
                      </button>
                    </div>
                    <div className="toolbar-flyout">
                      <button
                        type="button"
                        className="toolbar-button icon-only"
                        aria-label="Table options"
                        onClick={() => {
                          setMenuOpen((prev) => !prev);
                          setColumnsOpen(false);
                        }}
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
                {filterPopover
                  ? createPortal(
                      <div
                        className="grid-filter-popover"
                        ref={filterPopoverRef}
                        style={{
                          position: "fixed",
                          left: filterPopover.bounds?.x ?? 0,
                          top:
                            (filterPopover.bounds?.y ?? 0) +
                            (filterPopover.bounds?.height ?? 0) +
                            6
                        }}
                      >
                        <div className="grid-filters-header">
                          <span>{filterPopover.label || filterPopover.key} filter</span>
                          <button type="button" onClick={() => setFilterPopover(null)}>
                            Close
                          </button>
                        </div>
                        <div className="grid-filter-options">
                          {(filterOptions[filterPopover.key] || []).length === 0 ? (
                            <div className="grid-filter-empty">No options</div>
                          ) : (
                            filterOptions[filterPopover.key].map((option) => (
                              <label key={option || "none"} className="grid-filter-option">
                                <input
                                  type="checkbox"
                                  checked={(filters[filterPopover.key] || []).includes(option)}
                                  onChange={() => toggleFilterValue(filterPopover.key, option)}
                                />
                                {option || "None"}
                              </label>
                            ))
                          )}
                        </div>
                        <div className="grid-filter-actions">
                          <button type="button" onClick={() => clearFilter(filterPopover.key)}>
                            Clear
                          </button>
                        </div>
                      </div>,
                      document.getElementById("portal") || document.body
                    )
                  : null}
                <div className="glide-grid-frame life-admin-grid-frame">
                  {showGrid ? (
                    <GlideTable
                      gridRef={gridRef}
                      columns={gridColumns}
                      rows={displayRows.length}
                      getCellContent={getCellContent}
                      onHeaderClicked={handleHeaderClick}
                      onHeaderContextMenu={handleHeaderContextMenu}
                      onCellClicked={handleCellClicked}
                      onCellEdited={handleCellEdited}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && draftRecord) {
                          event.preventDefault();
                          event.stopPropagation();
                          setDraftRecord(null);
                        }
                      }}
                      onColumnResize={(column, newSize, colIndex) =>
                        handleColumnResize(columnKeys[colIndex], newSize)
                      }
                      onRowMoved={canReorder ? handleRowMoved : undefined}
                      onRowAppended={handleRowAppended}
                      gridSelection={gridSelection}
                      onGridSelectionChange={handleSelectionChange}
                      customRenderers={[GlideCustomRenderer]}
                      theme={gridTheme}
                      extraRows={1}
                      className="glide-grid"
                    />
                  ) : (
                    <div className="table-empty">
                      <p>No records yet. Add a row to get started.</p>
                      <button type="button" className="primary-button" onClick={onAddRecord}>
                        Add first record
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Records;
