import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Logout } from "../../lib/authApi.js";
import { ClearTokens, GetTokens, GetDisplayName } from "../../lib/authStorage.js";
import { GetKidsHeaderEmoji } from "../../lib/kidsEmoji.js";

const KidsLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("kids-theme");
    return () => {
      document.body.classList.remove("kids-theme");
    };
  }, []);

  const name = GetDisplayName();
  const onLogout = async () => {
    const refresh = GetTokens()?.RefreshToken;
    try {
      if (refresh) {
        await Logout({ RefreshToken: refresh });
      }
    } catch (error) {
      // ignore logout failures
    }
    ClearTokens();
    navigate("/login", { replace: true });
  };

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
      <footer className="kids-footer">
        <nav className="kids-footer-links" aria-label="Kids navigation">
          <NavLink
            to="/kids"
            end
            className={({ isActive }) =>
              `kids-text-button kids-footer-link${isActive ? " is-active" : ""}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/kids/history"
            className={({ isActive }) =>
              `kids-text-button kids-footer-link${isActive ? " is-active" : ""}`
            }
          >
            History
          </NavLink>
          <NavLink
            to="/kids/notifications"
            className={({ isActive }) =>
              `kids-text-button kids-footer-link${isActive ? " is-active" : ""}`
            }
          >
            Notifications
          </NavLink>
        </nav>
        <button type="button" className="kids-text-button kids-footer-logout" onClick={onLogout}>
          Log out
        </button>
      </footer>
    </div>
  );
};

export default KidsLayout;
