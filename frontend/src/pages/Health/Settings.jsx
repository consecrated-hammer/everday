import { useEffect, useState } from "react";

import {
  FetchHealthProfile,
  FetchHealthSettings,
  FetchRecommendationHistory,
  GetAiRecommendations,
  UpdateHealthProfile,
  UpdateHealthSettings
} from "../../lib/healthApi.js";

const EmptyProfile = {
  FirstName: "",
  LastName: "",
  Email: "",
  BirthDate: "",
  HeightCm: "",
  WeightKg: "",
  ActivityLevel: ""
};

const EmptyTargets = {
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

const ActivityOptions = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly_active", label: "Lightly active" },
  { value: "moderately_active", label: "Moderately active" },
  { value: "very_active", label: "Very active" },
  { value: "extra_active", label: "Extra active" }
];

const BuildTargetsState = (settingsTargets) => ({
  ...EmptyTargets,
  ...settingsTargets,
  FibreTarget: settingsTargets.FibreTarget ?? "",
  CarbsTarget: settingsTargets.CarbsTarget ?? "",
  FatTarget: settingsTargets.FatTarget ?? "",
  SaturatedFatTarget: settingsTargets.SaturatedFatTarget ?? "",
  SugarTarget: settingsTargets.SugarTarget ?? "",
  SodiumTarget: settingsTargets.SodiumTarget ?? ""
});

const Settings = () => {
  const [profile, setProfile] = useState(EmptyProfile);
  const [targets, setTargets] = useState(EmptyTargets);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationHistory, setRecommendationHistory] = useState([]);
  const [autoTuneWeekly, setAutoTuneWeekly] = useState(false);
  const [autoTuneLastRunAt, setAutoTuneLastRunAt] = useState(null);

  const loadData = async () => {
    try {
      setStatus("loading");
      setError("");
      const [settings, profileData, history] = await Promise.all([
        FetchHealthSettings(),
        FetchHealthProfile(),
        FetchRecommendationHistory()
      ]);
      setTargets(BuildTargetsState(settings.Targets));
      setProfile({
        ...EmptyProfile,
        FirstName: profileData.FirstName || "",
        LastName: profileData.LastName || "",
        Email: profileData.Email || "",
        BirthDate: profileData.BirthDate || "",
        HeightCm: profileData.HeightCm || "",
        WeightKg: profileData.WeightKg || "",
        ActivityLevel: profileData.ActivityLevel || ""
      });
      setRecommendationHistory(history.Logs || []);
      setAutoTuneWeekly(Boolean(settings.AutoTuneTargetsWeekly));
      setAutoTuneLastRunAt(settings.LastAutoTuneAt ? new Date(settings.LastAutoTuneAt) : null);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load settings");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const onTargetsChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setTargets((prev) => ({ ...prev, [name]: nextValue }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      await UpdateHealthProfile({
        FirstName: profile.FirstName || null,
        LastName: profile.LastName || null,
        Email: profile.Email || null,
        BirthDate: profile.BirthDate || null,
        HeightCm: profile.HeightCm ? Number(profile.HeightCm) : null,
        WeightKg: profile.WeightKg ? Number(profile.WeightKg) : null,
        ActivityLevel: profile.ActivityLevel || null
      });
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update profile");
    }
  };

  const saveTargets = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      await UpdateHealthSettings({
        DailyCalorieTarget: Number(targets.DailyCalorieTarget || 0),
        ProteinTargetMin: Number(targets.ProteinTargetMin || 0),
        ProteinTargetMax: Number(targets.ProteinTargetMax || 0),
        StepTarget: Number(targets.StepTarget || 0),
        StepKcalFactor: Number(targets.StepKcalFactor || 0),
        FibreTarget: targets.FibreTarget ? Number(targets.FibreTarget) : null,
        CarbsTarget: targets.CarbsTarget ? Number(targets.CarbsTarget) : null,
        FatTarget: targets.FatTarget ? Number(targets.FatTarget) : null,
        SaturatedFatTarget: targets.SaturatedFatTarget
          ? Number(targets.SaturatedFatTarget)
          : null,
        SugarTarget: targets.SugarTarget ? Number(targets.SugarTarget) : null,
        SodiumTarget: targets.SodiumTarget ? Number(targets.SodiumTarget) : null,
        ShowProteinOnToday: targets.ShowProteinOnToday,
        ShowStepsOnToday: targets.ShowStepsOnToday,
        ShowFibreOnToday: targets.ShowFibreOnToday,
        ShowCarbsOnToday: targets.ShowCarbsOnToday,
        ShowFatOnToday: targets.ShowFatOnToday,
        ShowSaturatedFatOnToday: targets.ShowSaturatedFatOnToday,
        ShowSugarOnToday: targets.ShowSugarOnToday,
        ShowSodiumOnToday: targets.ShowSodiumOnToday
      });
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to update targets");
    }
  };

  const runRecommendation = async () => {
    try {
      setStatus("loading");
      setError("");
      const result = await GetAiRecommendations();
      setRecommendation(result);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to fetch recommendations");
    }
  };

  const updateAutoTune = async (event) => {
    const nextValue = event.target.checked;
    const previousValue = autoTuneWeekly;
    setAutoTuneWeekly(nextValue);
    try {
      setStatus("saving");
      setError("");
      const updated = await UpdateHealthSettings({
        AutoTuneTargetsWeekly: nextValue
      });
      setTargets(BuildTargetsState(updated.Targets));
      setAutoTuneWeekly(Boolean(updated.AutoTuneTargetsWeekly));
      setAutoTuneLastRunAt(
        updated.LastAutoTuneAt ? new Date(updated.LastAutoTuneAt) : null
      );
      setStatus("ready");
    } catch (err) {
      setAutoTuneWeekly(previousValue);
      setStatus("error");
      setError(err?.message || "Failed to update auto-tune settings");
    }
  };

  const applyRecommendation = () => {
    if (!recommendation) return;
    setTargets((prev) => ({
      ...prev,
      DailyCalorieTarget: recommendation.DailyCalorieTarget,
      ProteinTargetMin: recommendation.ProteinTargetMin,
      ProteinTargetMax: recommendation.ProteinTargetMax,
      FibreTarget: recommendation.FibreTarget || "",
      CarbsTarget: recommendation.CarbsTarget || "",
      FatTarget: recommendation.FatTarget || "",
      SaturatedFatTarget: recommendation.SaturatedFatTarget || "",
      SugarTarget: recommendation.SugarTarget || "",
      SodiumTarget: recommendation.SodiumTarget || ""
    }));
  };

  return (
    <div className="health-settings">
      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h2>Profile</h2>
            <p>Keep your metrics up to date.</p>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        <form className="form-grid" onSubmit={saveProfile}>
          <label>
            First name
            <input name="FirstName" value={profile.FirstName} onChange={onProfileChange} />
          </label>
          <label>
            Last name
            <input name="LastName" value={profile.LastName} onChange={onProfileChange} />
          </label>
          <label>
            Email
            <input name="Email" value={profile.Email} onChange={onProfileChange} />
          </label>
          <label>
            Birth date
            <input type="date" name="BirthDate" value={profile.BirthDate} onChange={onProfileChange} />
          </label>
          <label>
            Height (cm)
            <input name="HeightCm" type="number" value={profile.HeightCm} onChange={onProfileChange} />
          </label>
          <label>
            Weight (kg)
            <input name="WeightKg" type="number" step="0.1" value={profile.WeightKg} onChange={onProfileChange} />
          </label>
          <label>
            Activity level
            <select name="ActivityLevel" value={profile.ActivityLevel} onChange={onProfileChange}>
              <option value="">Select</option>
              {ActivityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit">Save profile</button>
          </div>
        </form>
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h2>Targets</h2>
            <p>Keep today aligned with your goals.</p>
          </div>
        </header>
        <form className="form-grid" onSubmit={saveTargets}>
          <label>
            Daily calories
            <input
              name="DailyCalorieTarget"
              type="number"
              value={targets.DailyCalorieTarget}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Protein min (g)
            <input
              name="ProteinTargetMin"
              type="number"
              step="0.1"
              value={targets.ProteinTargetMin}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Protein max (g)
            <input
              name="ProteinTargetMax"
              type="number"
              step="0.1"
              value={targets.ProteinTargetMax}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Step target
            <input name="StepTarget" type="number" value={targets.StepTarget} onChange={onTargetsChange} />
          </label>
          <label>
            Calories per step
            <input
              name="StepKcalFactor"
              type="number"
              step="0.01"
              value={targets.StepKcalFactor}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Fibre target
            <input
              name="FibreTarget"
              type="number"
              step="0.1"
              value={targets.FibreTarget}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Carbs target
            <input
              name="CarbsTarget"
              type="number"
              step="0.1"
              value={targets.CarbsTarget}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Fat target
            <input
              name="FatTarget"
              type="number"
              step="0.1"
              value={targets.FatTarget}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Sat fat target
            <input
              name="SaturatedFatTarget"
              type="number"
              step="0.1"
              value={targets.SaturatedFatTarget}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Sugar target
            <input
              name="SugarTarget"
              type="number"
              step="0.1"
              value={targets.SugarTarget}
              onChange={onTargetsChange}
            />
          </label>
          <label>
            Sodium target
            <input
              name="SodiumTarget"
              type="number"
              step="0.1"
              value={targets.SodiumTarget}
              onChange={onTargetsChange}
            />
          </label>
          <div className="form-switch-row">
            <span className="form-switch-label">Show protein on Today</span>
            <input
              type="checkbox"
              name="ShowProteinOnToday"
              checked={targets.ShowProteinOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show steps on Today</span>
            <input
              type="checkbox"
              name="ShowStepsOnToday"
              checked={targets.ShowStepsOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show fibre on Today</span>
            <input
              type="checkbox"
              name="ShowFibreOnToday"
              checked={targets.ShowFibreOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show carbs on Today</span>
            <input
              type="checkbox"
              name="ShowCarbsOnToday"
              checked={targets.ShowCarbsOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show fat on Today</span>
            <input
              type="checkbox"
              name="ShowFatOnToday"
              checked={targets.ShowFatOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show saturated fat on Today</span>
            <input
              type="checkbox"
              name="ShowSaturatedFatOnToday"
              checked={targets.ShowSaturatedFatOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show sugar on Today</span>
            <input
              type="checkbox"
              name="ShowSugarOnToday"
              checked={targets.ShowSugarOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-switch-row">
            <span className="form-switch-label">Show sodium on Today</span>
            <input
              type="checkbox"
              name="ShowSodiumOnToday"
              checked={targets.ShowSodiumOnToday}
              onChange={onTargetsChange}
            />
          </div>
          <div className="form-actions">
            <button type="submit">Save targets</button>
          </div>
        </form>
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>AI recommendations</h3>
            <p>Generate targets based on your profile.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={runRecommendation}
            disabled={status === "loading"}
          >
            {recommendation ? "Refresh recommendations" : "Get recommendations"}
          </button>
        </header>
        <div className="form-switch-row">
          <span className="form-switch-label">Auto-tune targets weekly</span>
          <input type="checkbox" checked={autoTuneWeekly} onChange={updateAutoTune} />
        </div>
        <p className="health-detail">
          Auto-tune runs once a week when you open the app.
        </p>
        {autoTuneLastRunAt ? (
          <p className="health-detail">
            Last auto-tune: {autoTuneLastRunAt.toLocaleString()}
          </p>
        ) : (
          <p className="health-detail">No auto-tune run yet.</p>
        )}
        {recommendation ? (
          <div className="health-ai-result">
            <h4>Suggested targets</h4>
            <p>{recommendation.Explanation}</p>
            <div className="health-summary-grid">
              <div>
                <p>Calories</p>
                <h3>{recommendation.DailyCalorieTarget}</h3>
              </div>
              <div>
                <p>Protein min</p>
                <h3>{recommendation.ProteinTargetMin}</h3>
              </div>
              <div>
                <p>Protein max</p>
                <h3>{recommendation.ProteinTargetMax}</h3>
              </div>
            </div>
            <button type="button" onClick={applyRecommendation}>
              Apply to targets
            </button>
          </div>
        ) : null}
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>Recommendation history</h3>
            <p>Previous AI calculations for reference.</p>
          </div>
        </header>
        <div className="health-history">
          {recommendationHistory.length ? (
            recommendationHistory.map((log) => (
              <div key={log.RecommendationLogId} className="health-history-day">
                <div className="health-history-header">
                  <h4>{new Date(log.CreatedAt).toLocaleDateString()}</h4>
                  <span>{log.DailyCalorieTarget} kcal</span>
                </div>
                <p>{log.Explanation}</p>
              </div>
            ))
          ) : (
            <p className="health-empty">No recommendations yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Settings;
