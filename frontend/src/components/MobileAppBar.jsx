import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import Icon from "./Icon.jsx";
import NavFlyout from "./NavFlyout.jsx";

const GetMobileTitle = (pathname) => {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/health/today")) return "Today";
  if (pathname.startsWith("/health/log")) return "Log";
  if (pathname.startsWith("/health/history")) return "History";
  if (pathname.startsWith("/health/insights")) return "Insights";
  if (pathname.startsWith("/health/foods")) return "Foods";
  if (pathname.startsWith("/health/settings")) return "Settings";
  if (pathname.startsWith("/budget/income")) return "Income";
  if (pathname.startsWith("/budget/expenses")) return "Expenses";
  if (pathname.startsWith("/budget/allocations")) return "Allocations";
  if (pathname.startsWith("/budget/settings")) return "Budget settings";
  if (pathname.startsWith("/budget")) return "Budget";
  if (pathname.startsWith("/agenda")) return "Agenda";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Home";
};

const MobileAppBar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const firstItemRef = useRef(null);
  const title = GetMobileTitle(location.pathname);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onClick = (event) => {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => {
    if (open && firstItemRef.current) {
      firstItemRef.current.focus();
    }
  }, [open]);

  return (
    <div className="mobile-app-bar" ref={wrapperRef}>
      <button
        type="button"
        className="mobile-app-bar-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open navigation"
        aria-expanded={open}
      >
        <Icon name="dashboard" className="icon" />
      </button>
      <div className="mobile-app-bar-title">{title}</div>
      <div className="mobile-app-bar-actions" />
      <NavFlyout
        open={open}
        pathname={location.pathname}
        onClose={() => setOpen(false)}
        firstItemRef={firstItemRef}
      />
    </div>
  );
};

export default MobileAppBar;
