import { NavLink, Outlet } from "react-router-dom";

const LifeAdminLayout = () => (
  <div className="module-shell">
    <header className="module-header">
      <div>
        <p className="eyebrow">Life admin</p>
        <h1>Life admin</h1>
        <p className="lede">Build flexible tables and keep household history in one place.</p>
      </div>
      <div className="life-admin-header-actions">
        <NavLink
          to="/life-admin/records"
          className={({ isActive }) =>
            `life-admin-header-link${isActive ? " is-active" : ""}`
          }
        >
          Records
        </NavLink>
        <NavLink
          to="/life-admin/library"
          className={({ isActive }) =>
            `life-admin-header-link${isActive ? " is-active" : ""}`
          }
        >
          Library
        </NavLink>
        <NavLink
          to="/life-admin/builder"
          className={({ isActive }) =>
            `life-admin-header-link${isActive ? " is-active" : ""}`
          }
        >
          Builder
        </NavLink>
      </div>
    </header>
    <section className="module-content">
      <Outlet />
    </section>
  </div>
);

export default LifeAdminLayout;
