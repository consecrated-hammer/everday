import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ForgotPassword, Login as LoginRequest } from "../../lib/authApi.js";
import { SetTokens } from "../../lib/authStorage.js";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ Username: "", Password: "" });
  const [forgotForm, setForgotForm] = useState({ Identifier: "" });
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setNotice("");
    try {
      const tokens = await LoginRequest(form);
      SetTokens({ ...tokens, Username: tokens.Username || form.Username });
      const isKid =
        tokens.Role === "Kid" ||
        (tokens.Roles || []).some(
          (role) => role.ModuleName === "kids" && role.Role === "Kid"
        );
      navigate(isKid ? "/kids" : "/", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setStatus("idle");
    }
  };

  const onForgotChange = (event) => {
    const { name, value } = event.target;
    setForgotForm((prev) => ({ ...prev, [name]: value }));
  };

  const onForgotSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setNotice("");
    try {
      await ForgotPassword({ Identifier: forgotForm.Identifier });
      setNotice("If the account has an email on file, a reset link is on the way.");
      setForgotForm({ Identifier: "" });
    } catch (err) {
      setError(err?.message || "Unable to send reset link.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <p className="eyebrow">Everday</p>
        {mode === "login" ? (
          <>
            <h1>Sign in</h1>
            <p className="lede">Use your household credentials to continue.</p>
            <form className="form-grid" onSubmit={onSubmit}>
              <label>
                <span>Username</span>
                <input name="Username" value={form.Username} onChange={onChange} required />
              </label>
              <label>
                <span>Password</span>
                <input name="Password" type="password" value={form.Password} onChange={onChange} required />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Signing in..." : "Sign in"}
                </button>
                <button type="button" className="text-button" onClick={() => setMode("forgot")}>
                  Forgot login
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1>Forgot login</h1>
            <p className="lede">
              Enter your username or email. If no email is on file, we cannot send a reset link.
            </p>
            <form className="form-grid" onSubmit={onForgotSubmit}>
              <label>
                <span>Username or email</span>
                <input
                  name="Identifier"
                  value={forgotForm.Identifier}
                  onChange={onForgotChange}
                  required
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Sending..." : "Send reset link"}
                </button>
                <button type="button" className="text-button" onClick={() => setMode("login")}>
                  Back to sign in
                </button>
              </div>
            </form>
          </>
        )}
        {notice ? <p className="form-note">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
};

export default Login;
