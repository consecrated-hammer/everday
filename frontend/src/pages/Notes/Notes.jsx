import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { createPortal } from "react-dom";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";

import {
  FetchNotes,
  CreateNote,
  UpdateNote,
  DeleteNote,
  ArchiveNote,
  UnarchiveNote,
  TogglePinNote,
  FetchNoteShareUsers
} from "../../lib/notesApi.js";
import Icon from "../../components/Icon.jsx";
import { FormatDateTime } from "../../lib/formatters.js";
import { GetDisplayName, GetUserId, GetUsername } from "../../lib/authStorage.js";

const SystemLabelPrefixes = ["everday:"];

const ExtractUserTags = (labels = []) =>
  labels.filter((label) => !SystemLabelPrefixes.some((prefix) => label.startsWith(prefix)));

const MergeLabels = (labels, tags) => {
  const systemLabels = (labels || []).filter((label) =>
    SystemLabelPrefixes.some((prefix) => label.startsWith(prefix))
  );
  const cleanTags = (tags || [])
    .map((tag) => tag.trim())
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(cleanTags));
  return [...systemLabels, ...uniqueTags];
};

const NormalizeLabels = (labels = []) =>
  [...labels].map((label) => label.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));

const GetScopeFromLabels = (labels = []) => {
  if (labels.includes("everday:family")) return "family";
  if (labels.includes("everday:shared")) return "shared";
  return "personal";
};

const ApplyScopeLabel = (labels = [], scope) => {
  const withoutScope = labels.filter(
    (label) => !["everday:family", "everday:shared"].includes(label)
  );
  if (scope === "family") {
    return [...withoutScope, "everday:family"];
  }
  if (scope === "shared") {
    return [...withoutScope, "everday:shared"];
  }
  return withoutScope;
};

const NotesScopeTabs = () => (
  <nav className="notes-scope-tabs settings-tabs" aria-label="Notes sections">
    {[
      { label: "Personal", path: "/notes/personal" },
      { label: "Family", path: "/notes/family" },
      { label: "Shared", path: "/notes/shared" }
    ].map((item) => (
      <NavLink
        key={item.path}
        className={({ isActive }) => `settings-tab${isActive ? " is-active" : ""}`}
        to={item.path}
      >
        {item.label}
      </NavLink>
    ))}
  </nav>
);

const BuildFallbackText = (items = []) => {
  if (!items.length) {
    return "";
  }
  return items
    .map((item) => `${item.Checked ? "[x]" : "[ ]"} ${item.Text}`.trim())
    .join("\n");
};

const BuildDraftStorageKey = (scope, userId) => `notes:draft:${scope}:${userId || "unknown"}`;

const ParseContentToBlocks = (content, fallbackText = "") => {
  if (!content) {
    return [{ type: "paragraph", content: fallbackText }];
  }
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // fall through to plain text
  }
  return [{ type: "paragraph", content }];
};

const ExtractPlainText = (content) => {
  if (!content) {
    return "";
  }
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return String(content);
    }
    const parts = [];
    const walk = (node) => {
      if (!node) return;
      if (typeof node === "string") {
        parts.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        if (typeof node.text === "string") {
          parts.push(node.text);
        }
        if (node.content) {
          walk(node.content);
        }
        if (node.children) {
          walk(node.children);
        }
      }
    };
    walk(parsed);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  } catch (error) {
    return String(content);
  }
};

const NotesRichEditor = ({ content, fallbackItems = [], onChange = () => {}, readOnly = false }) => {
  const fallbackText = useMemo(() => BuildFallbackText(fallbackItems), [fallbackItems]);
  const initialBlocks = useMemo(() => ParseContentToBlocks(content, fallbackText), [content, fallbackText]);
  const initialSerialized = useMemo(() => JSON.stringify(initialBlocks), [initialBlocks]);
  const initialIsJson = useMemo(() => {
    try {
      const parsed = JSON.parse(content || "");
      return Array.isArray(parsed);
    } catch (error) {
      return false;
    }
  }, [content]);
  const editor = useCreateBlockNote({ initialContent: initialBlocks });
  const hasInitialized = useRef(false);

  const handleChange = useCallback(() => {
    if (readOnly) {
      return;
    }
    const serialized = JSON.stringify(editor.document);
    if (serialized === content) {
      return;
    }
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (!initialIsJson && serialized === initialSerialized) {
        return;
      }
    }
    onChange(serialized);
  }, [content, editor, initialIsJson, initialSerialized, onChange, readOnly]);

  return (
    <div className={`notes-rich-editor${readOnly ? " is-readonly" : ""}`}>
      <BlockNoteView editor={editor} editable={!readOnly} onChange={readOnly ? undefined : handleChange} />
    </div>
  );
};

export default function Notes() {
  const match = useMatch("/notes/:scope");
  const rawScope = match?.params?.scope;
  const actualScope =
    rawScope === "personal" || rawScope === "family" || rawScope === "shared" ? rawScope : "personal";

  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("idle");
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [selectedTags, setSelectedTags] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [shareUserIds, setShareUserIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState("idle");
  const [usersError, setUsersError] = useState("");
  const [editorSession, setEditorSession] = useState(0);
  const filtersButtonRef = useRef(null);
  const shareButtonRef = useRef(null);
  const searchInputRef = useRef(null);
  const draftAppliedRef = useRef(false);
  const [form, setForm] = useState({
    Title: "",
    Content: "",
    Labels: [],
    IsPinned: false,
    Items: []
  });
  const draftStorageKey = useMemo(
    () => BuildDraftStorageKey(actualScope, GetUserId()),
    [actualScope]
  );

  useEffect(() => {
    draftAppliedRef.current = false;
  }, [draftStorageKey]);

  const loadNotes = useCallback(async () => {
    try {
      setStatus("loading");
      const data = await FetchNotes(actualScope, showArchived);
      if (!Array.isArray(data)) {
        console.error("Notes payload was not an array", data);
        setNotes([]);
        setStatus("error");
        return;
      }
      setNotes(data);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to load notes:", error);
      setStatus("error");
    }
  }, [actualScope, showArchived]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (modalOpen || draftAppliedRef.current) {
      return;
    }
    const stored = sessionStorage.getItem(draftStorageKey);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") {
        return;
      }
      const nextForm = parsed.form;
      if (!nextForm || typeof nextForm !== "object") {
        return;
      }
      setEditingNote(null);
      setForm({
        Title: nextForm.Title || "",
        Content: nextForm.Content || "",
        Labels: Array.isArray(nextForm.Labels) ? nextForm.Labels : [],
        IsPinned: Boolean(nextForm.IsPinned),
        Items: Array.isArray(nextForm.Items) ? nextForm.Items : []
      });
      setShareUserIds(Array.isArray(parsed.shareUserIds) ? parsed.shareUserIds : []);
      setTagInput("");
      setEditorSession((value) => value + 1);
      setModalOpen(true);
      draftAppliedRef.current = true;
    } catch (error) {
      console.warn("Failed to restore note draft:", error);
    }
  }, [draftStorageKey, modalOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(max-width: 900px)");
    const onChange = (event) => setIsMobileView(event.matches);
    setIsMobileView(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      setTagInput("");
      setShareOpen(false);
      setUsersStatus("idle");
      setUsersError("");
    }
  }, [modalOpen]);

  const isLoadingUsersRef = useRef(false);

  const loadShareUsers = useCallback(() => {
    if (isLoadingUsersRef.current) {
      return;
    }
    let isMounted = true;
    let timeoutId = null;
    isLoadingUsersRef.current = true;
    setUsersStatus("loading");
    setUsersError("");
    timeoutId = window.setTimeout(() => {
      if (!isMounted) {
        return;
      }
      setUsers([]);
      setUsersStatus("error");
      setUsersError("User list timed out.");
    }, 5000);
    FetchNoteShareUsers()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        const currentUserId = GetUserId();
        const currentUsername = (GetUsername() || "").toLowerCase();
        const currentDisplayName = (GetDisplayName() || "").toLowerCase();
        const filtered = (data || []).filter((user) => {
          if (currentUserId && user.Id === currentUserId) {
            return false;
          }
          const username = (user.Username || "").toLowerCase();
          const fullName = `${user.FirstName || ""} ${user.LastName || ""}`.trim().toLowerCase();
          if (currentUsername && username === currentUsername) {
            return false;
          }
          if (
            currentDisplayName &&
            (fullName === currentDisplayName || username === currentDisplayName)
          ) {
            return false;
          }
          return true;
        });
        setUsers(filtered);
        setUsersStatus("loaded");
        isLoadingUsersRef.current = false;
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        setUsers([]);
        setUsersStatus("error");
        setUsersError(error?.message || "Users unavailable.");
        isLoadingUsersRef.current = false;
      })
      .finally(() => {
        isMounted = false;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        isLoadingUsersRef.current = false;
      });
  }, []);

  useEffect(() => {
    if (!modalOpen || usersStatus !== "idle") {
      return;
    }
    loadShareUsers();
  }, [modalOpen, usersStatus, loadShareUsers]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!filtersOpen && !shareOpen) {
      return undefined;
    }
    const onClick = (event) => {
      if (
        event.target.closest(".notes-filters-popover") ||
        event.target.closest(".notes-filters-button") ||
        event.target.closest(".notes-share-popover") ||
        event.target.closest(".notes-share-button")
      ) {
        return;
      }
      setFiltersOpen(false);
      setShareOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        setShareOpen(false);
      }
    };
    const onScroll = (event) => {
      const target = event?.target;
      if (target && typeof target.closest === "function") {
        if (
          target.closest(".notes-share-popover") ||
          target.closest(".notes-filters-popover")
        ) {
          return;
        }
      }
      setFiltersOpen(false);
      setShareOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [filtersOpen, shareOpen]);

  const isDirty = useMemo(() => {
    const formItemsComparable = form.Items.map((item, index) => ({
      Id: item.Id,
      Text: item.Text,
      Checked: item.Checked,
      OrderIndex: index
    }));
    const normalizedFormLabels = NormalizeLabels(form.Labels);
    if (editingNote) {
      const editingItemsComparable = (editingNote.Items || []).map((item, index) => ({
        Id: item.Id,
        Text: item.Text,
        Checked: item.Checked,
        OrderIndex: index
      }));
      const normalizedEditingLabels = NormalizeLabels(editingNote.Labels || []);
      const normalizedShareUsers = [...shareUserIds].sort((a, b) => a - b);
      const normalizedEditingShareUsers = [...(editingNote.Tags || [])].sort((a, b) => a - b);
      return (
        form.Title !== editingNote.Title ||
        form.Content !== (editingNote.Content || "") ||
        form.IsPinned !== editingNote.IsPinned ||
        JSON.stringify(formItemsComparable) !== JSON.stringify(editingItemsComparable) ||
        JSON.stringify(normalizedFormLabels) !== JSON.stringify(normalizedEditingLabels) ||
        JSON.stringify(normalizedShareUsers) !== JSON.stringify(normalizedEditingShareUsers)
      );
    }
    return (
      form.Title.trim() !== "" ||
      form.Content.trim() !== "" ||
      form.Items.length > 0 ||
      normalizedFormLabels.length > 0 ||
      shareUserIds.length > 0
    );
  }, [editingNote, form, shareUserIds]);

  useEffect(() => {
    if (!modalOpen || !isDirty || editingNote) {
      sessionStorage.removeItem(draftStorageKey);
      return;
    }
    const payload = {
      form,
      shareUserIds,
      savedAt: new Date().toISOString()
    };
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("Failed to store note draft:", error);
    }
  }, [modalOpen, isDirty, editingNote, form, shareUserIds, draftStorageKey]);

  const allTags = useMemo(() => {
    const tags = new Set();
    notes.forEach((note) => {
      (note.Labels || []).forEach((label) => {
        if (!label.startsWith("everday:")) {
          tags.add(label);
        }
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  useEffect(() => {
    if (selectedTags.length === 0) {
      return;
    }
    const filtered = selectedTags.filter((tag) => allTags.includes(tag));
    if (filtered.length !== selectedTags.length) {
      setSelectedTags(filtered);
    }
  }, [allTags, selectedTags]);

  const filteredNotes = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();
    return notes.filter((note) => {
      if (selectedTags.length > 0) {
        const tagLabels = (note.Labels || []).filter((label) => !label.startsWith("everday:"));
        if (!selectedTags.every((tag) => tagLabels.includes(tag))) {
          return false;
        }
      }
      if (!searchValue) {
        return true;
      }
      const combined = [note.Title, ExtractPlainText(note.Content), ...(note.Items || []).map((item) => item.Text)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return combined.includes(searchValue);
    });
  }, [notes, searchTerm, selectedTags]);

  const sortedNotes = useMemo(() => {
    const base = [...filteredNotes];
    if (sortBy === "title") {
      base.sort((a, b) => a.Title.localeCompare(b.Title));
    } else if (sortBy === "created") {
      base.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    } else {
      base.sort((a, b) => new Date(b.UpdatedAt) - new Date(a.UpdatedAt));
    }
    return base;
  }, [filteredNotes, sortBy]);

  const pinnedNotes = useMemo(() => sortedNotes.filter((note) => note.IsPinned), [sortedNotes]);
  const regularNotes = useMemo(() => sortedNotes.filter((note) => !note.IsPinned), [sortedNotes]);

  useEffect(() => {
    if (!sortedNotes.length) {
      setActiveNoteId(null);
      setMobilePreviewOpen(false);
      return;
    }
    const active = sortedNotes.find((note) => note.Id === activeNoteId);
    if (!active) {
      setActiveNoteId(sortedNotes[0].Id);
      if (isMobileView) {
        setMobilePreviewOpen(true);
      }
    }
  }, [sortedNotes, activeNoteId, isMobileView]);

  const activeNote = useMemo(
    () => sortedNotes.find((note) => note.Id === activeNoteId) || null,
    [sortedNotes, activeNoteId]
  );

  const onSave = useCallback(async () => {
    try {
      const itemsPayload = form.Items.map((item, index) => ({
        Id: item.Id,
        Text: item.Text,
        Checked: item.Checked,
        OrderIndex: index
      }));
      const payload = {
        ...form,
        Items: itemsPayload,
        SharedUserIds: shareUserIds
      };
      if (editingNote) {
        await UpdateNote(editingNote.Id, payload);
      } else {
        await CreateNote(payload);
      }
      setModalOpen(false);
      loadNotes();
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  }, [editingNote, form, loadNotes, shareUserIds]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const onKeyDown = (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (isDirty) {
          onSave();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, isDirty, onSave]);

  const onCreateClick = () => {
    setEditingNote(null);
    const baseLabels = [];
    if (actualScope === "family") baseLabels.push("everday:family");
    if (actualScope === "shared") baseLabels.push("everday:shared");

    setForm({
      Title: "",
      Content: "",
      Labels: baseLabels,
      IsPinned: false,
      Items: []
    });
    setShareUserIds([]);
    setTagInput("");
    setEditorSession((value) => value + 1);
    setModalOpen(true);
  };

  const onEditClick = (note) => {
    setEditingNote(note);
    setForm({
      Title: note.Title,
      Content: note.Content || "",
      Labels: note.Labels || [],
      IsPinned: note.IsPinned,
      Items: note.Items || []
    });
    setShareUserIds(note.Tags || []);
    setTagInput("");
    setEditorSession((value) => value + 1);
    setModalOpen(true);
  };

  const onDelete = async (noteId) => {
    if (!confirm("Delete this note?")) return;
    try {
      await DeleteNote(noteId);
      loadNotes();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const onArchive = async (noteId) => {
    try {
      await ArchiveNote(noteId);
      loadNotes();
    } catch (error) {
      console.error("Failed to archive note:", error);
    }
  };

  const onUnarchive = async (noteId) => {
    try {
      await UnarchiveNote(noteId);
      loadNotes();
    } catch (error) {
      console.error("Failed to unarchive note:", error);
    }
  };

  const onTogglePin = async (noteId) => {
    try {
      await TogglePinNote(noteId);
      loadNotes();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const buildNoteExcerpt = (note) => {
    const text = ExtractPlainText(note.Content);
    if (text) {
      return text.slice(0, 120);
    }
    const fallback = BuildFallbackText(note.Items || []);
    if (fallback) {
      return fallback.slice(0, 120);
    }
    return "Empty note";
  };

  const userTags = useMemo(() => ExtractUserTags(form.Labels), [form.Labels]);
  const noteScope = useMemo(() => GetScopeFromLabels(form.Labels), [form.Labels]);

  const addTag = (value) => {
    const nextTag = value.trim();
    if (!nextTag) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      Labels: MergeLabels(prev.Labels, [...ExtractUserTags(prev.Labels), nextTag])
    }));
    setTagInput("");
  };

  const removeTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      Labels: MergeLabels(prev.Labels, ExtractUserTags(prev.Labels).filter((t) => t !== tag))
    }));
  };

  const setMeOnly = () => {
    setForm((prev) => ({
      ...prev,
      Labels: ApplyScopeLabel(prev.Labels || [], "personal")
    }));
    setShareUserIds([]);
  };

  const setFamilyOnly = () => {
    setForm((prev) => ({
      ...prev,
      Labels: ApplyScopeLabel(prev.Labels || [], "family")
    }));
    setShareUserIds([]);
  };

  const toggleShareUser = (userId) => {
    setForm((prev) => ({
      ...prev,
      Labels: ApplyScopeLabel(prev.Labels || [], "personal")
    }));
    setShareUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (noteScope === "family") {
        return [userId];
      }
      return [...prev, userId];
    });
  };

  const shareOptions = useMemo(() => {
    return users.map((user) => ({
      id: user.Id,
      label: user.FirstName || user.LastName ? `${user.FirstName || ""} ${user.LastName || ""}`.trim() : user.Username || `User ${user.Id}`
    }));
  }, [users]);

  const shareOptionsSorted = useMemo(() => {
    const priority = ["Billy", "Bob", "Jane"];
    return [...shareOptions].sort((a, b) => {
      const aPriority = priority.indexOf(a.label);
      const bPriority = priority.indexOf(b.label);
      if (aPriority !== -1 || bPriority !== -1) {
        if (aPriority === -1) return 1;
        if (bPriority === -1) return -1;
        return aPriority - bPriority;
      }
      return a.label.localeCompare(b.label);
    });
  }, [shareOptions]);

  const shareSummary = useMemo(() => {
    if (noteScope === "family") {
      return "Family";
    }
    if (shareUserIds.length === 0) {
      return "Me only";
    }
    return shareUserIds
      .map((id) => shareOptions.find((entry) => entry.id === id)?.label || `User ${id}`)
      .join(", ");
  }, [noteScope, shareUserIds, shareOptions]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSortBy("updated");
    setSelectedTags([]);
    setShowArchived(false);
  };

  const activeFilterCount =
    (sortBy !== "updated" ? 1 : 0) + selectedTags.length + (showArchived ? 1 : 0);

  const sortLabelMap = {
    updated: "Recently updated",
    created: "Created",
    title: "Title"
  };

  const filtersPopover =
    filtersOpen && typeof document !== "undefined" && filtersButtonRef.current
      ? (() => {
          const rect = filtersButtonRef.current.getBoundingClientRect();
          const style = {
            top: rect.bottom + window.scrollY + 8,
            left: Math.max(16, rect.left + window.scrollX - 220),
            minWidth: 260
          };
          return createPortal(
            <div className="notes-filters-popover" role="dialog" style={style}>
              <div className="notes-filters-popover-header">
                <span>Sort and Filter</span>
                {(sortBy !== "updated" || selectedTags.length > 0 || showArchived) && (
                  <button type="button" className="text-button" onClick={clearFilters}>
                    Clear
                  </button>
                )}
              </div>
              <div className="notes-filters-section">
                <p className="notes-filters-label">Sort</p>
                <div className="notes-sort-segment">
                  {[
                    { id: "updated", label: "Recent" },
                    { id: "created", label: "Created" },
                    { id: "title", label: "Title" }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`notes-sort-option${sortBy === option.id ? " is-active" : ""}`}
                      onClick={() => setSortBy(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="notes-filters-section">
                <p className="notes-filters-label">Tags</p>
                <div className="notes-tags-wrap">
                  {allTags.length === 0 ? (
                    <span className="notes-muted">No tags yet.</span>
                  ) : (
                    allTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`notes-tag-chip${selectedTags.includes(tag) ? " is-active" : ""}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="notes-filters-section notes-filters-toggle">
                <div className="checkbox notes-toolbar-toggle">
                  <input
                    id="notes-show-archived"
                    type="checkbox"
                    className="notes-checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  <label htmlFor="notes-show-archived">Show archived</label>
                </div>
              </div>
            </div>,
            document.body
          );
        })()
      : null;

const activeFilterChips = [
    ...(sortBy !== "updated" ? [{ id: "sort", label: `Sort: ${sortLabelMap[sortBy]}` }] : []),
    ...selectedTags.map((tag) => ({ id: `tag-${tag}`, label: `Tag: ${tag}`, tag })),
    ...(showArchived ? [{ id: "archived", label: "Archived: Included" }] : [])
  ];

  const renderTagPills = (labels = [], max = 3) => {
    const tags = ExtractUserTags(labels);
    const scope = GetScopeFromLabels(labels);
    const scopePills =
      scope === "family" ? ["Family"] : scope === "shared" ? ["Shared"] : [];
    const combined = [...scopePills, ...tags];
    if (combined.length === 0) {
      return null;
    }
    const visible = combined.slice(0, max);
    const overflow = combined.length - visible.length;
    return (
      <div className="notes-tag-pills">
        {visible.map((tag) => (
          <span key={tag} className="notes-tag-pill">
            {tag}
          </span>
        ))}
        {overflow > 0 && <span className="notes-tag-pill notes-tag-pill--more">+{overflow}</span>}
      </div>
    );
  };

  const onRowKeyDown = (event, noteId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveNoteId(noteId);
      if (isMobileView) {
        setMobilePreviewOpen(true);
      }
    }
  };

  return (
    <>
      <header className="notes-header-actions">
        <NotesScopeTabs />
        <button type="button" className="primary-button" onClick={onCreateClick}>
          New note
        </button>
      </header>
      {filtersPopover}
      {shareOpen && typeof document !== "undefined" && shareButtonRef.current
        ? (() => {
            const rect = shareButtonRef.current.getBoundingClientRect();
            const minWidth = 260;
            const offset = 8;
            const left = Math.min(
              window.scrollX + window.innerWidth - minWidth - 16,
              Math.max(16, rect.left + window.scrollX - 120)
            );
            const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
            const spaceAbove = Math.max(0, rect.top - 16);
            const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
            const maxHeight = Math.min(360, preferBelow ? spaceBelow : spaceAbove);
            const style = preferBelow
              ? {
                  top: rect.bottom + window.scrollY + offset,
                  left,
                  minWidth,
                  maxHeight
                }
              : {
                  top: rect.top + window.scrollY - offset,
                  left,
                  minWidth,
                  maxHeight,
                  transform: "translateY(-100%)"
                };
            return createPortal(
              <div className="notes-share-popover" role="dialog" style={style}>
                <div className="notes-filters-popover-header">
                  <span>Share with</span>
                </div>
                <div className="notes-share-section">
                  <button
                    type="button"
                    className={`notes-share-option${
                      noteScope === "personal" && shareUserIds.length === 0 ? " is-active" : ""
                    }`}
                    onClick={setMeOnly}
                  >
                    <span>Me only</span>
                    {noteScope === "personal" && shareUserIds.length === 0 ? (
                      <Icon name="check" className="icon" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className={`notes-share-option${noteScope === "family" ? " is-active" : ""}`}
                    onClick={setFamilyOnly}
                  >
                    <span>Family</span>
                    {noteScope === "family" ? <Icon name="check" className="icon" /> : null}
                  </button>
                </div>
                <div className="notes-share-divider" />
                <div className="notes-share-section">
                  {usersStatus === "loading" && <span className="notes-muted">Loading users...</span>}
                  {usersStatus === "error" && (
                    <div className="notes-share-error">
                      <span className="notes-muted">{usersError || "Users unavailable."}</span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={loadShareUsers}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {usersStatus === "loaded" && shareOptionsSorted.length === 0 && (
                    <span className="notes-muted">No other users.</span>
                  )}
                  {shareOptionsSorted.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`notes-share-option${
                        shareUserIds.includes(user.id) ? " is-active" : ""
                      }`}
                      onClick={() => toggleShareUser(user.id)}
                    >
                      <span>{user.label}</span>
                      {shareUserIds.includes(user.id) ? <Icon name="check" className="icon" /> : null}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            );
          })()
        : null}

      <div className="notes-shell">
        {!isMobileView || !mobilePreviewOpen ? (
        <aside className="module-panel notes-list-panel">
          {status === "loading" && (
            <div className="notes-loading-indicator" aria-live="polite">
              Loading notes...
            </div>
          )}
          <div className="notes-list-header">
            <div className="notes-search-row">
              <div className="notes-search">
                <Icon name="search" className="icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="notes-search-input"
                  placeholder="Search notes..."
                  aria-label="Search notes"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                ref={filtersButtonRef}
                type="button"
                className="button-secondary notes-filters-button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
                title="Filters"
              >
                <Icon name="sliders" className="icon" />
                <span className="notes-filters-label-text">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="notes-filters-badge">{activeFilterCount}</span>
                )}
              </button>
            </div>
            {activeFilterChips.length > 0 && (
              <div className="notes-filter-chips">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="notes-filter-chip"
                    onClick={() => {
                      if (chip.id === "sort") {
                        setSortBy("updated");
                      } else if (chip.id === "archived") {
                        setShowArchived(false);
                      } else if (chip.tag) {
                        toggleTag(chip.tag);
                      }
                    }}
                  >
                    <span>{chip.label}</span>
                    <Icon name="close" className="icon" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="notes-list-body">
            {status === "error" && <p className="notes-muted">Could not load notes.</p>}
            {status === "idle" && sortedNotes.length === 0 && (
              <p className="notes-muted">No notes match this view.</p>
            )}
            {pinnedNotes.length > 0 && (
              <div className="notes-section">
                <p className="notes-section-title">Pinned</p>
                <div className="notes-list">
                  {pinnedNotes.map((note) => (
                    <div
                      key={note.Id}
                      role="button"
                      tabIndex={0}
                      className={`notes-list-row${activeNoteId === note.Id ? " is-active" : ""}`}
                      onClick={() => {
                        setActiveNoteId(note.Id);
                        if (isMobileView) {
                          setMobilePreviewOpen(true);
                        }
                      }}
                      onKeyDown={(event) => onRowKeyDown(event, note.Id)}
                    >
                      <div>
                        <div className="notes-row-title">{note.Title}</div>
                        <div className="notes-row-meta">{buildNoteExcerpt(note)}</div>
                        {renderTagPills(note.Labels)}
                      </div>
                      <div className="notes-row-right">
                        <span className="notes-row-date">{FormatDateTime(note.UpdatedAt)}</span>
                        <div className="notes-row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onTogglePin(note.Id);
                            }}
                            title={note.IsPinned ? "Unpin" : "Pin"}
                          >
                            <Icon
                              name={note.IsPinned ? "push_pin_filled" : "push_pin"}
                              className="icon"
                            />
                          </button>
                          {note.ArchivedAt ? (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onUnarchive(note.Id);
                              }}
                              title="Unarchive"
                            >
                              <Icon name="unarchive" className="icon" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onArchive(note.Id);
                              }}
                              title="Archive"
                            >
                              <Icon name="archive" className="icon" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {regularNotes.length > 0 && (
              <div className="notes-section">
                <p className="notes-section-title">Notes</p>
                <div className="notes-list">
                  {regularNotes.map((note) => (
                    <div
                      key={note.Id}
                      role="button"
                      tabIndex={0}
                      className={`notes-list-row${activeNoteId === note.Id ? " is-active" : ""}`}
                      onClick={() => {
                        setActiveNoteId(note.Id);
                        if (isMobileView) {
                          setMobilePreviewOpen(true);
                        }
                      }}
                      onKeyDown={(event) => onRowKeyDown(event, note.Id)}
                    >
                      <div>
                        <div className="notes-row-title">{note.Title}</div>
                        <div className="notes-row-meta">{buildNoteExcerpt(note)}</div>
                        {renderTagPills(note.Labels)}
                      </div>
                      <div className="notes-row-right">
                        <span className="notes-row-date">{FormatDateTime(note.UpdatedAt)}</span>
                        <div className="notes-row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onTogglePin(note.Id);
                            }}
                            title={note.IsPinned ? "Unpin" : "Pin"}
                          >
                            <Icon
                              name={note.IsPinned ? "push_pin_filled" : "push_pin"}
                              className="icon"
                            />
                          </button>
                          {note.ArchivedAt ? (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onUnarchive(note.Id);
                              }}
                              title="Unarchive"
                            >
                              <Icon name="unarchive" className="icon" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onArchive(note.Id);
                              }}
                              title="Archive"
                            >
                              <Icon name="archive" className="icon" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
        ) : null}

        {!isMobileView || mobilePreviewOpen ? (
        <section className="module-panel notes-preview-panel">
          {sortedNotes.length === 0 && status === "idle" ? (
            <div className="notes-empty-card">
              <h2>No notes yet</h2>
              <p>Create a note.</p>
              <div className="notes-empty-actions">
                <button type="button" className="primary-button" onClick={onCreateClick}>
                  New note
                </button>
              </div>
            </div>
          ) : activeNote ? (
            <div className="notes-preview">
              <header className="notes-preview-header">
                <div className="notes-preview-titleblock">
                  {isMobileView ? (
                    <button
                      type="button"
                      className="button-secondary notes-mobile-back"
                      onClick={() => setMobilePreviewOpen(false)}
                    >
                      Back
                    </button>
                  ) : null}
                  <p className="notes-preview-title">{activeNote.Title}</p>
                  <p className="notes-preview-meta">Updated {FormatDateTime(activeNote.UpdatedAt)}</p>
                </div>
                <div className="notes-preview-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => onEditClick(activeNote)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onTogglePin(activeNote.Id)}
                    title={activeNote.IsPinned ? "Unpin" : "Pin"}
                  >
                    <Icon
                      name={activeNote.IsPinned ? "push_pin_filled" : "push_pin"}
                      className="icon"
                    />
                  </button>
                  {activeNote.ArchivedAt ? (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onUnarchive(activeNote.Id)}
                      title="Unarchive"
                    >
                      <Icon name="unarchive" className="icon" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onArchive(activeNote.Id)}
                      title="Archive"
                    >
                      <Icon name="archive" className="icon" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onDelete(activeNote.Id)}
                    title="Delete"
                  >
                    <Icon name="delete" className="icon" />
                  </button>
                </div>
              </header>
              {activeNote.Content || (activeNote.Items && activeNote.Items.length > 0) ? (
                <NotesRichEditor
                  key={`preview-${activeNote.Id}-${activeNote.UpdatedAt || ""}`}
                  content={activeNote.Content}
                  fallbackItems={activeNote.Items || []}
                  readOnly
                />
              ) : (
                <div className="notes-preview-empty">No content yet.</div>
              )}
              {renderTagPills(activeNote.Labels, 5)}
            </div>
          ) : (
            <div className="notes-empty-card">
              <h2>Select a note</h2>
              <p>Choose a note from the list to preview it here.</p>
            </div>
          )}
        </section>
        ) : null}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNote ? "Edit Note" : "New Note"}</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModalOpen(false)}
                title="Close"
              >
                <Icon name="close" className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="note-title">Title</label>
                <input
                  id="note-title"
                  type="text"
                  className="form-input"
                  value={form.Title}
                  onChange={(e) => setForm((prev) => ({ ...prev, Title: e.target.value }))}
                  placeholder="Note title"
                />
              </div>
            <div className="form-group">
              <label>Content</label>
              <NotesRichEditor
                key={`editor-${editorSession}`}
                content={form.Content}
                fallbackItems={form.Items}
                onChange={(value) => setForm((prev) => ({ ...prev, Content: value }))}
              />
            </div>
              <div className="form-group">
                <label htmlFor="note-tags">Tags</label>
                <div className="notes-tags-editor">
                  <div className="notes-tags-input">
                    <input
                      id="note-tags"
                      type="text"
                      className="form-input notes-tags-input-field"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      placeholder="Add a tag..."
                    />
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => addTag(tagInput)}
                      disabled={!tagInput.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {userTags.length > 0 && (
                    <div className="notes-tags-chips">
                      {userTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="notes-tag-chip is-active"
                          onClick={() => removeTag(tag)}
                          title="Remove tag"
                        >
                          <span>{tag}</span>
                          <Icon name="close" className="icon" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Share with</label>
                <div className="notes-share-field">
                  <button
                    ref={shareButtonRef}
                    type="button"
                    className="form-input notes-share-button"
                    onClick={() => setShareOpen((prev) => !prev)}
                    aria-expanded={shareOpen}
                    aria-haspopup="dialog"
                    aria-label={`Share with ${shareSummary}`}
                  >
                    <Icon name="team" className="icon" />
                    <span className="notes-share-value">{shareSummary}</span>
                    <Icon name="chevronDown" className="icon" />
                  </button>
                </div>
              </div>
            </div>
            <div className="form-actions notes-form-actions">
              <button type="button" className="button-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={onSave}
                disabled={!isDirty}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
