import { useEffect, useState } from "react";

import { FetchKidLedger, FetchLinkedKids } from "../../../lib/kidsApi.js";
import { FormatCurrency } from "../../../lib/formatters.js";

const BuildKidName = (kid) => kid.FirstName || kid.Username || `Kid ${kid.KidUserId}`;

const KidsWidget = () => {
  const [kids, setKids] = useState([]);
  const [balances, setBalances] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

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
    <ul className="kids-balance-list">
      {kids.map((kid) => (
        <li key={kid.KidUserId} className="kids-balance-row">
          <span className="kids-balance-name">{BuildKidName(kid)}</span>
          <span className="kids-balance-amount">
            {FormatCurrency(balances[kid.KidUserId] ?? 0)}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default KidsWidget;
