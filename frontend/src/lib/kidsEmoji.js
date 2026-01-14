const StorageKey = "everday.kidsEmoji";

const Defaults = {
  Headers: {
    Brand: "🌟",
    Greeting: "👋",
    Subtitle: "🧭",
    AvailableNow: "💰",
    DailyJobs: "🧹",
    Habits: "✨",
    BonusTasks: "⭐",
    ThisMonth: "📈",
    History: "🗓️"
  },
  ChoreTypes: {
    Daily: "🧹",
    Habit: "✨",
    Bonus: "⭐"
  },
  Chores: {}
};

const ReadSettings = () => {
  const raw = localStorage.getItem(StorageKey);
  if (!raw) {
    return { ...Defaults };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      Headers: { ...Defaults.Headers, ...(parsed.Headers || {}) },
      ChoreTypes: { ...Defaults.ChoreTypes, ...(parsed.ChoreTypes || {}) },
      Chores: { ...Defaults.Chores, ...(parsed.Chores || {}) }
    };
  } catch (error) {
    return { ...Defaults };
  }
};

export const GetKidsEmojiSettings = () => ReadSettings();

export const SetKidsEmojiSettings = (partial) => {
  const current = ReadSettings();
  const next = {
    Headers: { ...current.Headers, ...(partial?.Headers || {}) },
    ChoreTypes: { ...current.ChoreTypes, ...(partial?.ChoreTypes || {}) },
    Chores: { ...current.Chores, ...(partial?.Chores || {}) }
  };
  localStorage.setItem(StorageKey, JSON.stringify(next));
  return next;
};

export const GetKidsHeaderEmoji = (key) => {
  const settings = ReadSettings();
  return settings.Headers?.[key] || "";
};

export const GetChoreEmoji = (chore) => {
  if (!chore) {
    return "";
  }
  const settings = ReadSettings();
  const choreKey = chore.Id !== undefined ? String(chore.Id) : "";
  if (choreKey && settings.Chores?.[choreKey]) {
    return settings.Chores[choreKey];
  }
  return settings.ChoreTypes?.[chore.Type] || "";
};
