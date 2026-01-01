import { Refresh } from "./authApi.js";
import { ClearTokens, GetTokens, SetTokens } from "./authStorage.js";

const NormalizeBaseUrl = (value) => {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const ApiBaseUrl = NormalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8100"
);

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
  return response.json();
};

const TryRefresh = async () => {
  const tokens = GetTokens();
  if (!tokens?.RefreshToken) {
    return null;
  }
  const nextTokens = await Refresh({ RefreshToken: tokens.RefreshToken });
  SetTokens(nextTokens);
  return nextTokens;
};

export const RequestWithAuth = async (path, options = {}) => {
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
