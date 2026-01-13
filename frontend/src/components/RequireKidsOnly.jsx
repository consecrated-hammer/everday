import { Navigate, useLocation } from "react-router-dom";

import { IsKid } from "../lib/authStorage.js";

const RequireKidsOnly = ({ children }) => {
  const location = useLocation();
  const isKid = IsKid();
  if (!isKid) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default RequireKidsOnly;
