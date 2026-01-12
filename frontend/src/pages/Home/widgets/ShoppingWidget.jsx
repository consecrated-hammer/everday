import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "../../../components/Icon.jsx";
import {
  CreateShoppingItem,
  DeleteShoppingItem,
  FetchShoppingItems
} from "../../../lib/shoppingApi.js";

const ResolveHouseholdId = () => {
  const raw = Number(import.meta.env.VITE_SHOPPING_HOUSEHOLD_ID || 1);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1;
  }
  return raw;
};

const HouseholdId = ResolveHouseholdId();

const ShoppingWidget = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ Item: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const addFormRef = useRef(null);

  const loadItems = async () => {
    const data = await FetchShoppingItems(HouseholdId);
    setItems(data || []);
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
        setError(err?.message || "Unable to load shopping list.");
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.widgetId !== "shopping" || event.detail?.actionId !== "add-item") {
        return;
      }
      setShowAdd(true);
    };
    window.addEventListener("dashboard-widget-action", handler);
    return () => window.removeEventListener("dashboard-widget-action", handler);
  }, []);

  useEffect(() => {
    if (!showAdd) {
      return;
    }
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      setShowAdd(false);
      setForm({ Item: "" });
    };
    const handlePointerDown = (event) => {
      if (!addFormRef.current || addFormRef.current.contains(event.target)) {
        return;
      }
      setShowAdd(false);
      setForm({ Item: "" });
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showAdd]);

  const previewItems = useMemo(() => {
    if (items.length <= 5) {
      return items;
    }
    return items.slice(0, 3);
  }, [items]);

  const extraCount = items.length > 5 ? items.length - previewItems.length : 0;

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const trimmed = form.Item.trim();
    if (!trimmed) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await CreateShoppingItem({ HouseholdId, Item: trimmed });
      setForm({ Item: "" });
      setShowAdd(false);
      await loadItems();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to add item.");
    }
  };

  const onComplete = async (itemId) => {
    try {
      setStatus("saving");
      setError("");
      await DeleteShoppingItem(itemId, HouseholdId);
      await loadItems();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to update list.");
    }
  };

  const isReady = status === "ready" || status === "saving";

  return (
    <div className="widget-body">
      {status === "loading" ? <p className="text-muted">Loading shopping list...</p> : null}
      {status === "error" ? <p className="form-error">{error}</p> : null}
      {isReady ? (
        <>
          {items.length > 0 ? (
            <p className="text-muted">
              {items.length} item{items.length === 1 ? "" : "s"} on the list.
            </p>
          ) : (
            <p className="text-muted">Nothing on the list yet.</p>
          )}
          <ul className="shopping-list">
            {previewItems.map((item) => (
              <li key={item.Id} className="shopping-item dashboard-panel">
                <span>{item.Item}</span>
                <button
                  type="button"
                  className="widget-icon-button"
                  onClick={() => onComplete(item.Id)}
                  aria-label={`Mark ${item.Item} as done`}
                >
                  <Icon name="check" className="icon" />
                </button>
              </li>
            ))}
            {extraCount > 0 ? (
              <li className="shopping-item shopping-item-muted dashboard-panel">+{extraCount} more</li>
            ) : null}
          </ul>
          {showAdd ? (
            <form className="shopping-add" onSubmit={onSubmit} ref={addFormRef}>
              <input
                type="text"
                name="Item"
                placeholder="Add item"
                value={form.Item}
                onChange={onChange}
                aria-label="Add shopping item"
                autoFocus
              />
              <div className="shopping-add-actions">
                <button type="submit" className="button-secondary" disabled={!form.Item.trim()}>
                  Save
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setShowAdd(false);
                    setForm({ Item: "" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default ShoppingWidget;
