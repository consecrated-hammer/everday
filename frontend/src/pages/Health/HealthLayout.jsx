import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Today", path: "/health/today" },
  { label: "Log", path: "/health/log" },
  { label: "Foods", path: "/health/foods" },
  { label: "History", path: "/health/history" },
  { label: "Insights", path: "/health/insights" }
];

const bottomNavItems = [
  { label: "Today", path: "/health/today" },
  { label: "Log", path: "/health/log" },
  { label: "Foods", path: "/health/foods" },
  { label: "History", path: "/health/history" },
  { label: "Insights", path: "/health/insights" }
];

const HealthLayout = () => (
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
  </div>
);

export default HealthLayout;
