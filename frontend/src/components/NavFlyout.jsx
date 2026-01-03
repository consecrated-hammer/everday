import { NavLink } from "react-router-dom";

import Icon from "./Icon.jsx";
import { NavItems } from "../lib/navItems.js";

const IsNavActive = (item, pathname) => {
  if (item.Path === "/") {
    return pathname === "/";
  }
  return item.MatchPrefixes.some((prefix) => pathname.startsWith(prefix));
};

const NavFlyout = ({ open, pathname, onClose, firstItemRef }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="nav-flyout" role="menu" aria-label="Primary navigation">
      {NavItems.map((item, index) => {
        const isActive = IsNavActive(item, pathname);
        return (
          <NavLink
            key={item.Path}
            to={item.Path}
            className={`nav-flyout-item${isActive ? " is-active" : ""}`}
            onClick={onClose}
            ref={index === 0 ? firstItemRef : null}
            role="menuitem"
          >
            <Icon name={item.Icon} className="icon" />
            <span>{item.Label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};

export default NavFlyout;
