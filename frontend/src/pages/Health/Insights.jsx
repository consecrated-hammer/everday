import { useCallback, useEffect, useMemo, useState } from "react";

import { FetchAiSuggestions, FetchWeeklySummary } from "../../lib/healthApi.js";

const FormatDate = (value) => value.toISOString().slice(0, 10);

const GetRollingStart = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return date;
};

const FormatAverage = (total, decimals = 0) => {
  const value = Number(total) || 0;
  const factor = 10 ** decimals;
  return Math.round((value / 7) * factor) / factor;
};

const SuggestionsCacheMs = 60 * 60 * 1000;

const BuildSuggestionsCacheKey = (logDate) => `health.aiSuggestions.${logDate}`;

const LoadSuggestionsCache = (logDate) => {
  const raw = localStorage.getItem(BuildSuggestionsCacheKey(logDate));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.Suggestions) || !parsed.Timestamp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const SaveSuggestionsCache = (logDate, payload) => {
  localStorage.setItem(BuildSuggestionsCacheKey(logDate), JSON.stringify(payload));
};

const FormatSuggestedTime = (value) =>
  value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const Insights = () => {
  const [summary, setSummary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsStatus, setSuggestionsStatus] = useState("idle");
  const [lastSuggestedAt, setLastSuggestedAt] = useState(null);
  const [error, setError] = useState("");

  const weekStart = useMemo(() => FormatDate(GetRollingStart()), []);
  const today = useMemo(() => FormatDate(new Date()), []);

  const loadSuggestions = useCallback(async ({ force = false } = {}) => {
    // Check localStorage cache first for quick load
    const cached = LoadSuggestionsCache(today);
    if (cached?.Timestamp) {
      setLastSuggestedAt(new Date(cached.Timestamp));
    }
    if (cached && !force) {
      const ageMs = Date.now() - cached.Timestamp;
      if (ageMs < SuggestionsCacheMs) {
        setSuggestions(cached.Suggestions || []);
        setSuggestionsStatus("ready");
        return;
      }
    }

    try {
      setSuggestionsStatus("loading");
      // Fetch from API - backend now stores and returns suggestions
      const ai = await FetchAiSuggestions(today);
      const nextSuggestions = ai.Suggestions || [];
      setSuggestions(nextSuggestions);
      const now = Date.now();
      setLastSuggestedAt(new Date(now));
      // Update localStorage cache for faster subsequent loads
      SaveSuggestionsCache(today, {
        Timestamp: now,
        Suggestions: nextSuggestions
      });
      setSuggestionsStatus("ready");
    } catch {
      // Fall back to cached if available
      if (cached) {
        setSuggestions(cached.Suggestions || []);
        setSuggestionsStatus("ready");
      } else {
        setSuggestions([]);
        setSuggestionsStatus("error");
      }
    }
  }, [today]);

  const loadInsights = useCallback(async () => {
    try {
      setError("");
      const weekly = await FetchWeeklySummary(weekStart);
      setSummary(weekly);
      await loadSuggestions();
    } catch (err) {
      setError(err?.message || "Failed to load insights");
    }
  }, [loadSuggestions, weekStart]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);


  return (
    <div className="health-insights">
      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h2>Weekly snapshot</h2>
            <p>7 day averages based on the last week.</p>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {summary ? (
          <div className="health-summary-grid">
            <div>
              <p>Average calories</p>
              <h3>{FormatAverage(summary.Totals.TotalCalories)}</h3>
            </div>
            <div>
              <p>Average protein</p>
              <h3>{FormatAverage(summary.Totals.TotalProtein, 1)}</h3>
            </div>
            <div>
              <p>Average steps</p>
              <h3>{FormatAverage(summary.Totals.TotalSteps)}</h3>
            </div>
          </div>
        ) : (
          <p className="health-empty">No summary data yet.</p>
        )}
      </section>

      <section className="module-panel" id="ai-suggestions">
        <header className="module-panel-header">
          <div>
            <h3>AI suggestions</h3>
            <p>
              Suggestions use today’s log first and fall back to your last 7 days when the day is
              sparse.
            </p>
            {lastSuggestedAt ? (
              <p className="health-detail">Last suggested at {FormatSuggestedTime(lastSuggestedAt)}.</p>
            ) : (
              <p className="health-detail">Not suggested yet.</p>
            )}
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => loadSuggestions({ force: true })}
            disabled={suggestionsStatus === "loading"}
          >
            {suggestionsStatus === "loading" ? (
              <span className="health-lookup-loading">
                <span className="loading-spinner" aria-hidden="true" />
                Refreshing
              </span>
            ) : (
              "Refresh"
            )}
          </button>
        </header>
        <div className="health-suggestions">
          {suggestionsStatus === "loading" ? (
            <div className="health-lookup-loading health-ai-loading">
              <span className="loading-spinner loading-spinner--large" aria-hidden="true" />
              Fetching suggestions...
            </div>
          ) : null}
          {suggestionsStatus !== "loading" && suggestions.length
            ? suggestions.map((suggestion, index) => (
                <div key={`${suggestion.Title}-${index}`}>
                  <h4>{suggestion.Title}</h4>
                  <p>{suggestion.Detail}</p>
                </div>
              ))
            : null}
          {suggestionsStatus === "error" ? (
            <p className="health-empty">Unable to load suggestions.</p>
          ) : null}
          {suggestionsStatus === "ready" && suggestions.length === 0 ? (
            <p className="health-empty">No suggestions yet. Log more meals or steps to get AI guidance.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default Insights;
