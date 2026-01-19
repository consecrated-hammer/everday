import { useEffect, useMemo, useState } from "react";

import { FetchAiSuggestions, FetchWeeklySummary } from "../../lib/healthApi.js";

const FormatDate = (value) => value.toISOString().slice(0, 10);

const GetMonday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday;
};

const Insights = () => {
  const [summary, setSummary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [suggestionsStatus, setSuggestionsStatus] = useState("idle");
  const [error, setError] = useState("");

  const weekStart = useMemo(() => FormatDate(GetMonday()), []);
  const today = useMemo(() => FormatDate(new Date()), []);

  const loadSuggestions = async () => {
    try {
      setSuggestionsStatus("loading");
      const ai = await FetchAiSuggestions(today);
      setSuggestions(ai.Suggestions || []);
      setSuggestionsStatus("ready");
    } catch {
      setSuggestions([]);
      setSuggestionsStatus("error");
    }
  };

  const loadInsights = async () => {
    try {
      setStatus("loading");
      setError("");
      const weekly = await FetchWeeklySummary(weekStart);
      setSummary(weekly);
      await loadSuggestions();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load insights");
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  return (
    <div className="health-insights">
      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h2>Weekly snapshot</h2>
            <p>Monday to Sunday totals.</p>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {summary ? (
          <div className="health-summary-grid">
            <div>
              <p>Total calories</p>
              <h3>{summary.Totals.TotalCalories}</h3>
            </div>
            <div>
              <p>Total protein</p>
              <h3>{summary.Totals.TotalProtein}</h3>
            </div>
            <div>
              <p>Total steps</p>
              <h3>{summary.Totals.TotalSteps}</h3>
            </div>
            <div>
              <p>Average calories</p>
              <h3>{summary.Averages.AverageCalories}</h3>
            </div>
            <div>
              <p>Average protein</p>
              <h3>{summary.Averages.AverageProtein}</h3>
            </div>
            <div>
              <p>Average steps</p>
              <h3>{summary.Averages.AverageSteps}</h3>
            </div>
          </div>
        ) : (
          <p className="health-empty">No summary data yet.</p>
        )}
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>AI suggestions</h3>
            <p>Guidance tuned to today's log.</p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={loadSuggestions}
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
          {suggestions.length ? (
            suggestions.map((suggestion, index) => (
              <div key={`${suggestion.Title}-${index}`}>
                <h4>{suggestion.Title}</h4>
                <p>{suggestion.Detail}</p>
              </div>
            ))
          ) : (
            <p className="health-empty">No suggestions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Insights;
