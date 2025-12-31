import { RequestJson, RequestWithAuth } from "./apiClient.js";

export const FetchIncomeStreams = async () => {
  return RequestJson("/budget/income-streams");
};

export const CreateIncomeStream = async (payload) => {
  return RequestJson("/budget/income-streams", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateIncomeStream = async (streamId, payload) => {
  return RequestJson(`/budget/income-streams/${streamId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteIncomeStream = async (streamId) => {
  const response = await RequestWithAuth(`/budget/income-streams/${streamId}`, { method: "DELETE" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchExpenses = async () => {
  return RequestJson("/budget/expenses");
};

export const FetchAllocationAccounts = async () => {
  return RequestJson("/budget/allocation-accounts");
};

export const CreateAllocationAccount = async (payload) => {
  return RequestJson("/budget/allocation-accounts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateAllocationAccount = async (accountId, payload) => {
  return RequestJson(`/budget/allocation-accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteAllocationAccount = async (accountId) => {
  const response = await RequestWithAuth(`/budget/allocation-accounts/${accountId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const CreateExpense = async (payload) => {
  return RequestJson("/budget/expenses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateExpense = async (expenseId, payload) => {
  return RequestJson(`/budget/expenses/${expenseId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const UpdateExpenseOrder = async (payload) => {
  const response = await RequestWithAuth("/budget/expenses/order", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const DeleteExpense = async (expenseId) => {
  const response = await RequestWithAuth(`/budget/expenses/${expenseId}`, { method: "DELETE" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchExpenseAccounts = async () => {
  return RequestJson("/budget/expense-accounts");
};

export const CreateExpenseAccount = async (payload) => {
  return RequestJson("/budget/expense-accounts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateExpenseAccount = async (accountId, payload) => {
  return RequestJson(`/budget/expense-accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteExpenseAccount = async (accountId) => {
  const response = await RequestWithAuth(`/budget/expense-accounts/${accountId}`, { method: "DELETE" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchExpenseTypes = async () => {
  return RequestJson("/budget/expense-types");
};

export const CreateExpenseType = async (payload) => {
  return RequestJson("/budget/expense-types", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateExpenseType = async (typeId, payload) => {
  return RequestJson(`/budget/expense-types/${typeId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteExpenseType = async (typeId) => {
  const response = await RequestWithAuth(`/budget/expense-types/${typeId}`, { method: "DELETE" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};
