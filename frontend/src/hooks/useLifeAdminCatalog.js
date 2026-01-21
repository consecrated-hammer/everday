import { useCallback, useEffect, useState } from "react";

import {
  FetchLifeCategories,
  FetchLifeDropdowns,
  FetchLifePeople
} from "../lib/lifeAdminApi.js";

export const useLifeAdminCatalog = ({ includeInactive = false } = {}) => {
  const [categories, setCategories] = useState([]);
  const [dropdowns, setDropdowns] = useState([]);
  const [people, setPeople] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadCatalog = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      const [nextCategories, nextDropdowns, nextPeople] = await Promise.all([
        FetchLifeCategories(includeInactive),
        FetchLifeDropdowns(),
        FetchLifePeople()
      ]);
      setCategories(nextCategories);
      setDropdowns(nextDropdowns);
      setPeople(nextPeople);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load life admin data");
    }
  }, [includeInactive]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  return {
    categories,
    dropdowns,
    people,
    status,
    error,
    reloadCatalog: loadCatalog
  };
};
