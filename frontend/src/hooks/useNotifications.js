import { useCallback, useEffect, useState } from "react";

import {
  DismissNotification,
  FetchNotifications,
  MarkAllNotificationsRead,
  MarkNotificationRead
} from "../lib/notificationsApi.js";

export const useNotifications = ({
  includeRead = true,
  includeDismissed = false,
  limit = 12,
  pollIntervalMs = 60000
} = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      const result = await FetchNotifications({
        includeRead,
        includeDismissed,
        limit,
        offset: 0
      });
      setNotifications(result?.Notifications || []);
      setUnreadCount(result?.UnreadCount || 0);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load notifications");
    }
  }, [includeRead, includeDismissed, limit]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!pollIntervalMs) {
      return undefined;
    }
    const timer = setInterval(() => {
      loadNotifications();
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [loadNotifications, pollIntervalMs]);

  const markRead = useCallback(
    async (notificationId) => {
      await MarkNotificationRead(notificationId);
      await loadNotifications();
    },
    [loadNotifications]
  );

  const dismiss = useCallback(
    async (notificationId) => {
      await DismissNotification(notificationId);
      await loadNotifications();
    },
    [loadNotifications]
  );

  const markAllRead = useCallback(async () => {
    await MarkAllNotificationsRead();
    await loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    status,
    error,
    reload: loadNotifications,
    markRead,
    dismiss,
    markAllRead
  };
};
