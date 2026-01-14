import { RequestJson, RequestWithAuth } from "./apiClient.js";

export const FetchKidsSummary = async () => RequestJson("/kids/me/summary");

export const FetchKidsOverview = async (selectedDate = "") => {
  const query = selectedDate ? `?selected_date=${encodeURIComponent(selectedDate)}` : "";
  return RequestJson(`/kids/me/overview${query}`);
};

export const FetchKidsLedger = async (limit = 50) =>
  RequestJson(`/kids/me/ledger?limit=${limit}`);

export const FetchKidsChores = async () => RequestJson("/kids/me/chores");

export const FetchKidsChoreEntries = async (limit = 50, includeDeleted = false) =>
  RequestJson(
    `/kids/me/chore-entries?limit=${limit}&include_deleted=${includeDeleted ? "true" : "false"}`
  );

export const FetchKidsChoreEntryAudit = async (entryId) =>
  RequestJson(`/kids/me/chore-entries/${entryId}/audit`);

export const CreateKidsChoreEntry = async (payload) =>
  RequestJson("/kids/me/chore-entries", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const UpdateKidsChoreEntry = async (entryId, payload) =>
  RequestJson(`/kids/me/chore-entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const DeleteKidsChoreEntry = async (entryId) => {
  const response = await RequestWithAuth(`/kids/me/chore-entries/${entryId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchLinkedKids = async () => RequestJson("/kids/parents/children");

export const CreateKidLink = async (payload) =>
  RequestJson("/kids/parents/children", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const FetchKidLedger = async (kidId, limit = 100) =>
  RequestJson(`/kids/parents/children/${kidId}/ledger?limit=${limit}`);

export const FetchKidChoreEntries = async (kidId, limit = 200, includeDeleted = true) =>
  RequestJson(
    `/kids/parents/children/${kidId}/chore-entries?limit=${limit}&include_deleted=${
      includeDeleted ? "true" : "false"
    }`
  );

export const FetchKidChoreEntryAudit = async (kidId, entryId) =>
  RequestJson(`/kids/parents/children/${kidId}/chore-entries/${entryId}/audit`);

export const FetchKidMonthSummary = async (kidId, month = "") => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return RequestJson(`/kids/parents/children/${kidId}/month-summary${query}`);
};

export const FetchKidMonthOverview = async (kidId, month = "") => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return RequestJson(`/kids/parents/children/${kidId}/month-overview${query}`);
};

export const FetchKidDayDetail = async (kidId, entryDate) =>
  RequestJson(
    `/kids/parents/children/${kidId}/day?entry_date=${encodeURIComponent(entryDate)}`
  );

export const CreateParentKidChoreEntry = async (kidId, payload) =>
  RequestJson(`/kids/parents/children/${kidId}/chore-entries`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const UpdateParentKidChoreEntry = async (kidId, entryId, payload) =>
  RequestJson(`/kids/parents/children/${kidId}/chore-entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const DeleteParentKidChoreEntry = async (kidId, entryId) => {
  const response = await RequestWithAuth(
    `/kids/parents/children/${kidId}/chore-entries/${entryId}`,
    {
      method: "DELETE"
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchKidsPendingApprovals = async ({ kidId = "", choreType = "" } = {}) => {
  const params = new URLSearchParams();
  if (kidId) {
    params.set("kid_id", String(kidId));
  }
  if (choreType) {
    params.set("chore_type", choreType);
  }
  const query = params.toString();
  return RequestJson(`/kids/parents/approvals${query ? `?${query}` : ""}`);
};

export const ApproveKidsChoreEntry = async (entryId) =>
  RequestJson(`/kids/parents/approvals/${entryId}/approve`, { method: "POST" });

export const RejectKidsChoreEntry = async (entryId) =>
  RequestJson(`/kids/parents/approvals/${entryId}/reject`, { method: "POST" });

export const CreateKidDeposit = async (kidId, payload) =>
  RequestJson(`/kids/parents/children/${kidId}/ledger/deposit`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const CreateKidWithdrawal = async (kidId, payload) =>
  RequestJson(`/kids/parents/children/${kidId}/ledger/withdrawal`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const CreateKidStartingBalance = async (kidId, payload) =>
  RequestJson(`/kids/parents/children/${kidId}/ledger/starting-balance`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const FetchPocketMoneyRule = async (kidId) =>
  RequestJson(`/kids/parents/children/${kidId}/pocket-money`);

export const UpdatePocketMoneyRule = async (kidId, payload) =>
  RequestJson(`/kids/parents/children/${kidId}/pocket-money`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const FetchParentChores = async () => RequestJson("/kids/parents/chores");

export const CreateParentChore = async (payload) =>
  RequestJson("/kids/parents/chores", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const UpdateParentChore = async (choreId, payload) =>
  RequestJson(`/kids/parents/chores/${choreId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const DeleteParentChore = async (choreId) => {
  const response = await RequestWithAuth(`/kids/parents/chores/${choreId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const AssignChoreToKids = async (choreId, payload) =>
  RequestJson(`/kids/parents/chores/${choreId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const SetChoreAssignments = async (choreId, payload) =>
  RequestJson(`/kids/parents/chores/${choreId}/assignments`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
