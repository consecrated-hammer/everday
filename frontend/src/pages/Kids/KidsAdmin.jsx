import { useEffect, useMemo, useState } from "react";

import {
  ApproveKidsChoreEntry,
  CreateParentChore,
  DeleteParentChore,
  FetchKidMonthSummary,
  FetchKidsPendingApprovals,
  FetchLinkedKids,
  FetchParentChores,
  FetchPocketMoneyRule,
  RejectKidsChoreEntry,
  SetChoreAssignments,
  UpdateParentChore,
  UpdatePocketMoneyRule
} from "../../lib/kidsApi.js";
import { FormatCurrency, NormalizeAmountInput } from "../../lib/formatters.js";
import Icon from "../../components/Icon.jsx";

const BuildToday = () => new Date().toISOString().slice(0, 10);

const EmptyChoreForm = () => ({
  Label: "",
  Type: "Daily",
  Amount: "",
  SortOrder: "0",
  IsActive: true,
  KidUserIds: []
});

const TypeLabel = (value) => {
  switch (value) {
    case "Daily":
      return "Daily jobs";
    case "Habit":
      return "Habits";
    case "Bonus":
      return "Bonus tasks";
    default:
      return value || "-";
  }
};

const KidsAdmin = () => {
  const [kids, setKids] = useState([]);
  const [activeKidId, setActiveKidId] = useState(null);
  const [chores, setChores] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [monthSummaries, setMonthSummaries] = useState({});
  const [kidRules, setKidRules] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [allowanceForm, setAllowanceForm] = useState({ Amount: "40", StartDate: BuildToday() });

  const [showChoreModal, setShowChoreModal] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [choreForm, setChoreForm] = useState(EmptyChoreForm());

  const [approvalFilterKid, setApprovalFilterKid] = useState("all");
  const [approvalFilterType, setApprovalFilterType] = useState("all");

  const loadData = async () => {
    setStatus("loading");
    setError("");
    try {
      const kidsList = await FetchLinkedKids();
      setKids(kidsList || []);

      const choreList = await FetchParentChores();
      setChores(choreList || []);

      const approvalList = await FetchKidsPendingApprovals();
      setPendingApprovals(approvalList || []);

      const summaryResults = await Promise.all(
        (kidsList || []).map((kid) => FetchKidMonthSummary(kid.KidUserId))
      );
      const summaryMap = {};
      (kidsList || []).forEach((kid, index) => {
        summaryMap[kid.KidUserId] = summaryResults[index];
      });
      setMonthSummaries(summaryMap);

      const ruleResults = await Promise.all(
        (kidsList || []).map((kid) => FetchPocketMoneyRule(kid.KidUserId))
      );
      const ruleMap = {};
      (kidsList || []).forEach((kid, index) => {
        const rule = ruleResults[index];
        ruleMap[kid.KidUserId] = rule;
      });
      setKidRules(ruleMap);

      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load kids data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (kids.length === 0) {
      setActiveKidId(null);
      return;
    }
    if (!activeKidId || !kids.some((kid) => kid.KidUserId === activeKidId)) {
      setActiveKidId(kids[0].KidUserId);
    }
  }, [kids, activeKidId]);

  useEffect(() => {
    if (!activeKidId) {
      return;
    }
    const rule = kidRules[activeKidId];
    setAllowanceForm({
      Amount: rule?.Amount ? String(rule.Amount) : "40",
      StartDate: rule?.StartDate || BuildToday()
    });
  }, [activeKidId, kidRules]);

  const kidOptions = useMemo(
    () =>
      kids.map((kid) => ({
        Id: kid.KidUserId,
        Name: kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`
      })),
    [kids]
  );

  const activeKid = useMemo(
    () => kids.find((kid) => kid.KidUserId === activeKidId) || null,
    [kids, activeKidId]
  );

  const activeKidName = activeKid ? activeKid.FirstName || activeKid.Username : "Kid";
  const activeSummary = activeKid ? monthSummaries[activeKid.KidUserId] : null;

  const filteredApprovals = useMemo(() => {
    return pendingApprovals
      .filter((entry) => {
        if (approvalFilterKid !== "all" && String(entry.KidUserId) !== approvalFilterKid) {
          return false;
        }
        if (approvalFilterType !== "all" && entry.ChoreType !== approvalFilterType) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.EntryDate).getTime() - new Date(a.EntryDate).getTime());
  }, [pendingApprovals, approvalFilterKid, approvalFilterType]);

  const openChoreModal = (chore = null) => {
    if (chore) {
      setEditingChore(chore);
      setChoreForm({
        Label: chore.Label,
        Type: chore.Type,
        Amount: chore.Amount ? String(chore.Amount) : "",
        SortOrder: String(chore.SortOrder || 0),
        IsActive: chore.IsActive !== false,
        KidUserIds: chore.AssignedKidIds || []
      });
    } else {
      setEditingChore(null);
      setChoreForm(EmptyChoreForm());
    }
    setShowChoreModal(true);
  };

  const onChoreFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setChoreForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onToggleKidAssignment = (kidId) => {
    setChoreForm((prev) => {
      const existing = new Set(prev.KidUserIds || []);
      if (existing.has(kidId)) {
        existing.delete(kidId);
      } else {
        existing.add(kidId);
      }
      return { ...prev, KidUserIds: Array.from(existing) };
    });
  };

  const onSaveChore = async (event) => {
    event.preventDefault();
    if (!choreForm.Label.trim()) {
      setError("Chore name is required.");
      return;
    }
    if (choreForm.Type === "Bonus" && Number(choreForm.Amount || 0) <= 0) {
      setError("Bonus amount is required.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const payload = {
        Label: choreForm.Label.trim(),
        Type: choreForm.Type,
        Amount: choreForm.Type === "Bonus" ? Number(choreForm.Amount || 0) : 0,
        SortOrder: Number(choreForm.SortOrder || 0),
        IsActive: choreForm.IsActive
      };
      let saved = null;
      if (editingChore) {
        saved = await UpdateParentChore(editingChore.Id, payload);
      } else {
        saved = await CreateParentChore(payload);
      }
      if (saved?.Id) {
        await SetChoreAssignments(saved.Id, { KidUserIds: choreForm.KidUserIds || [] });
      }
      setShowChoreModal(false);
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save chore.");
    } finally {
      setStatus("ready");
    }
  };

  const onDeleteChore = async (chore) => {
    const confirmed = window.confirm("Delete this chore? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    try {
      await DeleteParentChore(chore.Id);
      await loadData();
    } catch (err) {
      setError(err?.message || "Unable to delete chore.");
    }
  };

  const onSaveAllowance = async (event) => {
    event.preventDefault();
    if (!activeKid) {
      return;
    }
    const amountValue = Number(allowanceForm.Amount || 0);
    if (!amountValue || Number.isNaN(amountValue)) {
      setError("Monthly allowance is required.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const payload = {
        Amount: amountValue,
        Frequency: "monthly",
        DayOfMonth: 1,
        DayOfWeek: 0,
        StartDate: allowanceForm.StartDate || BuildToday(),
        IsActive: true
      };
      await UpdatePocketMoneyRule(activeKid.KidUserId, payload);
      setShowAllowanceModal(false);
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to save allowance.");
    } finally {
      setStatus("ready");
    }
  };

  const onApprovalAction = async (entryId, action) => {
    setStatus("saving");
    setError("");
    try {
      if (action === "approve") {
        await ApproveKidsChoreEntry(entryId);
      } else {
        await RejectKidsChoreEntry(entryId);
      }
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to update approval.");
    } finally {
      setStatus("ready");
    }
  };

  return (
    <div className="kids-admin-container">
      <div className="kids-admin">
        <header className="kids-admin-header">
          <div className="kids-admin-header-copy">
            <h1>Kids portal</h1>
            <p className="lede">Approvals, reviews, and chore setup.</p>
            {kids.length ? (
              <div className="kids-admin-switcher">
                {kids.length <= 4 ? (
                  kids.map((kid) => (
                    <button
                      key={kid.KidUserId}
                      type="button"
                      className={`kids-admin-tab${activeKidId === kid.KidUserId ? " is-active" : ""}`}
                      onClick={() => setActiveKidId(kid.KidUserId)}
                    >
                      {kid.FirstName || kid.Username}
                    </button>
                  ))
                ) : (
                  <select
                    aria-label="Select kid"
                    value={activeKidId || ""}
                    onChange={(event) => setActiveKidId(Number(event.target.value))}
                  >
                    <option value="" disabled>
                      Select kid
                    </option>
                    {kidOptions.map((kid) => (
                      <option key={kid.Id} value={kid.Id}>
                        {kid.Name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="kids-admin-layout">
          <aside className="kids-admin-rail">
            <section className="kids-admin-card">
              <div className="kids-admin-card-header">
                <div>
                  <h3>Month review</h3>
                  <p className="text-muted">{activeKidName}</p>
                </div>
                <button
                  type="button"
                  className="button-secondary-pill"
                  onClick={() => setShowAllowanceModal(true)}
                  disabled={!activeKid}
                >
                  Edit allowance
                </button>
              </div>
              <div className="kids-admin-meta">
                <div className="kids-admin-meta-row">
                  <span>Base allowance</span>
                  <span>{activeSummary ? FormatCurrency(activeSummary.MonthlyAllowance) : "-"}</span>
                </div>
                <div className="kids-admin-meta-row">
                  <span>Missed days</span>
                  <span>
                    {activeSummary
                      ? `${activeSummary.MissedDays} (${FormatCurrency(activeSummary.MissedDeduction)})`
                      : "-"}
                  </span>
                </div>
                <div className="kids-admin-meta-row">
                  <span>Bonus approved</span>
                  <span>
                    {activeSummary ? FormatCurrency(activeSummary.ApprovedBonusTotal) : "-"}
                  </span>
                </div>
                <div className="kids-admin-meta-row">
                  <span>Bonus pending</span>
                  <span>
                    {activeSummary ? FormatCurrency(activeSummary.PendingBonusTotal) : "-"}
                  </span>
                </div>
                <div className="kids-admin-meta-row">
                  <span>Projected payout</span>
                  <span>
                    {activeSummary ? FormatCurrency(activeSummary.ProjectedPayout) : "-"}
                  </span>
                </div>
              </div>
            </section>

            <section className="kids-admin-card kids-admin-card--chores">
              <div className="kids-admin-card-header">
                <div>
                  <h3>Chores</h3>
                  <p className="text-muted">Daily jobs, habits, and bonus tasks.</p>
                </div>
                <button type="button" className="button-secondary-pill" onClick={() => openChoreModal()}>
                  Add chore
                </button>
              </div>
              {chores.length > 0 ? (
                <div className="kids-admin-mini-table">
                  <div className="kids-admin-mini-row kids-admin-mini-header">
                    <span>Chore</span>
                    <span>Type</span>
                    <span className="kids-admin-mini-actions">Actions</span>
                  </div>
                  {chores.map((chore) => (
                    <div key={chore.Id} className="kids-admin-mini-row">
                      <span>
                        {chore.Label}
                        {!chore.IsActive ? <span className="kids-pill kids-pill--muted">Disabled</span> : null}
                      </span>
                      <span>{TypeLabel(chore.Type)}</span>
                      <span className="kids-admin-mini-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => openChoreModal(chore)}
                          aria-label={`Edit ${chore.Label}`}
                        >
                          <Icon name="edit" className="icon" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onDeleteChore(chore)}
                          aria-label={`Delete ${chore.Label}`}
                        >
                          <Icon name="trash" className="icon" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No chores created yet.</p>
              )}
            </section>
          </aside>

          <div className="kids-admin-main">
            <section className="kids-admin-card kids-admin-approvals">
              <div className="kids-admin-card-header">
                <div>
                  <h2>Pending approvals</h2>
                  <p className="text-muted">Backdated chores waiting for review.</p>
                </div>
              </div>
              <div className="kids-admin-approval-filters">
                <label>
                  <span>Kid</span>
                  <select value={approvalFilterKid} onChange={(event) => setApprovalFilterKid(event.target.value)}>
                    <option value="all">All kids</option>
                    {kidOptions.map((kid) => (
                      <option key={kid.Id} value={String(kid.Id)}>
                        {kid.Name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Type</span>
                  <select value={approvalFilterType} onChange={(event) => setApprovalFilterType(event.target.value)}>
                    <option value="all">All types</option>
                    <option value="Daily">Daily jobs</option>
                    <option value="Habit">Habits</option>
                    <option value="Bonus">Bonus tasks</option>
                  </select>
                </label>
              </div>
              {filteredApprovals.length === 0 ? (
                <p className="text-muted">No pending approvals right now.</p>
              ) : (
                <div className="kids-admin-approval-list">
                  {filteredApprovals.map((entry) => (
                    <div key={entry.Id} className="kids-admin-approval-card">
                      <div>
                        <div className="kids-admin-approval-title">
                          <span>{entry.ChoreLabel}</span>
                          <span className="kids-pill">{TypeLabel(entry.ChoreType)}</span>
                        </div>
                        <p className="kids-muted">
                          {entry.KidName} • {entry.EntryDate}
                          {entry.Amount ? ` • ${FormatCurrency(entry.Amount)}` : ""}
                        </p>
                        {entry.Notes ? <p className="kids-admin-approval-notes">{entry.Notes}</p> : null}
                      </div>
                      <div className="kids-admin-approval-actions">
                        <button
                          type="button"
                          className="kids-outline-button"
                          onClick={() => onApprovalAction(entry.Id, "reject")}
                          disabled={status === "saving"}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="kids-primary-button"
                          onClick={() => onApprovalAction(entry.Id, "approve")}
                          disabled={status === "saving"}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showChoreModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowChoreModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingChore ? "Edit chore" : "New chore"}</h3>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowChoreModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-admin-form" onSubmit={onSaveChore}>
                <label>
                  <span>Name</span>
                  <input name="Label" value={choreForm.Label} onChange={onChoreFormChange} />
                </label>
                <label>
                  <span>Type</span>
                  <select name="Type" value={choreForm.Type} onChange={onChoreFormChange}>
                    <option value="Daily">Daily jobs</option>
                    <option value="Habit">Habits</option>
                    <option value="Bonus">Bonus tasks</option>
                  </select>
                </label>
                {choreForm.Type === "Bonus" ? (
                  <label>
                    <span>Amount</span>
                    <input
                      name="Amount"
                      value={choreForm.Amount}
                      onChange={(event) =>
                        setChoreForm((prev) => ({
                          ...prev,
                          Amount: NormalizeAmountInput(event.target.value)
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label>
                  <span>Display order</span>
                  <input name="SortOrder" value={choreForm.SortOrder} onChange={onChoreFormChange} />
                </label>
                <label className="kids-admin-toggle">
                  <input
                    type="checkbox"
                    name="IsActive"
                    checked={choreForm.IsActive}
                    onChange={onChoreFormChange}
                  />
                  <span>Enabled</span>
                </label>

                <div className="kids-admin-assignees">
                  <span className="kids-admin-hint">Assign to kids</span>
                  <div className="kids-admin-tags">
                    {kids.map((kid) => (
                      <label key={kid.KidUserId} className="kids-admin-tag">
                        <input
                          type="checkbox"
                          checked={choreForm.KidUserIds.includes(kid.KidUserId)}
                          onChange={() => onToggleKidAssignment(kid.KidUserId)}
                        />
                        <span>{kid.FirstName || kid.Username}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="kids-admin-form-wide">
                  <button type="submit" disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {showAllowanceModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAllowanceModal(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Monthly allowance</h3>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowAllowanceModal(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <form className="kids-admin-form" onSubmit={onSaveAllowance}>
                <label>
                  <span>Monthly allowance</span>
                  <input
                    value={allowanceForm.Amount}
                    onChange={(event) =>
                      setAllowanceForm((prev) => ({
                        ...prev,
                        Amount: NormalizeAmountInput(event.target.value)
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={allowanceForm.StartDate}
                    onChange={(event) =>
                      setAllowanceForm((prev) => ({
                        ...prev,
                        StartDate: event.target.value
                      }))
                    }
                  />
                </label>
                <div className="kids-admin-form-wide">
                  <button type="submit" disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save allowance"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KidsAdmin;
