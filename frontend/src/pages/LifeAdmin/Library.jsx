import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

import {
  AddDocumentTags,
  ApplyAiSuggestion,
  BulkUpdateDocuments,
  CreateDocumentFolder,
  CreateDocumentLink,
  CreateReminder,
  DeleteDocumentFolder,
  DeleteDocumentLink,
  DeleteReminder,
  FetchDocumentFile,
  FetchDocumentDetail,
  FetchDocumentFolders,
  FetchDocumentTags,
  FetchDocuments,
  FetchReminders,
  RemoveDocumentTag,
  RunGmailIntake,
  UpdateDocument,
  UpdateReminder,
  UploadDocument
} from "../../lib/lifeAdminDocumentsApi.js";
import { FetchLifeCategories, FetchLifeRecordLookup } from "../../lib/lifeAdminApi.js";

const BuildTagList = (value) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const IsImageType = (contentType) => contentType?.startsWith("image/");
const IsPdfType = (contentType) => contentType?.includes("pdf");

const Library = () => {
  const [searchParams] = useSearchParams();
  const recordFilterId = useMemo(() => {
    const raw = searchParams.get("recordId");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [documentDetail, setDocumentDetail] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [smartFilter, setSmartFilter] = useState("recent");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilterId, setTagFilterId] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [remindersOnly, setRemindersOnly] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkLinkCategoryId, setBulkLinkCategoryId] = useState("");
  const [bulkLinkRecordId, setBulkLinkRecordId] = useState("");
  const [bulkReminderTitle, setBulkReminderTitle] = useState("");
  const [bulkReminderDueAt, setBulkReminderDueAt] = useState("");
  const [detailTitle, setDetailTitle] = useState("");
  const [detailFolderId, setDetailFolderId] = useState("");
  const [detailTagInput, setDetailTagInput] = useState("");
  const [detailPreviewUrl, setDetailPreviewUrl] = useState("");
  const previewUrlRef = useRef("");
  const [linkCategoryId, setLinkCategoryId] = useState("");
  const [linkRecordId, setLinkRecordId] = useState("");
  const [recordOptions, setRecordOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDueAt, setReminderDueAt] = useState("");
  const [reminderRepeat, setReminderRepeat] = useState("");
  const [recordReminders, setRecordReminders] = useState([]);
  const [recordReminderTitle, setRecordReminderTitle] = useState("");
  const [recordReminderDueAt, setRecordReminderDueAt] = useState("");
  const [gmailStatus, setGmailStatus] = useState("");
  const [gmailRunning, setGmailRunning] = useState(false);
  const previewDocId = documentDetail?.Id || null;
  const previewContentType = documentDetail?.ContentType || null;

  const detailDirty = useMemo(() => {
    if (!documentDetail) return false;
    const currentTitle = documentDetail.Title || "";
    const currentFolder = documentDetail.FolderId ? String(documentDetail.FolderId) : "";
    return detailTitle !== currentTitle || detailFolderId !== currentFolder;
  }, [documentDetail, detailTitle, detailFolderId]);

  const loadLibrary = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const [foldersResponse, tagsResponse, docsResponse] = await Promise.all([
        FetchDocumentFolders(),
        FetchDocumentTags(),
        FetchDocuments({
          search: searchTerm,
          folderId: smartFilter === "unfiled" ? 0 : activeFolderId,
          tagIds: tagFilterId ? [tagFilterId] : [],
          linkedOnly: smartFilter === "linked" || linkedOnly,
          remindersOnly: smartFilter === "reminders" || remindersOnly,
          recordId: recordFilterId
        })
      ]);
      setFolders(foldersResponse);
      setTags(tagsResponse);
      setDocuments(docsResponse);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load documents");
    }
  }, [
    searchTerm,
    activeFolderId,
    smartFilter,
    tagFilterId,
    linkedOnly,
    remindersOnly,
    recordFilterId
  ]);

  const loadDetail = useCallback(async (documentId) => {
    if (!documentId) {
      setDocumentDetail(null);
      setDetailPreviewUrl("");
      return;
    }
    try {
      const detail = await FetchDocumentDetail(documentId);
      setDocumentDetail(detail);
      setDetailTitle(detail.Title || "");
      setDetailFolderId(detail.FolderId ? String(detail.FolderId) : "");
      setDetailTagInput("");
    } catch (err) {
      setError(err?.message || "Failed to load document detail");
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await FetchLifeCategories(false);
      setCategories(data);
    } catch (err) {
      setError(err?.message || "Failed to load record categories");
    }
  }, []);

  const loadRecordOptions = useCallback(async (categoryId) => {
    if (!categoryId) {
      setRecordOptions([]);
      return;
    }
    try {
      const data = await FetchLifeRecordLookup(categoryId);
      setRecordOptions(data || []);
    } catch (err) {
      setError(err?.message || "Failed to load record options");
    }
  }, []);

  const loadRecordReminders = useCallback(async () => {
    if (!recordFilterId) {
      setRecordReminders([]);
      return;
    }
    try {
      const reminders = await FetchReminders({
        sourceType: "life_admin_record",
        sourceId: recordFilterId
      });
      setRecordReminders(reminders || []);
    } catch (err) {
      setError(err?.message || "Failed to load record reminders");
    }
  }, [recordFilterId]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    loadDetail(selectedDocId);
  }, [selectedDocId, loadDetail]);

  useEffect(() => {
    if (!previewDocId) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setDetailPreviewUrl("");
      return;
    }
    const canPreview =
      IsImageType(previewContentType) || IsPdfType(previewContentType);
    if (!canPreview) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setDetailPreviewUrl("");
      return;
    }
    let isActive = true;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setDetailPreviewUrl("");
    FetchDocumentFile(previewDocId)
      .then((blob) => {
        if (!isActive) return;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setDetailPreviewUrl(url);
      })
      .catch(() => {
        if (!isActive) return;
        setDetailPreviewUrl("");
      });
    return () => {
      isActive = false;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    };
  }, [previewDocId, previewContentType]);

  useEffect(() => {
    if (!selectedDocId) return;
    if (!documents.some((doc) => doc.Id === selectedDocId)) {
      setSelectedDocId(null);
    }
  }, [documents, selectedDocId]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => documents.some((doc) => doc.Id === id)));
  }, [documents]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadRecordOptions(linkCategoryId);
  }, [linkCategoryId, loadRecordOptions]);

  useEffect(() => {
    setLinkRecordId("");
  }, [linkCategoryId]);

  useEffect(() => {
    if (!recordFilterId) return;
    loadRecordReminders();
  }, [recordFilterId, loadRecordReminders]);

  const visibleDocuments = useMemo(() => {
    if (typeFilter === "all") return documents;
    if (typeFilter === "images") {
      return documents.filter((doc) => IsImageType(doc.ContentType));
    }
    if (typeFilter === "pdfs") {
      return documents.filter((doc) => IsPdfType(doc.ContentType));
    }
    return documents;
  }, [documents, typeFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const onToggleSelect = (docId) => {
    setSelectedIds((prev) => {
      if (prev.includes(docId)) {
        return prev.filter((id) => id !== docId);
      }
      return [...prev, docId];
    });
  };

  const onSelectAll = () => {
    if (selectedIds.length === visibleDocuments.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(visibleDocuments.map((doc) => doc.Id));
  };

  const onUploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError("");
    try {
      for (const file of files) {
        await UploadDocument({
          file,
          title: file.name,
          folderId: smartFilter === "unfiled" ? null : activeFolderId
        });
      }
      await loadLibrary();
    } catch (err) {
      setUploadError(err?.message || "Failed to upload document");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const onCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await CreateDocumentFolder({ Name: newFolderName.trim(), SortOrder: 0 });
      setNewFolderName("");
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to create folder");
    }
  };

  const onDeleteFolder = async (folderId) => {
    if (!window.confirm("Delete this folder? Documents will be moved to Unfiled.")) return;
    try {
      await DeleteDocumentFolder(folderId);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to delete folder");
    }
  };

  const onApplyBulk = async () => {
    if (selectedIds.length === 0) return;
    const payload = {
      DocumentIds: selectedIds,
      FolderId: bulkFolderId ? Number(bulkFolderId) : undefined,
      TagNames: bulkTags ? BuildTagList(bulkTags) : undefined
    };
    try {
      await BulkUpdateDocuments(payload);
      if (bulkLinkRecordId && bulkLinkCategoryId) {
        await Promise.all(
          selectedIds.map((docId) =>
            CreateDocumentLink(docId, {
              LinkedEntityType: "life_admin_record",
              LinkedEntityId: Number(bulkLinkRecordId)
            })
          )
        );
      }
      if (bulkReminderTitle && bulkReminderDueAt) {
        const dueAt = new Date(bulkReminderDueAt).toISOString();
        await Promise.all(
          selectedIds.map((docId) =>
            CreateReminder({
              SourceType: "life_admin_document",
              SourceId: docId,
              Title: bulkReminderTitle,
              DueAt: dueAt
            })
          )
        );
      }
      setBulkTags("");
      setBulkFolderId("");
      setBulkLinkCategoryId("");
      setBulkLinkRecordId("");
      setBulkReminderTitle("");
      setBulkReminderDueAt("");
      setSelectedIds([]);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to apply bulk updates");
    }
  };

  const onUpdateDetail = async () => {
    if (!documentDetail) return;
    try {
      await UpdateDocument(documentDetail.Id, {
        Title: detailTitle || null,
        FolderId: detailFolderId ? Number(detailFolderId) : 0
      });
      await loadLibrary();
      await loadDetail(documentDetail.Id);
    } catch (err) {
      setError(err?.message || "Failed to update document");
    }
  };

  const onDownloadDocument = async () => {
    if (!documentDetail) return;
    try {
      const blob = await FetchDocumentFile(documentDetail.Id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        documentDetail.OriginalFileName ||
        documentDetail.Title ||
        `document-${documentDetail.Id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || "Failed to download document");
    }
  };

  const onAddDetailTags = async () => {
    if (!documentDetail) return;
    const tagList = BuildTagList(detailTagInput);
    if (!tagList.length) return;
    try {
      await AddDocumentTags(documentDetail.Id, tagList);
      setDetailTagInput("");
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to add tags");
    }
  };

  const onRemoveDetailTag = async (tagId) => {
    if (!documentDetail) return;
    try {
      await RemoveDocumentTag(documentDetail.Id, tagId);
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to remove tag");
    }
  };

  const onAddLink = async () => {
    if (!documentDetail || !linkRecordId) return;
    try {
      await CreateDocumentLink(documentDetail.Id, {
        LinkedEntityType: "life_admin_record",
        LinkedEntityId: Number(linkRecordId)
      });
      setLinkRecordId("");
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to create link");
    }
  };

  const onRemoveLink = async (linkId) => {
    if (!documentDetail) return;
    try {
      await DeleteDocumentLink(documentDetail.Id, linkId);
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to remove link");
    }
  };

  const onCreateReminder = async () => {
    if (!documentDetail || !reminderTitle || !reminderDueAt) return;
    try {
      await CreateReminder({
        SourceType: "life_admin_document",
        SourceId: documentDetail.Id,
        Title: reminderTitle,
        DueAt: new Date(reminderDueAt).toISOString(),
        RepeatRule: reminderRepeat || null
      });
      setReminderTitle("");
      setReminderDueAt("");
      setReminderRepeat("");
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to create reminder");
    }
  };

  const onToggleReminder = async (reminder) => {
    try {
      const nextStatus = reminder.Status === "Done" ? "Open" : "Done";
      await UpdateReminder(reminder.Id, { Status: nextStatus });
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to update reminder");
    }
  };

  const onDeleteReminder = async (reminderId) => {
    try {
      await DeleteReminder(reminderId);
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to remove reminder");
    }
  };

  const onApplyAi = async () => {
    if (!documentDetail) return;
    try {
      await ApplyAiSuggestion(documentDetail.Id);
      await loadDetail(documentDetail.Id);
      await loadLibrary();
    } catch (err) {
      setError(err?.message || "Failed to apply AI suggestions");
    }
  };

  const onCreateRecordReminder = async () => {
    if (!recordFilterId || !recordReminderTitle || !recordReminderDueAt) return;
    try {
      await CreateReminder({
        SourceType: "life_admin_record",
        SourceId: recordFilterId,
        Title: recordReminderTitle,
        DueAt: new Date(recordReminderDueAt).toISOString()
      });
      setRecordReminderTitle("");
      setRecordReminderDueAt("");
      await loadRecordReminders();
    } catch (err) {
      setError(err?.message || "Failed to create record reminder");
    }
  };

  const onRunGmailIntake = async () => {
    setGmailStatus("Running Gmail intake");
    setGmailRunning(true);
    try {
      const result = await RunGmailIntake(10);
      setGmailStatus(
        `Gmail intake complete. Messages: ${result.MessagesProcessed}. Documents: ${result.DocumentsCreated}.`
      );
      await loadLibrary();
    } catch (err) {
      setGmailStatus(err?.message || "Gmail intake failed");
    } finally {
      setGmailRunning(false);
    }
  };

  const closeModal = () => {
    setSelectedDocId(null);
  };

  const detailModal = documentDetail
    ? createPortal(
        <div
          className="modal-backdrop life-admin-library-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Document details"
          onClick={closeModal}
        >
          <div
            className="modal life-admin-library-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{documentDetail.Title || documentDetail.OriginalFileName || "Document"}</h2>
                <p className="lede">Preview, file metadata, links, and reminders.</p>
              </div>
              <div className="modal-header-actions">
                <button type="button" className="button-secondary" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body life-admin-library-modal-body">
              <div className="life-admin-library-modal-preview">
                <div className="life-admin-detail-preview">
                  {detailPreviewUrl ? (
                    IsImageType(documentDetail.ContentType) ? (
                      <img src={detailPreviewUrl} alt={documentDetail.Title || "Document"} />
                    ) : (
                      <iframe title="Document preview" src={detailPreviewUrl} />
                    )
                  ) : (
                    <div className="life-admin-doc-placeholder">
                      <span>Preview unavailable</span>
                    </div>
                  )}
                </div>
                <div className="life-admin-library-modal-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={onDownloadDocument}
                  >
                    Download file
                  </button>
                  {documentDetail.OcrStatus ? (
                    <p className="form-note">OCR status: {documentDetail.OcrStatus}</p>
                  ) : null}
                </div>
              </div>
              <div className="life-admin-library-modal-content">
                <div className="life-admin-detail-section">
                  <h4>Details</h4>
                  <label className="form-group">
                    <span>Title</span>
                    <input
                      className="form-input"
                      value={detailTitle}
                      onChange={(event) => setDetailTitle(event.target.value)}
                    />
                  </label>
                  <label className="form-group">
                    <span>Folder</span>
                    <select
                      className="form-input"
                      value={detailFolderId}
                      onChange={(event) => setDetailFolderId(event.target.value)}
                    >
                      <option value="">Unfiled</option>
                      {folders.map((folder) => (
                        <option key={folder.Id} value={folder.Id}>
                          {folder.Name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="form-note">
                    File: {documentDetail.OriginalFileName || "Untitled"}
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={onUpdateDetail}
                    disabled={!detailDirty}
                  >
                    Save changes
                  </button>
                </div>

                <div className="life-admin-detail-section">
                  <h4>Tags</h4>
                  <div className="life-admin-chip-row">
                    {documentDetail.Tags.map((tag) => (
                      <button
                        key={tag.Id}
                        type="button"
                        className="life-admin-chip"
                        onClick={() => onRemoveDetailTag(tag.Id)}
                      >
                        {tag.Name}
                      </button>
                    ))}
                  </div>
                  <div className="life-admin-inline">
                    <input
                      className="form-input"
                      placeholder="Tag1, Tag2"
                      value={detailTagInput}
                      onChange={(event) => setDetailTagInput(event.target.value)}
                    />
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={onAddDetailTags}
                      disabled={!detailTagInput}
                    >
                      Add tags
                    </button>
                  </div>
                </div>

                {documentDetail.OcrText ? (
                  <div className="life-admin-detail-section">
                    <h4>OCR text</h4>
                    <textarea className="form-input" rows={6} readOnly value={documentDetail.OcrText} />
                  </div>
                ) : null}

                <div className="life-admin-detail-section">
                  <h4>Links</h4>
                  {documentDetail.Links.map((link) => (
                    <div key={link.Id} className="life-admin-link-row">
                      <span>{link.LinkedEntityType}</span>
                      <span>#{link.LinkedEntityId}</span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onRemoveLink(link.Id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="life-admin-inline">
                    <select
                      className="form-input"
                      value={linkCategoryId}
                      onChange={(event) => setLinkCategoryId(event.target.value)}
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.Id} value={category.Id}>
                          {category.Name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="form-input"
                      value={linkRecordId}
                      onChange={(event) => setLinkRecordId(event.target.value)}
                    >
                      <option value="">Select record</option>
                      {recordOptions.map((record) => (
                        <option key={record.Id} value={record.Id}>
                          {record.Title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={onAddLink}
                      disabled={!linkRecordId}
                    >
                      Link
                    </button>
                  </div>
                </div>

                <div className="life-admin-detail-section">
                  <h4>Reminders</h4>
                  {documentDetail.Reminders.map((reminder) => (
                    <div key={reminder.Id} className="life-admin-reminder-row">
                      <button
                        type="button"
                        className={`button-secondary${reminder.Status === "Done" ? " is-active" : ""}`}
                        onClick={() => onToggleReminder(reminder)}
                      >
                        {reminder.Status === "Done" ? "Done" : "Open"}
                      </button>
                      <div>
                        <p>{reminder.Title}</p>
                        <span>{new Date(reminder.DueAt).toLocaleString("en-AU")}</span>
                      </div>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onDeleteReminder(reminder.Id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="life-admin-inline">
                    <input
                      className="form-input"
                      placeholder="Reminder title"
                      value={reminderTitle}
                      onChange={(event) => setReminderTitle(event.target.value)}
                    />
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={reminderDueAt}
                      onChange={(event) => setReminderDueAt(event.target.value)}
                    />
                  </div>
                  <div className="life-admin-inline">
                    <input
                      className="form-input"
                      placeholder="Repeat rule (optional)"
                      value={reminderRepeat}
                      onChange={(event) => setReminderRepeat(event.target.value)}
                    />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={onCreateReminder}
                      disabled={!reminderTitle || !reminderDueAt}
                    >
                      Add reminder
                    </button>
                  </div>
                </div>

                {documentDetail.AiSuggestion?.Status === "Complete" ? (
                  <div className="life-admin-detail-section">
                    <h4>AI suggestions</h4>
                    <p className="form-note">Suggestions are optional and require review.</p>
                    <div className="life-admin-ai-grid">
                      <div>
                        <span>Folder</span>
                        <p>{documentDetail.AiSuggestion.SuggestedFolderName || "None"}</p>
                      </div>
                      <div>
                        <span>Tags</span>
                        <p>
                          {documentDetail.AiSuggestion.SuggestedTags.length
                            ? documentDetail.AiSuggestion.SuggestedTags.join(", ")
                            : "None"}
                        </p>
                      </div>
                      <div>
                        <span>Reminder</span>
                        <p>{documentDetail.AiSuggestion.SuggestedReminder?.Title || "None"}</p>
                      </div>
                      <div>
                        <span>Links</span>
                        <p>
                          {documentDetail.AiSuggestion.SuggestedLinks.length
                            ? documentDetail.AiSuggestion.SuggestedLinks.map((link) =>
                                link.Hint || link.Title || link.LinkedEntityId || link.EntityId || "Link"
                              ).join(", ")
                            : "None"}
                        </p>
                      </div>
                    </div>
                    <button type="button" className="button-secondary" onClick={onApplyAi}>
                      Apply suggestions
                    </button>
                  </div>
                ) : null}

                <div className="life-admin-detail-section">
                  <h4>Activity</h4>
                  {documentDetail.Audits.length === 0 ? (
                    <p className="form-note">No activity yet.</p>
                  ) : (
                    <div className="life-admin-activity-list">
                      {documentDetail.Audits.map((audit) => (
                        <div key={audit.Id} className="life-admin-activity-row">
                          <span>{audit.Action}</span>
                          <span>{new Date(audit.CreatedAt).toLocaleString("en-AU")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="module-panel module-panel--stretch life-admin-library">
      <div className="module-panel-header">
        <div>
          <h3>Library</h3>
          <p className="lede">Store and link life admin documents in one place.</p>
        </div>
        <div className="module-panel-actions">
          <label className="button-secondary life-admin-upload">
            <span>{uploading ? "Uploading" : "Upload"}</span>
            <input type="file" multiple onChange={onUploadFiles} disabled={uploading} />
          </label>
          <button
            type="button"
            className="button-secondary"
            onClick={onRunGmailIntake}
            disabled={gmailRunning}
          >
            Check Gmail
          </button>
        </div>
      </div>

      {gmailStatus ? <p className="form-note">{gmailStatus}</p> : null}
      <p className="form-note">
        Send to Everday via email attachments or mobile share. Files land in Unfiled.
      </p>
      {uploadError ? <p className="form-error">{uploadError}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="life-admin-library-grid">
        <aside className="life-admin-library-sidebar">
          <div className="life-admin-library-section">
            <h4>Smart filters</h4>
            <div className="life-admin-library-filters">
              {[
                { key: "recent", label: "Recent" },
                { key: "unfiled", label: "Unfiled" },
                { key: "linked", label: "Linked" },
                { key: "reminders", label: "With reminders" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`life-admin-filter${smartFilter === item.key ? " is-active" : ""}`}
                  onClick={() => {
                    setSmartFilter(item.key);
                    setActiveFolderId(null);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="life-admin-library-section">
            <h4>Folders</h4>
            <div className="life-admin-library-folders">
              <button
                type="button"
                className={`life-admin-folder${activeFolderId === null && smartFilter === "recent" ? " is-active" : ""}`}
                onClick={() => {
                  setActiveFolderId(null);
                  setSmartFilter("recent");
                }}
              >
                All documents
              </button>
              {folders.map((folder) => (
                <div key={folder.Id} className="life-admin-folder-row">
                  <button
                    type="button"
                    className={`life-admin-folder${activeFolderId === folder.Id ? " is-active" : ""}`}
                    onClick={() => {
                      setActiveFolderId(folder.Id);
                      setSmartFilter("recent");
                    }}
                  >
                    {folder.Name}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onDeleteFolder(folder.Id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="life-admin-folder-create">
              <input
                className="form-input"
                placeholder="New folder"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
              />
              <button
                type="button"
                className="button-secondary"
                onClick={onCreateFolder}
                disabled={!newFolderName.trim()}
              >
                Add
              </button>
            </div>
          </div>

          <div className="life-admin-library-section">
            <h4>Record filter</h4>
            {recordFilterId ? (
              <p className="form-note">Linked to record #{recordFilterId}</p>
            ) : (
              <p className="form-note">Select a record from the records page to filter.</p>
            )}
            {recordFilterId ? (
              <div className="life-admin-record-reminder">
                <label className="form-group">
                  <span>Add reminder</span>
                  <input
                    className="form-input"
                    placeholder="Reminder title"
                    value={recordReminderTitle}
                    onChange={(event) => setRecordReminderTitle(event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span>Due at</span>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={recordReminderDueAt}
                    onChange={(event) => setRecordReminderDueAt(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  onClick={onCreateRecordReminder}
                  disabled={!recordReminderTitle || !recordReminderDueAt}
                >
                  Create reminder
                </button>
                {recordReminders.length > 0 ? (
                  <div className="life-admin-reminder-list">
                    {recordReminders.map((reminder) => (
                      <div key={reminder.Id} className="life-admin-reminder-item">
                        <span>{reminder.Title}</span>
                        <span>{new Date(reminder.DueAt).toLocaleString("en-AU")}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="life-admin-library-main">
          <div className="life-admin-library-toolbar">
            <label className="life-admin-library-search">
              <span className="form-grid-label">Search</span>
              <input
                className="form-input"
                placeholder="Search by title, tags, OCR"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <div className="life-admin-library-chips">
              <label className="form-group">
                <span>Type</span>
                <select
                  className="form-input"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="images">Images</option>
                  <option value="pdfs">PDFs</option>
                </select>
              </label>
              <label className="form-group">
                <span>Tag</span>
                <select
                  className="form-input"
                  value={tagFilterId}
                  onChange={(event) => setTagFilterId(event.target.value)}
                >
                  <option value="">All tags</option>
                  {tags.map((tag) => (
                    <option key={tag.Id} value={tag.Id}>
                      {tag.Name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span>Linked</span>
                <button
                  type="button"
                  className={`button-secondary${linkedOnly ? " is-active" : ""}`}
                  onClick={() => setLinkedOnly((prev) => !prev)}
                >
                  {linkedOnly ? "On" : "Off"}
                </button>
              </label>
              <label className="form-group">
                <span>Reminder</span>
                <button
                  type="button"
                  className={`button-secondary${remindersOnly ? " is-active" : ""}`}
                  onClick={() => setRemindersOnly((prev) => !prev)}
                >
                  {remindersOnly ? "On" : "Off"}
                </button>
              </label>
            </div>
            <button type="button" className="button-secondary" onClick={onSelectAll}>
              {selectedIds.length === visibleDocuments.length && visibleDocuments.length > 0
                ? "Clear selection"
                : "Select all"}
            </button>
          </div>

          {selectedIds.length > 0 ? (
            <div className="life-admin-triage">
              <div>
                <strong>{selectedIds.length} selected</strong>
                <p className="form-note">Apply folder, tags, links, and reminders in one pass.</p>
              </div>
              <div className="life-admin-triage-grid">
                <label className="form-group">
                  <span>Folder</span>
                  <select
                    className="form-input"
                    value={bulkFolderId}
                    onChange={(event) => setBulkFolderId(event.target.value)}
                  >
                    <option value="">No change</option>
                    <option value="0">Unfiled</option>
                    {folders.map((folder) => (
                      <option key={folder.Id} value={folder.Id}>
                        {folder.Name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-group">
                  <span>Tags</span>
                  <input
                    className="form-input"
                    placeholder="Tag1, Tag2"
                    value={bulkTags}
                    onChange={(event) => setBulkTags(event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span>Link category</span>
                  <select
                    className="form-input"
                    value={bulkLinkCategoryId}
                    onChange={(event) => {
                      setBulkLinkCategoryId(event.target.value);
                      setLinkCategoryId(event.target.value);
                      setBulkLinkRecordId("");
                    }}
                  >
                    <option value="">None</option>
                    {categories.map((category) => (
                      <option key={category.Id} value={category.Id}>
                        {category.Name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-group">
                  <span>Link record</span>
                  <select
                    className="form-input"
                    value={bulkLinkRecordId}
                    onChange={(event) => setBulkLinkRecordId(event.target.value)}
                  >
                    <option value="">None</option>
                    {recordOptions.map((record) => (
                      <option key={record.Id} value={record.Id}>
                        {record.Title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-group">
                  <span>Reminder title</span>
                  <input
                    className="form-input"
                    value={bulkReminderTitle}
                    onChange={(event) => setBulkReminderTitle(event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span>Reminder due</span>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={bulkReminderDueAt}
                    onChange={(event) => setBulkReminderDueAt(event.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={onApplyBulk}
                disabled={!selectedIds.length}
              >
                Apply to selected
              </button>
            </div>
          ) : null}

          {status === "loading" ? <p className="form-note">Loading documents.</p> : null}
          {visibleDocuments.length === 0 && status !== "loading" ? (
            <p className="form-note">No documents yet. Upload to get started.</p>
          ) : (
            <div className="life-admin-library-list">
              {visibleDocuments.map((doc) => (
                <article
                  key={doc.Id}
                  className={`life-admin-doc-card${selectedDocId === doc.Id ? " is-active" : ""}`}
                  onClick={() => setSelectedDocId(doc.Id)}
                >
                  <div className="life-admin-doc-card-header">
                    <input
                      type="checkbox"
                      className="life-admin-checkbox"
                      aria-label={`Select ${doc.Title || doc.OriginalFileName || "document"}`}
                      checked={selectedSet.has(doc.Id)}
                      onChange={(event) => {
                        event.stopPropagation();
                        onToggleSelect(doc.Id);
                      }}
                    />
                    <span className="life-admin-doc-title">{doc.Title || doc.OriginalFileName}</span>
                  </div>
                  <div className="life-admin-doc-preview">
                    <div className="life-admin-doc-placeholder">
                      <span>
                        {IsImageType(doc.ContentType)
                          ? "Image"
                          : IsPdfType(doc.ContentType)
                            ? "PDF"
                            : "File"}
                      </span>
                    </div>
                  </div>
                  <div className="life-admin-doc-meta">
                    <span>{doc.FolderName || "Unfiled"}</span>
                    <span>{new Date(doc.CreatedAt).toLocaleDateString("en-AU")}</span>
                  </div>
                  <div className="life-admin-doc-stats">
                    <span>{doc.LinkCount} linked</span>
                    <span>{doc.ReminderCount} reminders</span>
                  </div>
                  <div className="life-admin-doc-chips">
                    {doc.Tags.slice(0, 3).map((tag) => (
                      <span key={tag.Id} className="life-admin-chip">{tag.Name}</span>
                    ))}
                    {doc.Tags.length > 3 ? (
                      <span className="life-admin-chip">+{doc.Tags.length - 3}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

      </div>
      {detailModal}
    </div>
  );
};

export default Library;
