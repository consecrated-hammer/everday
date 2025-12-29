import { useEffect, useState } from "react";

import { Logger } from "../../lib/logger.js";

const modules = [
  { title: "Budget", subtitle: "Household" },
  { title: "Health", subtitle: "Portion Note" },
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
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Everday</p>
          <h1>Life admin, one calm workspace.</h1>
          <p className="lede">
            This is the Phase 1 baseline. Modules are wired for navigation and
            the API is online.
          </p>
        </div>
        <div className="status-card">
          <p className="status-title">System status</p>
          <div className="status-row">
            <span className={`status-dot status-${apiStatus}`} aria-hidden="true" />
            <span>API {apiStatus === "ok" ? "ready" : apiStatus}</span>
          </div>
          <div className="status-row">
            <span className={`status-dot status-${dbStatus}`} aria-hidden="true" />
            <span>Database {dbStatus === "ok" ? "connected" : dbStatus}</span>
          </div>
        </div>
      </header>

      <section className="module-grid">
        {modules.map((module) => (
          <article key={module.title} className="module-card">
            <div className="module-title">{module.title}</div>
            <div className="module-subtitle">{module.subtitle}</div>
            <button className="module-button" type="button" disabled>
              Coming next
            </button>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Home;
