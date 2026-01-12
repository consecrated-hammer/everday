import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Icon from "../../../components/Icon.jsx";
import {
  CreateKidDeposit,
  CreateKidStartingBalance,
  CreateKidWithdrawal,
  FetchKidLedger,
  FetchLinkedKids
} from "../../../lib/kidsApi.js";
import { FormatCurrency } from "../../../lib/formatters.js";

const BuildKidName = (kid) => kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`;
const BuildToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);
};

const EmptyTransaction = (kidId) => ({
  KidUserId: kidId ? String(kidId) : "",
  Type: "Deposit",
  Amount: "",
  EntryDate: BuildToday(),
  Narrative: "",
  Notes: ""
});

const KidsWidget = () => {
  const [kids, setKids] = useState([]);
  const [balances, setBalances] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(() => EmptyTransaction(""));
  const [formError, setFormError] = useState("");

  const kidOptions = useMemo(
    () =>
      kids.map((kid) => ({
        Id: String(kid.KidUserId),
        Name: BuildKidName(kid)
      })),
    [kids]
  );

  const selectedKidId = form.KidUserId;
  const isBalanceAdjustment = form.Type === "StartingBalance";

  const loadData = async () => {
    try {
      setStatus("loading");
      setError("");
      const kidsList = await FetchLinkedKids();
      setKids(kidsList || []);
      if (!kidsList || kidsList.length === 0) {
        setBalances({});
        setStatus("ready");
        return;
      }
      const ledgerResults = await Promise.all(
        kidsList.map((kid) => FetchKidLedger(kid.KidUserId, 200))
      );
      const balanceMap = {};
      kidsList.forEach((kid, index) => {
        balanceMap[kid.KidUserId] = ledgerResults[index]?.Balance ?? 0;
      });
      setBalances(balanceMap);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Unable to load kids balances.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!kidOptions.length || selectedKidId) {
      return;
    }
    setForm((prev) => ({ ...prev, KidUserId: kidOptions[0].Id }));
  }, [kidOptions, selectedKidId]);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.widgetId !== "kids" || event.detail?.actionId !== "quick-update") {
        return;
      }
      setShowModal(true);
      setFormError("");
    };
    window.addEventListener("dashboard-widget-action", handler);
    return () => window.removeEventListener("dashboard-widget-action", handler);
  }, []);

  useEffect(() => {
    if (!showModal) {
      return;
    }
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      closeModal();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const closeModal = () => {
    setShowModal(false);
    setFormError("");
    setForm(EmptyTransaction(selectedKidId || kidOptions[0]?.Id));
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitTransaction = async () => {
    if (!selectedKidId) {
      setFormError("Pick a kid.");
      return;
    }
    if (!form.Amount || !form.Narrative) {
      setFormError("Add an amount and a short note.");
      return;
    }
    setStatus("saving");
    setFormError("");
    try {
      const payload = {
        Amount: Number(form.Amount),
        EntryDate: form.EntryDate,
        Narrative: form.Narrative,
        Notes: form.Notes || null
      };
      const kidId = Number(selectedKidId);
      if (form.Type === "Deposit") {
        await CreateKidDeposit(kidId, payload);
      } else if (form.Type === "Withdrawal") {
        await CreateKidWithdrawal(kidId, payload);
      } else {
        await CreateKidStartingBalance(kidId, payload);
      }
      await loadData();
      closeModal();
    } catch (err) {
      setStatus("error");
      setFormError(err?.message || "Unable to add update.");
    } finally {
      setStatus("ready");
    }
  };

  if (status === "loading") {
    return <p className="text-muted">Loading kids...</p>;
  }

  if (status === "error") {
    return <p className="form-error">{error}</p>;
  }

  if (kids.length === 0) {
    return <p className="text-muted">No kids linked yet.</p>;
  }

  return (
    <>
      <ul className="kids-balance-list">
        {kids.map((kid) => (
          <li key={kid.KidUserId} className="kids-balance-row dashboard-panel">
            <Link
              className="kids-balance-name kids-balance-link"
              to={`/kids-admin?kid=${kid.KidUserId}`}
            >
              {BuildKidName(kid)}
            </Link>
            <span className="kids-balance-amount">
              {FormatCurrency(balances[kid.KidUserId] ?? 0)}
            </span>
          </li>
        ))}
      </ul>

      {showModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3>Add update</h3>
                  <p>Deposits, withdrawals, and balance adjustments.</p>
                </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeModal}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="modal-body">
              {formError ? <p className="form-error">{formError}</p> : null}
              <div className="kids-admin-form">
                <label>
                  <span>Kid</span>
                  <select name="KidUserId" value={selectedKidId} onChange={onFormChange}>
                    {kidOptions.map((kid) => (
                      <option key={kid.Id} value={kid.Id}>
                        {kid.Name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Type</span>
                  <select name="Type" value={form.Type} onChange={onFormChange}>
                    <option value="Deposit">Deposit</option>
                    <option value="Withdrawal">Withdrawal</option>
                    <option value="StartingBalance">Balance adjustment</option>
                  </select>
                </label>
                <label>
                  <span>{isBalanceAdjustment ? "Set balance to" : "Amount"}</span>
                  {isBalanceAdjustment ? (
                    <span className="text-muted kids-admin-hint">
                      We will calculate the change to reach this balance.
                    </span>
                  ) : null}
                  <input
                    name="Amount"
                    value={form.Amount}
                    onChange={onFormChange}
                    placeholder={isBalanceAdjustment ? "50.00" : "0.00"}
                  />
                </label>
                <label>
                  <span>Date</span>
                  <input type="date" name="EntryDate" value={form.EntryDate} onChange={onFormChange} />
                </label>
                <label className="kids-admin-form-wide">
                  <span>Note</span>
                  <input
                    name="Narrative"
                    value={form.Narrative}
                    onChange={onFormChange}
                    placeholder="Example: Robux, birthday cash"
                  />
                </label>
                <label className="kids-admin-form-wide">
                  <span>Details (optional)</span>
                  <input name="Notes" value={form.Notes} onChange={onFormChange} />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  onClick={submitTransaction}
                  disabled={status === "saving"}
                >
                  Add update
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default KidsWidget;
