import { Navigate, useLocation } from "react-router-dom";

import { GetTokens } from "../lib/authStorage.js";

const RequireAuth = ({ children }) => {
  const location = useLocation();
  const tokens = GetTokens();
  if (!tokens?.AccessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default RequireAuth;
