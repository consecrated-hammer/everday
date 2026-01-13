import { Refresh } from "./authApi.js";
import { ClearTokens, GetTokens, IsAccessTokenExpired, SetTokens } from "./authStorage.js";

const NormalizeBaseUrl = (value) => {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const ApiBaseUrl = NormalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8100"
);

let refreshPromise = null;
let refreshTokenInFlight = null;

const BuildHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const tokens = GetTokens();
  if (tokens?.AccessToken) {
    headers.Authorization = `Bearer ${tokens.AccessToken}`;
  }
  return headers;
};

const HandleJson = async (response) => {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
};

const RefreshWithToken = async (refreshToken) => {
  const nextTokens = await Refresh({ RefreshToken: refreshToken });
  SetTokens(nextTokens);
  return nextTokens;
};

const TryRefresh = async () => {
  const tokens = GetTokens();
  const refreshToken = tokens?.RefreshToken;
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise || refreshTokenInFlight !== refreshToken) {
    refreshTokenInFlight = refreshToken;
    refreshPromise = RefreshWithToken(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }

  try {
    return await refreshPromise;
  } catch (error) {
    const latest = GetTokens();
    const latestRefresh = latest?.RefreshToken;
    if (latestRefresh && latestRefresh !== refreshToken) {
      refreshTokenInFlight = latestRefresh;
      return RefreshWithToken(latestRefresh);
    }
    throw error;
  }
};

export const EnsureFreshTokens = async () => {
  const tokens = GetTokens();
  if (!tokens?.AccessToken) {
    return null;
  }
  if (!IsAccessTokenExpired()) {
    return tokens;
  }
  try {
    const refreshed = await TryRefresh();
    if (refreshed) {
      return refreshed;
    }
  } catch (error) {
    ClearTokens();
    throw error;
  }
  ClearTokens();
  return null;
};

export const RequestWithAuth = async (path, options = {}) => {
  const tokens = GetTokens();
  if (tokens?.AccessToken && IsAccessTokenExpired()) {
    await EnsureFreshTokens();
  }
  const response = await fetch(`${ApiBaseUrl}${path}`, {
    ...options,
    headers: { ...BuildHeaders(), ...(options.headers || {}) }
  });
  if (response.status !== 401) {
    return response;
  }

  try {
    await TryRefresh();
  } catch (error) {
    ClearTokens();
    throw error;
  }

  const retry = await fetch(`${ApiBaseUrl}${path}`, {
    ...options,
    headers: { ...BuildHeaders(), ...(options.headers || {}) }
  });
  return retry;
};

export const RequestJson = async (path, options = {}) => {
  const response = await RequestWithAuth(path, options);
  return HandleJson(response);
};
