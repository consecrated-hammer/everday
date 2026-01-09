import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { GetDisplayName } from "../../lib/authStorage.js";

const KidsLayout = () => {
  useEffect(() => {
    document.body.classList.add("kids-theme");
    return () => {
      document.body.classList.remove("kids-theme");
    };
  }, []);

  const name = GetDisplayName();

  return (
    <div className="kids-shell">
      <header className="kids-header">
        <div>
          <p className="kids-eyebrow">Everday</p>
          <h1 className="kids-title">Hey {name || "there"}!</h1>
          <p className="kids-subtitle">Log chores, track your money.</p>
        </div>
      </header>
      <main className="kids-main">
        <Outlet />
      </main>
    </div>
  );
};

export default KidsLayout;
