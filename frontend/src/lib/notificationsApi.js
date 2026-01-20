import { RequestJson } from "./apiClient.js";

const NotificationsBase = "/notifications";

export const FetchNotifications = ({
  includeRead = true,
  includeDismissed = false,
  limit = 20,
  offset = 0
} = {}) => {
  const params = new URLSearchParams();
  params.set("include_read", String(includeRead));
  params.set("include_dismissed", String(includeDismissed));
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return RequestJson(`${NotificationsBase}?${params.toString()}`);
};

export const CreateNotification = (payload) =>
  RequestJson(NotificationsBase, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const MarkNotificationRead = (notificationId) =>
  RequestJson(`${NotificationsBase}/${notificationId}/read`, { method: "POST" });

export const DismissNotification = (notificationId) =>
  RequestJson(`${NotificationsBase}/${notificationId}/dismiss`, { method: "POST" });

export const MarkAllNotificationsRead = () =>
  RequestJson(`${NotificationsBase}/read-all`, { method: "POST" });
