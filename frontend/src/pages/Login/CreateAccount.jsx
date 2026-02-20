import { useState } from "react";
import { Link } from "react-router-dom";

import { Register as RegisterRequest } from "../../lib/authApi.js";

const EmptyForm = {
  Username: "",
  Password: "",
  FirstName: "",
  LastName: "",
  Email: "",
  DiscordHandle: ""
};

const CreateAccount = () => {
  const [form, setForm] = useState(EmptyForm);
  const [status, setStatus] = useState("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.Username || !form.Password) {
      setError("Username and password are required.");
      return;
    }

    try {
      setStatus("loading");
      setError("");
      setNotice("");
      const response = await RegisterRequest({
        Username: form.Username,
        Password: form.Password,
        FirstName: form.FirstName || null,
        LastName: form.LastName || null,
        Email: form.Email || null,
        DiscordHandle: form.DiscordHandle || null
      });
      setNotice(response?.Message || "Account request submitted.");
      setForm(EmptyForm);
    } catch (err) {
      setError(err?.message || "Failed to submit account request.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card login-card--wide">
        <p className="eyebrow">Everday</p>
        <h1>Create account</h1>
        <p className="lede">New accounts are reviewed and approved by a parent before sign in is enabled.</p>
        <ol className="login-instructions">
          <li>Complete this request form and submit it.</li>
          <li>A parent signs in and opens Settings, then Users.</li>
          <li>The parent approves your account and confirms your role.</li>
          <li>After approval, return to sign in with your username and password.</li>
        </ol>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            <span>Username</span>
            <input name="Username" value={form.Username} onChange={onChange} required />
          </label>
          <label>
            <span>Password</span>
            <input
              name="Password"
              type="password"
              value={form.Password}
              onChange={onChange}
              required
            />
          </label>
          <label>
            <span>First name</span>
            <input name="FirstName" value={form.FirstName} onChange={onChange} />
          </label>
          <label>
            <span>Last name</span>
            <input name="LastName" value={form.LastName} onChange={onChange} />
          </label>
          <label>
            <span>Email</span>
            <input name="Email" type="email" value={form.Email} onChange={onChange} />
          </label>
          <label>
            <span>Discord handle</span>
            <input name="DiscordHandle" value={form.DiscordHandle} onChange={onChange} />
          </label>
          <div className="form-actions login-links">
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Submitting..." : "Submit request"}
            </button>
            <Link className="text-button" to="/login">
              Back to sign in
            </Link>
          </div>
        </form>
        {notice ? <p className="form-note">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
};

export default CreateAccount;
