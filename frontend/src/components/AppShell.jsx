import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import AccountMenu from "./AccountMenu.jsx";
import MobileAppBar from "./MobileAppBar.jsx";
import PasswordChangePrompt from "./PasswordChangePrompt.jsx";
import HealthProfilePrompt from "./HealthProfilePrompt.jsx";
import Icon from "./Icon.jsx";
import NotificationsMenu from "./NotificationsMenu.jsx";
import { ResetDashboardLayout } from "../lib/dashboardLayout.js";
import { GetUserId } from "../lib/authStorage.js";
import { GetUiSettings, SetUiSettings } from "../lib/uiSettings.js";
const navSections = [
  {
    label: "Modules",
    items: [
      { label: "Dashboard", path: "/", icon: "dashboard", tone: "sunrise" },
      { label: "Health", path: "/health", icon: "health", tone: "rose" },
      { label: "Kids", path: "/kids-admin", icon: "team", tone: "amber" },
      { label: "Shopping", path: "/shopping", icon: "shopping", tone: "sky" },
      { label: "Life admin", path: "/life-admin/records", icon: "agenda", tone: "sky" },
      { label: "Tasks", path: "/tasks", icon: "tasks", tone: "mint" },
      { label: "Notes", path: "/notes", icon: "note", tone: "mint" },
      { label: "Budget", path: "/budget/allocations", icon: "budget", tone: "mint" }
    ]
  }
];

const AppShell = () => {
  const location = useLocation();
  const navOpen = true;
  const [uiSettings, setUiSettingsState] = useState(() => GetUiSettings());
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);
  const dashboardMenuRef = useRef(null);
  const [prefersDark, setPrefersDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const handler = (event) => {
      const next = event?.detail || GetUiSettings();
      setUiSettingsState(next);
    };
    window.addEventListener("ui-settings-changed", handler);
    return () => window.removeEventListener("ui-settings-changed", handler);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event) => setPrefersDark(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!dashboardMenuOpen) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setDashboardMenuOpen(false);
      }
    };
    const onClick = (event) => {
      if (!dashboardMenuRef.current || dashboardMenuRef.current.contains(event.target)) {
        return;
      }
      setDashboardMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [dashboardMenuOpen]);

  const isDashboard = useMemo(() => location.pathname === "/", [location.pathname]);
  const isBudget = useMemo(() => location.pathname.startsWith("/budget"), [location.pathname]);
  const isBudgetExpenses = useMemo(
    () => location.pathname === "/budget/expenses",
    [location.pathname]
  );
  const isHealth = useMemo(() => location.pathname.startsWith("/health"), [location.pathname]);
  const pageLabel = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return "Dashboard";
    if (path.startsWith("/tasks")) return "Tasks";
    if (path.startsWith("/budget")) return "Budget";
    if (path.startsWith("/shopping")) return "Shopping";
    if (path.startsWith("/life-admin")) return "Life admin";
    if (path.startsWith("/health")) return "Health";
    if (path.startsWith("/kids-admin")) return "Kids";
    if (path.startsWith("/notes")) return "Notes";
    if (path.startsWith("/notifications")) return "Notifications";
    if (path.startsWith("/settings")) return "Settings";
    return "";
  }, [location.pathname]);
  const resolvedTheme =
    uiSettings.Theme === "auto" ? (prefersDark ? "dark" : "light") : uiSettings.Theme;
  const themeOrder = ["auto", "light", "dark"];
  const currentThemeIndex = themeOrder.indexOf(uiSettings.Theme || "auto");
  const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];
  const themeIcon =
    uiSettings.Theme === "auto" ? "themeAuto" : resolvedTheme === "dark" ? "themeDark" : "themeLight";
  const themeLabel =
    uiSettings.Theme === "auto"
      ? "Theme: auto"
      : resolvedTheme === "dark"
        ? "Theme: dark"
        : "Theme: light";
  const showDashboardMenu = pageLabel === "Dashboard";
  const onResetDashboardLayout = () => {
    if (!window.confirm("Reset your dashboard layout to the default arrangement?")) {
      return;
    }
    ResetDashboardLayout(GetUserId());
    setDashboardMenuOpen(false);
  };

  useEffect(() => {
    if (!showDashboardMenu) {
      setDashboardMenuOpen(false);
    }
  }, [showDashboardMenu]);
  return (
    <div
      className={`app-layout nav-open${isBudgetExpenses ? " app-layout--no-scroll" : ""}${
        isDashboard ? " app-layout--home" : ""
      }${isHealth ? " app-layout--health" : ""}`}
    >
      <aside className="nav-rail">
        {navSections.map((section) => (
          <div key={section.label} className="nav-section">
            <p className={`nav-section-title${navOpen ? "" : " nav-section-title--hidden"}`}>
              {section.label}
            </p>
            <div className="nav-items">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-item${isActive && !(item.path === "/" && !isDashboard) ? " is-active" : ""}`
                  }
                  end={item.path === "/"}
                  data-tone={item.tone}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <Icon name={item.icon} className="icon" />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        <div className="nav-spacer" />
        <div className="nav-bottom">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item nav-item--utility${isActive ? " is-active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <Icon name="settings" className="icon" />
            </span>
            <span className="nav-label">Settings</span>
          </NavLink>
          <AccountMenu compact={!navOpen} />
        </div>
      </aside>
      <main
        className={`app-main${isBudget ? " app-main--compact" : ""}${
          isBudgetExpenses ? " app-main--no-scroll" : ""
        }`}
      >
        <MobileAppBar />
        <div className="app-topbar">
          <div className="app-topbar-left">
            <div className="app-topbar-breadcrumb">
              <span className="nav-logo">E</span>
              <span className="nav-title">Everday</span>
              {pageLabel ? (
                <>
                  <Icon name="chevronRight" className="app-topbar-separator" />
                  <span className="app-topbar-page">{pageLabel}</span>
                  {showDashboardMenu ? (
                    <div className="app-topbar-menu" ref={dashboardMenuRef}>
                      <button
                        type="button"
                        className="app-topbar-menu-button"
                        aria-label="Open dashboard menu"
                        aria-expanded={dashboardMenuOpen}
                        onClick={() => setDashboardMenuOpen((prev) => !prev)}
                      >
                        <Icon name="more" className="icon" />
                      </button>
                      {dashboardMenuOpen ? (
                        <div className="dropdown">
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={onResetDashboardLayout}
                          >
                            Reset layout
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="app-topbar-actions">
            <button
              type="button"
              className="app-topbar-button"
              aria-label={themeLabel}
              title={`Theme: ${uiSettings.Theme || "auto"}`}
              onClick={() => SetUiSettings({ Theme: nextTheme })}
            >
              <Icon name={themeIcon} className="icon" />
            </button>
            <NotificationsMenu />
          </div>
        </div>
        <div className="app-content">
          <Outlet />
        </div>
      </main>
      <PasswordChangePrompt />
      <HealthProfilePrompt />
    </div>
  );
};

export default AppShell;
