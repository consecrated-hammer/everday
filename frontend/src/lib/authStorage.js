const StorageKey = "everday.auth";

const NotifyAuthChange = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event("auth:changed"));
};

export const GetTokens = () => {
  const raw = localStorage.getItem(StorageKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const DecodeAccessToken = () => {
  const tokens = GetTokens();
  const accessToken = tokens?.AccessToken;
  if (!accessToken) {
    return null;
  }
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)), "=");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
};

export const SetTokens = (tokens) => {
  const existing = GetTokens() || {};
  const merged = { ...existing, ...tokens };
  localStorage.setItem(StorageKey, JSON.stringify(merged));
  NotifyAuthChange();
};

export const GetUsername = () => {
  const tokens = GetTokens();
  if (tokens?.Username) {
    return tokens.Username;
  }
  const data = DecodeAccessToken();
  return data?.username || "";
};

export const GetDisplayName = () => {
  const tokens = GetTokens();
  if (tokens?.FirstName) {
    return tokens.FirstName;
  }
  return GetUsername();
};

export const GetRoles = () => {
  const tokens = GetTokens();
  return tokens?.Roles || [];
};

export const GetRole = () => {
  const tokens = GetTokens();
  if (tokens?.Role) {
    return tokens.Role;
  }
  const roles = tokens?.Roles || [];
  const isKid = roles.some((entry) => entry.ModuleName === "kids" && entry.Role === "Kid");
  return isKid ? "Kid" : "Parent";
};

export const HasModuleRole = (moduleName, role) => {
  const tokens = GetTokens();
  if (tokens?.Role) {
    if (moduleName === "kids" && role === "Kid") {
      return tokens.Role === "Kid";
    }
    if (role === "Parent") {
      return tokens.Role === "Parent";
    }
    return false;
  }
  const roles = GetRoles();
  return roles.some((entry) => entry.ModuleName === moduleName && entry.Role === role);
};

export const IsKid = () => GetRole() === "Kid";

export const GetUserId = () => {
  const data = DecodeAccessToken();
  if (!data?.sub) {
    return null;
  }
  const parsed = Number.parseInt(data.sub, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const ClearTokens = () => {
  localStorage.removeItem(StorageKey);
  NotifyAuthChange();
};
