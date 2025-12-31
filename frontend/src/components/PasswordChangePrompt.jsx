import { useState } from "react";

import { RequestJson } from "../lib/apiClient.js";
import { GetTokens, SetTokens } from "../lib/authStorage.js";

const PasswordChangePrompt = () => {
  const tokens = GetTokens();
  const [form, setForm] = useState({ CurrentPassword: "", NewPassword: "", ConfirmPassword: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  if (!tokens?.RequirePasswordChange) {
    return null;
  }

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.NewPassword !== form.ConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setStatus("saving");
      await RequestJson("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          CurrentPassword: form.CurrentPassword,
          NewPassword: form.NewPassword
        })
      });
      SetTokens({ ...tokens, RequirePasswordChange: false });
    } catch (err) {
      setError(err?.message || "Failed to update password");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3>Update your password</h3>
        </div>
        <p>Please change your password now to keep your account secure.</p>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            <span>Current password</span>
            <input
              type="password"
              name="CurrentPassword"
              value={form.CurrentPassword}
              onChange={onChange}
              required
            />
          </label>
          <label>
            <span>New password</span>
            <input
              type="password"
              name="NewPassword"
              value={form.NewPassword}
              onChange={onChange}
              required
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              name="ConfirmPassword"
              value={form.ConfirmPassword}
              onChange={onChange}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
};

export default PasswordChangePrompt;
