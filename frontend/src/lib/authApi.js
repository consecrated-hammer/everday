const NormalizeBaseUrl = (value) => {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const ApiBaseUrl = NormalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8100"
);

const ReadErrorDetail = async (response) => {
  const text = await response.text();
  if (!text) {
    return "Request failed";
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed?.detail) {
      return parsed.detail;
    }
  } catch (error) {
    // ignore parse errors
  }
  return text;
};

const HandleJson = async (response) => {
  if (!response.ok) {
    const detail = await ReadErrorDetail(response);
    throw new Error(detail || "Request failed");
  }
  return response.json();
};

export const Login = async (payload) => {
  const response = await fetch(`${ApiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return HandleJson(response);
};

export const Refresh = async (payload) => {
  const response = await fetch(`${ApiBaseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return HandleJson(response);
};

export const Logout = async (payload) => {
  const response = await fetch(`${ApiBaseUrl}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await ReadErrorDetail(response);
    throw new Error(detail || "Request failed");
  }
};

export const ForgotPassword = async (payload) => {
  const response = await fetch(`${ApiBaseUrl}/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await ReadErrorDetail(response);
    throw new Error(detail || "Request failed");
  }
  return response.json();
};

export const ResetPassword = async (payload) => {
  const response = await fetch(`${ApiBaseUrl}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await ReadErrorDetail(response);
    throw new Error(detail || "Request failed");
  }
  return response.json();
};

export const Register = async (payload) => {
  const response = await fetch(`${ApiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await ReadErrorDetail(response);
    throw new Error(detail || "Request failed");
  }
  return response.json();
};
