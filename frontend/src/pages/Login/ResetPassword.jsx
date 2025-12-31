import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ResetPassword as ResetPasswordRequest } from "../../lib/authApi.js";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const navigate = useNavigate();
  const [form, setForm] = useState({ NewPassword: "", ConfirmPassword: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (form.NewPassword !== form.ConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setStatus("saving");
      await ResetPasswordRequest({ Token: token, NewPassword: form.NewPassword });
      setNotice("Password updated. You can sign in now.");
      setForm({ NewPassword: "", ConfirmPassword: "" });
      navigate("/login");
    } catch (err) {
      setError(err?.message || "Unable to reset password.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <p className="eyebrow">Everday</p>
        <h1>Reset password</h1>
        <p className="lede">Set a new password for your account.</p>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            <span>New password</span>
            <input
              name="NewPassword"
              type="password"
              value={form.NewPassword}
              onChange={onChange}
              required
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              name="ConfirmPassword"
              type="password"
              value={form.ConfirmPassword}
              onChange={onChange}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : "Update password"}
            </button>
          </div>
        </form>
        {notice ? <p className="form-note">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <Link className="text-button" to="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
