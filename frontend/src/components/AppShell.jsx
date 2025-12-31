import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import AccountMenu from "./AccountMenu.jsx";
import PasswordChangePrompt from "./PasswordChangePrompt.jsx";
import Icon from "./Icon.jsx";
const navSections = [
  {
    label: "Modules",
    items: [
      { label: "Dashboard", path: "/", icon: "dashboard", tone: "sunrise" },
      { label: "Budget", path: "/budget/income", icon: "budget", tone: "mint" },
      { label: "Health", path: "/health", icon: "health", tone: "rose" },
      { label: "Agenda", path: "/agenda", icon: "agenda", tone: "sky" },
      { label: "Inbox", path: "/inbox", icon: "inbox", tone: "amber" }
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

  return (
    <div className={`app-layout${navOpen ? " nav-open" : " nav-closed"}`}>
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
      <main className={`app-main${isBudget ? " app-main--compact" : ""}`}>
        <div className="app-topbar">
          <div />
          <AccountMenu />
        </div>
        <Outlet />
      </main>
      <PasswordChangePrompt />
    </div>
  );
};

export default AppShell;
