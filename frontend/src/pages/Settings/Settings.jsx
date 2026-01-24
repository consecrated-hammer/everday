import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router-dom";

import {
  CreateUser,
  FetchGoogleAuthUrl,
  FetchGoogleStatus,
  FetchUsers,
  UpdateUserPassword,
  UpdateUserProfile,
  UpdateUserRole
} from "../../lib/settingsApi.js";
import {
  FetchHealthProfile,
  FetchHealthSettings,
  FetchRecommendationHistory,
  GetAiRecommendations,
  RotateHaeApiKey,
  UpdateHealthProfile,
  UpdateHealthSettings
} from "../../lib/healthApi.js";
import {
  FetchTaskSettings,
  RunTaskOverdueNotifications,
  UpdateTaskSettings
} from "../../lib/tasksApi.js";
import { GetRole, GetTokens, GetUserId, SetTokens } from "../../lib/authStorage.js";
import { ResetDashboardLayout } from "../../lib/dashboardLayout.js";
import { GetUiSettings, SetUiSettings } from "../../lib/uiSettings.js";

const RoleOptions = ["Parent", "Kid"];
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
const GoalTypeOptions = [
  { value: "lose", label: "Lose weight" },
  { value: "maintain", label: "Maintain weight" },
  { value: "gain", label: "Gain weight" }
];
const BmiRangeOptions = [
  { key: "underweight", label: "Underweight (below 18.5)", min: 0, max: 18.4 },
  { key: "normal", label: "Normal (18.5 to 24.9)", min: 18.5, max: 24.9 },
  { key: "overweight", label: "Overweight (25 to 29.9)", min: 25, max: 29.9 },
  { key: "obese", label: "Obese (30 to 34.9)", min: 30, max: 34.9 },
  { key: "severe", label: "Severe obesity (35 to 39.9)", min: 35, max: 39.9 },
  { key: "extreme", label: "Extreme obesity (40+)", min: 40, max: 60 }
];
const GoalDurationOptions = [3, 6, 9, 12, 18, 24];
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

const ResolveUserTimeZone = () => {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const BuildTimeOptions = (stepMinutes = 15) => {
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    const date = new Date(2000, 0, 1, hours, mins);
    const label = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    options.push({ value, label });
  }
  return options;
};

const TimeOptions = BuildTimeOptions();

const BuildHealthTargetsState = (targets) => ({
  ...EmptyHealthTargets,
  ...targets,
  FibreTarget: targets.FibreTarget ?? "",
  CarbsTarget: targets.CarbsTarget ?? "",
  FatTarget: targets.FatTarget ?? "",
  SaturatedFatTarget: targets.SaturatedFatTarget ?? "",
  SugarTarget: targets.SugarTarget ?? "",
  SodiumTarget: targets.SodiumTarget ?? ""
});

const CalculateBmi = (weightKg, heightCm) => {
  const weight = Number(weightKg);
  const height = Number(heightCm);
  if (!weight || !height) return null;
  const meters = height / 100;
  if (!meters) return null;
  return weight / (meters * meters);
};

const FormatNumber = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return Number(value).toFixed(digits);
};

const FormatDate = (value) => {
  if (!value) return "--";
  const parsed =
    typeof value === "string" && value.length === 10
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString();
};

const FindBmiRangeForValue = (value) => {
  if (value === null || value === undefined) return null;
  return BmiRangeOptions.find((option) => value >= option.min && value <= option.max) || null;
};

const FindBmiRangeKey = (min, max) => {
  if (min === null || max === null || min === undefined || max === undefined) {
    return "normal";
  }
  const match = BmiRangeOptions.find(
    (option) => Math.abs(option.min - min) < 0.2 && Math.abs(option.max - max) < 0.2
  );
  return match ? match.key : "normal";
};

const AddMonthsToDate = (value, months) => {
  if (!value) return "";
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) return "";
  const month = base.getMonth();
  base.setMonth(month + Number(months || 0));
  return base.toISOString().slice(0, 10);
};

const CalculateDurationMonths = (startValue, endValue) => {
  if (!startValue || !endValue) return 6;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 6;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(1, months || 6);
};

const GetGoalTypeLabel = (value) => {
  const match = GoalTypeOptions.find((option) => option.value === value);
  return match ? match.label : value || "Goal";
};

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const { section } = useParams();
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
  const [healthAiStatus, setHealthAiStatus] = useState("idle");
  const [healthRecommendation, setHealthRecommendation] = useState(null);
  const [healthRecommendationHistory, setHealthRecommendationHistory] = useState([]);
  const [healthAutoTuneWeekly, setHealthAutoTuneWeekly] = useState(false);
  const [healthAutoTuneLastRunAt, setHealthAutoTuneLastRunAt] = useState(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [healthShowWeightChart, setHealthShowWeightChart] = useState(true);
  const [healthShowWeightProjection, setHealthShowWeightProjection] = useState(true);
  const [healthShowStepsChart, setHealthShowStepsChart] = useState(true);
  const [healthHaeConfigured, setHealthHaeConfigured] = useState(false);
  const [healthHaeLast4, setHealthHaeLast4] = useState("");
  const [healthHaeCreatedAt, setHealthHaeCreatedAt] = useState(null);
  const [healthHaeKey, setHealthHaeKey] = useState("");
  const [healthHaeKeyStatus, setHealthHaeKeyStatus] = useState("idle");
  const [healthHaeCopied, setHealthHaeCopied] = useState(false);
  const healthHaeCopyTimer = useRef(null);
  const [goalWizardOpen, setGoalWizardOpen] = useState(false);
  const [goalWizardStep, setGoalWizardStep] = useState(0);
  const [goalWizardStatus, setGoalWizardStatus] = useState("idle");
  const [goalWizardError, setGoalWizardError] = useState("");
  const [goalWizardPreview, setGoalWizardPreview] = useState(null);
  const [goalWizardAdjustments, setGoalWizardAdjustments] = useState(null);
  const [goalWizardForm, setGoalWizardForm] = useState({
    GoalType: "lose",
    BmiRangeKey: "normal",
    StartDate: "",
    DurationMonths: 6
  });
  const [uiSettings, setUiSettings] = useState(() => GetUiSettings());
  const [apiStatus, setApiStatus] = useState("checking");
  const [dbStatus, setDbStatus] = useState("checking");
  const [systemStatus, setSystemStatus] = useState("idle");
  const [dashboardNotice, setDashboardNotice] = useState("");
  const [googleAuthStatus, setGoogleAuthStatus] = useState("idle");
  const [googleAuthError, setGoogleAuthError] = useState("");
  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleStatusState, setGoogleStatusState] = useState("idle");
  const [googleStatusError, setGoogleStatusError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [taskSettings, setTaskSettings] = useState(null);
  const [taskSettingsForm, setTaskSettingsForm] = useState({
    OverdueReminderTime: "08:00",
    OverdueReminderTimeZone: ResolveUserTimeZone()
  });
  const [taskSettingsStatus, setTaskSettingsStatus] = useState("idle");
  const [taskSettingsError, setTaskSettingsError] = useState("");
  const [taskSettingsNotice, setTaskSettingsNotice] = useState("");
  const [taskOverdueRunStatus, setTaskOverdueRunStatus] = useState("idle");
  const [taskOverdueRunNotice, setTaskOverdueRunNotice] = useState("");
  const userTimeZone = useMemo(() => ResolveUserTimeZone(), []);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    Username: "",
    Password: "",
    FirstName: "",
    LastName: "",
    Email: "",
    DiscordHandle: "",
    Role: "Kid",
    RequirePasswordChange: false
  });
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8100";
  const settingsSections = [
    "appearance",
    "dashboard",
    "health",
    "tasks",
    "system",
    "integrations",
    "access"
  ];
  const activeSection = settingsSections.includes(section) ? section : null;
  const isParent = GetRole() === "Parent";
  const [searchParams, setSearchParams] = useSearchParams();

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
            Username: current.Username,
            Role: current.Role
          });
        }
      }
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load users");
    }
  };

  const loadSystemStatus = useCallback(async () => {
    try {
      setSystemStatus("loading");
      setApiStatus("checking");
      setDbStatus("checking");
      const response = await fetch(`${apiBaseUrl}/health`);
      const nextStatus = response.ok ? "ok" : "error";
      setApiStatus(nextStatus);
    } catch (error) {
      setApiStatus("error");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/health/db`);
      const body = await response.json();
      const nextStatus = response.ok && body.status === "ok" ? "ok" : "error";
      setDbStatus(nextStatus);
    } catch (error) {
      setDbStatus("error");
    } finally {
      setSystemStatus("ready");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeSection !== "system") {
      return;
    }
    loadSystemStatus();
  }, [activeSection, loadSystemStatus]);

  const loadGoogleStatus = useCallback(
    async (validate = false) => {
      try {
        setGoogleStatusState("loading");
        setGoogleStatusError("");
        const response = await FetchGoogleStatus(validate);
        setGoogleStatus(response || null);
        setGoogleStatusState("ready");
      } catch (err) {
        setGoogleStatusState("error");
        setGoogleStatusError(err?.message || "Failed to load Google status.");
      }
    },
    []
  );

  const loadTaskSettings = useCallback(async () => {
    try {
      setTaskSettingsStatus("loading");
      setTaskSettingsError("");
      const response = await FetchTaskSettings();
      setTaskSettings(response || null);
      setTaskSettingsForm({
        OverdueReminderTime: response?.OverdueReminderTime || "08:00",
        OverdueReminderTimeZone: userTimeZone
      });
      setTaskSettingsStatus("ready");
    } catch (err) {
      setTaskSettingsStatus("error");
      setTaskSettingsError(err?.message || "Failed to load task settings.");
    }
  }, [userTimeZone]);

  const onTaskSettingsChange = useCallback((event) => {
    const { name, value } = event.target;
    setTaskSettingsForm((current) => ({
      ...current,
      [name]: value
    }));
  }, []);

  const onTaskSettingsSave = useCallback(async () => {
    try {
      setTaskSettingsStatus("saving");
      setTaskSettingsError("");
      setTaskSettingsNotice("");
      const payload = {
        OverdueReminderTime: taskSettingsForm.OverdueReminderTime || null,
        OverdueReminderTimeZone: taskSettingsForm.OverdueReminderTimeZone || userTimeZone
      };
      const response = await UpdateTaskSettings(payload);
      setTaskSettings(response || null);
      setTaskSettingsNotice("Task settings saved.");
      setTaskSettingsStatus("ready");
    } catch (err) {
      setTaskSettingsStatus("error");
      setTaskSettingsError(err?.message || "Failed to save task settings.");
    }
  }, [taskSettingsForm, userTimeZone]);

  const onTaskOverdueRun = useCallback(async () => {
    try {
      setTaskOverdueRunStatus("loading");
      setTaskOverdueRunNotice("");
      const response = await RunTaskOverdueNotifications(true);
      const sent = response?.NotificationsSent ?? 0;
      const overdue = response?.OverdueTasks ?? 0;
      const users = response?.UsersProcessed ?? 0;
      setTaskOverdueRunNotice(
        `Sent ${sent} notification${sent === 1 ? "" : "s"} for ${overdue} overdue task${
          overdue === 1 ? "" : "s"
        } across ${users} user${users === 1 ? "" : "s"}.`
      );
      setTaskOverdueRunStatus("ready");
      await loadTaskSettings();
    } catch (err) {
      setTaskOverdueRunStatus("error");
      setTaskOverdueRunNotice(err?.message || "Failed to run overdue notifications.");
    }
  }, [loadTaskSettings]);

  useEffect(() => {
    if (activeSection !== "integrations") {
      return;
    }
    loadGoogleStatus(true);
  }, [activeSection, loadGoogleStatus]);

  useEffect(() => {
    if (activeSection !== "integrations") {
      return;
    }
    if (searchParams.get("connected") !== "google") {
      return;
    }
    setGoogleNotice("Google connected successfully.");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("connected");
    setSearchParams(nextParams, { replace: true });
  }, [activeSection, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeSection !== "tasks") {
      return;
    }
    loadTaskSettings();
  }, [activeSection, loadTaskSettings]);

  const onNewUserChange = (event) => {
    const { name, value, type, checked } = event.target;
    setNewUserForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onResetDashboardLayout = () => {
    if (!window.confirm("Reset your dashboard layout to the default arrangement?")) {
      return;
    }
    ResetDashboardLayout(GetUserId());
    setDashboardNotice("Dashboard layout reset. Return to the dashboard to see it.");
  };

  const onGoogleAuth = useCallback(async () => {
    if (!isParent || googleAuthStatus === "loading") {
      return;
    }
    try {
      setGoogleAuthStatus("loading");
      setGoogleAuthError("");
      const response = await FetchGoogleAuthUrl();
      const authUrl = response?.Url;
      if (!authUrl) {
        throw new Error("Google auth URL not available.");
      }
      window.location.assign(authUrl);
    } catch (err) {
      setGoogleAuthError(err?.message || "Failed to start Google sign in.");
      setGoogleAuthStatus("idle");
    }
  }, [googleAuthStatus, isParent]);

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
        Role: newUserForm.Role,
        RequirePasswordChange: newUserForm.RequirePasswordChange
      });
      setNewUserForm({
        Username: "",
        Password: "",
        FirstName: "",
        LastName: "",
        Email: "",
        DiscordHandle: "",
        Role: "Kid",
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
      const [settings, profile, history] = await Promise.all([
        FetchHealthSettings(),
        FetchHealthProfile(),
        FetchRecommendationHistory()
      ]);
      setHealthTargets(BuildHealthTargetsState(settings.Targets));
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
      setHealthAutoTuneWeekly(Boolean(settings.AutoTuneTargetsWeekly));
      setHealthAutoTuneLastRunAt(
        settings.LastAutoTuneAt ? new Date(settings.LastAutoTuneAt) : null
      );
      setHealthGoal(settings.Goal || null);
      setHealthShowWeightChart(settings.ShowWeightChartOnToday !== false);
      setHealthShowStepsChart(settings.ShowStepsChartOnToday !== false);
      setHealthShowWeightProjection(settings.ShowWeightProjectionOnToday !== false);
      setHealthHaeConfigured(Boolean(settings.HaeApiKeyConfigured));
      setHealthHaeLast4(settings.HaeApiKeyLast4 || "");
      setHealthHaeCreatedAt(settings.HaeApiKeyCreatedAt ? new Date(settings.HaeApiKeyCreatedAt) : null);
      setHealthHaeKey("");
      setHealthHaeKeyStatus("idle");
      setHealthHaeCopied(false);
      setHealthRecommendationHistory(history.Logs || []);
      setHealthStatus("ready");
    } catch (err) {
      setHealthStatus("error");
      setHealthError(err?.message || "Failed to load health settings");
    }
  };

  useEffect(() => {
    loadHealthSettings();
  }, []);

  const onRoleChange = async (userId, role) => {
    try {
      setStatus("saving");
      setError("");
      const updated = await UpdateUserRole(userId, {
        Role: role
      });
      setUsers((prev) => prev.map((user) => (user.Id === updated.Id ? updated : user)));
      const currentUserId = GetUserId();
      if (currentUserId && updated.Id === currentUserId) {
        const tokens = GetTokens() || {};
        SetTokens({ ...tokens, Role: updated.Role });
      }
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
          Username: updated.Username,
          Role: updated.Role
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
        ShowSodiumOnToday: healthTargets.ShowSodiumOnToday,
        ShowWeightChartOnToday: healthShowWeightChart,
        ShowStepsChartOnToday: healthShowStepsChart,
        ShowWeightProjectionOnToday: healthShowWeightProjection
      });
      await loadHealthSettings();
    } catch (err) {
      setHealthStatus("error");
      setHealthError(err?.message || "Failed to update health targets");
    }
  };

  const rotateHaeApiKey = async () => {
    try {
      setHealthHaeKeyStatus("loading");
      setHealthError("");
      const result = await RotateHaeApiKey();
      setHealthHaeKey(result.ApiKey || "");
      setHealthHaeLast4(result.Last4 || result.ApiKey?.slice(-4) || "");
      setHealthHaeCreatedAt(result.CreatedAt ? new Date(result.CreatedAt) : new Date());
      setHealthHaeConfigured(true);
      setHealthHaeCopied(false);
      setHealthHaeKeyStatus("ready");
    } catch (err) {
      setHealthHaeKeyStatus("error");
      setHealthError(err?.message || "Failed to rotate API key");
    }
  };

  const copyHaeKey = async () => {
    if (!healthHaeKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(healthHaeKey);
      setHealthHaeCopied(true);
    } catch (err) {
      setHealthError("Clipboard access failed. Copy the key manually.");
      return;
    }
    if (healthHaeCopyTimer.current) {
      clearTimeout(healthHaeCopyTimer.current);
    }
    healthHaeCopyTimer.current = setTimeout(() => {
      setHealthHaeCopied(false);
    }, 1800);
  };

  useEffect(() => {
    return () => {
      if (healthHaeCopyTimer.current) {
        clearTimeout(healthHaeCopyTimer.current);
      }
    };
  }, []);

  const runHealthRecommendation = async () => {
    try {
      setHealthAiStatus("loading");
      setHealthError("");
      const result = await GetAiRecommendations();
      setHealthRecommendation(result);
      if (result?.Goal) {
        setHealthGoal(result.Goal);
      }
      setHealthAiStatus("ready");
    } catch (err) {
      setHealthAiStatus("error");
      setHealthError(err?.message || "Failed to fetch AI targets");
    }
  };

  const applyHealthRecommendation = () => {
    if (!healthRecommendation) return;
    setHealthTargets((prev) => ({
      ...prev,
      DailyCalorieTarget: healthRecommendation.DailyCalorieTarget,
      ProteinTargetMin: healthRecommendation.ProteinTargetMin,
      ProteinTargetMax: healthRecommendation.ProteinTargetMax,
      FibreTarget: healthRecommendation.FibreTarget || "",
      CarbsTarget: healthRecommendation.CarbsTarget || "",
      FatTarget: healthRecommendation.FatTarget || "",
      SaturatedFatTarget: healthRecommendation.SaturatedFatTarget || "",
      SugarTarget: healthRecommendation.SugarTarget || "",
      SodiumTarget: healthRecommendation.SodiumTarget || ""
    }));
  };

  const updateHealthAutoTune = async (event) => {
    const nextValue = event.target.checked;
    const previousValue = healthAutoTuneWeekly;
    setHealthAutoTuneWeekly(nextValue);
    try {
      setHealthAiStatus("loading");
      setHealthError("");
      const updated = await UpdateHealthSettings({
        AutoTuneTargetsWeekly: nextValue
      });
      setHealthTargets(BuildHealthTargetsState(updated.Targets));
      setHealthAutoTuneWeekly(Boolean(updated.AutoTuneTargetsWeekly));
      setHealthAutoTuneLastRunAt(
        updated.LastAutoTuneAt ? new Date(updated.LastAutoTuneAt) : null
      );
      setHealthAiStatus("ready");
    } catch (err) {
      setHealthAutoTuneWeekly(previousValue);
      setHealthAiStatus("error");
      setHealthError(err?.message || "Failed to update auto-tune settings");
    }
  };

  const buildGoalFormDefaults = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (!healthGoal) {
      return {
        GoalType: "lose",
        BmiRangeKey: "normal",
        StartDate: today,
        DurationMonths: 6
      };
    }
    return {
      GoalType: healthGoal.GoalType || "lose",
      BmiRangeKey: FindBmiRangeKey(healthGoal.BmiMin, healthGoal.BmiMax),
      StartDate: healthGoal.StartDate || today,
      DurationMonths: CalculateDurationMonths(healthGoal.StartDate, healthGoal.EndDate)
    };
  };

  const openGoalWizard = () => {
    setGoalWizardForm(buildGoalFormDefaults());
    setGoalWizardStep(0);
    setGoalWizardPreview(null);
    setGoalWizardAdjustments(null);
    setGoalWizardError("");
    setGoalWizardStatus("idle");
    setGoalWizardOpen(true);
  };

  const closeGoalWizard = () => {
    setGoalWizardOpen(false);
    setGoalWizardError("");
    setGoalWizardPreview(null);
    setGoalWizardAdjustments(null);
  };

  const onGoalFormChange = (event) => {
    const { name, value } = event.target;
    setGoalWizardForm((prev) => ({
      ...prev,
      [name]: name === "DurationMonths" ? Number(value) : value
    }));
  };

  const onGoalAdjustmentChange = (event) => {
    const { name, value } = event.target;
    setGoalWizardAdjustments((prev) => ({
      ...(prev || {}),
      [name]: value
    }));
  };

  const buildGoalPayload = (applyGoal) => {
    const range =
      BmiRangeOptions.find((option) => option.key === goalWizardForm.BmiRangeKey) ||
      BmiRangeOptions[1];
    const payload = {
      GoalType: goalWizardForm.GoalType,
      BmiMin: range.min,
      BmiMax: range.max,
      StartDate: goalWizardForm.StartDate || undefined,
      DurationMonths: Number(goalWizardForm.DurationMonths || 6),
      ApplyGoal: applyGoal
    };
    if (applyGoal && goalWizardAdjustments) {
      const previewDaily = Number(goalWizardPreview?.DailyCalorieTarget);
      const previewTargetWeight = Number(goalWizardPreview?.Goal?.TargetWeightKg);
      const previewEndDate = goalWizardPreview?.Goal?.EndDate || "";
      const nextDaily = Number(goalWizardAdjustments.DailyCalorieTarget);
      if (Number.isFinite(nextDaily) && nextDaily !== previewDaily) {
        payload.DailyCalorieTargetOverride = nextDaily;
      }
      const nextTargetWeight = Number(goalWizardAdjustments.TargetWeightKg);
      if (Number.isFinite(nextTargetWeight) && nextTargetWeight !== previewTargetWeight) {
        payload.TargetWeightKgOverride = nextTargetWeight;
      }
      if (goalWizardAdjustments.EndDate && goalWizardAdjustments.EndDate !== previewEndDate) {
        payload.EndDateOverride = goalWizardAdjustments.EndDate;
      }
    }
    return payload;
  };

  const previewGoalRecommendation = async () => {
    try {
      setGoalWizardStatus("loading");
      setGoalWizardError("");
      const response = await GetAiRecommendations(buildGoalPayload(false));
      setGoalWizardPreview(response);
      if (response?.Goal) {
        setGoalWizardAdjustments({
          DailyCalorieTarget:
            response.DailyCalorieTarget !== null && response.DailyCalorieTarget !== undefined
              ? String(response.DailyCalorieTarget)
              : "",
          TargetWeightKg:
            response.Goal.TargetWeightKg !== null && response.Goal.TargetWeightKg !== undefined
              ? String(response.Goal.TargetWeightKg)
              : "",
          EndDate: response.Goal.EndDate || ""
        });
      }
      setGoalWizardStatus("ready");
    } catch (err) {
      setGoalWizardStatus("error");
      setGoalWizardError(err?.message || "Failed to preview goal targets");
    }
  };

  const applyGoalRecommendation = async () => {
    try {
      setGoalWizardStatus("saving");
      setGoalWizardError("");
      const response = await GetAiRecommendations(buildGoalPayload(true));
      setHealthRecommendation(response);
      await loadHealthSettings();
      setGoalWizardOpen(false);
      setGoalWizardStatus("ready");
    } catch (err) {
      setGoalWizardStatus("error");
      setGoalWizardError(err?.message || "Failed to save goal targets");
    }
  };

  const goToGoalStep = (step) => {
    setGoalWizardStep(step);
    if (step === 2) {
      previewGoalRecommendation();
    }
  };

  const onUiChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    const updated = SetUiSettings({ [name]: nextValue });
    setUiSettings(updated);
  };

  const currentBmi = CalculateBmi(healthProfile.WeightKg, healthProfile.HeightCm);
  const currentBmiRange = FindBmiRangeForValue(currentBmi);
  const isProfileComplete = Boolean(
    healthProfile.BirthDate &&
      healthProfile.HeightCm &&
      healthProfile.WeightKg &&
      healthProfile.ActivityLevel
  );
  const goalPreview = goalWizardPreview?.Goal || null;
  const adjustedDailyCalories =
    goalWizardAdjustments?.DailyCalorieTarget ??
    goalWizardPreview?.DailyCalorieTarget ??
    "--";
  const adjustedTargetWeight =
    goalWizardAdjustments?.TargetWeightKg ?? goalPreview?.TargetWeightKg ?? null;
  const adjustedEndDate = goalWizardAdjustments?.EndDate ?? goalPreview?.EndDate ?? "";
  const adjustedWeightDelta =
    adjustedTargetWeight !== null &&
    adjustedTargetWeight !== "" &&
    goalPreview?.CurrentWeightKg !== null &&
    goalPreview?.CurrentWeightKg !== undefined
      ? Number(adjustedTargetWeight) - Number(goalPreview.CurrentWeightKg)
      : goalPreview?.WeightDeltaKg ?? null;
  const googleConnected = Boolean(googleStatus?.Connected);
  const googleNeedsReauth = Boolean(googleStatus?.NeedsReauth);
  const googleConnectedAt = googleStatus?.ConnectedAt ? new Date(googleStatus.ConnectedAt) : null;
  const googleValidatedAt = googleStatus?.ValidatedAt ? new Date(googleStatus.ValidatedAt) : null;
  const googleConnectedBy = googleStatus?.ConnectedBy;
  const googleConnectionLabel = googleConnected
    ? googleNeedsReauth
      ? "Re-authentication required"
      : "Connected"
    : "Not connected";
  const googleActionLabel = googleConnected ? "Re-authenticate with Google" : "Authenticate with Google";
  const googleStatusClass = googleConnected && !googleNeedsReauth ? "ok" : "error";

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
          <NavLink
            to="/settings/appearance"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            Appearance
          </NavLink>
          <NavLink
            to="/settings/dashboard"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/settings/health"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            Health
          </NavLink>
          <p className="settings-nav-title">Workspace</p>
          <NavLink
            to="/settings/tasks"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            Tasks
          </NavLink>
          <NavLink
            to="/settings/system"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            System status
          </NavLink>
          <NavLink
            to="/settings/integrations"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            Integrations
          </NavLink>
          <NavLink
            to="/settings/access"
            className={({ isActive }) =>
              `settings-nav-item${isActive ? " is-active" : ""}`
            }
          >
            User profiles
          </NavLink>
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

          {activeSection === "dashboard" ? (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3>Dashboard</h3>
                <p>Reset your widget layout back to the default order.</p>
              </div>
              {dashboardNotice ? <p className="form-note">{dashboardNotice}</p> : null}
              <div className="settings-list">
                <div className="settings-item">
                  <div>
                    <h4>Reset layout</h4>
                    <p>Restore the default widget arrangement for your account.</p>
                  </div>
                  <button type="button" className="button-secondary" onClick={onResetDashboardLayout}>
                    Reset layout
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "tasks" ? (
            <div className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-header-row">
                  <div>
                    <h3>Tasks</h3>
                    <p>Control overdue reminders and manual runs for Google Tasks.</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={loadTaskSettings}
                    disabled={taskSettingsStatus === "loading"}
                  >
                    {taskSettingsStatus === "loading" ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
              {taskSettingsNotice ? <p className="form-note">{taskSettingsNotice}</p> : null}
              {taskSettingsError ? <p className="form-error">{taskSettingsError}</p> : null}
              {taskOverdueRunNotice ? (
                <p className={taskOverdueRunStatus === "error" ? "form-error" : "form-note"}>
                  {taskOverdueRunNotice}
                </p>
              ) : null}
              <div className="settings-list">
                <div className="settings-item">
                  <div>
                    <h4>Overdue reminder time</h4>
                    <p>Time of day to send overdue task notifications (local time: {userTimeZone}).</p>
                  </div>
                  <select
                    name="OverdueReminderTime"
                    value={taskSettingsForm.OverdueReminderTime}
                    onChange={onTaskSettingsChange}
                  >
                    {TimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-item">
                  <div>
                    <h4>Last reminder run</h4>
                    <p>Latest date overdue reminders were sent.</p>
                  </div>
                  <p>
                    {taskSettings?.OverdueLastNotifiedDate
                      ? FormatDate(taskSettings.OverdueLastNotifiedDate)
                      : "Not run yet"}
                  </p>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={onTaskSettingsSave}
                  disabled={taskSettingsStatus === "saving"}
                >
                  {taskSettingsStatus === "saving" ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onTaskOverdueRun}
                  disabled={!isParent || taskOverdueRunStatus === "loading"}
                >
                  {taskOverdueRunStatus === "loading"
                    ? "Running overdue reminders..."
                    : "Run overdue notifications now"}
                </button>
              </div>
              {!isParent ? (
                <p className="form-note">Only parent accounts can run overdue reminders.</p>
              ) : null}
            </div>
          ) : null}

          {activeSection === "system" ? (
            <div className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-header-row">
                  <div>
                    <h3>System status</h3>
                    <p>Check API and database connectivity.</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={loadSystemStatus}
                    disabled={systemStatus === "loading"}
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="settings-status-grid">
                <div className={`status-pill status-${apiStatus}`}>
                  <span className="status-dot" aria-hidden="true" />
                  <span>API {apiStatus === "ok" ? "ready" : apiStatus}</span>
                </div>
                <div className={`status-pill status-${dbStatus}`}>
                  <span className="status-dot" aria-hidden="true" />
                  <span>Database {dbStatus === "ok" ? "connected" : dbStatus}</span>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "integrations" ? (
            <div className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-header-row">
                  <div>
                    <h3>Integrations</h3>
                    <p>Connect Everday to external services.</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => loadGoogleStatus(true)}
                    disabled={googleStatusState === "loading"}
                  >
                    {googleStatusState === "loading" ? "Checking..." : "Check connection"}
                  </button>
                </div>
              </div>
              <div className="settings-subsection">
                <div className="settings-subsection-header">
                  <h4>Google Tasks and Calendar</h4>
                  <p>Sync tasks and events using the shared family account.</p>
                </div>
                {googleNotice ? <p className="form-note">{googleNotice}</p> : null}
                {googleStatusError ? <p className="form-error">{googleStatusError}</p> : null}
                {googleAuthError ? <p className="form-error">{googleAuthError}</p> : null}
                <div className="settings-status-grid">
                  <div className={`status-pill status-${googleStatusClass}`}>
                    <span className="status-dot" aria-hidden="true" />
                    <span>{googleConnectionLabel}</span>
                  </div>
                  {googleValidatedAt ? (
                    <div className="status-pill">
                      <span className="status-dot" aria-hidden="true" />
                      <span>Checked {googleValidatedAt.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
                {googleNeedsReauth ? (
                  <p className="form-note">
                    Google needs you to re-authenticate to keep tasks and events synced.
                  </p>
                ) : null}
                <div className="settings-list settings-list--integrations">
                  <div className="settings-item">
                    <div>
                      <h4>Connection</h4>
                      <p>Launch the Google consent flow to link the shared calendar.</p>
                    </div>
                    <button
                      type="button"
                      className="primary-button settings-google-auth-button"
                      onClick={onGoogleAuth}
                      disabled={!isParent || googleAuthStatus === "loading"}
                    >
                      {googleAuthStatus === "loading" ? "Opening Google..." : googleActionLabel}
                    </button>
                  </div>
                  <div className="settings-item">
                    <div>
                      <h4>Connected by</h4>
                      <p>Parent account that completed the connection.</p>
                    </div>
                    <p>
                      {googleConnectedBy
                        ? `${googleConnectedBy.FirstName || ""} ${googleConnectedBy.LastName || ""}`.trim() ||
                          googleConnectedBy.Username
                        : "Not connected"}
                    </p>
                  </div>
                  <div className="settings-item">
                    <div>
                      <h4>Connected at</h4>
                      <p>Time the integration was last connected.</p>
                    </div>
                    <p>{googleConnectedAt ? googleConnectedAt.toLocaleString() : "Not connected"}</p>
                  </div>
                  <div className="settings-item">
                    <div>
                      <h4>Calendar ID</h4>
                      <p>Google Calendar used for shared events.</p>
                    </div>
                    <p>{googleStatus?.CalendarId || "Not set"}</p>
                  </div>
                  <div className="settings-item">
                    <div>
                      <h4>Task list ID</h4>
                      <p>Google Tasks list used for Everday tasks.</p>
                    </div>
                    <p>{googleStatus?.TaskListId || "Not set"}</p>
                  </div>
                </div>
                {!isParent ? (
                  <p className="form-note">
                    Only a parent account can connect or disconnect this integration.
                  </p>
                ) : (
                  <p className="form-note">
                    This opens Google sign in for the shared account in the current browser.
                  </p>
                )}
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
                      <h4>Goal</h4>
                      <p>Set a BMI goal and timeline for AI targets.</p>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={openGoalWizard}
                        disabled={healthStatus === "loading"}
                      >
                        {healthGoal ? "Update goal" : "Set goal"}
                      </button>
                    </div>
                    {healthGoal ? (
                      <>
                        <div className="health-summary-grid">
                          <div>
                            <p>Goal</p>
                            <h3>{GetGoalTypeLabel(healthGoal.GoalType)}</h3>
                          </div>
                          <div>
                            <p>BMI range</p>
                            <h3>
                              {FormatNumber(healthGoal.BmiMin)} to {FormatNumber(healthGoal.BmiMax)}
                            </h3>
                          </div>
                          <div>
                            <p>Current BMI</p>
                            <h3>{FormatNumber(healthGoal.CurrentBmi)}</h3>
                          </div>
                          <div>
                            <p>Target weight</p>
                            <h3>{FormatNumber(healthGoal.TargetWeightKg)} kg</h3>
                          </div>
                          <div>
                            <p>Target date</p>
                            <h3>{FormatDate(healthGoal.EndDate)}</h3>
                          </div>
                          <div>
                            <p>Daily calories</p>
                            <h3>{healthGoal.DailyCalorieTarget}</h3>
                          </div>
                        </div>
                        <p className="health-detail">
                          Status: {healthGoal.Status}
                          {healthGoal.CompletedAt
                            ? ` · Completed ${FormatDate(healthGoal.CompletedAt)}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      <p className="form-note">No goal set yet.</p>
                    )}
                  </div>
                  <div className="settings-subsection">
                    <div className="settings-subsection-header">
                      <h4>AI targets</h4>
                      <p>Refresh AI suggestions and auto-tune weekly.</p>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={runHealthRecommendation}
                        disabled={healthAiStatus === "loading"}
                      >
                        {healthRecommendation ? "Refresh suggestions" : "Get suggestions"}
                      </button>
                    </div>
                    <div className="form-switch-row">
                      <span className="form-switch-label">Auto-tune targets weekly</span>
                      <input
                        type="checkbox"
                        checked={healthAutoTuneWeekly}
                        onChange={updateHealthAutoTune}
                      />
                    </div>
                    <p className="health-detail">Auto-tune runs once a week when you open the app.</p>
                    {healthAutoTuneLastRunAt ? (
                      <p className="health-detail">
                        Last auto-tune: {healthAutoTuneLastRunAt.toLocaleString()}
                      </p>
                    ) : (
                      <p className="health-detail">No auto-tune run yet.</p>
                    )}
                    {healthRecommendation ? (
                      <div className="health-ai-result">
                        <h4>Suggested targets</h4>
                        <p>{healthRecommendation.Explanation}</p>
                        <div className="health-summary-grid">
                          <div>
                            <p>Calories</p>
                            <h3>{healthRecommendation.DailyCalorieTarget}</h3>
                          </div>
                          <div>
                            <p>Protein min</p>
                            <h3>{healthRecommendation.ProteinTargetMin}</h3>
                          </div>
                          <div>
                            <p>Protein max</p>
                            <h3>{healthRecommendation.ProteinTargetMax}</h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="primary-button health-ai-apply"
                          onClick={applyHealthRecommendation}
                        >
                          Apply suggested targets
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="settings-subsection">
                    <div className="settings-subsection-header">
                      <h4>Integrations</h4>
                      <p>Generate an API key for Health Auto Export.</p>
                    </div>
                    <div className="health-integrations">
                      <div className="health-integrations-status">
                        <p>
                          Status: {healthHaeConfigured ? "Key configured" : "No key configured"}
                        </p>
                        {healthHaeLast4 ? <p>Key ending: •••• {healthHaeLast4}</p> : null}
                        {healthHaeCreatedAt ? (
                          <p>Created: {healthHaeCreatedAt.toLocaleString()}</p>
                        ) : null}
                      </div>
                      <div className="form-actions health-integrations-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={rotateHaeApiKey}
                          disabled={healthHaeKeyStatus === "loading"}
                        >
                          {healthHaeConfigured ? "Rotate key" : "Generate key"}
                        </button>
                      </div>
                      {healthHaeKey ? (
                        <div className="health-key-reveal">
                          <label>
                            New API key
                            <input type="text" readOnly value={healthHaeKey} className="form-input" />
                          </label>
                          <div className="health-key-actions">
                            <button type="button" className="button-secondary" onClick={copyHaeKey}>
                              Copy key
                            </button>
                            {healthHaeCopied ? (
                              <span className="health-key-status" role="status" aria-live="polite">
                                Key copied
                              </span>
                            ) : null}
                          </div>
                          <p className="form-note">
                            Copy this key now. It will not be shown again.
                          </p>
                          <p className="form-note">
                            Use header name <strong>X-API-Key</strong> in Health Auto Export.
                          </p>
                        </div>
                      ) : null}
                    </div>
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
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show weight chart on Today</span>
                        <input
                          type="checkbox"
                          checked={healthShowWeightChart}
                          onChange={(event) => setHealthShowWeightChart(event.target.checked)}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show steps chart on Today</span>
                        <input
                          type="checkbox"
                          checked={healthShowStepsChart}
                          onChange={(event) => setHealthShowStepsChart(event.target.checked)}
                        />
                      </div>
                      <div className="form-switch-row">
                        <span className="form-switch-label">Show weight projections on Today</span>
                        <input
                          type="checkbox"
                          checked={healthShowWeightProjection}
                          onChange={(event) => setHealthShowWeightProjection(event.target.checked)}
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" disabled={healthStatus === "saving"}>
                          {healthStatus === "saving" ? "Saving..." : "Save targets"}
                        </button>
                      </div>
                    </form>
                  </div>
                  <div className="settings-subsection">
                    <div className="settings-subsection-header">
                      <h4>Recommendation history</h4>
                      <p>Previous AI calculations for reference.</p>
                    </div>
                    <div className="health-history-list">
                      {healthRecommendationHistory.length ? (
                        healthRecommendationHistory.map((log) => (
                          <div key={log.RecommendationLogId} className="health-history-card">
                            <div className="health-history-card-header">
                              <span>
                                {new Date(log.CreatedAt).toLocaleDateString()}
                              </span>
                              <span className="health-history-card-kcal">
                                {log.DailyCalorieTarget} kcal
                              </span>
                            </div>
                            <div className="health-history-card-subtitle">{log.Explanation}</div>
                          </div>
                        ))
                      ) : (
                        <p className="health-history-card-empty">No recommendations yet.</p>
                      )}
                    </div>
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
                    <p>
                      Manage logins, roles, profiles, and password resets. Use the user Id to set
                      ALEXA_SERVICE_USER_ID for Alexa.
                    </p>
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
                        <label>
                          Role
                          <select name="Role" value={newUserForm.Role} onChange={onNewUserChange}>
                            {RoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
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
                              <span>Alexa service user Id {user.Id}</span>
                            </div>
                            <div className="settings-role-grid">
                              <label>
                                <span>Role</span>
                                <select
                                  value={user.Role || "Kid"}
                                  onChange={(event) => onRoleChange(user.Id, event.target.value)}
                                  disabled={status === "saving"}
                                >
                                  {RoleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
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
      {goalWizardOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Health goal</h3>
              <button className="text-button" type="button" onClick={closeGoalWizard}>
                Close
              </button>
            </div>
            <p className="form-note">Step {goalWizardStep + 1} of 3</p>
            {!isProfileComplete ? (
              <p className="form-error">
                Complete birth date, height, weight, and activity level first.
              </p>
            ) : null}
            {goalWizardError ? <p className="form-error">{goalWizardError}</p> : null}
            {goalWizardStep === 0 ? (
              <>
                <p className="form-note">
                  Current BMI: {FormatNumber(currentBmi)}
                  {currentBmiRange ? ` (${currentBmiRange.label})` : ""}
                </p>
                <div className="form-grid">
                  <label>
                    Goal type
                    <select
                      name="GoalType"
                      value={goalWizardForm.GoalType}
                      onChange={onGoalFormChange}
                    >
                      {GoalTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Target BMI range
                    <select
                      name="BmiRangeKey"
                      value={goalWizardForm.BmiRangeKey}
                      onChange={onGoalFormChange}
                    >
                      {BmiRangeOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-actions health-goal-actions">
                  <button className="button-secondary" type="button" onClick={closeGoalWizard}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => goToGoalStep(1)}
                    disabled={!isProfileComplete}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
            {goalWizardStep === 1 ? (
              <>
                <div className="form-grid">
                  <label>
                    Start date
                    <input
                      type="date"
                      name="StartDate"
                      value={goalWizardForm.StartDate}
                      onChange={onGoalFormChange}
                    />
                  </label>
                  <label>
                    Timeframe
                    <select
                      name="DurationMonths"
                      value={goalWizardForm.DurationMonths}
                      onChange={onGoalFormChange}
                    >
                      {GoalDurationOptions.map((months) => (
                        <option key={months} value={months}>
                          {months} months
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="form-note">
                  End date: {AddMonthsToDate(goalWizardForm.StartDate, goalWizardForm.DurationMonths) || "--"}
                </p>
                <div className="form-actions health-goal-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => goToGoalStep(0)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => goToGoalStep(2)}
                    disabled={!isProfileComplete || !goalWizardForm.StartDate}
                  >
                    Review
                  </button>
                </div>
              </>
            ) : null}
            {goalWizardStep === 2 ? (
              <>
                {goalWizardStatus === "loading" ? (
                  <p>Loading preview...</p>
                ) : goalPreview ? (
                  <>
                    <p>{goalWizardPreview?.Explanation}</p>
                    <div className="health-summary-grid">
                      <div>
                        <p>Daily calories</p>
                        <h3>{adjustedDailyCalories}</h3>
                      </div>
                      <div>
                        <p>Protein range</p>
                        <h3>
                          {FormatNumber(goalWizardPreview?.ProteinTargetMin)} to{" "}
                          {FormatNumber(goalWizardPreview?.ProteinTargetMax)} g
                        </h3>
                      </div>
                      <div>
                        <p>Target weight</p>
                        <h3>{FormatNumber(adjustedTargetWeight)} kg</h3>
                      </div>
                      <div>
                        <p>Weight change</p>
                        <h3>{FormatNumber(adjustedWeightDelta)} kg</h3>
                      </div>
                    </div>
                    <div className="form-grid">
                      <label>
                        Daily calories
                        <input
                          type="number"
                          name="DailyCalorieTarget"
                          min="0"
                          value={goalWizardAdjustments?.DailyCalorieTarget ?? ""}
                          onChange={onGoalAdjustmentChange}
                        />
                      </label>
                      <label>
                        Target weight (kg)
                        <input
                          type="number"
                          name="TargetWeightKg"
                          min="0"
                          step="0.1"
                          value={goalWizardAdjustments?.TargetWeightKg ?? ""}
                          onChange={onGoalAdjustmentChange}
                        />
                      </label>
                      <label>
                        End date
                        <input
                          type="date"
                          name="EndDate"
                          value={adjustedEndDate}
                          onChange={onGoalAdjustmentChange}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <p className="form-note">No preview available yet.</p>
                )}
                <div className="form-actions health-goal-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => goToGoalStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={applyGoalRecommendation}
                    disabled={goalWizardStatus === "saving" || goalWizardStatus === "loading" || !goalPreview}
                  >
                    {goalWizardStatus === "saving" ? "Saving..." : "Save goal"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
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
