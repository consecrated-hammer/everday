import { useEffect, useMemo, useRef, useState } from "react";

import DataTable from "../../components/DataTable.jsx";
import Icon from "../../components/Icon.jsx";
import { FormatDateTime } from "../../lib/formatters.js";
import {
  CreateShoppingItem,
  DeleteShoppingItem,
  FetchShoppingItems,
  UpdateShoppingItem
} from "../../lib/shoppingApi.js";

const EmptyForm = {
  Item: ""
};

const ResolveHouseholdId = () => {
  const raw = Number(import.meta.env.VITE_SHOPPING_HOUSEHOLD_ID || 1);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1;
  }
  return raw;
};

const HouseholdId = ResolveHouseholdId();

const Shopping = () => {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState(EmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const selectAllRef = useRef(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = items.length > 0 && items.every((item) => selectedSet.has(item.Id));
  const hasSelected = selectedIds.length > 0;
  const hasItems = items.length > 0;

  const loadItems = async () => {
    const data = await FetchShoppingItems(HouseholdId);
    setItems(data);
    return data;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setStatus("loading");
        setError("");
        await loadItems();
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Failed to load shopping list");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = hasSelected && !allSelected;
  }, [hasSelected, allSelected]);

  useEffect(() => {
    const available = new Set(items.map((item) => item.Id));
    setSelectedIds((prev) => prev.filter((id) => available.has(id)));
  }, [items]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onOpenAdd = () => {
    setForm(EmptyForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const onEdit = (item) => {
    setForm({ Item: item.Item });
    setEditingId(item.Id);
    setModalOpen(true);
  };

  const onCancel = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EmptyForm);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      if (editingId) {
        await UpdateShoppingItem(editingId, { Item: form.Item }, HouseholdId);
      } else {
        await CreateShoppingItem({ HouseholdId, Item: form.Item });
      }
      await loadItems();
      onCancel();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save shopping item");
    }
  };

  const onDelete = async (item) => {
    if (!window.confirm(`Delete "${item.Item}"?`)) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteShoppingItem(item.Id, HouseholdId);
      await loadItems();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete shopping item");
    }
  };

  const onToggleSelectAll = (event) => {
    const checked = event.target.checked;
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item.Id));
  };

  const onToggleSelected = (itemId) => {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const onRemoveSelected = async () => {
    if (!hasSelected) {
      return;
    }
    const count = selectedIds.length;
    if (!window.confirm(`Remove ${count} item${count === 1 ? "" : "s"} from the list?`)) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await Promise.all(selectedIds.map((itemId) => DeleteShoppingItem(itemId, HouseholdId)));
      setSelectedIds([]);
      await loadItems();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to remove selected items");
    }
  };

  const columns = useMemo(
    () => [
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
            aria-label={`Select ${row.Item}`}
          />
        )
      },
      { key: "Item", label: "Item", sortable: true, width: 280 },
      {
        key: "AddedByName",
        label: "Added by",
        sortable: true,
        filterable: true,
        width: 180,
        render: (row) => row.AddedByName || "-"
      },
      {
        key: "CreatedAt",
        label: "Added",
        sortable: true,
        width: 180,
        render: (row) => FormatDateTime(row.CreatedAt)
      }
    ],
    [selectedSet]
  );

  return (
    <div className="module-panel">
      <header className="module-panel-header">
        <div>
          <h2>Shopping list</h2>
          <p>Track shared groceries and household items.</p>
          <p className="form-note">
            Zebra helper examples: "Alexa, ask zebra helper to add milk", "Alexa, ask zebra helper to remove milk",
            "Alexa, ask zebra helper to clear the list".
          </p>
        </div>
        <div className="module-panel-actions">
          <button type="button" className="primary-button" onClick={onOpenAdd} disabled={status === "saving"}>
            Add item
          </button>
        </div>
      </header>
      <div className="module-panel-actions">
        <label>
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            disabled={!hasItems || status === "saving"}
          />
          <span>Select all</span>
        </label>
        <button
          type="button"
          className="button-secondary"
          onClick={onRemoveSelected}
          disabled={!hasSelected || status === "saving"}
        >
          Remove selected items
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <DataTable
        tableKey="shopping-items"
        columns={columns}
        rows={items}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {modalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingId ? "Edit item" : "Add item"}</h3>
              <div className="modal-header-actions">
                <button type="button" className="icon-button" onClick={onCancel} aria-label="Close">
                  <Icon name="close" className="icon action-icon" />
                  <span className="action-label">Close</span>
                </button>
              </div>
            </div>
            <form className="form-grid" onSubmit={onSubmit}>
              <label>
                <span>Item</span>
                <input name="Item" value={form.Item} onChange={onChange} required />
              </label>
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={status === "saving"}>
                  {editingId ? "Save changes" : "Add item"}
                </button>
                <button type="button" className="button-secondary" onClick={onCancel}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Shopping;
