import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { FetchKidLedger, FetchPocketMoneyRule } from "../../../lib/kidsApi.js";
import { FormatCurrency, FormatDate, FormatDateTime } from "../../../lib/formatters.js";

const NormalizeDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const AddDays = (value, days) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const DaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const WeekdayIndex = (value) => (value.getDay() + 6) % 7;

const NextWeekly = (afterDate, dayOfWeek) => {
  const delta = (dayOfWeek - WeekdayIndex(afterDate) + 7) % 7;
  return AddDays(afterDate, delta === 0 ? 7 : delta);
};

const NextFortnightly = (afterDate, anchorDate) => {
  if (afterDate < anchorDate) {
    return anchorDate;
  }
  const deltaDays = Math.floor((afterDate - anchorDate) / 86400000);
  const remainder = deltaDays % 14;
  if (remainder === 0) {
    return AddDays(afterDate, 14);
  }
  return AddDays(afterDate, 14 - remainder);
};

const NextMonthly = (afterDate, dayOfMonth) => {
  const year = afterDate.getFullYear();
  const monthIndex = afterDate.getMonth() + 1;
  const targetYear = monthIndex > 11 ? year + 1 : year;
  const targetMonth = monthIndex > 11 ? 0 : monthIndex;
  const day = Math.min(dayOfMonth, DaysInMonth(targetYear, targetMonth));
  return new Date(targetYear, targetMonth, day);
};

const FirstMonthly = (startDate, dayOfMonth) => {
  const day = Math.min(dayOfMonth, DaysInMonth(startDate.getFullYear(), startDate.getMonth()));
  const candidate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
  if (candidate < startDate) {
    return NextMonthly(startDate, dayOfMonth);
  }
  return candidate;
};

const NextPocketMoneyRun = (rule) => {
  if (!rule || !rule.IsActive || !rule.Amount) {
    return null;
  }
  const startDate = NormalizeDate(rule.StartDate);
  if (!startDate) {
    return null;
  }
  const today = NormalizeDate(new Date());
  const dayOfWeek = Number(rule.DayOfWeek);
  const dayOfMonth = Number(rule.DayOfMonth);
  let nextDate = null;
  let anchorDate = startDate;

  if (rule.Frequency === "weekly") {
    if (Number.isNaN(dayOfWeek)) {
      return null;
    }
    if (rule.LastPostedOn) {
      const lastPosted = NormalizeDate(rule.LastPostedOn);
      nextDate = lastPosted ? NextWeekly(lastPosted, dayOfWeek) : startDate;
    } else {
      nextDate = startDate;
      if (WeekdayIndex(nextDate) !== dayOfWeek) {
        nextDate = NextWeekly(AddDays(nextDate, -1), dayOfWeek);
      }
    }
  } else if (rule.Frequency === "fortnightly") {
    if (Number.isNaN(dayOfWeek)) {
      return null;
    }
    if (WeekdayIndex(anchorDate) !== dayOfWeek) {
      anchorDate = NextWeekly(AddDays(anchorDate, -1), dayOfWeek);
    }
    if (rule.LastPostedOn) {
      const lastPosted = NormalizeDate(rule.LastPostedOn);
      nextDate = lastPosted ? NextFortnightly(lastPosted, anchorDate) : anchorDate;
    } else {
      nextDate = anchorDate;
    }
  } else if (rule.Frequency === "monthly") {
    if (Number.isNaN(dayOfMonth)) {
      return null;
    }
    if (rule.LastPostedOn) {
      const lastPosted = NormalizeDate(rule.LastPostedOn);
      nextDate = lastPosted ? NextMonthly(lastPosted, dayOfMonth) : FirstMonthly(startDate, dayOfMonth);
    } else {
      nextDate = FirstMonthly(startDate, dayOfMonth);
    }
  }

  if (!nextDate) {
    return null;
  }
  while (nextDate < today) {
    if (rule.Frequency === "weekly") {
      nextDate = NextWeekly(nextDate, dayOfWeek);
    } else if (rule.Frequency === "fortnightly") {
      nextDate = NextFortnightly(nextDate, anchorDate);
    } else {
      nextDate = NextMonthly(nextDate, dayOfMonth);
    }
  }
  return nextDate;
};

const BuildKidName = (kid) => kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`;

const KidWidget = ({ kid, IsExpanded }) => {
  const [ledger, setLedger] = useState(null);
  const [rule, setRule] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setStatus("loading");
        setError("");
        const [ledgerData, ruleData] = await Promise.all([
          FetchKidLedger(kid.KidUserId, 200),
          FetchPocketMoneyRule(kid.KidUserId)
        ]);
        setLedger(ledgerData || null);
        setRule(ruleData || null);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Unable to load kid details.");
      }
    };
    load();
  }, [kid.KidUserId]);

  const latestEntry = useMemo(() => {
    if (!ledger?.Entries?.length) {
      return null;
    }
    return [...ledger.Entries].sort(
      (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
    )[0];
  }, [ledger]);

  const latestLabel = latestEntry ? FormatDateTime(latestEntry.CreatedAt) : "-";
  const latestBy = latestEntry?.CreatedByName || (latestEntry ? `User ${latestEntry.CreatedByUserId}` : "-");
  const latestByLabel = latestEntry ? `Entered by ${latestBy}` : "No updates yet.";
  const nextRun = NextPocketMoneyRun(rule);
  const nextRunLabel = nextRun ? FormatDate(nextRun) : "-";
  const amountLabel = rule?.Amount ? FormatCurrency(rule.Amount) : "-";
  const frequencyLabel = rule?.Frequency
    ? rule.Frequency.charAt(0).toUpperCase() + rule.Frequency.slice(1)
    : "-";

  return (
    <div className="widget-body">
      {status === "loading" ? <p className="text-muted">Loading kid details...</p> : null}
      {status === "error" ? <p className="form-error">{error}</p> : null}
      {status === "ready" ? (
        <>
          <div className="kids-balance">
            <p className="metric-label">Balance</p>
            <p className="kids-balance-value">
              {ledger?.Balance !== undefined ? FormatCurrency(ledger.Balance) : "-"}
            </p>
          </div>
          <div className="kids-meta">
            <p className="kids-meta-label">Last update</p>
            <p>{latestLabel}</p>
            <p className="kids-meta-sub">{latestByLabel}</p>
          </div>
          <div className="kids-meta">
            <p className="kids-meta-label">Next pocket money</p>
            <p>{nextRunLabel}</p>
            <p className="kids-meta-sub">{amountLabel}</p>
          </div>
          {IsExpanded ? (
            <div className="kids-meta">
              <p className="kids-meta-label">Frequency</p>
              <p>{frequencyLabel}</p>
            </div>
          ) : null}
          <div className="kids-actions">
            <Link className="button-pill" to={`/kids-admin?kid=${kid.KidUserId}`}>
              Add update
            </Link>
            <Link className="button-secondary-pill" to={`/kids-admin?kid=${kid.KidUserId}#kids-history`}>
              View history
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default KidWidget;
