const StoragePrefix = "everday.dashboard.layout";

const BuildStorageKey = (userId) => `${StoragePrefix}.${userId || "guest"}`;

export const LoadDashboardLayout = (userId) => {
  const key = BuildStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

export const SaveDashboardLayout = (userId, layout) => {
  const key = BuildStorageKey(userId);
  if (!Array.isArray(layout)) {
    return;
  }
  localStorage.setItem(key, JSON.stringify(layout));
};

export const ResetDashboardLayout = (userId) => {
  const key = BuildStorageKey(userId);
  localStorage.removeItem(key);
};
