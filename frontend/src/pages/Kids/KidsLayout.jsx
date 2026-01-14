import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { GetDisplayName } from "../../lib/authStorage.js";
import { GetKidsHeaderEmoji } from "../../lib/kidsEmoji.js";

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
          <p className="kids-eyebrow">{GetKidsHeaderEmoji("Brand")} Everday</p>
          <h1 className="kids-title">
            {GetKidsHeaderEmoji("Greeting")} Hey {name || "there"}!
          </h1>
          <p className="kids-subtitle">
            {GetKidsHeaderEmoji("Subtitle")} Log chores, track your money.
          </p>
        </div>
      </header>
      <main className="kids-main">
        <Outlet />
      </main>
    </div>
  );
};

export default KidsLayout;
