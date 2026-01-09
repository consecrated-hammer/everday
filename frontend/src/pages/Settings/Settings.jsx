import { useEffect, useState } from "react";

import {
  CreateUser,
  FetchUsers,
  UpdateUserPassword,
  UpdateUserProfile,
  UpdateUserRole
} from "../../lib/settingsApi.js";
import {
  FetchHealthProfile,
  FetchHealthSettings,
  UpdateHealthProfile,
  UpdateHealthSettings
} from "../../lib/healthApi.js";
import { GetTokens, GetUserId, SetTokens } from "../../lib/authStorage.js";
import { GetUiSettings, SetUiSettings } from "../../lib/uiSettings.js";

const RoleOptions = ["Admin", "Edit", "Editor", "User", "ReadOnly", "Kid"];
const ModuleOptions = ["budget", "health", "kids", "settings"];
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
const ActivityOptions = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly_active", label: "Lightly active" },
  { value: "moderately_active", label: "Moderately active" },
  { value: "very_active", label: "Very active" },
  { value: "extra_active", label: "Extra active" }
];
const EmptyHealthProfile = {
  FirstName: "",
  LastName: "",
  Email: "",
  BirthDate: "",
  HeightCm: "",
  WeightKg: "",
  ActivityLevel: ""
};
const EmptyHealthTargets = {
  DailyCalorieTarget: "",
  ProteinTargetMin: "",
  ProteinTargetMax: "",
  StepTarget: "",
  StepKcalFactor: "",
  FibreTarget: "",
  CarbsTarget: "",
  FatTarget: "",
  SaturatedFatTarget: "",
  SugarTarget: "",
  SodiumTarget: "",
  ShowProteinOnToday: true,
  ShowStepsOnToday: true,
  ShowFibreOnToday: false,
  ShowCarbsOnToday: false,
  ShowFatOnToday: false,
  ShowSaturatedFatOnToday: false,
  ShowSugarOnToday: false,
  ShowSodiumOnToday: false
};

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ NewPassword: "", ConfirmPassword: "" });
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileForm, setProfileForm] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    DiscordHandle: ""
  });
  const [healthProfile, setHealthProfile] = useState(EmptyHealthProfile);
  const [healthTargets, setHealthTargets] = useState(EmptyHealthTargets);
  const [healthStatus, setHealthStatus] = useState("idle");
  const [healthError, setHealthError] = useState("");
  const [uiSettings, setUiSettings] = useState(() => GetUiSettings());
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    Username: "",
    Password: "",
    FirstName: "",
    LastName: "",
    Email: "",
    DiscordHandle: "",
    RequirePasswordChange: false
  });

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

  const onNewUserChange = (event) => {
    const { name, value, type, checked } = event.target;
    setNewUserForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onCreateUser = async (event) => {
    event.preventDefault();
    if (!newUserForm.Username || !newUserForm.Password) {
      setError("Username and password are required.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await CreateUser({
        Username: newUserForm.Username,
        Password: newUserForm.Password,
        FirstName: newUserForm.FirstName || null,
        LastName: newUserForm.LastName || null,
        Email: newUserForm.Email || null,
        DiscordHandle: newUserForm.DiscordHandle || null,
        RequirePasswordChange: newUserForm.RequirePasswordChange
      });
      setNewUserForm({
        Username: "",
        Password: "",
        FirstName: "",
        LastName: "",
        Email: "",
        DiscordHandle: "",
        RequirePasswordChange: false
      });
      setShowAddUser(false);
      await loadUsers();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to create user");
    } finally {
      setStatus("ready");
    }
  };

  const loadHealthSettings = async () => {
    try {
      setHealthStatus("loading");
      setHealthError("");
      const [settings, profile] = await Promise.all([
        FetchHealthSettings(),
        FetchHealthProfile()
      ]);
      setHealthTargets({
        ...EmptyHealthTargets,
        ...settings.Targets,
        FibreTarget: settings.Targets.FibreTarget ?? "",
        CarbsTarget: settings.Targets.CarbsTarget ?? "",
        FatTarget: settings.Targets.FatTarget ?? "",
        SaturatedFatTarget: settings.Targets.SaturatedFatTarget ?? "",
        SugarTarget: settings.Targets.SugarTarget ?? "",
        SodiumTarget: settings.Targets.SodiumTarget ?? ""
      });
      setHealthProfile({
        ...EmptyHealthProfile,
        FirstName: profile.FirstName || "",
        LastName: profile.LastName || "",
        Email: profile.Email || "",
        BirthDate: profile.BirthDate || "",
        HeightCm: profile.HeightCm || "",
        WeightKg: profile.WeightKg || "",
        ActivityLevel: profile.ActivityLevel || ""
      });
      setHealthStatus("ready");
    } catch (err) {
      setHealthStatus("error");
      setHealthError(err?.message || "Failed to load health settings");
    }
  };

  useEffect(() => {
    loadHealthSettings();
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

  const onHealthProfileChange = (event) => {
    const { name, value } = event.target;
    setHealthProfile((prev) => ({ ...prev, [name]: value }));
  };

  const onHealthTargetsChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setHealthTargets((prev) => ({ ...prev, [name]: nextValue }));
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

  const saveHealthProfile = async (event) => {
    event.preventDefault();
    try {
      setHealthStatus("saving");
      setHealthError("");
      await UpdateHealthProfile({
        FirstName: healthProfile.FirstName || null,
        LastName: healthProfile.LastName || null,
        Email: healthProfile.Email || null,
        BirthDate: healthProfile.BirthDate || null,
        HeightCm: healthProfile.HeightCm ? Number(healthProfile.HeightCm) : null,
        WeightKg: healthProfile.WeightKg ? Number(healthProfile.WeightKg) : null,
        ActivityLevel: healthProfile.ActivityLevel || null
      });
      await loadHealthSettings();
    } catch (err) {
      setHealthStatus("error");
      setHealthError(err?.message || "Failed to update health profile");
    }
  };

  const saveHealthTargets = async (event) => {
    event.preventDefault();
    try {
      setHealthStatus("saving");
      setHealthError("");
      await UpdateHealthSettings({
        DailyCalorieTarget: Number(healthTargets.DailyCalorieTarget || 0),
        ProteinTargetMin: Number(healthTargets.ProteinTargetMin || 0),
        ProteinTargetMax: Number(healthTargets.ProteinTargetMax || 0),
        StepTarget: Number(healthTargets.StepTarget || 0),
        StepKcalFactor: Number(healthTargets.StepKcalFactor || 0),
        FibreTarget: healthTargets.FibreTarget ? Number(healthTargets.FibreTarget) : null,
        CarbsTarget: healthTargets.CarbsTarget ? Number(healthTargets.CarbsTarget) : null,
        FatTarget: healthTargets.FatTarget ? Number(healthTargets.FatTarget) : null,
        SaturatedFatTarget: healthTargets.SaturatedFatTarget
          ? Number(healthTargets.SaturatedFatTarget)
          : null,
        SugarTarget: healthTargets.SugarTarget ? Number(healthTargets.SugarTarget) : null,
        SodiumTarget: healthTargets.SodiumTarget ? Number(healthTargets.SodiumTarget) : null,
        ShowProteinOnToday: healthTargets.ShowProteinOnToday,
        ShowStepsOnToday: healthTargets.ShowStepsOnToday,
        ShowFibreOnToday: healthTargets.ShowFibreOnToday,
        ShowCarbsOnToday: healthTargets.ShowCarbsOnToday,
        ShowFatOnToday: healthTargets.ShowFatOnToday,
        ShowSaturatedFatOnToday: healthTargets.ShowSaturatedFatOnToday,
        ShowSugarOnToday: healthTargets.ShowSugarOnToday,
        ShowSodiumOnToday: healthTargets.ShowSodiumOnToday
      });
      await loadHealthSettings();
    } catch (err) {
      setHealthStatus("error");
      setHealthError(err?.message || "Failed to update health targets");
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
          <button
            type="button"
            className={`settings-nav-item${activeSection === "appearance" ? " is-active" : ""}`}
            onClick={() => setActiveSection("appearance")}
          >
            Appearance
          </button>
          <button
            type="button"
            className={`settings-nav-item${activeSection === "health" ? " is-active" : ""}`}
            onClick={() => setActiveSection("health")}
          >
            Health
          </button>
          <p className="settings-nav-title">Workspace</p>
          <button
            type="button"
            className={`settings-nav-item${activeSection === "access" ? " is-active" : ""}`}
            onClick={() => setActiveSection("access")}
          >
            User profiles
          </button>
        </aside>
        <section className="settings-content">
          {activeSection === null ? (
            <p className="form-note">Select a section to view settings.</p>
          ) : null}
          {activeSection === "appearance" ? (
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
          ) : null}

          {activeSection === "health" ? (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3>Health</h3>
                <p>Manage your health profile and daily targets.</p>
              </div>
              {healthError ? <p className="form-error">{healthError}</p> : null}
              {healthStatus === "loading" ? (
                <p>Loading health settings...</p>
              ) : (
                <div className="settings-health">
                  <div className="settings-subsection">
                    <div className="settings-subsection-header">
                      <h4>Profile</h4>
                      <p>Keep your metrics up to date.</p>
                    </div>
                    <form className="form-grid" onSubmit={saveHealthProfile}>
                      <label>
                        Birth date
                        <input
                          type="date"
                          name="BirthDate"
                          value={healthProfile.BirthDate}
                          onChange={onHealthProfileChange}
                        />
                      </label>
                      <label>
                        Height (cm)
                        <input
                          type="number"
                          name="HeightCm"
                          value={healthProfile.HeightCm}
                          onChange={onHealthProfileChange}
                        />
                      </label>
                      <label>
                        Weight (kg)
                        <input
                          type="number"
                          step="0.1"
                          name="WeightKg"
                          value={healthProfile.WeightKg}
                          onChange={onHealthProfileChange}
                        />
                      </label>
                      <label>
                        Activity level
                        <select
                          name="ActivityLevel"
                          value={healthProfile.ActivityLevel}
                          onChange={onHealthProfileChange}
                        >
                          <option value="">Select</option>
                          {ActivityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-actions">
                        <button type="submit" disabled={healthStatus === "saving"}>
                          {healthStatus === "saving" ? "Saving..." : "Save profile"}
                        </button>
                      </div>
                    </form>
                  </div>
                  <div className="settings-subsection">
                    <div className="settings-subsection-header">
                      <h4>Targets</h4>
                      <p>Set calorie, protein, and step goals for today.</p>
                    </div>
                    <form className="form-grid" onSubmit={saveHealthTargets}>
                      <label>
                        Daily calories
                        <input
                          name="DailyCalorieTarget"
                          type="number"
                          value={healthTargets.DailyCalorieTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Protein min (g)
                        <input
                          name="ProteinTargetMin"
                          type="number"
                          step="0.1"
                          value={healthTargets.ProteinTargetMin}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Protein max (g)
                        <input
                          name="ProteinTargetMax"
                          type="number"
                          step="0.1"
                          value={healthTargets.ProteinTargetMax}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Step target
                        <input
                          name="StepTarget"
                          type="number"
                          value={healthTargets.StepTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Step kcal factor
                        <input
                          name="StepKcalFactor"
                          type="number"
                          step="0.01"
                          value={healthTargets.StepKcalFactor}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Fibre target
                        <input
                          name="FibreTarget"
                          type="number"
                          step="0.1"
                          value={healthTargets.FibreTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Carbs target
                        <input
                          name="CarbsTarget"
                          type="number"
                          step="0.1"
                          value={healthTargets.CarbsTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Fat target
                        <input
                          name="FatTarget"
                          type="number"
                          step="0.1"
                          value={healthTargets.FatTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Sat fat target
                        <input
                          name="SaturatedFatTarget"
                          type="number"
                          step="0.1"
                          value={healthTargets.SaturatedFatTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Sugar target
                        <input
                          name="SugarTarget"
                          type="number"
                          step="0.1"
                          value={healthTargets.SugarTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <label>
                        Sodium target
                        <input
                          name="SodiumTarget"
                          type="number"
                          step="0.1"
                          value={healthTargets.SodiumTarget}
                          onChange={onHealthTargetsChange}
                        />
                      </label>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show protein on Today</span>
                        <input
                          type="checkbox"
                          name="ShowProteinOnToday"
                          checked={healthTargets.ShowProteinOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show steps on Today</span>
                        <input
                          type="checkbox"
                          name="ShowStepsOnToday"
                          checked={healthTargets.ShowStepsOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show fibre on Today</span>
                        <input
                          type="checkbox"
                          name="ShowFibreOnToday"
                          checked={healthTargets.ShowFibreOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show carbs on Today</span>
                        <input
                          type="checkbox"
                          name="ShowCarbsOnToday"
                          checked={healthTargets.ShowCarbsOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show fat on Today</span>
                        <input
                          type="checkbox"
                          name="ShowFatOnToday"
                          checked={healthTargets.ShowFatOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show saturated fat on Today</span>
                        <input
                          type="checkbox"
                          name="ShowSaturatedFatOnToday"
                          checked={healthTargets.ShowSaturatedFatOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show sugar on Today</span>
                        <input
                          type="checkbox"
                          name="ShowSugarOnToday"
                          checked={healthTargets.ShowSugarOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show sodium on Today</span>
                        <input
                          type="checkbox"
                          name="ShowSodiumOnToday"
                          checked={healthTargets.ShowSodiumOnToday}
                          onChange={onHealthTargetsChange}
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" disabled={healthStatus === "saving"}>
                          {healthStatus === "saving" ? "Saving..." : "Save targets"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "access" ? (
            <div className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-header-row">
                  <div>
                    <h3>User profiles</h3>
                    <p>Manage logins, roles, profiles, and password resets.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowAddUser((prev) => !prev)}
                  >
                    {showAddUser ? "Close add user" : "Add new user"}
                  </button>
                </div>
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              {status === "loading" ? (
                <p>Loading users...</p>
              ) : (
                <div className="settings-access">
                  {showAddUser ? (
                    <div className="settings-subsection">
                      <div className="settings-subsection-header">
                        <h4>Add user</h4>
                        <p>Create a login, then assign module roles below.</p>
                      </div>
                      <form className="form-grid" onSubmit={onCreateUser}>
                        <label>
                          Username
                          <input
                            name="Username"
                            value={newUserForm.Username}
                            onChange={onNewUserChange}
                            required
                          />
                        </label>
                        <label>
                          Password
                          <input
                            name="Password"
                            type="password"
                            value={newUserForm.Password}
                            onChange={onNewUserChange}
                            required
                          />
                        </label>
                        <label>
                          First name
                          <input
                            name="FirstName"
                            value={newUserForm.FirstName}
                            onChange={onNewUserChange}
                          />
                        </label>
                        <label>
                          Last name
                          <input
                            name="LastName"
                            value={newUserForm.LastName}
                            onChange={onNewUserChange}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            name="Email"
                            type="email"
                            value={newUserForm.Email}
                            onChange={onNewUserChange}
                          />
                        </label>
                        <label>
                          Discord
                          <input
                            name="DiscordHandle"
                            value={newUserForm.DiscordHandle}
                            onChange={onNewUserChange}
                          />
                        </label>
                        <div className="form-switch-row">
                          <span className="form-switch-label">
                            Require password change on first login
                          </span>
                          <input
                            type="checkbox"
                            name="RequirePasswordChange"
                            checked={newUserForm.RequirePasswordChange}
                            onChange={onNewUserChange}
                          />
                        </div>
                        <div className="form-actions">
                          <button type="submit" disabled={status === "saving"}>
                            {status === "saving" ? "Saving..." : "Create user"}
                          </button>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setShowAddUser(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                  <div className="settings-subsection">
                    <div className="settings-subsection-header">
                      <h4>Users</h4>
                      <p>Review roles, profiles, and password resets.</p>
                    </div>
                    <div className="settings-users">
                      {users.map((user) => {
                        const displayName = [user.FirstName, user.LastName].filter(Boolean).join(" ");
                        return (
                          <div key={user.Id} className="settings-user-card">
                            <div className="settings-user-header">
                              <div>
                                <h4>{user.Username}</h4>
                                <p className="settings-user-subtitle">
                                  Id {user.Id}
                                  {displayName ? ` · ${displayName}` : ""}
                                </p>
                              </div>
                              <div className="settings-user-actions">
                                <button
                                  type="button"
                                  className="button-secondary"
                                  onClick={() => onOpenProfileModal(user)}
                                >
                                  Edit profile
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenPasswordModal(user)}
                                >
                                  Reset password
                                </button>
                                {user.RequirePasswordChange ? (
                                  <span className="badge">Reset required</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="settings-user-meta">
                              <span>{user.Email || "No email"}</span>
                              <span>{user.DiscordHandle || "No Discord"}</span>
                            </div>
                            <div className="settings-role-pills">
                              {ModuleOptions.map((module) => {
                                const current = user.Roles.find((role) => role.ModuleName === module);
                                return (
                                  <span key={`${user.Id}-${module}`} className="settings-role-pill">
                                    {module}: {current?.Role || "ReadOnly"}
                                  </span>
                                );
                              })}
                            </div>
                            <details className="settings-role-details">
                              <summary>Manage roles</summary>
                              <div className="settings-role-grid">
                                {ModuleOptions.map((module) => {
                                  const current = user.Roles.find((role) => role.ModuleName === module);
                                  return (
                                    <label key={`${user.Id}-${module}`}>
                                      <span>{module}</span>
                                      <select
                                        value={current?.Role || "ReadOnly"}
                                        onChange={(event) =>
                                          onRoleChange(user.Id, module, event.target.value)
                                        }
                                        disabled={status === "saving"}
                                      >
                                        {RoleOptions.map((role) => (
                                          <option key={role} value={role}>
                                            {role}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  );
                                })}
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
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
