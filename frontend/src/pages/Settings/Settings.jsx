import { useEffect, useState } from "react";

import {
  FetchUsers,
  UpdateUserPassword,
  UpdateUserProfile,
  UpdateUserRole
} from "../../lib/settingsApi.js";
import Icon from "../../components/Icon.jsx";
import { GetTokens, GetUserId, SetTokens } from "../../lib/authStorage.js";
import { GetUiSettings, SetUiSettings } from "../../lib/uiSettings.js";

const RoleOptions = ["Admin", "Edit", "ReadOnly"];
const ModuleOptions = ["budget", "settings"];
const ThemeOptions = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];
const IconOptions = [
  { value: "phosphor", label: "Phosphor" },
  { value: "material", label: "Material Symbols" },
  { value: "lucide", label: "Lucide" }
];

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ NewPassword: "", ConfirmPassword: "" });
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileForm, setProfileForm] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    DiscordHandle: ""
  });
  const [uiSettings, setUiSettings] = useState(() => GetUiSettings());

  const loadUsers = async () => {
    try {
      setStatus("loading");
      setError("");
      const data = await FetchUsers();
      setUsers(data);
      const currentUserId = GetUserId();
      if (currentUserId) {
        const current = data.find((entry) => entry.Id === currentUserId);
        if (current) {
          const tokens = GetTokens() || {};
          SetTokens({
            ...tokens,
            FirstName: current.FirstName,
            LastName: current.LastName,
            Email: current.Email,
            DiscordHandle: current.DiscordHandle,
            Username: current.Username
          });
        }
      }
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load users");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onRoleChange = async (userId, moduleName, role) => {
    try {
      setStatus("saving");
      setError("");
      const updated = await UpdateUserRole(userId, {
        ModuleName: moduleName,
        Role: role
      });
      setUsers((prev) => prev.map((user) => (user.Id === updated.Id ? updated : user)));
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update role");
    }
  };

  const onOpenPasswordModal = (user) => {
    setPasswordTarget(user);
    setPasswordForm({ NewPassword: "", ConfirmPassword: "" });
    setError("");
  };

  const onClosePasswordModal = () => {
    setPasswordTarget(null);
    setPasswordForm({ NewPassword: "", ConfirmPassword: "" });
  };

  const onPasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmitPassword = async (event) => {
    event.preventDefault();
    if (!passwordTarget) {
      return;
    }
    if (passwordForm.NewPassword !== passwordForm.ConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const updated = await UpdateUserPassword(passwordTarget.Id, {
        NewPassword: passwordForm.NewPassword
      });
      setUsers((prev) => prev.map((user) => (user.Id === updated.Id ? updated : user)));
      onClosePasswordModal();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update password");
    }
  };

  const onOpenProfileModal = (user) => {
    setProfileTarget(user);
    setProfileForm({
      FirstName: user.FirstName || "",
      LastName: user.LastName || "",
      Email: user.Email || "",
      DiscordHandle: user.DiscordHandle || ""
    });
    setError("");
  };

  const onCloseProfileModal = () => {
    setProfileTarget(null);
    setProfileForm({ FirstName: "", LastName: "", Email: "", DiscordHandle: "" });
  };

  const onProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmitProfile = async (event) => {
    event.preventDefault();
    if (!profileTarget) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const updated = await UpdateUserProfile(profileTarget.Id, profileForm);
      setUsers((prev) => prev.map((user) => (user.Id === updated.Id ? updated : user)));
      const currentUserId = GetUserId();
      if (currentUserId && updated.Id === currentUserId) {
        const tokens = GetTokens() || {};
        SetTokens({
          ...tokens,
          FirstName: updated.FirstName,
          LastName: updated.LastName,
          Email: updated.Email,
          DiscordHandle: updated.DiscordHandle,
          Username: updated.Username
        });
      }
      onCloseProfileModal();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update profile");
    }
  };

  const onUiChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    const updated = SetUiSettings({ [name]: nextValue });
    setUiSettings(updated);
  };

  return (
    <div className="module-panel">
      <header className="module-panel-header">
        <div>
          <h2>Settings</h2>
          <p>Manage user access and preferences.</p>
        </div>
      </header>
      <div className="settings-layout">
        <aside className="settings-nav">
          <p className="settings-nav-title">Account</p>
          <button type="button" className="settings-nav-item is-active">
            General
          </button>
          <button type="button" className="settings-nav-item">
            Profile
          </button>
          <button type="button" className="settings-nav-item">
            Security
          </button>
          <p className="settings-nav-title">Workspace</p>
          <button type="button" className="settings-nav-item">
            Access
          </button>
        </aside>
        <section className="settings-content">
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>Appearance</h3>
              <p>Control the theme, icons, and number formatting.</p>
            </div>
            <div className="settings-list">
              <div className="settings-item">
                <div>
                  <h4>Theme</h4>
                  <p>Choose light, dark, or match your device.</p>
                </div>
                <select name="Theme" value={uiSettings.Theme} onChange={onUiChange}>
                  {ThemeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-item">
                <div>
                  <h4>Icon set</h4>
                  <p>Pick an icon style for the entire app.</p>
                </div>
                <select name="IconSet" value={uiSettings.IconSet} onChange={onUiChange}>
                  {IconOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-item">
                <div>
                  <h4>Show decimals</h4>
                  <p>Display cents in currency amounts.</p>
                </div>
                <label className="settings-switch-inline">
                  <input
                    type="checkbox"
                    name="ShowDecimals"
                    checked={uiSettings.ShowDecimals}
                    onChange={onUiChange}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-header">
              <h3>User access</h3>
              <p>Assign roles, update profiles, and reset passwords.</p>
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            {status === "loading" ? (
              <p>Loading users...</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>First name</th>
                      <th>Last name</th>
                      <th>Email</th>
                      <th>Discord</th>
                      {ModuleOptions.map((module) => (
                        <th key={module}>{module}</th>
                      ))}
                      <th>Profile</th>
                      <th>Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.Id}>
                        <td>{user.Username}</td>
                        <td>{user.FirstName || "-"}</td>
                        <td>{user.LastName || "-"}</td>
                        <td>{user.Email || "-"}</td>
                        <td>{user.DiscordHandle || "-"}</td>
                        {ModuleOptions.map((module) => {
                          const current = user.Roles.find((role) => role.ModuleName === module);
                          return (
                            <td key={`${user.Id}-${module}`}>
                              <select
                                value={current?.Role || "ReadOnly"}
                                onChange={(event) => onRoleChange(user.Id, module, event.target.value)}
                                disabled={status === "saving"}
                              >
                                {RoleOptions.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                        <td>
                          <div className="table-actions">
                            <button type="button" className="icon-button" onClick={() => onOpenProfileModal(user)} aria-label="Edit profile">
                              <Icon name="edit" className="icon" />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button type="button" onClick={() => onOpenPasswordModal(user)}>
                              Reset password
                            </button>
                            {user.RequirePasswordChange ? <span className="badge">Reset required</span> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
      {passwordTarget ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Reset password for {passwordTarget.Username}</h3>
              <button className="text-button" type="button" onClick={onClosePasswordModal}>
                Close
              </button>
            </div>
            <p>Set a temporary password. The user will be prompted to change it on next login.</p>
            <form className="form-grid" onSubmit={onSubmitPassword}>
              <label>
                <span>New password</span>
                <input
                  type="password"
                  name="NewPassword"
                  value={passwordForm.NewPassword}
                  onChange={onPasswordChange}
                  required
                />
              </label>
              <label>
                <span>Confirm new password</span>
                <input
                  type="password"
                  name="ConfirmPassword"
                  value={passwordForm.ConfirmPassword}
                  onChange={onPasswordChange}
                  required
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={status === "saving"}>
                  {status === "saving" ? "Saving..." : "Update password"}
                </button>
                <button className="button-secondary" type="button" onClick={onClosePasswordModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {profileTarget ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit profile for {profileTarget.Username}</h3>
              <button className="text-button" type="button" onClick={onCloseProfileModal}>
                Close
              </button>
            </div>
            <form className="form-grid" onSubmit={onSubmitProfile}>
              <label>
                <span>First name</span>
                <input name="FirstName" value={profileForm.FirstName} onChange={onProfileChange} />
              </label>
              <label>
                <span>Last name</span>
                <input name="LastName" value={profileForm.LastName} onChange={onProfileChange} />
              </label>
              <label>
                <span>Email</span>
                <input name="Email" type="email" value={profileForm.Email} onChange={onProfileChange} />
              </label>
              <label>
                <span>Discord</span>
                <input
                  name="DiscordHandle"
                  value={profileForm.DiscordHandle}
                  onChange={onProfileChange}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={status === "saving"}>
                  {status === "saving" ? "Saving..." : "Save profile"}
                </button>
                <button className="button-secondary" type="button" onClick={onCloseProfileModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Settings;
