import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { GetTokens } from "../lib/authStorage.js";

const RequireAuth = ({ children }) => {
  const location = useLocation();
  const [, setAuthVersion] = useState(0);

  useEffect(() => {
    const onAuthChange = () => setAuthVersion((prev) => prev + 1);
    window.addEventListener("auth:changed", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("auth:changed", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const tokens = GetTokens();
  if (!tokens?.AccessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default RequireAuth;
