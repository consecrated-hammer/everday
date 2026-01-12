import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { FetchDailyLog, FetchHealthSettings, FetchWeeklySummary } from "../../../lib/healthApi.js";

const FormatDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ParseLocalDate = (value) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
};

const FormatNumber = (value) => {
  if (value === null || value === undefined) return "0";
  return Number(value).toLocaleString();
};

const BuildWeeklySeries = (startDate, summary, target) => {
  const days = summary?.Days || [];
  const byDate = new Map(days.map((day) => [day.LogDate, day]));
  const series = [];
  const start = ParseLocalDate(startDate);

  for (let i = 0; i < 7; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const iso = FormatDate(current);
    const record = byDate.get(iso);
    series.push({
      Date: iso,
      Label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Calories: record?.TotalCalories ?? 0,
      Target: target ?? 0
    });
  }

  return series;
};

const FormatXAxisLabel = (value, index) => {
  if (index === 0) {
    return value;
  }
  const parts = String(value).split(" ");
  return parts[parts.length - 1] || value;
};

const HealthWidget = ({ IsExpanded }) => {
  const today = useMemo(() => FormatDate(new Date()), []);
  const startDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return FormatDate(date);
  }, []);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [targets, setTargets] = useState(null);
  const [log, setLog] = useState(null);
  const [totals, setTotals] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setStatus("loading");
        setError("");
        const [settings, dailyData, weeklyData] = await Promise.all([
          FetchHealthSettings(),
          FetchDailyLog(today),
          FetchWeeklySummary(startDate)
        ]);
        setTargets(settings.Targets);
        setLog(dailyData.DailyLog);
        setTotals(dailyData.Totals || null);
        setWeeklySummary(weeklyData);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Unable to load health snapshot.");
      }
    };
    load();
  }, [startDate, today]);

  const weeklySeries = useMemo(
    () => BuildWeeklySeries(startDate, weeklySummary, targets?.DailyCalorieTarget ?? 0),
    [startDate, targets, weeklySummary]
  );

  const calories = totals?.NetCalories ?? totals?.TotalCalories ?? 0;
  const protein = totals?.TotalProtein ?? 0;
  const steps = log?.Steps ?? 0;

  const summaryItems = [
    {
      Key: "Calories",
      Label: "Calories",
      Value: calories,
      Target: targets?.DailyCalorieTarget ?? 0
    },
    {
      Key: "Protein",
      Label: "Protein",
      Value: protein,
      Target: targets?.ProteinTargetMax ?? targets?.ProteinTargetMin ?? 0
    },
    {
      Key: "Steps",
      Label: "Steps",
      Value: steps,
      Target: targets?.StepTarget ?? 0
    }
  ];

  const chartHeight = IsExpanded ? 200 : 160;

  return (
    <div className="widget-body">
      {status === "loading" ? <p className="text-muted">Loading health snapshot...</p> : null}
      {status === "error" ? <p className="form-error">{error}</p> : null}
      {status === "ready" ? (
        <>
          <div className="dashboard-health-chart">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart data={weeklySeries} margin={{ top: 10, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(43, 110, 246, 0.18)" />
                <XAxis
                  dataKey="Label"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={FormatXAxisLabel}
                />
                <YAxis tickLine={false} axisLine={false} width={50} tickMargin={6} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="Calories"
                  stroke="var(--chart-primary)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Target"
                  stroke="var(--accent)"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="health-summary-grid">
            {summaryItems.map((item) => (
              <div key={item.Key} className="health-summary-item">
                <span className="metric-label">{item.Label}</span>
                <span className="health-summary-value">
                  {FormatNumber(item.Value)}
                  {item.Target ? ` / ${FormatNumber(item.Target)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default HealthWidget;
