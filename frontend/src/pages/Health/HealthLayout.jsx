import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";


const navItems = [
  { label: "Today", path: "/health/today" },
  { label: "Log", path: "/health/log" },
  { label: "Foods", path: "/health/foods" },
  { label: "Insights", path: "/health/insights" }
];

const bottomNavItems = [
  { label: "Today", path: "/health/today" },
  { label: "Log", path: "/health/log" },
  { label: "Foods", path: "/health/foods" },
  { label: "Insights", path: "/health/insights" }
];

const BuildHealthPageLabel = (path) => {
  if (path.startsWith("/health/today")) {
    return "Health Today";
  }
  if (path.startsWith("/health/log")) {
    return "Health Log";
  }
  if (path.startsWith("/health/foods")) {
    return "Health Foods";
  }
  if (path.startsWith("/health/insights")) {
    return "Health Insights";
  }
  if (path.startsWith("/health/history")) {
    return "Health History";
  }
  if (path.startsWith("/health/settings")) {
    return "Health Settings";
  }
  return "Health";
};

const HealthLayout = () => {
  const location = useLocation();
  const [infoOpen, setInfoOpen] = useState(false);
  const [modalLabel, setModalLabel] = useState("");
  const [viewLabel, setViewLabel] = useState("");
  const label = useMemo(() => BuildHealthPageLabel(location.pathname), [location.pathname]);
  const baseLabel = viewLabel ? `${label} · ${viewLabel}` : label;
  const infoLabel = modalLabel ? `${baseLabel} · ${modalLabel}` : baseLabel;

  useEffect(() => {
    setInfoOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const resolveLabels = () => {
      const modals = document.querySelectorAll("[data-health-modal-label]");
      const latest = modals.length ? modals[modals.length - 1] : null;
      const nextLabel = latest?.getAttribute("data-health-modal-label") || "";
      setModalLabel(nextLabel);
      const viewNode = document.querySelector("[data-health-view-label]");
      const nextView = viewNode?.getAttribute("data-health-view-label") || "";
      setViewLabel(nextView);
    };
    resolveLabels();
    const observer = new MutationObserver(() => resolveLabels());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-health-modal-label", "data-health-view-label"]
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="module-shell module-shell--health">
      <header className="module-header">
        <div>
          <p className="eyebrow">Health</p>
          <h1>Health</h1>
          <p className="lede">Track meals, movement, and nutrition momentum.</p>
        </div>
      </header>
      <nav className="module-nav" aria-label="Health sections">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) => `module-link${isActive ? " is-active" : ""}`}
            to={item.path}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <section className="module-content">
        <Outlet />
      </section>
      <nav className="health-bottom-nav" aria-label="Health navigation">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) =>
              `health-bottom-link${isActive ? " is-active" : ""}`
            }
            to={item.path}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="health-page-info" data-open={infoOpen}>
        <button
          type="button"
          className="health-page-info-toggle"
          onClick={() => setInfoOpen((prev) => !prev)}
          aria-label="Show page info"
        >
          ?
        </button>
        {infoOpen ? <div className="health-page-info-bubble">{infoLabel}</div> : null}
      </div>
    </div>
  );
};

export default HealthLayout;
