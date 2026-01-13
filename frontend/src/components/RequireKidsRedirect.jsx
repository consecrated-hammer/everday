import { Navigate, useLocation } from "react-router-dom";

import { IsKid } from "../lib/authStorage.js";

const RequireKidsRedirect = ({ children }) => {
  const location = useLocation();
  const isKid = IsKid();
  if (!isKid) {
    return children;
  }
  if (!location.pathname.startsWith("/kids")) {
    return <Navigate to="/kids" replace />;
  }
  return children;
};

export default RequireKidsRedirect;
