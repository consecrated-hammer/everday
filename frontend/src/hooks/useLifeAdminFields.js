import { useCallback, useEffect, useState } from "react";

import { FetchLifeFields } from "../lib/lifeAdminApi.js";

export const useLifeAdminFields = (categoryId) => {
  const [fields, setFields] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadFields = useCallback(async () => {
    if (!categoryId) {
      setFields([]);
      return;
    }
    try {
      setStatus("loading");
      setError("");
      const nextFields = await FetchLifeFields(categoryId);
      setFields(nextFields);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load fields");
    }
  }, [categoryId]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  return { fields, status, error, reloadFields: loadFields };
};
