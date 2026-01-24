import { RequestJson } from "./apiClient.js";

const TasksBase = "/integrations/google/tasks";

export const FetchTaskLists = async () => RequestJson(`${TasksBase}/lists`);

export const FetchTasks = async (listKey, options = {}) => {
  const refresh = options.Refresh ? "&refresh=1" : "";
  return RequestJson(`${TasksBase}?list_key=${encodeURIComponent(listKey)}${refresh}`);
};

export const CreateTask = async (payload) =>
  RequestJson(TasksBase, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const UpdateTask = async (taskId, payload) =>
  RequestJson(`${TasksBase}/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const DeleteTask = async (taskId, listKey) =>
  RequestJson(`${TasksBase}/${taskId}?list_key=${encodeURIComponent(listKey)}`, {
    method: "DELETE"
  });

export const FetchTaskSettings = async () => RequestJson("/tasks/settings");

export const UpdateTaskSettings = async (payload) =>
  RequestJson("/tasks/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const RunTaskOverdueNotifications = async (force = false) => {
  const query = force ? "?force=1" : "";
  return RequestJson(`/integrations/google/tasks/overdue/run${query}`, {
    method: "POST"
  });
};
