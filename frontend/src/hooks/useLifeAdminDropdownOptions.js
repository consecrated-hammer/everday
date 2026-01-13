import { useEffect, useState } from "react";

import { FetchLifeDropdownOptions } from "../lib/lifeAdminApi.js";

export const useLifeAdminDropdownOptions = (dropdownId) => {
  const [options, setOptions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadOptions = async () => {
    if (!dropdownId) {
      setOptions([]);
      return;
    }
    try {
      setStatus("loading");
      setError("");
      const nextOptions = await FetchLifeDropdownOptions(dropdownId);
      setOptions(nextOptions);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load dropdown options");
    }
  };

  useEffect(() => {
    loadOptions();
  }, [dropdownId]);

  return { options, status, error, reloadOptions: loadOptions };
};
