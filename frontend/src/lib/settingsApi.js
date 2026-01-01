import { RequestJson } from "./apiClient.js";

export const FetchUsers = async () => {
  return RequestJson("/settings/users");
};

export const UpdateUserRole = async (userId, payload) => {
  return RequestJson(`/settings/users/${userId}/roles`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const UpdateUserPassword = async (userId, payload) => {
  return RequestJson(`/settings/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const UpdateUserProfile = async (userId, payload) => {
  return RequestJson(`/settings/users/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};
