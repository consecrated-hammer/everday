import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useNotifications } from "../hooks/useNotifications.js";
import { FormatDateTime } from "../lib/formatters.js";
import Icon from "./Icon.jsx";

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

const BuildBadgeLabel = (count) => (count > 9 ? "9+" : String(count));

const NotificationsMenu = () => {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    status,
    error,
    reload,
    markRead,
    dismiss,
    markAllRead
  } = useNotifications({ includeRead: true, includeDismissed: false, limit: 12 });

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    reload();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onClick = (event) => {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, reload]);

  const hasUnread = unreadCount > 0;
  const badgeLabel = useMemo(() => BuildBadgeLabel(unreadCount), [unreadCount]);

  return (
    <div className="notifications-menu" ref={wrapperRef}>
      <button
        type="button"
        className="notifications-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle notifications"
        aria-expanded={open}
      >
        <Icon name="bell" className="icon" />
        {hasUnread ? <span className="notifications-badge">{badgeLabel}</span> : null}
      </button>
      {open ? (
        <div className="dropdown dropdown-right notifications-panel">
          <div className="notifications-header">
            <div>
              <p className="notifications-title">Notifications</p>
              <p className="notifications-subtitle">
                {unreadCount} unread
              </p>
            </div>
            <div className="notifications-header-actions">
              <button
                type="button"
                className="notification-action is-quiet"
                onClick={markAllRead}
                disabled={!hasUnread}
              >
                Mark all read
              </button>
              <Link
                className="notification-action is-quiet"
                to="/notifications"
                onClick={() => setOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
          <div className="notifications-list">
            {status === "error" ? (
              <div className="notifications-empty">{error || "Unable to load notifications"}</div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">No notifications yet.</div>
            ) : (
              notifications.map((notification) => {
                const actionLabel = notification.ActionLabel || "Open";
                const showAction = Boolean(notification.LinkUrl);
                const metaLabel = BuildMetaLabel(notification);
                const isExternal = IsExternalLink(notification.LinkUrl);
                const onAction = async () => {
                  if (!notification.IsRead) {
                    await markRead(notification.Id);
                  }
                  setOpen(false);
                };
                return (
                  <div
                    key={notification.Id}
                    className={`notification-card${notification.IsRead ? " is-read" : ""}`}
                  >
                    <div className="notification-main">
                      <div className="notification-title-row">
                        <span className="notification-title">{notification.Title}</span>
                        {!notification.IsRead ? <span className="notification-dot" /> : null}
                      </div>
                      {notification.Body ? (
                        <p className="notification-body">{notification.Body}</p>
                      ) : null}
                      {metaLabel ? <p className="notification-meta">{metaLabel}</p> : null}
                    </div>
                    <div className="notification-actions">
                      {showAction ? (
                        isExternal ? (
                          <a
                            className="notification-action is-primary"
                            href={notification.LinkUrl}
                            onClick={onAction}
                          >
                            {actionLabel}
                          </a>
                        ) : (
                          <Link
                            className="notification-action is-primary"
                            to={notification.LinkUrl}
                            onClick={onAction}
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
                      <button
                        type="button"
                        className="notification-action is-quiet"
                        onClick={() => dismiss(notification.Id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsMenu;
