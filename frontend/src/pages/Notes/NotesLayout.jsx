import { Outlet } from "react-router-dom";

const NotesLayout = () => {
  return (
    <div className="module-shell module-shell--notes">
      <section className="module-content">
        <Outlet />
      </section>
    </div>
  );
};

export default NotesLayout;
