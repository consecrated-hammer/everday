import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";

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
  RunHealthReminders,
  UpdateHealthProfile,
  UpdateHealthSettings
} from "../../lib/healthApi.js";
import {
  FetchTaskOverdueHistory,
  FetchTaskSettings,
  RunTaskOverdueNotifications,
  UpdateTaskSettings
} from "../../lib/tasksApi.js";
import { GetRole, GetTokens, GetUserId, SetTokens } from "../../lib/authStorage.js";
import { GetUiSettings, SetUiSettings } from "../../lib/uiSettings.js";
import { FormatDateTime } from "../../lib/formatters.js";
import Icon from "../../components/Icon.jsx";
import DataTable from "../../components/DataTable.jsx";
import { GetGravatarUrl } from "../../lib/gravatar.js";

const RoleOptions = ["Parent", "Kid"];
const IconOptions = [
  { value: "phosphor", label: "Phosphor" },
  { value: "material", label: "Material Symbols" },
  { value: "lucide", label: "Lucide" }
];
const SettingsTabs = [
  { id: "appearance", label: "Appearance", path: "/settings/appearance" },
  { id: "health", label: "Health", path: "/settings/health" },
  { id: "tasks", label: "Tasks", path: "/settings/tasks" },
  { id: "system", label: "System", path: "/settings/system" },
  { id: "integrations", label: "Integrations", path: "/settings/integrations" },
  { id: "access", label: "Users", path: "/settings/access" }
];
const SettingsSections = SettingsTabs.map((tab) => tab.id);
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

const MealReminderSlots = [
  { key: "Breakfast", label: "Breakfast" },
  { key: "Snack1", label: "Snack 1" },
  { key: "Lunch", label: "Lunch" },
  { key: "Snack2", label: "Snack 2" },
  { key: "Dinner", label: "Dinner" },
  { key: "Snack3", label: "Snack 3" }
];

const DefaultMealReminderTimes = {
  Breakfast: "08:00",
  Snack1: "10:30",
  Lunch: "12:30",
  Snack2: "15:30",
  Dinner: "18:30",
  Snack3: "20:30"
};

const DefaultWeightReminderTime = "08:00";

const NormalizeFoodReminderTimes = (times) => {
  const normalized = { ...DefaultMealReminderTimes };
  if (!times || typeof times !== "object") {
    return normalized;
  }
  MealReminderSlots.forEach(({ key }) => {
    const value = times[key];
    if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
      normalized[key] = value;
    }
  });
  return normalized;
};

const EmptyHealthReminders = {
  ReminderTimeZone: ResolveUserTimeZone(),
  FoodRemindersEnabled: false,
  FoodReminderTimes: { ...DefaultMealReminderTimes },
  WeightRemindersEnabled: false,
  WeightReminderTime: DefaultWeightReminderTime
};

const BuildHealthRemindersState = (settings) => ({
  ReminderTimeZone: settings.ReminderTimeZone || ResolveUserTimeZone(),
  FoodRemindersEnabled: Boolean(settings.FoodRemindersEnabled),
  FoodReminderTimes: NormalizeFoodReminderTimes(settings.FoodReminderTimes),
  WeightRemindersEnabled: Boolean(settings.WeightRemindersEnabled),
  WeightReminderTime:
    typeof settings.WeightReminderTime === "string" && /^\d{2}:\d{2}$/.test(settings.WeightReminderTime)
      ? settings.WeightReminderTime
      : DefaultWeightReminderTime
});

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

const BuildHealthProfilePayload = (profile) => ({
  FirstName: profile.FirstName || null,
  LastName: profile.LastName || null,
  Email: profile.Email || null,
  BirthDate: profile.BirthDate || null,
  HeightCm: profile.HeightCm ? Number(profile.HeightCm) : null,
  WeightKg: profile.WeightKg ? Number(profile.WeightKg) : null,
  ActivityLevel: profile.ActivityLevel || null
});

const BuildHealthSettingsPayload = (targets, showWeightChart, showStepsChart, reminders) => {
  const reminderState = reminders || EmptyHealthReminders;
  return {
    DailyCalorieTarget: Number(targets.DailyCalorieTarget || 0),
    ProteinTargetMin: Number(targets.ProteinTargetMin || 0),
    ProteinTargetMax: Number(targets.ProteinTargetMax || 0),
    StepTarget: Number(targets.StepTarget || 0),
    StepKcalFactor: Number(targets.StepKcalFactor || 0),
    FibreTarget: targets.FibreTarget ? Number(targets.FibreTarget) : null,
    CarbsTarget: targets.CarbsTarget ? Number(targets.CarbsTarget) : null,
    FatTarget: targets.FatTarget ? Number(targets.FatTarget) : null,
    SaturatedFatTarget: targets.SaturatedFatTarget ? Number(targets.SaturatedFatTarget) : null,
    SugarTarget: targets.SugarTarget ? Number(targets.SugarTarget) : null,
    SodiumTarget: targets.SodiumTarget ? Number(targets.SodiumTarget) : null,
    ShowProteinOnToday: targets.ShowProteinOnToday,
    ShowStepsOnToday: targets.ShowStepsOnToday,
    ShowFibreOnToday: targets.ShowFibreOnToday,
    ShowCarbsOnToday: targets.ShowCarbsOnToday,
    ShowFatOnToday: targets.ShowFatOnToday,
    ShowSaturatedFatOnToday: targets.ShowSaturatedFatOnToday,
    ShowSugarOnToday: targets.ShowSugarOnToday,
    ShowSodiumOnToday: targets.ShowSodiumOnToday,
    ShowWeightChartOnToday: showWeightChart,
    ShowStepsChartOnToday: showStepsChart,
    ReminderTimeZone: reminderState.ReminderTimeZone || ResolveUserTimeZone(),
    FoodRemindersEnabled: reminderState.FoodRemindersEnabled,
    FoodReminderTimes: reminderState.FoodReminderTimes,
    WeightRemindersEnabled: reminderState.WeightRemindersEnabled,
    WeightReminderTime: reminderState.WeightReminderTime || DefaultWeightReminderTime
  };
};

const FormatRelativeTime = (value) => {
  if (!value) return "Not checked";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked";
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 45) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
};

const GetUserInitials = (user) => {
  const first = (user.FirstName || "").trim();
  const last = (user.LastName || "").trim();
  const username = (user.Username || "").trim();
  const letters = [];
  if (first) letters.push(first[0]);
  if (last) letters.push(last[0]);
  if (letters.length === 0 && username) letters.push(username[0]);
  if (letters.length === 1 && username.length > 1) letters.push(username[1]);
  return letters.join("").toUpperCase() || "?";
};

const GetUserDisplayName = (user) =>
  [user.FirstName, user.LastName].filter(Boolean).join(" ").trim() || user.Username || "Account";

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
  const [healthReminders, setHealthReminders] = useState(EmptyHealthReminders);
  const [healthStatus, setHealthStatus] = useState("idle");
  const [healthError, setHealthError] = useState("");
  const [healthAiStatus, setHealthAiStatus] = useState("idle");
  const [healthReminderRunStatus, setHealthReminderRunStatus] = useState("idle");
  const [healthReminderRunResult, setHealthReminderRunResult] = useState(null);
  const [healthReminderRunError, setHealthReminderRunError] = useState("");
  const [healthRecommendation, setHealthRecommendation] = useState(null);
  const [healthRecommendationHistory, setHealthRecommendationHistory] = useState([]);
  const [healthAutoTuneWeekly, setHealthAutoTuneWeekly] = useState(false);
  const [healthAutoTuneLastRunAt, setHealthAutoTuneLastRunAt] = useState(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [healthShowWeightChart, setHealthShowWeightChart] = useState(true);
  const [healthShowStepsChart, setHealthShowStepsChart] = useState(true);
  const [healthHaeConfigured, setHealthHaeConfigured] = useState(false);
  const [healthHaeLast4, setHealthHaeLast4] = useState("");
  const [healthHaeCreatedAt, setHealthHaeCreatedAt] = useState(null);
  const [healthHaeKey, setHealthHaeKey] = useState("");
  const [healthHaeKeyStatus, setHealthHaeKeyStatus] = useState("idle");
  const [healthHaeCopied, setHealthHaeCopied] = useState(false);
  const healthHaeCopyTimer = useRef(null);
  const healthProfileSaveTimer = useRef(null);
  const healthSettingsSaveTimer = useRef(null);
  const healthProfileSavedRef = useRef("");
  const healthSettingsSavedRef = useRef("");
  const healthLoadedRef = useRef(false);
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
  const [systemLastChecked, setSystemLastChecked] = useState(null);
  const [googleAuthStatus, setGoogleAuthStatus] = useState("idle");
  const [googleAuthError, setGoogleAuthError] = useState("");
  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleStatusState, setGoogleStatusState] = useState("idle");
  const [googleStatusError, setGoogleStatusError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [accessSearchTerm, setAccessSearchTerm] = useState("");
  const [accessMenu, setAccessMenu] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState("google");
  const integrationCopyTimer = useRef(null);
  const [taskSettings, setTaskSettings] = useState(null);
  const [taskSettingsForm, setTaskSettingsForm] = useState({
    OverdueReminderTime: "08:00",
    OverdueReminderTimeZone: ResolveUserTimeZone(),
    OverdueRemindersEnabled: true
  });
  const [taskSettingsStatus, setTaskSettingsStatus] = useState("idle");
  const [taskSettingsError, setTaskSettingsError] = useState("");
  const [taskToast, setTaskToast] = useState("");
  const [taskRunHistory, setTaskRunHistory] = useState([]);
  const [taskHistoryStatus, setTaskHistoryStatus] = useState("idle");
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [taskOverdueRunStatus, setTaskOverdueRunStatus] = useState("idle");
  const [taskOverdueRunNotice, setTaskOverdueRunNotice] = useState("");
  const taskToastTimer = useRef(null);
  const taskSettingsSaveTimer = useRef(null);
  const taskSettingsSavedRef = useRef("");
  const taskSettingsLoadedRef = useRef(false);
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
  const activeSection = SettingsSections.includes(section) ? section : "appearance";
  const isParent = GetRole() === "Parent";
  const isAdmin = GetRole() === "Admin";
  const latestTaskRun = taskRunHistory[0] || null;
  const taskNeedsAttention = Boolean(
    taskSettingsStatus === "error" ||
      taskOverdueRunStatus === "error" ||
      taskHistoryStatus === "error" ||
      latestTaskRun?.result === "Failed"
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const loadUsers = useCallback(async () => {
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
  }, []);

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
      setSystemLastChecked(new Date());
    }
  }, [apiBaseUrl]);

  const onCopyBuildInfo = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
        OverdueReminderTimeZone: userTimeZone,
        OverdueRemindersEnabled: response?.OverdueRemindersEnabled !== false
      });
      taskSettingsSavedRef.current = JSON.stringify({
        OverdueReminderTime: response?.OverdueReminderTime || "08:00",
        OverdueReminderTimeZone: userTimeZone,
        OverdueRemindersEnabled: response?.OverdueRemindersEnabled !== false
      });
      taskSettingsLoadedRef.current = true;
      setTaskSettingsStatus("ready");
    } catch (err) {
      setTaskSettingsStatus("error");
      setTaskSettingsError(err?.message || "Failed to load task settings.");
    }
  }, [userTimeZone]);

  const loadTaskHistory = useCallback(async (limit = 20) => {
    try {
      setTaskHistoryStatus("loading");
      setTaskOverdueRunNotice("");
      const response = await FetchTaskOverdueHistory(limit);
      const entries = Array.isArray(response) ? response : [];
      const mapped = entries.map((entry) => ({
        id: entry.Id ?? entry.id ?? `${entry.RanAt || entry.ranAt || ""}`,
        ranAt: entry.RanAt ?? entry.ranAt,
        result: entry.Result ?? entry.result ?? "Unknown",
        sent: entry.NotificationsSent ?? entry.sent ?? 0,
        overdue: entry.OverdueTasks ?? entry.overdue ?? 0,
        users: entry.UsersProcessed ?? entry.users ?? 0,
        error: entry.ErrorMessage ?? entry.error ?? ""
      }));
      setTaskRunHistory(mapped);
      setTaskHistoryStatus("ready");
    } catch (err) {
      setTaskHistoryStatus("error");
      setTaskOverdueRunNotice(err?.message || "Failed to load overdue run history.");
      setTaskRunHistory([]);
    }
  }, []);

  const onTaskSettingsChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setTaskSettingsForm((current) => ({
      ...current,
      [name]: nextValue
    }));
  }, []);

  useEffect(() => {
    if (!taskSettingsLoadedRef.current) {
      return;
    }
    const serialized = JSON.stringify(taskSettingsForm);
    if (serialized === taskSettingsSavedRef.current) {
      return;
    }
    if (taskSettingsSaveTimer.current) {
      clearTimeout(taskSettingsSaveTimer.current);
    }
    taskSettingsSaveTimer.current = setTimeout(async () => {
      try {
        setTaskSettingsStatus("saving");
        setTaskSettingsError("");
        const payload = {
          OverdueReminderTime: taskSettingsForm.OverdueReminderTime || null,
          OverdueReminderTimeZone: taskSettingsForm.OverdueReminderTimeZone || userTimeZone,
          OverdueRemindersEnabled: Boolean(taskSettingsForm.OverdueRemindersEnabled)
        };
        const response = await UpdateTaskSettings(payload);
        setTaskSettings(response || null);
        taskSettingsSavedRef.current = serialized;
        setTaskSettingsStatus("ready");
      } catch (err) {
        setTaskSettingsStatus("error");
        setTaskSettingsError(err?.message || "Failed to save task settings.");
      }
    }, 700);
    return () => {
      if (taskSettingsSaveTimer.current) {
        clearTimeout(taskSettingsSaveTimer.current);
      }
    };
  }, [taskSettingsForm, userTimeZone]);

  const onTaskOverdueRun = useCallback(async () => {
    try {
      setTaskOverdueRunStatus("loading");
      setTaskOverdueRunNotice("");
      const response = await RunTaskOverdueNotifications(true);
      const sent = response?.NotificationsSent ?? 0;
      const message = `Sent ${sent} reminder${sent === 1 ? "" : "s"}.`;
      setTaskToast(message);
      if (taskToastTimer.current) {
        clearTimeout(taskToastTimer.current);
      }
      taskToastTimer.current = setTimeout(() => {
        setTaskToast("");
      }, 2600);
      setTaskOverdueRunStatus("ready");
      setTaskSettings((prev) =>
        prev ? { ...prev, OverdueLastNotifiedDate: new Date().toISOString() } : prev
      );
      await Promise.all([loadTaskSettings(), loadTaskHistory()]);
    } catch (err) {
      setTaskOverdueRunStatus("error");
      setTaskOverdueRunNotice(err?.message || "Failed to run overdue notifications.");
    }
  }, [loadTaskHistory, loadTaskSettings]);

  const onRefreshTaskStatus = useCallback(async () => {
    await Promise.all([loadTaskSettings(), loadTaskHistory()]);
  }, [loadTaskHistory, loadTaskSettings]);

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
    loadTaskHistory();
  }, [activeSection, loadTaskHistory, loadTaskSettings]);

  useEffect(() => {
    if (!showTaskHistory || activeSection !== "tasks") {
      return;
    }
    loadTaskHistory();
  }, [activeSection, loadTaskHistory, showTaskHistory]);

  const onNewUserChange = (event) => {
    const { name, value, type, checked } = event.target;
    setNewUserForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
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
      const nextTargets = BuildHealthTargetsState(settings.Targets);
      const nextProfile = {
        ...EmptyHealthProfile,
        FirstName: profile.FirstName || "",
        LastName: profile.LastName || "",
        Email: profile.Email || "",
        BirthDate: profile.BirthDate || "",
        HeightCm: profile.HeightCm || "",
        WeightKg: profile.WeightKg || "",
        ActivityLevel: profile.ActivityLevel || ""
      };
      const nextShowWeightChart = settings.ShowWeightChartOnToday !== false;
      const nextShowStepsChart = settings.ShowStepsChartOnToday !== false;
      const nextReminders = BuildHealthRemindersState(settings);
      setHealthTargets(nextTargets);
      setHealthReminders(nextReminders);
      setHealthProfile(nextProfile);
      setHealthAutoTuneWeekly(Boolean(settings.AutoTuneTargetsWeekly));
      setHealthAutoTuneLastRunAt(
        settings.LastAutoTuneAt ? new Date(settings.LastAutoTuneAt) : null
      );
      setHealthGoal(settings.Goal || null);
      setHealthShowWeightChart(nextShowWeightChart);
      setHealthShowStepsChart(nextShowStepsChart);
      setHealthHaeConfigured(Boolean(settings.HaeApiKeyConfigured));
      setHealthHaeLast4(settings.HaeApiKeyLast4 || "");
      setHealthHaeCreatedAt(settings.HaeApiKeyCreatedAt ? new Date(settings.HaeApiKeyCreatedAt) : null);
      setHealthHaeKey("");
      setHealthHaeKeyStatus("idle");
      setHealthHaeCopied(false);
      setHealthRecommendationHistory(history.Logs || []);
      setHealthReminderRunStatus("idle");
      setHealthReminderRunResult(null);
      setHealthReminderRunError("");
      healthProfileSavedRef.current = JSON.stringify(BuildHealthProfilePayload(nextProfile));
      healthSettingsSavedRef.current = JSON.stringify(
        BuildHealthSettingsPayload(nextTargets, nextShowWeightChart, nextShowStepsChart, nextReminders)
      );
      healthLoadedRef.current = true;
      setHealthStatus("ready");
    } catch (err) {
      setHealthStatus("error");
      setHealthError(err?.message || "Failed to load health settings");
    }
  };

  useEffect(() => {
    loadHealthSettings();
  }, []);

  const onRoleChange = useCallback(async (userId, role) => {
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
  }, []);

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

  const onFoodRemindersEnabledChange = (event) => {
    const nextValue = event.target.checked;
    setHealthReminders((prev) => ({ ...prev, FoodRemindersEnabled: nextValue }));
  };

  const onMealReminderTimeChange = (mealType, timeValue) => {
    setHealthReminders((prev) => ({
      ...prev,
      FoodReminderTimes: {
        ...prev.FoodReminderTimes,
        [mealType]: timeValue
      }
    }));
  };

  const onWeightRemindersEnabledChange = (event) => {
    const nextValue = event.target.checked;
    setHealthReminders((prev) => ({ ...prev, WeightRemindersEnabled: nextValue }));
  };

  const onWeightReminderTimeChange = (event) => {
    const nextValue = event.target.value;
    setHealthReminders((prev) => ({ ...prev, WeightReminderTime: nextValue }));
  };

  const runHealthRemindersNow = async () => {
    if (!isAdmin) {
      return;
    }
    const now = new Date();
    const runDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const runTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      setHealthReminderRunStatus("loading");
      setHealthReminderRunError("");
      setHealthReminderRunResult(null);
      const result = await RunHealthReminders({ RunDate: runDate, RunTime: runTime });
      setHealthReminderRunResult(result);
      setHealthReminderRunStatus("ready");
    } catch (err) {
      setHealthReminderRunStatus("error");
      setHealthReminderRunError(err?.message || "Failed to run reminders");
    }
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

  useEffect(() => {
    if (!healthLoadedRef.current) {
      return;
    }
    const payload = BuildHealthProfilePayload(healthProfile);
    const serialized = JSON.stringify(payload);
    if (serialized === healthProfileSavedRef.current) {
      return;
    }
    if (healthProfileSaveTimer.current) {
      clearTimeout(healthProfileSaveTimer.current);
    }
    healthProfileSaveTimer.current = setTimeout(async () => {
      try {
        setHealthStatus("saving");
        setHealthError("");
        await UpdateHealthProfile(payload);
        healthProfileSavedRef.current = serialized;
        setHealthStatus("ready");
      } catch (err) {
        setHealthStatus("error");
        setHealthError(err?.message || "Failed to update health profile");
      }
    }, 700);
    return () => {
      if (healthProfileSaveTimer.current) {
        clearTimeout(healthProfileSaveTimer.current);
      }
    };
  }, [healthProfile]);

  useEffect(() => {
    if (!healthLoadedRef.current) {
      return;
    }
    const payload = BuildHealthSettingsPayload(
      healthTargets,
      healthShowWeightChart,
      healthShowStepsChart,
      healthReminders
    );
    const serialized = JSON.stringify(payload);
    if (serialized === healthSettingsSavedRef.current) {
      return;
    }
    if (healthSettingsSaveTimer.current) {
      clearTimeout(healthSettingsSaveTimer.current);
    }
    healthSettingsSaveTimer.current = setTimeout(async () => {
      try {
        setHealthStatus("saving");
        setHealthError("");
        await UpdateHealthSettings(payload);
        healthSettingsSavedRef.current = serialized;
        setHealthStatus("ready");
      } catch (err) {
        setHealthStatus("error");
        setHealthError(err?.message || "Failed to update health settings");
      }
    }, 700);
    return () => {
      if (healthSettingsSaveTimer.current) {
        clearTimeout(healthSettingsSaveTimer.current);
      }
    };
  }, [healthTargets, healthShowWeightChart, healthShowStepsChart, healthReminders]);

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
      if (healthProfileSaveTimer.current) {
        clearTimeout(healthProfileSaveTimer.current);
      }
      if (healthSettingsSaveTimer.current) {
        clearTimeout(healthSettingsSaveTimer.current);
      }
      if (taskToastTimer.current) {
        clearTimeout(taskToastTimer.current);
      }
      if (taskSettingsSaveTimer.current) {
        clearTimeout(taskSettingsSaveTimer.current);
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
      if (updated.ShowWeightChartOnToday !== undefined) {
        setHealthShowWeightChart(updated.ShowWeightChartOnToday !== false);
      }
      if (updated.ShowStepsChartOnToday !== undefined) {
        setHealthShowStepsChart(updated.ShowStepsChartOnToday !== false);
      }
      const nextTargets = BuildHealthTargetsState(updated.Targets);
      const nextShowWeight =
        updated.ShowWeightChartOnToday !== undefined
          ? updated.ShowWeightChartOnToday !== false
          : healthShowWeightChart;
      const nextShowSteps =
        updated.ShowStepsChartOnToday !== undefined
          ? updated.ShowStepsChartOnToday !== false
          : healthShowStepsChart;
      const nextReminders = BuildHealthRemindersState(updated);
      setHealthReminders(nextReminders);
      healthSettingsSavedRef.current = JSON.stringify(
        BuildHealthSettingsPayload(nextTargets, nextShowWeight, nextShowSteps, nextReminders)
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
  const googleActionLabel = googleConnected ? "Re-authenticate with Google" : "Authenticate with Google";
  const googleStatusTone =
    googleStatusState === "error"
      ? "error"
      : googleNeedsReauth
        ? "checking"
        : googleConnected
          ? "ok"
          : "";
  const googleStatusLabel =
    googleStatusState === "error"
      ? "Error"
      : googleNeedsReauth
        ? "Needs auth"
        : googleConnected
          ? "Connected"
          : "Disabled";
  const googleServices = [
    googleStatus?.CalendarId ? "Calendar" : null,
    googleStatus?.TaskListId ? "Tasks" : null
  ].filter(Boolean);
  const googleCheckedLabel = googleValidatedAt
    ? `Checked ${FormatRelativeTime(googleValidatedAt)}`
    : "Not checked";
  const healthCheckedLabel = healthHaeCreatedAt
    ? `Checked ${FormatRelativeTime(healthHaeCreatedAt)}`
    : "Not checked";
  const accessRows = useMemo(
    () =>
      users.map((user) => {
        const displayName = GetUserDisplayName(user);
        const gravatar = GetGravatarUrl(user.Email || "");
        return {
          Id: user.Id,
          AvatarFallback: GetUserInitials(user),
          AvatarUrl: gravatar,
          Name: displayName || "Not set",
          Email: user.Email || "Not set",
          Username: user.Username,
          Role: user.Role || "Kid",
          Status: user.RequirePasswordChange ? "Reset required" : "Active",
          LastActive: user.CreatedAt || "",
          RequirePasswordChange: Boolean(user.RequirePasswordChange),
          User: user
        };
      }),
    [users]
  );
  const accessColumns = useMemo(
    () => [
      {
        key: "Avatar",
        label: "Avatar",
        width: 80,
        sortable: false,
        filterable: false,
        render: (row) =>
          row.AvatarUrl ? (
            <img
              src={row.AvatarUrl}
              alt={row.Name}
              className="settings-user-avatar-img"
              loading="lazy"
            />
          ) : (
            <span className="settings-user-avatar">{row.AvatarFallback}</span>
          )
      },
      { key: "Id", label: "Id", width: 70, sortable: true, filterable: true },
      { key: "Name", label: "Name", width: 180, sortable: true, filterable: true },
      { key: "Email", label: "Email", width: 220, sortable: true, filterable: true },
      { key: "Username", label: "Username", width: 160, sortable: true, filterable: true },
      {
        key: "Role",
        label: "Role",
        width: 140,
        sortable: true,
        filterable: true,
        render: (row) => (
          <select
            value={row.Role}
            onChange={(event) => onRoleChange(row.Id, event.target.value)}
            disabled={status === "saving"}
          >
            {RoleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        )
      },
      { key: "Status", label: "Status", width: 160, sortable: true, filterable: true },
      {
        key: "LastActive",
        label: "Last active/Updated",
        width: 180,
        sortable: true,
        filterable: false,
        render: (row) => (row.LastActive ? FormatDate(row.LastActive) : "Not set")
      }
    ],
    [status, onRoleChange]
  );

  const onAccessMenuToggle = (user, event) => {
    event.preventDefault();
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    const right = Math.max(8, window.innerWidth - rect.right);
    const style = openAbove
      ? {
          right: `${right}px`,
          bottom: `${window.innerHeight - rect.top + 8}px`,
          top: "auto",
          left: "auto"
        }
      : {
          right: `${right}px`,
          top: `${rect.bottom + 8}px`,
          bottom: "auto",
          left: "auto"
        };

    setAccessMenu((prev) =>
      prev?.userId === user.Id ? null : { userId: user.Id, style, user }
    );
  };

  useEffect(() => {
    if (!accessMenu) {
      return;
    }
    const handleClick = (event) => {
      if (
        event.target.closest(".settings-access-menu-dropdown") ||
        event.target.closest(".settings-access-menu-button")
      ) {
        return;
      }
      setAccessMenu(null);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setAccessMenu(null);
      }
    };
    const handleScroll = () => setAccessMenu(null);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleScroll);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [accessMenu]);

  useEffect(() => {
    const timerRef = integrationCopyTimer;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);


  const accessMenuPortal =
    accessMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            className="dropdown dropdown-right settings-access-menu-dropdown"
            role="menu"
            style={accessMenu.style}
          >
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setAccessMenu(null);
                onOpenProfileModal(accessMenu.user);
              }}
            >
              Edit profile
            </button>
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setAccessMenu(null);
                onOpenPasswordModal(accessMenu.user);
              }}
            >
              Reset password
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="module-panel">
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          {SettingsTabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={`settings-tab${activeSection === tab.id ? " is-active" : ""}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <section className="settings-content">
          {activeSection === "appearance" ? (
            <div className="settings-section settings-section--slim">
              <div className="settings-section-header">
                <h3>Appearance</h3>
                <p>Control the theme, icons, and number formatting.</p>
              </div>
              <div className="settings-list settings-list--slim">
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
                  <div className="switch-pill">
                    <input
                      id="show-decimals"
                      type="checkbox"
                      name="ShowDecimals"
                      checked={uiSettings.ShowDecimals}
                      onChange={onUiChange}
                      aria-label="Show decimals"
                    />
                    <label htmlFor="show-decimals" className="switch-pill-track">
                      <span className="switch-pill-icon switch-pill-icon--off">
                        <Icon name="toggleOff" className="icon" />
                      </span>
                      <span className="switch-pill-icon switch-pill-icon--on">
                        <Icon name="toggleOn" className="icon" />
                      </span>
                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                      <span className="switch-pill-text switch-pill-text--on">On</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "tasks" ? (
            <div className="settings-section settings-section--full">
              <div className="settings-section-header">
                <div className="settings-section-header-row">
                  <div>
                    <h3>Tasks</h3>
                    <p>Control overdue reminders and manual runs for Google Tasks.</p>
                  </div>
                </div>
              </div>
              {taskSettingsError ? <p className="form-error">{taskSettingsError}</p> : null}
              {taskOverdueRunNotice ? (
                <p className="form-error">{taskOverdueRunNotice}</p>
              ) : null}
              <div className="settings-tasks">
                <div className="settings-subsection">
                  <div className="settings-subsection-header">
                    <h4>Schedule</h4>
                    <p>Set when overdue reminders should be sent.</p>
                  </div>
                  <div className="settings-list settings-list--slim">
                    <div className="settings-item">
                      <div>
                        <h4>Overdue reminder time</h4>
                        <p>Uses local time ({userTimeZone}).</p>
                      </div>
                      <select
                        name="OverdueReminderTime"
                        value={taskSettingsForm.OverdueReminderTime}
                        onChange={onTaskSettingsChange}
                        disabled={!taskSettingsForm.OverdueRemindersEnabled}
                      >
                        {TimeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-switch-row form-switch-row--inline">
                    <span className="form-switch-label">Enabled</span>
                    <div className="switch-pill">
                      <input
                        id="overdue-reminders-enabled"
                        type="checkbox"
                        name="OverdueRemindersEnabled"
                        checked={taskSettingsForm.OverdueRemindersEnabled}
                        onChange={onTaskSettingsChange}
                        aria-label="Overdue reminders enabled"
                      />
                      <label
                        htmlFor="overdue-reminders-enabled"
                        className="switch-pill-track"
                      >
                        <span className="switch-pill-icon switch-pill-icon--off">
                          <Icon name="toggleOff" className="icon" />
                        </span>
                        <span className="switch-pill-icon switch-pill-icon--on">
                          <Icon name="toggleOn" className="icon" />
                        </span>
                        <span className="switch-pill-text switch-pill-text--off">Off</span>
                        <span className="switch-pill-text switch-pill-text--on">On</span>
                      </label>
                    </div>
                  </div>
                  <p className="form-note">
                    Runs automatically based on the schedule above when enabled.
                  </p>
                </div>
                <div className="settings-subsection">
                  <div className="settings-subsection-header">
                    <h4>Status</h4>
                    <p>Health and latest results for overdue reminders.</p>
                  </div>
                  <div className="settings-task-status-row">
                    <span className="status-pill">
                      <span
                        className={`status-dot ${
                          taskSettingsForm.OverdueRemindersEnabled ? "status-ok" : "status-checking"
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {taskSettingsForm.OverdueRemindersEnabled ? "Enabled" : "Paused"}
                      </span>
                    </span>
                    <span className="status-pill">
                      <span
                        className={`status-dot ${
                          taskNeedsAttention ? "status-error" : "status-ok"
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {taskNeedsAttention ? "Needs attention" : "Healthy"}
                      </span>
                    </span>
                  </div>
                  <div className="settings-list settings-list--slim">
                    <div className="settings-item">
                      <div>
                        <h4>Last run</h4>
                        <p>Latest overdue reminder timestamp.</p>
                      </div>
                      <div className="settings-item-actions">
                        <span className="settings-task-last-run">
                          {latestTaskRun?.ranAt
                            ? FormatDateTime(latestTaskRun.ranAt)
                            : taskSettings?.OverdueLastNotifiedDate
                              ? FormatDate(taskSettings.OverdueLastNotifiedDate)
                              : "Not run yet"}
                        </span>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={onRefreshTaskStatus}
                          aria-label="Refresh task status"
                          title="Refresh status"
                          disabled={
                            taskSettingsStatus === "loading" || taskHistoryStatus === "loading"
                          }
                        >
                          <Icon name="reset" className="icon" />
                        </button>
                      </div>
                    </div>
                    <div className="settings-item">
                      <div>
                        <h4>Result</h4>
                        <p>Latest run status.</p>
                      </div>
                      <p>{latestTaskRun?.result || "No data"}</p>
                    </div>
                    {latestTaskRun?.result === "Failed" ? (
                      <div className="settings-item">
                        <div>
                          <h4>Error</h4>
                          <p>Most recent failure.</p>
                        </div>
                        <div className="settings-item-actions">
                          <span>{latestTaskRun?.error || "Failed to run overdue reminders."}</span>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              navigator.clipboard.writeText(
                                latestTaskRun?.error || "Failed to run overdue reminders."
                              )
                            }
                            aria-label="Copy error"
                            title="Copy error"
                          >
                            <Icon name="copy" className="icon" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="settings-item">
                        <div>
                          <h4>Sent</h4>
                          <p>Reminders sent in the latest run.</p>
                        </div>
                        <p>
                          {latestTaskRun?.sent !== undefined
                            ? `${latestTaskRun.sent} reminder${latestTaskRun.sent === 1 ? "" : "s"}`
                            : "No data"}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="settings-subsection settings-subsection--tight">
                    <div className="settings-subsection-header">
                      <h4>Tools</h4>
                      <p>Run or review overdue reminders.</p>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={onTaskOverdueRun}
                        disabled={!isParent || taskOverdueRunStatus === "loading"}
                      >
                        {taskOverdueRunStatus === "loading"
                          ? "Running overdue reminders..."
                          : "Run now"}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setShowTaskHistory((prev) => !prev)}
                      >
                        {showTaskHistory ? "Hide log" : "View log"}
                      </button>
                    </div>
                  </div>
                  {showTaskHistory ? (
                    <div className="settings-subsection settings-subsection--tight">
                    <div className="settings-subsection-header">
                      <h4>History</h4>
                      <p>Recent runs stored on the server.</p>
                    </div>
                    <div className="settings-history">
                      {taskRunHistory.length ? (
                        taskRunHistory.map((entry) => (
                          <div key={entry.id} className="settings-history-row">
                            <div>
                              <span className="settings-history-time">
                                {FormatDateTime(entry.ranAt)}
                              </span>
                              <span className="settings-history-result">{entry.result}</span>
                            </div>
                            <span className="settings-history-meta">
                              {entry.result === "Failed"
                                ? entry.error || "Failed to run overdue reminders."
                                : `${entry.sent ?? 0} reminder${entry.sent === 1 ? "" : "s"}`}
                            </span>
                          </div>
                        ))
                        ) : (
                          <p className="form-note">No runs recorded yet.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {!isParent ? (
                    <p className="form-note">Only parent accounts can run overdue reminders.</p>
                  ) : null}
                </div>
              </div>
              {taskToast ? (
                <div className="settings-toast" role="status" aria-live="polite">
                  <span>{taskToast}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSection === "system" ? (
            <div className="settings-system-layout">
              <div className="settings-system-card">
                <div className="settings-section-header">
                  <div className="settings-section-header-row">
                    <div>
                      <h3>System status</h3>
                      <p>API and database connectivity</p>
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
                <div className="system-status-badges">
                  <div className={`system-status-badge system-status-${apiStatus}`}>
                    <Icon name={apiStatus === "ok" ? "check_circle" : "cancel"} className="icon" />
                    <span>API {apiStatus === "ok" ? "ready" : apiStatus === "checking" ? "checking" : "offline"}</span>
                  </div>
                  <div className={`system-status-badge system-status-${dbStatus}`}>
                    <Icon name={dbStatus === "ok" ? "check_circle" : "cancel"} className="icon" />
                    <span>Database {dbStatus === "ok" ? "connected" : dbStatus === "checking" ? "checking" : "offline"}</span>
                  </div>
                </div>
                {systemLastChecked ? (
                  <div className="system-last-checked">
                    Last checked: {systemLastChecked.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                  </div>
                ) : null}
              </div>

              <div className="settings-system-card">
                <div className="settings-section-header">
                  <div className="settings-section-header-row">
                    <div>
                      <h3>Build information</h3>
                      <p>Version and build details</p>
                    </div>
                  </div>
                </div>
                <div className="system-build-table">
                  <div className="system-build-row">
                    <span className="system-build-label">Commit</span>
                    <span className="system-build-value">
                      {(() => {
                        const commitSha = import.meta.env.VITE_COMMIT_SHA || "";
                        const shortCommit = commitSha ? commitSha.substring(0, 7) : "";
                        return shortCommit || "local";
                      })()}
                    </span>
                    <button
                      type="button"
                      className="icon-button system-copy-button"
                      onClick={() => {
                        const commitSha = import.meta.env.VITE_COMMIT_SHA || "";
                        const shortCommit = commitSha ? commitSha.substring(0, 7) : "local";
                        onCopyBuildInfo(shortCommit);
                      }}
                      title="Copy commit"
                    >
                      <Icon name="content_copy" className="icon" />
                    </button>
                  </div>
                  <div className="system-build-row">
                    <span className="system-build-label">Version</span>
                    <span className="system-build-value">
                      {import.meta.env.VITE_APP_VERSION || "dev"}
                    </span>
                    <button
                      type="button"
                      className="icon-button system-copy-button"
                      onClick={() => onCopyBuildInfo(import.meta.env.VITE_APP_VERSION || "dev")}
                      title="Copy version"
                    >
                      <Icon name="content_copy" className="icon" />
                    </button>
                  </div>
                  <div className="system-build-row">
                    <span className="system-build-label">Branch</span>
                    <span className="system-build-value">
                      {import.meta.env.VITE_IMAGE_TAG || "dev"}
                    </span>
                    <button
                      type="button"
                      className="icon-button system-copy-button"
                      onClick={() => onCopyBuildInfo(import.meta.env.VITE_IMAGE_TAG || "dev")}
                      title="Copy branch"
                    >
                      <Icon name="content_copy" className="icon" />
                    </button>
                  </div>
                  <div className="system-build-row">
                    <span className="system-build-label">Build time</span>
                    <span className="system-build-value">
                      {(() => {
                        const buildTimeRaw = import.meta.env.VITE_BUILD_TIME || "";
                        const buildTime =
                          typeof buildTimeRaw === "string"
                            ? buildTimeRaw.trim().replace(/^['"]|['"]$/g, "")
                            : buildTimeRaw;

                        if (!buildTime || buildTime === "dev-build") return "dev-build";

                        const numericValue = Number(buildTime);
                        if (!Number.isNaN(numericValue)) {
                          const looksLikeMillis = numericValue > 1e12;
                          const looksLikeSeconds = numericValue > 1e9 && numericValue < 1e12;
                          if (looksLikeMillis || looksLikeSeconds) {
                            const date = new Date(looksLikeMillis ? numericValue : numericValue * 1000);
                            if (!Number.isNaN(date.getTime())) return date.toLocaleString();
                          }
                          return `build #${buildTime}`;
                        }

                        const d = new Date(buildTime);
                        if (Number.isNaN(d.getTime())) return buildTime;
                        return d.toLocaleString();
                      })()}
                    </span>
                    <button
                      type="button"
                      className="icon-button system-copy-button"
                      onClick={() => {
                        const buildTimeRaw = import.meta.env.VITE_BUILD_TIME || "";
                        onCopyBuildInfo(buildTimeRaw);
                      }}
                      title="Copy build time"
                    >
                      <Icon name="content_copy" className="icon" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "integrations" ? (
            <div className="settings-section settings-section--full">
              <div className="settings-section-header">
                <div className="settings-section-header-row">
                  <div>
                    <h3>Integrations</h3>
                    <p>Connect Everday to external services.</p>
                  </div>
                </div>
              </div>
              <div className="settings-integrations">
                <div className="integrations-catalog">
                  <div
                    className={`integration-card${selectedIntegration === "google" ? " is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIntegration("google")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedIntegration("google");
                      }
                    }}
                  >
                    <div className="integration-card-header">
                      <div className="integration-card-title">
                        <span className="integration-card-icon">
                          <Icon name="agenda" className="icon" />
                        </span>
                        <span>Google Calendar/Tasks</span>
                      </div>
                      <span className="status-pill integration-status-pill">
                        <span className={`status-dot ${googleStatusTone ? `status-${googleStatusTone}` : ""}`} />
                        <span>{googleStatusLabel}</span>
                      </span>
                    </div>
                    <div className="integration-card-meta">{googleCheckedLabel}</div>
                  </div>
                  <div
                    className={`integration-card${selectedIntegration === "health" ? " is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIntegration("health")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedIntegration("health");
                      }
                    }}
                  >
                    <div className="integration-card-header">
                      <div className="integration-card-title">
                        <span className="integration-card-icon">
                          <Icon name="health" className="icon" />
                        </span>
                        <span>Health Auto Export</span>
                      </div>
                      <span className="status-pill integration-status-pill">
                        <span
                          className={`status-dot ${healthHaeConfigured ? "status-ok" : ""}`}
                          aria-hidden="true"
                        />
                        <span>{healthHaeConfigured ? "Connected" : "Disabled"}</span>
                      </span>
                    </div>
                    <div className="integration-card-meta">{healthCheckedLabel}</div>
                  </div>
                </div>
                <div className="integrations-details">
                  {selectedIntegration === "google" ? (
                    <>
                      <div className="integration-detail-topbar">
                        <div className="integration-detail-status">
                          <span className="status-pill integration-status-pill integration-status-pill--large">
                            <span className={`status-dot ${googleStatusTone ? `status-${googleStatusTone}` : ""}`} />
                            <span>{googleStatusLabel}</span>
                          </span>
                          <span
                            className="integration-detail-checked"
                            title={googleValidatedAt ? googleValidatedAt.toLocaleString() : ""}
                          >
                            {googleValidatedAt
                              ? `Checked ${FormatRelativeTime(googleValidatedAt)}`
                              : "Not checked"}
                          </span>
                        </div>
                        <div className="integration-detail-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={onGoogleAuth}
                            disabled={!isParent || googleAuthStatus === "loading"}
                          >
                            {googleAuthStatus === "loading" ? "Opening Google..." : googleActionLabel}
                          </button>
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
                      {!isParent ? (
                        <p className="integration-detail-note">
                          Only a parent account can connect or disconnect this integration.
                        </p>
                      ) : null}
                      {googleNotice ? <p className="form-note">{googleNotice}</p> : null}
                      {googleStatusError ? <p className="form-error">{googleStatusError}</p> : null}
                      {googleAuthError ? <p className="form-error">{googleAuthError}</p> : null}
                      <div className="settings-subsection">
                        <div className="settings-subsection-header">
                          <h4>Configuration</h4>
                          <p>Summary details for the active integration.</p>
                        </div>
                        <div className="settings-list settings-list--slim">
                          <div className="settings-item">
                            <div>
                              <h4>Account</h4>
                              <p>Shared account used to connect.</p>
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
                              <h4>Services</h4>
                              <p>Enabled Google services.</p>
                            </div>
                            <p>{googleServices.length ? googleServices.join(", ") : "Not configured"}</p>
                          </div>
                          <div className="settings-item">
                            <div>
                              <h4>Last sync/check</h4>
                              <p>Most recent validation timestamp.</p>
                            </div>
                            <p>{googleValidatedAt ? googleValidatedAt.toLocaleString() : "Not checked"}</p>
                          </div>
                        </div>
                      </div>
                      <details className="settings-subsection settings-subsection--collapsible">
                        <summary className="settings-subsection-header settings-subsection-summary">
                          <div>
                            <h4>Technical details</h4>
                            <p>Raw identifiers and connection metadata.</p>
                          </div>
                        </summary>
                        <div className="settings-list settings-list--slim settings-list--integrations">
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
                              <p>Raw Google Calendar identifier.</p>
                            </div>
                            <p>{googleStatus?.CalendarId || "Not set"}</p>
                          </div>
                          <div className="settings-item">
                            <div>
                              <h4>Task list ID</h4>
                              <p>Raw Google Tasks list identifier.</p>
                            </div>
                            <p>{googleStatus?.TaskListId || "Not set"}</p>
                          </div>
                        </div>
                      </details>
                    </>
                  ) : null}
                  {selectedIntegration === "health" ? (
                    <>
                      <div className="integration-detail-topbar">
                        <div className="integration-detail-status">
                          <span className="status-pill integration-status-pill integration-status-pill--large">
                            <span
                              className={`status-dot ${healthHaeConfigured ? "status-ok" : ""}`}
                              aria-hidden="true"
                            />
                            <span>{healthHaeConfigured ? "Connected" : "Disabled"}</span>
                          </span>
                          <span
                            className="integration-detail-checked"
                            title={healthHaeCreatedAt ? healthHaeCreatedAt.toLocaleString() : ""}
                          >
                            {healthHaeCreatedAt
                              ? `Checked ${FormatRelativeTime(healthHaeCreatedAt)}`
                              : "Not checked"}
                          </span>
                        </div>
                        <div className="integration-detail-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={rotateHaeApiKey}
                            disabled={healthHaeKeyStatus === "loading"}
                          >
                            {healthHaeConfigured ? "Rotate key" : "Generate key"}
                          </button>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={loadHealthSettings}
                            disabled={healthStatus === "loading"}
                          >
                            {healthStatus === "loading" ? "Refreshing..." : "Refresh status"}
                          </button>
                        </div>
                      </div>
                      <p className="integration-detail-note">
                        Generate an API key to connect Health Auto Export.
                      </p>
                      <div className="settings-subsection settings-subsection--actions-bottom">
                        <div className="settings-subsection-header">
                          <h4>Configuration</h4>
                          <p>Current Health Auto Export settings.</p>
                        </div>
                        <div className="settings-list settings-list--slim">
                          <div className="settings-item">
                            <div>
                              <h4>Status</h4>
                              <p>API key availability.</p>
                            </div>
                            <p>{healthHaeConfigured ? "Key configured" : "No key configured"}</p>
                          </div>
                          <div className="settings-item">
                            <div>
                              <h4>Key ending</h4>
                              <p>Last four characters of the key.</p>
                            </div>
                            <p>{healthHaeLast4 ? `•••• ${healthHaeLast4}` : "Not set"}</p>
                          </div>
                          <div className="settings-item">
                            <div>
                              <h4>Last updated</h4>
                              <p>Latest key rotation timestamp.</p>
                            </div>
                            <p>{healthHaeCreatedAt ? healthHaeCreatedAt.toLocaleString() : "Not set"}</p>
                          </div>
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
                      <details className="settings-subsection settings-subsection--collapsible">
                        <summary className="settings-subsection-header settings-subsection-summary">
                          <div>
                            <h4>Technical details</h4>
                            <p>Additional integration metadata.</p>
                          </div>
                        </summary>
                        <div className="settings-list settings-list--slim">
                          <div className="settings-item">
                            <div>
                              <h4>Header name</h4>
                              <p>Expected HTTP header for the API key.</p>
                            </div>
                            <p>X-API-Key</p>
                          </div>
                          <div className="settings-item">
                            <div>
                              <h4>Created at</h4>
                              <p>When the latest key was generated.</p>
                            </div>
                            <p>{healthHaeCreatedAt ? healthHaeCreatedAt.toLocaleString() : "Not set"}</p>
                          </div>
                        </div>
                      </details>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "health" ? (
            <div className="settings-section">
              {healthError ? <p className="form-error">{healthError}</p> : null}
              {healthStatus === "loading" ? (
                <p>Loading health settings...</p>
              ) : (
                <div className="settings-health">
                  <div className="settings-health-group">
                    <div className="settings-group-header">Basics</div>
                    <div className="settings-health-columns">
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Profile</h4>
                            <p>Keep your metrics up to date.</p>
                          </div>
                          <div className="form-stack">
                            <div className="form-grid form-grid--kv">
                              <label>
                                <span>Birth date</span>
                                <input
                                  type="date"
                                  name="BirthDate"
                                  value={healthProfile.BirthDate}
                                  onChange={onHealthProfileChange}
                                />
                              </label>
                              <label>
                                <span>Height (cm)</span>
                                <input
                                  type="number"
                                  name="HeightCm"
                                  value={healthProfile.HeightCm}
                                  onChange={onHealthProfileChange}
                                />
                              </label>
                              <label>
                                <span>Weight (kg)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  name="WeightKg"
                                  value={healthProfile.WeightKg}
                                  onChange={onHealthProfileChange}
                                />
                              </label>
                              <label>
                                <span>Activity level</span>
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
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Goal</h4>
                            <p>Set BMI target, target weight and date, plus daily calories.</p>
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
                                    {FormatNumber(healthGoal.BmiMin)} to{" "}
                                    {FormatNumber(healthGoal.BmiMax)}
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
                            </>
                          ) : (
                            <p className="form-note">No goal set yet.</p>
                          )}
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
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="settings-health-group">
                    <div className="settings-group-header">Reminders</div>
                    <div className="settings-health-columns">
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Food logging</h4>
                            <p>Set reminder times for each meal slot.</p>
                          </div>
                          <div className="form-stack">
                            <div className="form-switch-row form-switch-row--inline">
                              <span className="form-switch-label">Enable food reminders</span>
                              <div className="switch-pill">
                                <input
                                  id="health-food-reminders-enabled"
                                  type="checkbox"
                                  aria-label="Enable food reminders"
                                  checked={healthReminders.FoodRemindersEnabled}
                                  onChange={onFoodRemindersEnabledChange}
                                />
                                <label
                                  htmlFor="health-food-reminders-enabled"
                                  className="switch-pill-track"
                                >
                                  <span className="switch-pill-icon switch-pill-icon--off">
                                    <Icon name="toggleOff" className="icon" />
                                  </span>
                                  <span className="switch-pill-icon switch-pill-icon--on">
                                    <Icon name="toggleOn" className="icon" />
                                  </span>
                                  <span className="switch-pill-text switch-pill-text--off">Off</span>
                                  <span className="switch-pill-text switch-pill-text--on">On</span>
                                </label>
                              </div>
                            </div>
                            <div className="form-grid form-grid--kv">
                              {MealReminderSlots.map((slot) => (
                                <label key={slot.key}>
                                  <span>{slot.label}</span>
                                  <select
                                    value={healthReminders.FoodReminderTimes[slot.key]}
                                    onChange={(event) =>
                                      onMealReminderTimeChange(slot.key, event.target.value)
                                    }
                                    disabled={!healthReminders.FoodRemindersEnabled}
                                  >
                                    {TimeOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ))}
                            </div>
                            <p className="form-note">
                              Reminders are sent only when the scheduled run matches the selected
                              time and the slot has not been logged.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Weight logging</h4>
                            <p>Set a daily reminder to log your weight.</p>
                          </div>
                          <div className="form-stack">
                            <div className="form-switch-row form-switch-row--inline">
                              <span className="form-switch-label">Enable weight reminders</span>
                              <div className="switch-pill">
                                <input
                                  id="health-weight-reminders-enabled"
                                  type="checkbox"
                                  aria-label="Enable weight reminders"
                                  checked={healthReminders.WeightRemindersEnabled}
                                  onChange={onWeightRemindersEnabledChange}
                                />
                                <label
                                  htmlFor="health-weight-reminders-enabled"
                                  className="switch-pill-track"
                                >
                                  <span className="switch-pill-icon switch-pill-icon--off">
                                    <Icon name="toggleOff" className="icon" />
                                  </span>
                                  <span className="switch-pill-icon switch-pill-icon--on">
                                    <Icon name="toggleOn" className="icon" />
                                  </span>
                                  <span className="switch-pill-text switch-pill-text--off">Off</span>
                                  <span className="switch-pill-text switch-pill-text--on">On</span>
                                </label>
                              </div>
                            </div>
                            <label>
                              <span>Reminder time</span>
                              <select
                                value={healthReminders.WeightReminderTime}
                                onChange={onWeightReminderTimeChange}
                                disabled={!healthReminders.WeightRemindersEnabled}
                              >
                                {TimeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="settings-divider" />
                            {isAdmin ? (
                              <div className="form-stack">
                                <div className="form-actions">
                                  <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={runHealthRemindersNow}
                                    disabled={healthReminderRunStatus === "loading"}
                                  >
                                    {healthReminderRunStatus === "loading"
                                      ? "Running reminders..."
                                      : "Run reminders now"}
                                  </button>
                                </div>
                                {healthReminderRunError ? (
                                  <p className="form-error">{healthReminderRunError}</p>
                                ) : null}
                                {healthReminderRunResult ? (
                                  <div className="settings-list settings-list--slim">
                                    <div className="settings-item">
                                      <div>
                                        <h4>Eligible users</h4>
                                        <p>Users with reminders due at this time.</p>
                                      </div>
                                      <p>{healthReminderRunResult.EligibleUsers ?? 0}</p>
                                    </div>
                                    <div className="settings-item">
                                      <div>
                                        <h4>Processed users</h4>
                                        <p>Users evaluated during the run.</p>
                                      </div>
                                      <p>{healthReminderRunResult.ProcessedUsers ?? 0}</p>
                                    </div>
                                    <div className="settings-item">
                                      <div>
                                        <h4>Notifications sent</h4>
                                        <p>Reminders that were delivered.</p>
                                      </div>
                                      <p>{healthReminderRunResult.NotificationsSent ?? 0}</p>
                                    </div>
                                    <div className="settings-item">
                                      <div>
                                        <h4>Skipped</h4>
                                        <p>Already logged or already run at this time.</p>
                                      </div>
                                      <p>{healthReminderRunResult.Skipped ?? 0}</p>
                                    </div>
                                    <div className="settings-item">
                                      <div>
                                        <h4>Errors</h4>
                                        <p>Failures during the run.</p>
                                      </div>
                                      <p>{healthReminderRunResult.Errors ?? 0}</p>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <p className="form-note">
                                Only admin accounts can run reminders manually.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="settings-health-group">
                    <div className="settings-group-header">Targets</div>
                    <div className="settings-health-columns">
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Targets</h4>
                            <p>Set calorie, protein, and step goals for today.</p>
                          </div>
                          <div className="form-stack">
                            <div className="form-grid form-grid--kv">
                              <label>
                                <span>Daily calories</span>
                                <input
                                  name="DailyCalorieTarget"
                                  type="number"
                                  value={healthTargets.DailyCalorieTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Protein min (g)</span>
                                <input
                                  name="ProteinTargetMin"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.ProteinTargetMin}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Protein max (g)</span>
                                <input
                                  name="ProteinTargetMax"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.ProteinTargetMax}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Step target</span>
                                <input
                                  name="StepTarget"
                                  type="number"
                                  value={healthTargets.StepTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Step kcal factor</span>
                                <input
                                  name="StepKcalFactor"
                                  type="number"
                                  step="0.01"
                                  value={healthTargets.StepKcalFactor}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Fibre target</span>
                                <input
                                  name="FibreTarget"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.FibreTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Carbs target</span>
                                <input
                                  name="CarbsTarget"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.CarbsTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Fat target</span>
                                <input
                                  name="FatTarget"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.FatTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Sat fat target</span>
                                <input
                                  name="SaturatedFatTarget"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.SaturatedFatTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Sugar target</span>
                                <input
                                  name="SugarTarget"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.SugarTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                              <label>
                                <span>Sodium target</span>
                                <input
                                  name="SodiumTarget"
                                  type="number"
                                  step="0.1"
                                  value={healthTargets.SodiumTarget}
                                  onChange={onHealthTargetsChange}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Visibility</h4>
                            <p>Choose which targets show on Today.</p>
                          </div>
                          <div className="form-stack">
                            <div className="form-switch-list">
                              <div className="settings-subgroup">
                                <div className="settings-subgroup-title">Core</div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show protein on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-protein"
                                      type="checkbox"
                                      aria-label="Show protein on Today"
                                      name="ShowProteinOnToday"
                                      checked={healthTargets.ShowProteinOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-protein" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show steps on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-steps"
                                      type="checkbox"
                                      aria-label="Show steps on Today"
                                      name="ShowStepsOnToday"
                                      checked={healthTargets.ShowStepsOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-steps" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                              <div className="settings-subgroup">
                                <div className="settings-subgroup-title">Optional</div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show fibre on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-fibre"
                                      type="checkbox"
                                      aria-label="Show fibre on Today"
                                      name="ShowFibreOnToday"
                                      checked={healthTargets.ShowFibreOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-fibre" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show carbs on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-carbs"
                                      type="checkbox"
                                      aria-label="Show carbs on Today"
                                      name="ShowCarbsOnToday"
                                      checked={healthTargets.ShowCarbsOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-carbs" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show fat on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-fat"
                                      type="checkbox"
                                      aria-label="Show fat on Today"
                                      name="ShowFatOnToday"
                                      checked={healthTargets.ShowFatOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-fat" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show sugar on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-sugar"
                                      type="checkbox"
                                      aria-label="Show sugar on Today"
                                      name="ShowSugarOnToday"
                                      checked={healthTargets.ShowSugarOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-sugar" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                              <div className="settings-subgroup">
                                <div className="settings-subgroup-title">Advanced</div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show sodium on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-sodium"
                                      type="checkbox"
                                      aria-label="Show sodium on Today"
                                      name="ShowSodiumOnToday"
                                      checked={healthTargets.ShowSodiumOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-sodium" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="form-switch-row form-switch-row--inline">
                                  <span className="form-switch-label">Show saturated fat on Today</span>
                                  <div className="switch-pill">
                                    <input
                                      id="show-sat-fat"
                                      type="checkbox"
                                      aria-label="Show saturated fat on Today"
                                      name="ShowSaturatedFatOnToday"
                                      checked={healthTargets.ShowSaturatedFatOnToday}
                                      onChange={onHealthTargetsChange}
                                    />
                                    <label htmlFor="show-sat-fat" className="switch-pill-track">
                                      <span className="switch-pill-icon switch-pill-icon--off">
                                        <Icon name="toggleOff" className="icon" />
                                      </span>
                                      <span className="switch-pill-icon switch-pill-icon--on">
                                        <Icon name="toggleOn" className="icon" />
                                      </span>
                                      <span className="switch-pill-text switch-pill-text--off">Off</span>
                                      <span className="switch-pill-text switch-pill-text--on">On</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="settings-divider" />
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>Charts</h4>
                            <p>Control which charts appear on Today.</p>
                          </div>
                          <div className="form-stack">
                            <div className="form-switch-list">
                              <div className="form-switch-row form-switch-row--inline">
                                <span className="form-switch-label">Show weight chart on Today</span>
                                <div className="switch-pill">
                                  <input
                                    id="show-weight-chart"
                                    type="checkbox"
                                    aria-label="Show weight chart on Today"
                                    checked={healthShowWeightChart}
                                    onChange={(event) => setHealthShowWeightChart(event.target.checked)}
                                  />
                                  <label htmlFor="show-weight-chart" className="switch-pill-track">
                                    <span className="switch-pill-icon switch-pill-icon--off">
                                      <Icon name="toggleOff" className="icon" />
                                    </span>
                                    <span className="switch-pill-icon switch-pill-icon--on">
                                      <Icon name="toggleOn" className="icon" />
                                    </span>
                                    <span className="switch-pill-text switch-pill-text--off">Off</span>
                                    <span className="switch-pill-text switch-pill-text--on">On</span>
                                  </label>
                                </div>
                              </div>
                              <div className="form-switch-row form-switch-row--inline">
                                <span className="form-switch-label">Show steps chart on Today</span>
                                <div className="switch-pill">
                                  <input
                                    id="show-steps-chart"
                                    type="checkbox"
                                    aria-label="Show steps chart on Today"
                                    checked={healthShowStepsChart}
                                    onChange={(event) => setHealthShowStepsChart(event.target.checked)}
                                  />
                                  <label htmlFor="show-steps-chart" className="switch-pill-track">
                                    <span className="switch-pill-icon switch-pill-icon--off">
                                      <Icon name="toggleOff" className="icon" />
                                    </span>
                                    <span className="switch-pill-icon switch-pill-icon--on">
                                      <Icon name="toggleOn" className="icon" />
                                    </span>
                                    <span className="switch-pill-text switch-pill-text--off">Off</span>
                                    <span className="switch-pill-text switch-pill-text--on">On</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="settings-health-group">
                    <div className="settings-group-header">AI</div>
                    <div className="settings-health-columns">
                      <div className="settings-health-column">
                        <div className="settings-subsection settings-subsection--actions-bottom">
                          <div className="settings-subsection-header">
                            <h4>AI targets</h4>
                            <p>Refresh AI suggestions and auto-tune weekly.</p>
                          </div>
                          <div className="form-switch-row form-switch-row--inline">
                            <span className="form-switch-label">Auto-tune targets weekly</span>
                            <div className="switch-pill">
                              <input
                                id="health-auto-tune"
                                type="checkbox"
                                aria-label="Auto-tune targets weekly"
                                checked={healthAutoTuneWeekly}
                                onChange={updateHealthAutoTune}
                              />
                              <label htmlFor="health-auto-tune" className="switch-pill-track">
                                <span className="switch-pill-icon switch-pill-icon--off">
                                  <Icon name="toggleOff" className="icon" />
                                </span>
                                <span className="switch-pill-icon switch-pill-icon--on">
                                  <Icon name="toggleOn" className="icon" />
                                </span>
                                <span className="switch-pill-text switch-pill-text--off">Off</span>
                                <span className="switch-pill-text switch-pill-text--on">On</span>
                              </label>
                            </div>
                          </div>
                          <p className="health-detail">
                            Auto-tune runs once a week when you open the app.
                          </p>
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
                        </div>
                      </div>
                      <div className="settings-health-column">
                        <details className="settings-subsection settings-subsection--collapsible">
                          <summary className="settings-subsection-header settings-subsection-summary">
                            <div>
                              <h4>Recommendation history</h4>
                              <p>Previous AI calculations for reference.</p>
                            </div>
                          </summary>
                          <div className="health-history-list">
                            {healthRecommendationHistory.length ? (
                              healthRecommendationHistory.map((log) => (
                                <div key={log.RecommendationLogId} className="health-history-card">
                                  <div className="health-history-card-header">
                                    <span>{new Date(log.CreatedAt).toLocaleDateString()}</span>
                                    <span className="health-history-card-kcal">
                                      {log.DailyCalorieTarget} kcal
                                    </span>
                                  </div>
                                  <div className="health-history-card-subtitle">
                                    {log.Explanation}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="health-history-card-empty">No recommendations yet.</p>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "access" ? (
            <div className="settings-section settings-section--full">
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
                        <div className="form-switch-row form-switch-row--inline">
                          <span className="form-switch-label">
                            Require password change on first login
                          </span>
                          <div className="switch-pill">
                            <input
                              id="require-password-change"
                              type="checkbox"
                              name="RequirePasswordChange"
                              checked={newUserForm.RequirePasswordChange}
                              onChange={onNewUserChange}
                              aria-label="Require password change on first login"
                            />
                            <label
                              htmlFor="require-password-change"
                              className="switch-pill-track"
                            >
                              <span className="switch-pill-icon switch-pill-icon--off">
                                <Icon name="toggleOff" className="icon" />
                              </span>
                              <span className="switch-pill-icon switch-pill-icon--on">
                                <Icon name="toggleOn" className="icon" />
                              </span>
                              <span className="switch-pill-text switch-pill-text--off">Off</span>
                              <span className="switch-pill-text switch-pill-text--on">On</span>
                            </label>
                          </div>
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
                  <div className="settings-access-table">
                    <div className="settings-access-table-header">
                      <h4>Users</h4>
                      <p>Review roles, profiles, and password resets.</p>
                    </div>
                    <div className="settings-access-table-shell">
                      <DataTable
                        tableKey="settings-users"
                        columns={accessColumns}
                        rows={accessRows}
                        searchTerm={accessSearchTerm}
                        onSearchTermChange={setAccessSearchTerm}
                        renderActions={(row) => {
                          const isOpen = accessMenu?.userId === row.Id;
                          return (
                            <div className="settings-access-actions">
                              {row.RequirePasswordChange ? (
                                <span className="badge">Reset required</span>
                              ) : null}
                              <div className="settings-access-menu">
                                <button
                                  type="button"
                                  className="icon-button settings-access-menu-button"
                                  aria-label="User actions"
                                  aria-haspopup="menu"
                                  aria-expanded={isOpen}
                                  onClick={(event) => onAccessMenuToggle(row.User, event)}
                                >
                                  <Icon name="more" className="icon" />
                                </button>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="settings-access-cards">
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
                                    className="button-secondary"
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
                                <span>{user.Email || "Not set"}</span>
                                <span>{user.DiscordHandle || "Not set"}</span>
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
                </div>
              )}
            </div>
          ) : null}

        </section>
      </div>
      {accessMenuPortal}
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
