import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../../components/Icon.jsx";
import { CreateTask, DeleteTask, FetchTaskLists, FetchTasks, UpdateTask } from "../../lib/tasksApi.js";
import { FetchUsers } from "../../lib/settingsApi.js";
import { GetUserId } from "../../lib/authStorage.js";

const BuildListStorageKey = (userId) => `everday.tasks.google.selected.${userId || "anon"}`;

const FilterOptions = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" }
];

const BuildEmptyForm = (listKey) => ({
  Title: "",
  Notes: "",
  DueDate: "",
  AssignedToUserId: "",
  ListKey: listKey || "user"
});

const FormatDueDate = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const ParseDueDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const Tasks = () => {
  const currentUserId = GetUserId();
  const listStorageKey = BuildListStorageKey(currentUserId);
  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedListKey, setSelectedListKey] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(listStorageKey) || "";
  });
  const [view, setView] = useState("open");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(BuildEmptyForm(selectedListKey));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedList = useMemo(
    () => lists.find((list) => list.Key === selectedListKey) || lists[0] || null,
    [lists, selectedListKey]
  );

  const selectedListKeyValue = selectedList?.Key || "user";

  const filteredUsers = useMemo(
    () => users.filter((user) => user.Id !== currentUserId),
    [users, currentUserId]
  );

  const assigneeOptions = useMemo(
    () =>
      filteredUsers.map((user) => ({
        value: String(user.Id),
        label: user.FirstName?.trim() || user.Username
      })),
    [filteredUsers]
  );

  const visibleTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (view === "completed") {
      return tasks.filter((task) => task.IsCompleted);
    }
    if (view === "overdue") {
      return tasks.filter((task) => {
        if (task.IsCompleted) {
          return false;
        }
        const dueDate = ParseDueDate(task.DueDate);
        return dueDate ? dueDate < today : false;
      });
    }
    if (view === "all") {
      return tasks;
    }
    return tasks.filter((task) => !task.IsCompleted);
  }, [tasks, view]);

  const taskCountLabel = useMemo(() => {
    const count = visibleTasks.length;
    if (!count) {
      return "No tasks";
    }
    return `${count} task${count === 1 ? "" : "s"}`;
  }, [visibleTasks.length]);

  const loadLists = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      const response = await FetchTaskLists();
      const nextLists = response?.Lists || [];
      setLists(nextLists);
      if (!nextLists.length) {
        setSelectedListKey("");
        return;
      }
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(listStorageKey) : "";
      const hasStored = stored && nextLists.some((list) => list.Key === stored);
      const nextKey = hasStored ? stored : nextLists[0].Key;
      setSelectedListKey(nextKey);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(listStorageKey, nextKey);
      }
    } catch (err) {
      setError(err?.message || "Failed to load task lists.");
    } finally {
      setStatus("ready");
    }
  }, [listStorageKey]);

  const loadTasks = useCallback(
    async (listKey, options = {}) => {
      if (!listKey) {
        setTasks([]);
        return;
      }
      try {
        setStatus("loading");
        setError("");
        const response = await FetchTasks(listKey, { Refresh: options.Refresh });
        setTasks(response?.Tasks || []);
      } catch (err) {
        setError(err?.message || "Failed to load tasks.");
      } finally {
        setStatus("ready");
      }
    },
    []
  );

  const loadUsers = useCallback(async () => {
    try {
      const response = await FetchUsers();
      setUsers(response || []);
    } catch (err) {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadLists();
    loadUsers();
  }, [loadLists, loadUsers]);

  useEffect(() => {
    if (!selectedListKeyValue) {
      return;
    }
    loadTasks(selectedListKeyValue);
  }, [selectedListKeyValue, loadTasks]);

  const onSelectList = (listKey) => {
    setSelectedListKey(listKey);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(listStorageKey, listKey);
    }
  };

  const openNewForm = () => {
    setEditingTask(null);
    setForm(BuildEmptyForm(selectedListKeyValue));
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (task) => {
    setEditingTask(task);
    setForm({
      Title: task.Title || "",
      Notes: task.Notes || "",
      DueDate: task.DueDate || "",
      AssignedToUserId: task.AssignedToUserId ? String(task.AssignedToUserId) : "",
      ListKey: task.ListKey
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTask(null);
    setForm(BuildEmptyForm(selectedListKeyValue));
    setFormError("");
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.Title.trim()) {
      setFormError("Title is required.");
      return;
    }
    const assignedId = Number(form.AssignedToUserId || 0);
    const targetListKey = editingTask?.ListKey || form.ListKey;
    const isSharedList = targetListKey === "shared";
    const wantsAssignment = assignedId && assignedId !== currentUserId;
    const payload = {
      Title: form.Title.trim(),
      Notes: form.Notes.trim(),
      DueDate: form.DueDate || null,
      ListKey: targetListKey
    };
    if (isSharedList) {
      if (!assignedId) {
        setFormError("Choose who this task is shared with.");
        return;
      }
      payload.AssignedToUserId = assignedId;
    } else if (wantsAssignment) {
      payload.AssignedToUserId = assignedId;
    }
    try {
      setIsSaving(true);
      setFormError("");
      if (editingTask) {
        if (!isSharedList && wantsAssignment) {
          if (
            !window.confirm(
              "This will create a new shared task and remove it from this list. Continue?"
            )
          ) {
            setIsSaving(false);
            return;
          }
          await CreateTask(payload);
          await DeleteTask(editingTask.Id, editingTask.ListKey);
        } else {
          await UpdateTask(editingTask.Id, payload);
        }
      } else {
        await CreateTask(payload);
      }
      await loadTasks(selectedListKeyValue, { Refresh: true });
      closeForm();
    } catch (err) {
      setFormError(err?.message || "Failed to save task.");
    } finally {
      setIsSaving(false);
    }
  };

  const onToggleComplete = async (task) => {
    try {
      await UpdateTask(task.Id, {
        ListKey: task.ListKey,
        IsCompleted: !task.IsCompleted
      });
      await loadTasks(selectedListKeyValue, { Refresh: true });
    } catch (err) {
      setError(err?.message || "Failed to update task.");
    }
  };

  const onDeleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.Title}"?`)) {
      return;
    }
    try {
      await DeleteTask(task.Id, task.ListKey);
      await loadTasks(selectedListKeyValue, { Refresh: true });
      if (editingTask?.Id === task.Id) {
        closeForm();
      }
    } catch (err) {
      setError(err?.message || "Failed to delete task.");
    }
  };

  return (
    <div
      className={`module-shell module-shell--compact tasks-shell${
        isFormOpen ? " tasks-shell--modal-open" : ""
      }`}
    >
      <header className="module-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>Tasks</h1>
          <p className="lede">Keep on top of personal and family tasks.</p>
        </div>
      </header>
      <section className="module-content">
        <div className="tasks-container">
          <div className="tasks-layout">
            <aside className="module-panel tasks-lists-panel">
              <div className="tasks-lists-header">
                <h2>Lists</h2>
              </div>
              <div className="tasks-lists-scroll">
                {lists.map((list) => (
                  <div
                    key={list.Key}
                    className={`tasks-list-row${selectedListKeyValue === list.Key ? " is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="tasks-list-select"
                      onClick={() => onSelectList(list.Key)}
                    >
                      <span className="tasks-list-dot" />
                      <span className="tasks-list-name">{list.Name}</span>
                    </button>
                  </div>
                ))}
              </div>
            </aside>
            <section className="module-panel tasks-main-panel">
              <div className="tasks-main-header">
                <div>
                  <h2>{selectedList?.Name || "Tasks"}</h2>
                  <p className="lede">{taskCountLabel}</p>
                </div>
                <div className="tasks-header-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => loadTasks(selectedListKeyValue, { Refresh: true })}
                    disabled={status === "loading"}
                  >
                    Refresh
                  </button>
                  <button type="button" className="primary-button" onClick={openNewForm}>
                    <Icon name="plus" className="icon" />
                    New task
                  </button>
                </div>
              </div>
              <div className="tasks-filters">
                {FilterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`button-secondary-pill${view === option.key ? " is-active" : ""}`}
                    onClick={() => setView(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="tasks-list tasks-list-scroll">
                {status === "loading" ? (
                  <div className="tasks-empty">
                    <Icon name="info" className="icon" />
                    <p>Loading tasks...</p>
                  </div>
                ) : null}
                {status !== "loading" && visibleTasks.length === 0 ? (
                  <div className="tasks-empty">
                    <Icon name="info" className="icon" />
                    <p>No tasks to show right now.</p>
                  </div>
                ) : null}
                {status !== "loading"
                  ? visibleTasks.map((task) => {
                      const dueLabel = FormatDueDate(task.DueDate);
                      const metaParts = [dueLabel];
                      if (task.ListKey === "shared" && task.AssignedToName) {
                        metaParts.push(`Shared with ${task.AssignedToName}`);
                      }
                      const metaLine = metaParts.filter(Boolean).join(" \u2022 ");
                      return (
                        <div
                          key={task.Id}
                          className={`task-row${task.IsCompleted ? " is-completed" : ""}`}
                        >
                          <div className="task-complete">
                            <button
                              type="button"
                              className={`task-complete-button${
                                task.IsCompleted ? " is-completed" : ""
                              }`}
                              onClick={() => onToggleComplete(task)}
                              aria-label={
                                task.IsCompleted ? `Uncomplete ${task.Title}` : `Complete ${task.Title}`
                              }
                            >
                              <Icon name="check" className="icon" />
                            </button>
                          </div>
                          <div className="task-body">
                            <div className="task-title-row">
                              <button
                                type="button"
                                className="task-title-button"
                                onClick={() => openEditForm(task)}
                              >
                                <h3>{task.Title}</h3>
                              </button>
                            </div>
                            {task.Notes ? <p className="task-note">{task.Notes}</p> : null}
                            {metaLine ? <p className="task-meta">{metaLine}</p> : null}
                          </div>
                          <div className="task-actions">
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => openEditForm(task)}
                              aria-label={`Edit ${task.Title}`}
                            >
                              <Icon name="edit" className="icon" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            </section>
          </div>
        </div>
      </section>
      {isFormOpen ? (
        <div className="modal-backdrop tasks-modal-backdrop" role="dialog" aria-modal="true" onClick={closeForm}>
          <div className="modal tasks-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{editingTask ? "Edit task" : "New task"}</h2>
              </div>
              <div className="modal-header-actions">
                <button type="button" className="icon-button" onClick={closeForm} aria-label="Close modal">
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <form className="tasks-form" onSubmit={onSubmit}>
              <div className="form-grid tasks-form-grid">
                <label className="tasks-full">
                  Title
                  <input
                    name="Title"
                    value={form.Title}
                    onChange={onFormChange}
                    placeholder="What needs doing?"
                    required
                  />
                </label>
                <label className="tasks-full">
                  Notes
                  <textarea
                    name="Notes"
                    value={form.Notes}
                    onChange={onFormChange}
                    placeholder="Add a little context"
                    rows={4}
                  />
                </label>
                <label>
                  Due date
                  <input name="DueDate" type="date" value={form.DueDate} onChange={onFormChange} />
                </label>
                <label>
                  Assign to
                  <select
                    name="AssignedToUserId"
                    value={form.AssignedToUserId}
                    onChange={onFormChange}
                    disabled={Boolean(editingTask && form.ListKey === "shared")}
                  >
                    <option value="">
                      {form.ListKey === "shared" ? "Select a person" : "Just me"}
                    </option>
                    {assigneeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {form.ListKey === "shared" && editingTask ? (
                  <p className="form-note tasks-full">
                    To change who this task is shared with, create a new shared task.
                  </p>
                ) : null}
              </div>
              {formError ? <p className="form-error">{formError}</p> : null}
              <div className="form-actions tasks-form-actions">
                {editingTask ? (
                  <button
                    type="button"
                    className="primary-button button-danger tasks-delete-button"
                    onClick={() => onDeleteTask(editingTask)}
                  >
                    Delete
                  </button>
                ) : null}
                <button type="button" className="button-secondary" onClick={closeForm} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Tasks;
