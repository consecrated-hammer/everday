import { useEffect, useState } from "react";

import { getDefaultTheme } from "@glideapps/glide-data-grid";

const ReadCssVar = (name, fallback) => {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const BuildTheme = () => {
  const base = getDefaultTheme();
  const surface = ReadCssVar("--surface", base.bgCell);
  const surfaceStrong = ReadCssVar("--surface-strong", base.bgCellMedium);
  const surfaceMuted = ReadCssVar("--surface-muted", base.bgHeader);
  const text = ReadCssVar("--text", base.textDark);
  const textMuted = ReadCssVar("--text-muted", base.textMedium);
  const textSoft = ReadCssVar("--text-soft", base.textLight);
  const border = ReadCssVar("--border", base.borderColor);
  const accent = ReadCssVar("--accent", base.accentColor);
  const accentContrast = ReadCssVar("--accent-contrast", base.accentFg);
  const accentSoft = ReadCssVar("--accent-soft", base.accentLight);
  return {
    ...base,
    accentColor: accent,
    accentFg: accentContrast,
    accentLight: accentSoft,
    textDark: text,
    textMedium: textMuted,
    textLight: textSoft,
    textBubble: text,
    bgCell: surface,
    bgCellMedium: surfaceStrong,
    bgHeader: surfaceMuted,
    bgHeaderHasFocus: surfaceStrong,
    bgHeaderHovered: surfaceStrong,
    bgBubble: surfaceMuted,
    bgBubbleSelected: accentSoft,
    bgSearchResult: accentSoft,
    bgIconHeader: surfaceMuted,
    fgIconHeader: textMuted,
    textHeader: text,
    textHeaderSelected: text,
    borderColor: border,
    drilldownBorder: border,
    linkColor: accent,
    horizontalBorderColor: border,
    headerBottomBorderColor: border
  };
};

export const useGlideTheme = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return getDefaultTheme();
    }
    return BuildTheme();
  });

  useEffect(() => {
    const update = () => setTheme(BuildTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    window.addEventListener("ui-settings-changed", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
      window.removeEventListener("ui-settings-changed", update);
    };
  }, []);

  return theme;
};
