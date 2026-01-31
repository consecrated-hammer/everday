import { RequestJson } from "./apiClient.js";

export const FetchUsers = async () => {
  return RequestJson("/settings/users");
};

export const CreateUser = async (payload) => {
  return RequestJson("/settings/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export const FetchGoogleAuthUrl = async () => {
  return RequestJson("/integrations/google/oauth/start");
};

export const FetchGoogleStatus = async (validate = false) => {
  const query = validate ? "?validate=1" : "";
  return RequestJson(`/integrations/google/status${query}`);
};

export const FetchGmailAuthUrl = async () => {
  return RequestJson("/integrations/gmail/oauth/start");
};

export const FetchGmailStatus = async (validate = false) => {
  const query = validate ? "?validate=1" : "";
  return RequestJson(`/integrations/gmail/status${query}`);
};
