import { RequestJson, RequestRaw } from "./apiClient.js";

export const FetchDocumentFolders = async () => RequestJson("/life-admin/document-folders");

export const CreateDocumentFolder = async (payload) =>
  RequestJson("/life-admin/document-folders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const UpdateDocumentFolder = async (folderId, payload) =>
  RequestJson(`/life-admin/document-folders/${folderId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const DeleteDocumentFolder = async (folderId) =>
  RequestJson(`/life-admin/document-folders/${folderId}`, {
    method: "DELETE"
  });

export const FetchDocumentTags = async () => RequestJson("/life-admin/document-tags");

export const UploadDocument = async ({ file, title, folderId, tagNames }) => {
  const formData = new FormData();
  formData.append("file", file);
  if (title) {
    formData.append("title", title);
  }
  if (folderId !== undefined && folderId !== null) {
    formData.append("folder_id", folderId);
  }
  if (tagNames && tagNames.length > 0) {
    formData.append("tag_names", tagNames.join(","));
  }
  const response = await RequestRaw("/life-admin/documents", {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
};

export const FetchDocuments = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.folderId !== undefined && filters.folderId !== null) {
    params.set("folder_id", filters.folderId);
  }
  if (filters.tagIds && filters.tagIds.length) {
    params.set("tag_ids", filters.tagIds.join(","));
  }
  if (filters.linkedOnly) params.set("linked_only", "true");
  if (filters.remindersOnly) params.set("reminders_only", "true");
  if (filters.recordId) params.set("record_id", filters.recordId);
  const query = params.toString();
  return RequestJson(`/life-admin/documents${query ? `?${query}` : ""}`);
};

export const FetchDocumentDetail = async (documentId) =>
  RequestJson(`/life-admin/documents/${documentId}`);

export const FetchDocumentFile = async (documentId) => {
  const response = await RequestRaw(`/life-admin/documents/${documentId}/file`, {
    method: "GET"
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.blob();
};

export const UpdateDocument = async (documentId, payload) =>
  RequestJson(`/life-admin/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const AddDocumentTags = async (documentId, tagNames) =>
  RequestJson(`/life-admin/documents/${documentId}/tags`, {
    method: "POST",
    body: JSON.stringify({ TagNames: tagNames })
  });

export const RemoveDocumentTag = async (documentId, tagId) =>
  RequestJson(`/life-admin/documents/${documentId}/tags/${tagId}`, {
    method: "DELETE"
  });

export const CreateDocumentLink = async (documentId, payload) =>
  RequestJson(`/life-admin/documents/${documentId}/links`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const DeleteDocumentLink = async (documentId, linkId) =>
  RequestJson(`/life-admin/documents/${documentId}/links/${linkId}`, {
    method: "DELETE"
  });

export const BulkUpdateDocuments = async (payload) =>
  RequestJson("/life-admin/documents/bulk", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const CreateReminder = async (payload) =>
  RequestJson("/life-admin/reminders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const FetchReminders = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.sourceType) params.set("source_type", filters.sourceType);
  if (filters.sourceId) params.set("source_id", filters.sourceId);
  const query = params.toString();
  return RequestJson(`/life-admin/reminders${query ? `?${query}` : ""}`);
};

export const UpdateReminder = async (reminderId, payload) =>
  RequestJson(`/life-admin/reminders/${reminderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const DeleteReminder = async (reminderId) =>
  RequestJson(`/life-admin/reminders/${reminderId}`, {
    method: "DELETE"
  });

export const ApplyAiSuggestion = async (documentId) =>
  RequestJson(`/life-admin/documents/${documentId}/ai/apply`, {
    method: "POST"
  });

export const RunGmailIntake = async (maxMessages = 10) =>
  RequestJson(`/life-admin/documents/intake/gmail?max_messages=${maxMessages}`, {
    method: "POST"
  });
