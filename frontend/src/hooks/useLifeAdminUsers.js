import { useEffect, useState } from "react";

import { FetchUsers } from "../lib/settingsApi.js";

export const useLifeAdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      setStatus("loading");
      setError("");
      const nextUsers = await FetchUsers();
      setUsers(nextUsers);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load users");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return { users, status, error, reloadUsers: loadUsers };
};
