import { Navigate, useLocation } from "react-router-dom";

import { HasModuleRole } from "../lib/authStorage.js";

const RequireKidsOnly = ({ children }) => {
  const location = useLocation();
  const isKid = HasModuleRole("kids", "Kid");
  if (!isKid) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default RequireKidsOnly;
