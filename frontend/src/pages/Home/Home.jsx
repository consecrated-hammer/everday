import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { GetDisplayName } from "../../lib/authStorage.js";
import { Logger } from "../../lib/logger.js";

const modules = [
  {
    title: "Budget",
    subtitle: "Income, expenses, and allocations",
    cta: "Open Budget",
    href: "/budget/allocations"
  },
  {
    title: "Health",
    subtitle: "Meals, steps, and nutrition",
    cta: "Open Health",
    href: "/health/today"
  },
  { title: "Agenda", subtitle: "Recurrence and reminders" },
  { title: "Inbox", subtitle: "Uploads and triage" },
  { title: "AI Intake", subtitle: "Draft suggestions" },
  { title: "Notifications", subtitle: "Discord and email" },
  { title: "Calendar Sync", subtitle: "ICS feeds" }
];

const Home = () => {
  const [apiStatus, setApiStatus] = useState("checking");
  const [dbStatus, setDbStatus] = useState("checking");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8100";
  const displayName = GetDisplayName();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        const nextStatus = response.ok ? "ok" : "error";
        setApiStatus(nextStatus);
        Logger.Debug("api health check", { status: nextStatus });
      } catch (error) {
        setApiStatus("error");
        Logger.Error("api health check failed", { error: error?.message });
      }

      try {
        const response = await fetch(`${apiBaseUrl}/health/db`);
        const body = await response.json();
        const nextStatus = response.ok && body.status === "ok" ? "ok" : "error";
        setDbStatus(nextStatus);
        Logger.Debug("db health check", {
          status: nextStatus,
          detail: body?.detail || null
        });
      } catch (error) {
        setDbStatus("error");
        Logger.Error("db health check failed", { error: error?.message });
      }
    };

    checkStatus();
  }, [apiBaseUrl]);

  return (
    <div className="app-shell app-shell--wide dashboard">
      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Everday</p>
          {displayName ? <p className="welcome-banner">Welcome {displayName}!</p> : null}
          <h1>Household control center.</h1>
          <p className="lede">
            Stay on top of money, schedules, and life admin with clear, shared workflows.
          </p>
          <div className="dashboard-status dashboard-status--muted">
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
      </header>

      <section className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Modules</h2>
            <p>Jump straight into the areas that matter today.</p>
          </div>
        </div>
        <div className="module-grid">
          {modules.map((module) => (
            <article key={module.title} className="module-card">
              <div className="module-title">{module.title}</div>
              <div className="module-subtitle">{module.subtitle}</div>
              {module.href ? (
                <Link className="module-button module-button--active" to={module.href}>
                  {module.cta || "Open"}
                </Link>
              ) : (
                <button className="module-button" type="button" disabled>
                  Coming soon
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
