import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { EnsureFreshTokens } from "../lib/apiClient.js";
import { GetTokens } from "../lib/authStorage.js";
import { Logger } from "../lib/logger.js";

const RequireAuth = ({ children }) => {
  const location = useLocation();
  const [authVersion, setAuthVersion] = useState(0);
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [error, setError] = useState(null);
  const failsafeTimer = useRef(null);

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

    // Failsafe: force completion after 5 seconds to prevent indefinite blank screen
    if (failsafeTimer.current) {
      clearTimeout(failsafeTimer.current);
    }
    failsafeTimer.current = setTimeout(() => {
      if (!isCancelled) {
        Logger.Warn("RequireAuth check exceeded timeout, forcing completion", {
          authVersion,
          hadTokens: Boolean(GetTokens()?.AccessToken)
        });
        setIsChecking(false);
        setError("Authentication check timed out. Please refresh or try logging in again.");
      }
    }, 5000);

    const checkAuth = async () => {
      try {
        Logger.Debug("RequireAuth: starting auth check", { authVersion });
        setIsChecking(true);
        setError(null);

        const tokens = GetTokens();
        if (!tokens?.AccessToken) {
          Logger.Debug("RequireAuth: no access token found");
          if (!isCancelled) {
            setIsAuthed(false);
            setIsChecking(false);
          }
          return;
        }

        Logger.Debug("RequireAuth: access token found, ensuring fresh");
        const refreshed = await EnsureFreshTokens();
        const nextTokens = refreshed || GetTokens();
        const hasValidToken = Boolean(nextTokens?.AccessToken);

        Logger.Debug("RequireAuth: token refresh complete", { hasValidToken });
        if (!isCancelled) {
          setIsAuthed(hasValidToken);
          setIsChecking(false);
        }
      } catch (err) {
        Logger.Error("RequireAuth: error during auth check", {
          error: err?.message || String(err),
          stack: err?.stack
        });
        if (!isCancelled) {
          setIsAuthed(false);
          setIsChecking(false);
          setError(err?.message || "Authentication check failed");
        }
      } finally {
        if (failsafeTimer.current) {
          clearTimeout(failsafeTimer.current);
          failsafeTimer.current = null;
        }
      }
    };

    checkAuth();

    return () => {
      isCancelled = true;
      if (failsafeTimer.current) {
        clearTimeout(failsafeTimer.current);
        failsafeTimer.current = null;
      }
    };
  }, [authVersion]);

  if (isChecking && !isAuthed) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--color-bg-base)",
        color: "var(--color-text-base)"
      }}>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "20px" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "3px solid var(--color-border-base)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px"
          }} />
          <p style={{ margin: "0 0 8px", fontSize: "14px" }}>Checking authentication...</p>
          {error && (
            <div style={{
              marginTop: "16px",
              padding: "12px",
              background: "var(--color-error-bg)",
              color: "var(--color-error)",
              borderRadius: "4px",
              fontSize: "13px"
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    Logger.Debug("RequireAuth: redirecting to login", { from: location.pathname });
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  Logger.Debug("RequireAuth: rendering protected content");
  return children;
};

export default RequireAuth;
