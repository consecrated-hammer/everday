import { Link } from "react-router-dom";

import { useNotifications } from "../../hooks/useNotifications.js";
import { FormatDateTime } from "../../lib/formatters.js";

const IsExternalLink = (value) => /^https?:\/\//i.test(value || "");

const ExtractFirstName = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.split(/\s+/)[0];
};

const BuildMetaLabel = (notification) => {
  const parts = [];
  if (notification.CreatedAt) {
    parts.push(FormatDateTime(notification.CreatedAt));
  }
  if (notification.CreatedByName) {
    const firstName = ExtractFirstName(notification.CreatedByName);
    if (firstName) {
      parts.push(`From ${firstName}`);
    }
  }
  return parts.join(" | ");
};

const BuildStatusLabel = (notification) => {
  if (notification.IsDismissed) {
    return "Dismissed";
  }
  if (notification.IsRead) {
    return "Read";
  }
  return "Unread";
};

const Notifications = () => {
  const {
    notifications,
    unreadCount,
    status,
    error,
    reload,
    markRead,
    dismiss,
    markAllRead
  } = useNotifications({
    includeRead: true,
    includeDismissed: true,
    limit: 200,
    pollIntervalMs: 0
  });

  return (
    <div className="module-panel">
      <header className="module-panel-header">
        <div>
          <h2>Notifications</h2>
          <p>Review all notifications, including dismissed items.</p>
        </div>
        <div className="module-panel-actions">
          <button type="button" className="notification-action is-primary" onClick={reload}>
            Refresh
          </button>
          <button
            type="button"
            className="notification-action is-primary"
            onClick={markAllRead}
            disabled={!unreadCount}
          >
            Mark all read
          </button>
        </div>
      </header>
      {status === "error" ? <p className="form-error">{error}</p> : null}
      {status === "loading" ? (
        <p>Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="form-note">No notifications yet.</p>
      ) : (
        <div className="notification-history-list">
          {notifications.map((notification) => {
            const metaLabel = BuildMetaLabel(notification);
            const statusLabel = BuildStatusLabel(notification);
            const actionLabel = notification.ActionLabel || "Open";
            const showAction = Boolean(notification.LinkUrl);
            const isExternal = IsExternalLink(notification.LinkUrl);
            const onOpen = async () => {
              if (!notification.IsRead) {
                await markRead(notification.Id);
              }
            };
            return (
              <div
                key={notification.Id}
                className={`notification-card${notification.IsRead ? " is-read" : ""}`}
              >
                <div className="notification-title-row">
                  <span className="notification-title">{notification.Title}</span>
                  <span className="badge">{statusLabel}</span>
                </div>
                {notification.Body ? (
                  <p className="notification-body">{notification.Body}</p>
                ) : null}
                {metaLabel ? <p className="notification-meta">{metaLabel}</p> : null}
                <div className="notification-actions">
                  {showAction ? (
                    isExternal ? (
                      <a
                        className="notification-action is-primary"
                        href={notification.LinkUrl}
                        onClick={onOpen}
                      >
                        {actionLabel}
                      </a>
                    ) : (
                      <Link
                        className="notification-action is-primary"
                        to={notification.LinkUrl}
                        onClick={onOpen}
                      >
                        {actionLabel}
                      </Link>
                    )
                  ) : null}
                  {!notification.IsRead ? (
                    <button
                      type="button"
                      className="notification-action"
                      onClick={() => markRead(notification.Id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                  {!notification.IsDismissed ? (
                    <button
                      type="button"
                      className="notification-action is-quiet"
                      onClick={() => dismiss(notification.Id)}
                    >
                      Dismiss
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
