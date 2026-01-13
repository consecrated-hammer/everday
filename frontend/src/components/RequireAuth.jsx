import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { EnsureFreshTokens } from "../lib/apiClient.js";
import { GetTokens } from "../lib/authStorage.js";

const RequireAuth = ({ children }) => {
  const location = useLocation();
  const [authVersion, setAuthVersion] = useState(0);
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const onAuthChange = () => setAuthVersion((prev) => prev + 1);
    window.addEventListener("auth:changed", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setAuthVersion((prev) => prev + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("auth:changed", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const checkAuth = async () => {
      setIsChecking(true);
      const tokens = GetTokens();
      if (!tokens?.AccessToken) {
        if (!isCancelled) {
          setIsAuthed(false);
          setIsChecking(false);
        }
        return;
      }

      try {
        const refreshed = await EnsureFreshTokens();
        const nextTokens = refreshed || GetTokens();
        if (!isCancelled) {
          setIsAuthed(Boolean(nextTokens?.AccessToken));
        }
      } catch (error) {
        if (!isCancelled) {
          setIsAuthed(false);
        }
      } finally {
        if (!isCancelled) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();
    return () => {
      isCancelled = true;
    };
  }, [authVersion]);

  if (isChecking) {
    return null;
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default RequireAuth;
