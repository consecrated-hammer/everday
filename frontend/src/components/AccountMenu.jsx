import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Logout } from "../lib/authApi.js";
import { ClearTokens, GetTokens } from "../lib/authStorage.js";
import { GetGravatarUrl } from "../lib/gravatar.js";

const AccountMenu = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const tokens = GetTokens() || {};
  const email = tokens.Email || "";
  const gravatar = GetGravatarUrl(email);
  const displayName = tokens.FirstName || tokens.Username || "Account";

  useEffect(() => {
    const onClick = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const onLogout = async () => {
    const refresh = tokens.RefreshToken;
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
    <div className="account-menu" ref={menuRef}>
      <button type="button" className="account-trigger" onClick={() => setOpen((prev) => !prev)}>
        {gravatar ? (
          <img src={gravatar} alt={displayName} className="account-avatar" />
        ) : (
          <span className="account-avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="account-name">{displayName}</span>
        <span className={`account-caret${open ? " is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="dropdown dropdown-right">
          <button type="button" className="dropdown-item" onClick={() => navigate("/settings")}>
            Settings
          </button>
          <button type="button" className="dropdown-item" onClick={onLogout}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default AccountMenu;
