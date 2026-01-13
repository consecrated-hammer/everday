import { Outlet } from "react-router-dom";

const LifeAdminLayout = () => (
  <div className="module-shell">
    <header className="module-header">
      <div>
        <p className="eyebrow">Life admin</p>
        <h1>Life admin</h1>
        <p className="lede">Build flexible tables and keep household history in one place.</p>
      </div>
    </header>
    <section className="module-content">
      <Outlet />
    </section>
  </div>
);

export default LifeAdminLayout;
