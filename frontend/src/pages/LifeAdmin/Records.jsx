import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DataTable from "../../components/DataTable.jsx";
import { CreateLifeRecord, DeleteLifeRecord, UpdateLifeRecord } from "../../lib/lifeAdminApi.js";
import { useLifeAdminCatalog } from "../../hooks/useLifeAdminCatalog.js";
import { useLifeAdminFields } from "../../hooks/useLifeAdminFields.js";
import { useLifeAdminRecords } from "../../hooks/useLifeAdminRecords.js";

const EmptyRecordForm = {
  Data: {}
};

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

const Records = () => {
  const { categories, dropdowns, people, status, error } = useLifeAdminCatalog();
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const { fields } = useLifeAdminFields(activeCategoryId);
  const { records, recordError, recordStatus, recordLookups, dropdownOptions, reloadRecords } =
    useLifeAdminRecords(activeCategoryId, fields);
  const [recordForm, setRecordForm] = useState(EmptyRecordForm);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
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
    setRecordForm(EmptyRecordForm);
    setEditingRecordId(null);
    setIsFormOpen(false);
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
  const hasRecords = records.length > 0;
  const allSelected = hasRecords && records.every((record) => selectedSet.has(record.Id));
  const hasSelected = selectedIds.length > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasSelected && !allSelected;
    }
  }, [hasSelected, allSelected]);
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

  const onRecordChange = (key, value) => {
    setRecordForm((prev) => ({
      ...prev,
      Data: {
        ...prev.Data,
        [key]: value
      }
    }));
  };

  const onRecordSubmit = async (event) => {
    event.preventDefault();
    if (!activeCategoryId) {
      setActionError("Select a category to save records.");
      return;
    }
    try {
      setActionStatus("saving");
      setActionError("");
      if (editingRecordId) {
        await UpdateLifeRecord(editingRecordId, recordForm);
      } else {
        await CreateLifeRecord(activeCategoryId, recordForm);
      }
      setRecordForm(EmptyRecordForm);
      setEditingRecordId(null);
      setIsFormOpen(false);
      await reloadRecords();
      setActionStatus("ready");
    } catch (err) {
      setActionStatus("error");
      setActionError(err?.message || "Failed to save record");
    }
  };

  const onEditRecord = (record) => {
    setEditingRecordId(record.Id);
    setRecordForm({
      Data: record.Data || {}
    });
    setIsFormOpen(true);
  };

  const onCloseForm = () => {
    setEditingRecordId(null);
    setRecordForm(EmptyRecordForm);
    setIsFormOpen(false);
  };

  const onAddRecord = () => {
    if (!activeCategoryId) {
      setActionError("Select a category to add records.");
      return;
    }
    setEditingRecordId(null);
    setRecordForm(EmptyRecordForm);
    setIsFormOpen(true);
  };

  const onToggleSelectAll = (event) => {
    const checked = event.target.checked;
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(records.map((record) => record.Id));
  };

  const onToggleSelected = (recordId) => {
    setSelectedIds((prev) =>
      prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]
    );
  };

  const onDeleteRecord = async (record) => {
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
    if (field.FieldType === "DateRange" && value && typeof value === "object") {
      return BuildDateRangeText(value);
    }
    if (field.FieldType === "Boolean") {
      return value ? "Yes" : "No";
    }
    return value;
  }, [dropdownLabelMap, personMap, recordLabelMap]);

  const tableRows = useMemo(
    () =>
      records.map((record) => {
        const row = { Id: record.Id, Record: record };
        fields.forEach((field) => {
          row[field.Key] = formatValue(field, record.Data?.[field.Key]);
          row[`__raw_${field.Key}`] = record.Data?.[field.Key];
        });
        return row;
      }),
    [records, fields, formatValue]
  );

  const columns = useMemo(() => {
    const dynamic = fields.map((field) => {
      const column = {
        key: field.Key,
        label: field.Name,
        sortable: true,
        width: 200
      };
      if (field.FieldType === "DateRange") {
        column.render = (row) => {
          const raw = row[`__raw_${field.Key}`];
          const display = row[field.Key];
          const duration = BuildDateRangeDuration(raw?.StartDate, raw?.EndDate);
          if (!display) {
            return "";
          }
          if (!duration) {
            return display;
          }
          return <span title={duration}>{display}</span>;
        };
      }
      return column;
    });
    return [
      {
        key: "Selected",
        label: "",
        sortable: false,
        width: 60,
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedSet.has(row.Id)}
            onChange={() => onToggleSelected(row.Id)}
            aria-label="Select record"
          />
        )
      },
      ...dynamic
    ];
  }, [fields, selectedSet]);

  const renderFieldControl = (field) => {
    const value = recordForm.Data[field.Key] ?? (field.IsMulti ? [] : "");
    if (field.FieldType === "LongText") {
      return (
        <textarea
          name={field.Key}
          value={value}
          onChange={(event) => onRecordChange(field.Key, event.target.value)}
        />
      );
    }
    if (field.FieldType === "Date") {
      return (
        <input
          type="date"
          name={field.Key}
          value={value}
          onChange={(event) => onRecordChange(field.Key, event.target.value)}
        />
      );
    }
    if (field.FieldType === "Number" || field.FieldType === "Currency") {
      return (
        <input
          type="number"
          name={field.Key}
          step={field.FieldType === "Currency" ? "0.01" : "any"}
          value={value}
          onChange={(event) => onRecordChange(field.Key, event.target.value)}
        />
      );
    }
    if (field.FieldType === "Dropdown") {
      const options = dropdownOptions[field.DropdownId] || [];
      return (
        <select
          name={field.Key}
          multiple={field.IsMulti}
          value={value}
          onChange={(event) => {
            if (!field.IsMulti) {
              onRecordChange(field.Key, event.target.value);
              return;
            }
            const selected = Array.from(event.target.selectedOptions).map((entry) => entry.value);
            onRecordChange(field.Key, selected);
          }}
        >
          {!field.IsMulti ? <option value="">Select</option> : null}
          {options.map((option) => (
            <option key={option.Id} value={option.Id}>
              {option.Label}
            </option>
          ))}
        </select>
      );
    }
    if (field.FieldType === "Person") {
      return (
        <select
          name={field.Key}
          multiple={field.IsMulti}
          value={value}
          onChange={(event) => {
            if (!field.IsMulti) {
              onRecordChange(field.Key, event.target.value);
              return;
            }
            const selected = Array.from(event.target.selectedOptions).map((entry) => entry.value);
            onRecordChange(field.Key, selected);
          }}
        >
          {!field.IsMulti ? <option value="">Select</option> : null}
          {people.map((person) => (
            <option key={person.Id} value={person.Id}>
              {person.Name}
            </option>
          ))}
        </select>
      );
    }
    if (field.FieldType === "RecordLink") {
      const lookups = recordLookups[field.LinkedCategoryId] || [];
      return (
        <select
          name={field.Key}
          multiple={field.IsMulti}
          value={value}
          onChange={(event) => {
            if (!field.IsMulti) {
              onRecordChange(field.Key, event.target.value);
              return;
            }
            const selected = Array.from(event.target.selectedOptions).map((entry) => entry.value);
            onRecordChange(field.Key, selected);
          }}
        >
          {!field.IsMulti ? <option value="">Select</option> : null}
          {lookups.map((record) => (
            <option key={record.Id} value={record.Id}>
              {record.Title}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        name={field.Key}
        value={value}
        onChange={(event) => onRecordChange(field.Key, event.target.value)}
      />
    );
  };

  const renderFieldBlock = (field) => {
    if (field.FieldType === "DateRange") {
      const value = recordForm.Data[field.Key] || {};
      const startValue = value?.StartDate || "";
      const endValue = value?.EndDate || "";
      return (
        <div key={field.Id} className="form-grid form-grid--tight form-span form-date-range">
          <div className="form-span form-grid-label">{field.Name}</div>
          <label>
            Start date
            <input
              type="date"
              value={startValue}
              onChange={(event) =>
                onRecordChange(field.Key, {
                  StartDate: event.target.value,
                  EndDate: endValue || null
                })
              }
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={endValue}
              onChange={(event) =>
                onRecordChange(field.Key, {
                  StartDate: startValue || null,
                  EndDate: event.target.value
                })
              }
            />
          </label>
        </div>
      );
    }
    if (field.FieldType === "Boolean") {
      const value = recordForm.Data[field.Key] ?? false;
      return (
        <label key={field.Id} className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onRecordChange(field.Key, event.target.checked)}
          />
          {field.Name}
        </label>
      );
    }
    return (
      <label key={field.Id}>
        {field.Name}
        {renderFieldControl(field)}
      </label>
    );
  };

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
              <DataTable
                tableKey={`life-admin-records-${activeCategoryId || "all"}`}
                columns={columns}
                rows={tableRows}
                onEdit={(row) => onEditRecord(row.Record)}
                onDelete={(row) => onDeleteRecord(row.Record)}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                headerAddon={
                  <>
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
                  </>
                }
              />
            )}
          </div>
          {isFormOpen ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCloseForm}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h3>{editingRecordId ? "Edit record" : "Add record"}</h3>
                    <p>{activeCategory?.Name || "Select a category to continue."}</p>
                  </div>
                  <button type="button" className="text-button" onClick={onCloseForm}>
                    Close
                  </button>
                </div>
                {actionError ? <p className="form-error">{actionError}</p> : null}
                <form className="form-grid" onSubmit={onRecordSubmit}>
                  {fields.map((field) => renderFieldBlock(field))}
                  <div className="form-actions">
                    <button type="submit" disabled={actionStatus === "saving"}>
                      {editingRecordId ? "Save record" : "Add record"}
                    </button>
                    <button type="button" className="button-secondary" onClick={onCloseForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default Records;
