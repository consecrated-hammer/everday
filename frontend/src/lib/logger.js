const FormatTimestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const FormatMessage = (level, message) => {
  const timestamp = FormatTimestamp();
  return `${timestamp} ${level.toUpperCase()} frontend ${message}`;
};

const LevelMap = {
  debug: 10,
  info: 20,
  warning: 30,
  error: 40
};

const GetMinLevel = () => {
  const raw = (import.meta.env.VITE_LOG_LEVEL || "info").toLowerCase();
  return LevelMap[raw] ?? LevelMap.info;
};

const ShouldLog = (level) => LevelMap[level] >= GetMinLevel();

const PostLog = async (payload) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    return;
  }

  try {
    await fetch(`${baseUrl}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (error) {
    // Avoid infinite loops by not logging failures here.
  }
};

let originalConsole = null;

const Emit = (level, message, context) => {
  if (!ShouldLog(level)) {
    return;
  }

  const formatted = FormatMessage(level, message);
  const output = originalConsole || console;
  if (level === "error") {
    output.error(formatted, context || "");
  } else if (level === "warning") {
    output.warn(formatted, context || "");
  } else {
    output.log(formatted, context || "");
  }

  PostLog({ level, message, context });
};

export const Logger = {
  Info: (message, context) => Emit("info", message, context),
  Warn: (message, context) => Emit("warning", message, context),
  Error: (message, context) => Emit("error", message, context),
  Debug: (message, context) => Emit("debug", message, context)
};

export const AttachConsoleBridge = () => {
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  console.log = (...args) => {
    originalConsole.log(...args);
    PostLog({ level: "info", message: args.join(" ") });
  };

  console.warn = (...args) => {
    originalConsole.warn(...args);
    PostLog({ level: "warning", message: args.join(" ") });
  };

  console.error = (...args) => {
    originalConsole.error(...args);
    PostLog({ level: "error", message: args.join(" ") });
  };

  window.addEventListener("error", (event) => {
    Logger.Error("window.error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    Logger.Error("window.unhandledrejection", {
      reason: event.reason?.toString?.() || "unknown"
    });
  });
};
