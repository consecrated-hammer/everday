import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import AccountMenu from "./AccountMenu.jsx";
import MobileAppBar from "./MobileAppBar.jsx";
import PasswordChangePrompt from "./PasswordChangePrompt.jsx";
import HealthProfilePrompt from "./HealthProfilePrompt.jsx";
import Icon from "./Icon.jsx";
import NotificationsMenu from "./NotificationsMenu.jsx";
const navSections = [
  {
    label: "Modules",
    items: [
      { label: "Dashboard", path: "/", icon: "dashboard", tone: "sunrise" },
      { label: "Budget", path: "/budget/allocations", icon: "budget", tone: "mint" },
      { label: "Shopping", path: "/shopping", icon: "shopping", tone: "sky" },
      { label: "Life admin", path: "/life-admin/records", icon: "agenda", tone: "sky" },
      { label: "Health", path: "/health", icon: "health", tone: "rose" },
      { label: "Kids", path: "/kids-admin", icon: "team", tone: "amber" }
    ]
  }
];

const AppShell = () => {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(() => {
    const stored = localStorage.getItem("everday.navOpen");
    if (stored === "false") return false;
    if (stored === "true") return true;
    return true;
  });

  const onToggleNav = () => {
    setNavOpen((prev) => {
      const next = !prev;
      localStorage.setItem("everday.navOpen", String(next));
      return next;
    });
  };

  const isDashboard = useMemo(() => location.pathname === "/", [location.pathname]);
  const isBudget = useMemo(() => location.pathname.startsWith("/budget"), [location.pathname]);
  const isBudgetExpenses = useMemo(
    () => location.pathname === "/budget/expenses",
    [location.pathname]
  );
  const isHealth = useMemo(() => location.pathname.startsWith("/health"), [location.pathname]);
  return (
    <div
      className={`app-layout${navOpen ? " nav-open" : " nav-closed"}${
        isBudgetExpenses ? " app-layout--no-scroll" : ""
      }${isDashboard ? " app-layout--home" : ""}${isHealth ? " app-layout--health" : ""}`}
    >
      <aside className="nav-rail">
        <div className="nav-brand">
          <span className="nav-logo">E</span>
          <span className="nav-title">Everday</span>
        </div>
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
          <button
            className="nav-toggle"
            type="button"
            onClick={onToggleNav}
            aria-label={navOpen ? "Collapse navigation" : "Expand navigation"}
          >
            <Icon name={navOpen ? "navCollapse" : "navExpand"} className="nav-toggle-icon" />
            {navOpen ? <span className="nav-toggle-label">Collapse</span> : null}
          </button>
        </div>
      </aside>
      <main
        className={`app-main${isBudget ? " app-main--compact" : ""}${
          isBudgetExpenses ? " app-main--no-scroll" : ""
        }`}
      >
        <MobileAppBar />
        <div className="app-topbar">
          <div />
          <div className="app-topbar-actions">
            <NotificationsMenu />
          </div>
        </div>
        <Outlet />
      </main>
      <PasswordChangePrompt />
      <HealthProfilePrompt />
    </div>
  );
};

export default AppShell;
