import { RequestJson } from "./apiClient.js";

export async function FetchNotes(scope = "personal", archived = false) {
  const params = new URLSearchParams({ scope, archived: String(archived) });
  return RequestJson(`/notes?${params}`);
}

export async function FetchNoteById(noteId) {
  return RequestJson(`/notes/${noteId}`);
}

export async function CreateNote(data) {
  return RequestJson(`/notes`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function UpdateNote(noteId, data) {
  return RequestJson(`/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function DeleteNote(noteId) {
  return RequestJson(`/notes/${noteId}`, {
    method: "DELETE"
  });
}

export async function ArchiveNote(noteId) {
  return RequestJson(`/notes/${noteId}/archive`, {
    method: "POST"
  });
}

export async function UnarchiveNote(noteId) {
  return RequestJson(`/notes/${noteId}/unarchive`, {
    method: "POST"
  });
}

export async function TogglePinNote(noteId) {
  return RequestJson(`/notes/${noteId}/toggle-pin`, {
    method: "POST"
  });
}

export async function AddNoteTag(noteId, userId) {
  return RequestJson(`/notes/${noteId}/tags`, {
    method: "POST",
    body: JSON.stringify({ UserId: userId })
  });
}

export async function RemoveNoteTag(noteId, userId) {
  return RequestJson(`/notes/${noteId}/tags/${userId}`, {
    method: "DELETE"
  });
}

export async function LinkNoteTask(noteId, taskId) {
  return RequestJson(`/notes/${noteId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ TaskId: taskId })
  });
}

export async function UnlinkNoteTask(noteId, taskId) {
  return RequestJson(`/notes/${noteId}/tasks/${taskId}`, {
    method: "DELETE"
  });
}

export async function AddNoteAssociation(noteId, moduleName, recordId) {
  return RequestJson(`/notes/${noteId}/associations`, {
    method: "POST",
    body: JSON.stringify({ ModuleName: moduleName, RecordId: recordId })
  });
}

export async function RemoveNoteAssociation(noteId, associationId) {
  return RequestJson(`/notes/${noteId}/associations/${associationId}`, {
    method: "DELETE"
  });
}

export async function ReorderNoteItems(noteId, itemOrders) {
  return RequestJson(`/notes/${noteId}/items/reorder`, {
    method: "POST",
    body: JSON.stringify({ ItemOrders: itemOrders })
  });
}

export async function FetchNoteShareUsers() {
  return RequestJson("/notes/share-users");
}
