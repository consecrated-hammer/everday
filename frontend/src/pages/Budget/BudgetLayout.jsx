import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Allocations", path: "/budget/allocations" },
  { label: "Expenses", path: "/budget/expenses" },
  { label: "Income", path: "/budget/income" },
  { label: "Settings", path: "/budget/settings", disabled: true }
];

const BudgetLayout = () => (
  <div className="module-shell module-shell--compact">
    <header className="module-header">
      <div>
        <p className="eyebrow">Budget</p>
        <h1>Budget</h1>
        <p className="lede">Plan income, expenses, and allocations.</p>
      </div>
    </header>
    <nav className="module-nav" aria-label="Budget sections">
      {navItems.map((item) => {
        if (item.disabled) {
          return (
            <span key={item.path} className="module-link is-disabled" aria-disabled="true">
              {item.label}
            </span>
          );
        }
        return (
          <NavLink
            key={item.path}
            className={({ isActive }) => `module-link${isActive ? " is-active" : ""}`}
            to={item.path}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
    <section className="module-content">
      <Outlet />
    </section>
  </div>
);

export default BudgetLayout;
