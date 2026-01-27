import { GetUiSettings } from "./uiSettings.js";

const BuildCurrencyFormatter = (showDecimals) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  });

const BuildNumberFormatter = (showDecimals) =>
  new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  });

const HasExplicitTimezone = (value) => /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
const IsDateOnlyString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const NormalizeUtcDateString = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (IsDateOnlyString(trimmed)) {
    return trimmed;
  }
  // Backend emits naive UTC timestamps (no timezone suffix). Treat them as UTC.
  const withIsoSeparator = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (HasExplicitTimezone(withIsoSeparator)) {
    return withIsoSeparator;
  }
  return `${withIsoSeparator}Z`;
};

const ParseDateValue = (value) => {
  const normalized = NormalizeUtcDateString(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const FormatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  const { ShowDecimals } = GetUiSettings();
  return BuildCurrencyFormatter(ShowDecimals).format(Number(value));
};

export const FormatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  const { ShowDecimals } = GetUiSettings();
  return BuildNumberFormatter(ShowDecimals).format(Number(value));
};

export const FormatDate = (value) => {
  if (!value) {
    return "-";
  }
  const parsed = ParseDateValue(value);
  if (!parsed) {
    return String(value);
  }
  return parsed.toLocaleDateString("en-AU");
};

export const FormatTime = (value) => {
  if (!value) {
    return "-";
  }
  const parsed = ParseDateValue(value);
  if (!parsed) {
    return String(value);
  }
  return parsed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
};

export const FormatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  const parsed = ParseDateValue(value);
  if (!parsed) {
    return String(value);
  }
  return `${parsed.toLocaleDateString("en-AU")} ${parsed.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
};

export const ToNumber = (value) => {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
};

export const FormatAmountInput = (value) => {
  if (!value) {
    return "";
  }
  const raw = String(value);
  const parts = raw.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = parts.length > 1 ? parts[1] : "";
  const formattedInteger = new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0
  }).format(Number(integerPart));
  if (raw.endsWith(".")) {
    return `${formattedInteger}.`;
  }
  if (decimalPart.length > 0) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};

export const NormalizeAmountInput = (rawValue) => {
  if (!rawValue) {
    return "";
  }
  let cleanedInput = String(rawValue).replace(/\s/g, "");
  const hasDot = cleanedInput.includes(".");
  const hasComma = cleanedInput.includes(",");
  if (hasDot) {
    cleanedInput = cleanedInput.replace(/,/g, "");
  } else if (hasComma) {
    const lastCommaIndex = cleanedInput.lastIndexOf(",");
    const decimals = cleanedInput.slice(lastCommaIndex + 1);
    if (/^\d{1,2}$/.test(decimals)) {
      cleanedInput = cleanedInput.replace(/\./g, "");
      cleanedInput = cleanedInput.replace(/,/g, ".");
    } else {
      cleanedInput = cleanedInput.replace(/,/g, "");
    }
  }
  const cleaned = cleanedInput.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`;
  }
  return parts[0];
};

export const NormalizeFrequency = (value) => String(value || "").toLowerCase();

export const DisplayForPeriod = (entry, periodKey, amountValue, perValue) => {
  const frequency = NormalizeFrequency(entry?.Frequency);
  if (frequency === periodKey) {
    return FormatCurrency(amountValue);
  }
  return FormatCurrency(perValue);
};
