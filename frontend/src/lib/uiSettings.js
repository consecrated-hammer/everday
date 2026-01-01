const StorageKey = "everday.ui";

const Defaults = {
  Theme: "auto",
  IconSet: "phosphor",
  ShowDecimals: true
};

const ReadSettings = () => {
  const raw = localStorage.getItem(StorageKey);
  if (!raw) {
    return { ...Defaults };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...Defaults, ...parsed };
  } catch (error) {
    return { ...Defaults };
  }
};

const WriteSettings = (settings) => {
  localStorage.setItem(StorageKey, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("ui-settings-changed", { detail: settings }));
};

export const GetUiSettings = () => ReadSettings();

export const SetUiSettings = (partial) => {
  const current = ReadSettings();
  const next = { ...current, ...partial };
  WriteSettings(next);
  ApplyUiSettings(next);
  return next;
};

const ResolveTheme = (theme) => {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
};

export const ApplyUiSettings = (settings) => {
  const root = document.documentElement;
  const theme = ResolveTheme(settings.Theme);
  root.dataset.theme = theme;
  root.dataset.iconSet = settings.IconSet;
  root.dataset.showDecimals = settings.ShowDecimals ? "true" : "false";
};

export const InitUiSettings = () => {
  const settings = ReadSettings();
  ApplyUiSettings(settings);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    const latest = ReadSettings();
    if (latest.Theme === "auto") {
      ApplyUiSettings(latest);
    }
  };
  media.addEventListener("change", handleChange);
  window.addEventListener("ui-settings-changed", () => {
    const latest = ReadSettings();
    ApplyUiSettings(latest);
  });
  return settings;
};
