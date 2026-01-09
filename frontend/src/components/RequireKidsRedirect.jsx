import { Navigate, useLocation } from "react-router-dom";

import { HasModuleRole } from "../lib/authStorage.js";

const RequireKidsRedirect = ({ children }) => {
  const location = useLocation();
  const isKid = HasModuleRole("kids", "Kid");
  if (!isKid) {
    return children;
  }
  if (!location.pathname.startsWith("/kids")) {
    return <Navigate to="/kids" replace />;
  }
  return children;
};

export default RequireKidsRedirect;
