import { useEffect, useState } from "react";

import { FetchHealthProfile, UpdateHealthProfile } from "../lib/healthApi.js";
import { GetTokens } from "../lib/authStorage.js";

const ActivityOptions = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly_active", label: "Lightly active" },
  { value: "moderately_active", label: "Moderately active" },
  { value: "very_active", label: "Very active" },
  { value: "extra_active", label: "Extra active" }
];

const EmptyProfile = {
  BirthDate: "",
  HeightCm: "",
  WeightKg: "",
  ActivityLevel: ""
};

const IsProfileComplete = (profile) =>
  Boolean(profile.BirthDate && profile.HeightCm && profile.WeightKg && profile.ActivityLevel);

const HealthProfilePrompt = () => {
  const tokens = GetTokens();
  const [form, setForm] = useState(EmptyProfile);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isActive = true;
    const loadProfile = async () => {
      try {
        setStatus("loading");
        const profile = await FetchHealthProfile();
        if (!isActive) {
          return;
        }
        const nextForm = {
          BirthDate: profile.BirthDate || "",
          HeightCm: profile.HeightCm ? String(profile.HeightCm) : "",
          WeightKg: profile.WeightKg ? String(profile.WeightKg) : "",
          ActivityLevel: profile.ActivityLevel || ""
        };
        setForm(nextForm);
        if (!IsProfileComplete(nextForm)) {
          setOpen(true);
        }
      } catch (err) {
        if (isActive) {
          setError(err?.message || "Failed to load health profile");
        }
      } finally {
        if (isActive) {
          setStatus("ready");
        }
      }
    };
    if (!tokens?.RequirePasswordChange) {
      loadProfile();
    }
    return () => {
      isActive = false;
    };
  }, [tokens?.RequirePasswordChange]);

  if (!open || tokens?.RequirePasswordChange) {
    return null;
  }

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!IsProfileComplete(form)) {
      setError("Please complete all fields.");
      return;
    }
    try {
      setStatus("saving");
      await UpdateHealthProfile({
        BirthDate: form.BirthDate,
        HeightCm: Number(form.HeightCm),
        WeightKg: Number(form.WeightKg),
        ActivityLevel: form.ActivityLevel
      });
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to save health profile");
    } finally {
      setStatus("ready");
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Tell us about you</h3>
        </div>
        <p>Set your health profile to personalize targets.</p>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Birth date
            <input
              type="date"
              name="BirthDate"
              value={form.BirthDate}
              onChange={onChange}
              required
            />
          </label>
          <label>
            Height (cm)
            <input
              type="number"
              name="HeightCm"
              value={form.HeightCm}
              onChange={onChange}
              required
            />
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              step="0.1"
              name="WeightKg"
              value={form.WeightKg}
              onChange={onChange}
              required
            />
          </label>
          <label>
            Activity level
            <select name="ActivityLevel" value={form.ActivityLevel} onChange={onChange} required>
              <option value="">Select</option>
              {ActivityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : "Save health info"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setOpen(false)}>
              Not now
            </button>
          </div>
        </form>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
};

export default HealthProfilePrompt;
