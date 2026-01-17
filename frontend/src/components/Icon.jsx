import { useEffect, useState } from "react";

import { GetUiSettings } from "../lib/uiSettings.js";

const IconMap = {
  dashboard: {
    phosphor: "ph:squares-four",
    material: "material-symbols:dashboard",
    lucide: "lucide:layout-dashboard"
  },
  budget: {
    phosphor: "ph:wallet",
    material: "material-symbols:account-balance-wallet",
    lucide: "lucide:wallet"
  },
  shopping: {
    phosphor: "ph:shopping-cart",
    material: "material-symbols:shopping-cart",
    lucide: "lucide:shopping-cart"
  },
  health: {
    phosphor: "ph:heart-straight",
    material: "material-symbols:monitor-heart",
    lucide: "lucide:heart-pulse"
  },
  breakfast: {
    phosphor: "ph:sun-horizon",
    material: "material-symbols:wb-twilight",
    lucide: "lucide:sunrise"
  },
  morningSnack: {
    phosphor: "ph:coffee",
    material: "material-symbols:local-cafe",
    lucide: "lucide:coffee"
  },
  lunch: {
    phosphor: "ph:sun",
    material: "material-symbols:sunny",
    lucide: "lucide:sun"
  },
  afternoonSnack: {
    phosphor: "ph:apple-logo",
    material: "material-symbols:nutrition",
    lucide: "lucide:apple"
  },
  dinner: {
    phosphor: "ph:moon-stars",
    material: "material-symbols:dark-mode",
    lucide: "lucide:moon"
  },
  eveningSnack: {
    phosphor: "ph:cookie",
    material: "material-symbols:cookie",
    lucide: "lucide:cookie"
  },
  steps: {
    phosphor: "ph:footprints",
    material: "material-symbols:footprint",
    lucide: "lucide:footprints"
  },
  weight: {
    phosphor: "ph:scales",
    material: "material-symbols:scale",
    lucide: "lucide:scale"
  },
  agenda: {
    phosphor: "ph:calendar-check",
    material: "material-symbols:event",
    lucide: "lucide:calendar-check"
  },
  inbox: {
    phosphor: "ph:inbox",
    material: "material-symbols:inbox",
    lucide: "lucide:inbox"
  },
  settings: {
    phosphor: "ph:gear",
    material: "material-symbols:settings",
    lucide: "lucide:settings"
  },
  search: {
    phosphor: "ph:magnifying-glass",
    material: "material-symbols:search",
    lucide: "lucide:search"
  },
  filter: {
    phosphor: "ph:funnel-simple",
    material: "material-symbols:filter-list",
    lucide: "lucide:filter"
  },
  columns: {
    phosphor: "ph:columns",
    material: "material-symbols:view-column",
    lucide: "lucide:columns-2"
  },
  more: {
    phosphor: "ph:dots-three-vertical",
    material: "material-symbols:more-vert",
    lucide: "lucide:more-vertical"
  },
  edit: {
    phosphor: "ph:pencil-simple",
    material: "material-symbols:edit",
    lucide: "lucide:pencil"
  },
  trash: {
    phosphor: "ph:trash",
    material: "material-symbols:delete",
    lucide: "lucide:trash-2"
  },
  save: {
    phosphor: "ph:floppy-disk",
    material: "material-symbols:save",
    lucide: "lucide:save"
  },
  plus: {
    phosphor: "ph:plus",
    material: "material-symbols:add",
    lucide: "lucide:plus"
  },
  close: {
    phosphor: "ph:x",
    material: "material-symbols:close",
    lucide: "lucide:x"
  },
  chevronLeft: {
    phosphor: "ph:caret-left",
    material: "material-symbols:chevron-left",
    lucide: "lucide:chevron-left"
  },
  chevronRight: {
    phosphor: "ph:caret-right",
    material: "material-symbols:chevron-right",
    lucide: "lucide:chevron-right"
  },
  chevronsLeft: {
    phosphor: "ph:caret-double-left",
    material: "material-symbols:keyboard-double-arrow-left",
    lucide: "lucide:chevrons-left"
  },
  chevronsRight: {
    phosphor: "ph:caret-double-right",
    material: "material-symbols:keyboard-double-arrow-right",
    lucide: "lucide:chevrons-right"
  },
  navCollapse: {
    phosphor: "ph:arrow-line-left",
    material: "material-symbols:menu-open",
    lucide: "lucide:arrow-left-from-line"
  },
  navExpand: {
    phosphor: "ph:arrow-line-right",
    material: "material-symbols:arrow-menu-close",
    lucide: "lucide:arrow-right-from-line"
  },
  chevronDown: {
    phosphor: "ph:caret-down",
    material: "material-symbols:expand-more",
    lucide: "lucide:chevron-down"
  },
  user: {
    phosphor: "ph:user-circle",
    material: "material-symbols:account-circle",
    lucide: "lucide:user-circle-2"
  },
  logout: {
    phosphor: "ph:sign-out",
    material: "material-symbols:logout",
    lucide: "lucide:log-out"
  },
  reset: {
    phosphor: "ph:arrow-counter-clockwise",
    material: "material-symbols:restart-alt",
    lucide: "lucide:rotate-ccw"
  },
  check: {
    phosphor: "ph:check",
    material: "material-symbols:check",
    lucide: "lucide:check"
  },
  lock: {
    phosphor: "ph:lock",
    material: "material-symbols:lock",
    lucide: "lucide:lock"
  },
  team: {
    phosphor: "ph:users",
    material: "material-symbols:groups",
    lucide: "lucide:users"
  },
  sort: {
    phosphor: "ph:arrows-down-up",
    material: "material-symbols:swap-vert",
    lucide: "lucide:arrow-up-down"
  },
  sortUp: {
    phosphor: "ph:arrow-up",
    material: "material-symbols:arrow-upward",
    lucide: "lucide:arrow-up"
  },
  sortDown: {
    phosphor: "ph:arrow-down",
    material: "material-symbols:arrow-downward",
    lucide: "lucide:arrow-down"
  },
  drag: {
    phosphor: "ph:dots-six-vertical",
    material: "material-symbols:drag-handle",
    lucide: "lucide:grip-vertical"
  },
  info: {
    phosphor: "ph:info",
    material: "material-symbols:info",
    lucide: "lucide:info"
  },
  food: {
    phosphor: "ph:apple-logo",
    material: "material-symbols:nutrition",
    lucide: "lucide:apple"
  },
  meal: {
    phosphor: "ph:fork-knife",
    material: "material-symbols:restaurant",
    lucide: "lucide:utensils"
  },
  recent: {
    phosphor: "ph:clock-counter-clockwise",
    material: "material-symbols:history",
    lucide: "lucide:history"
  },
  list: {
    phosphor: "ph:list-bullets",
    material: "material-symbols:lists",
    lucide: "lucide:list"
  }
};

const Icon = ({ name, className = "", ...props }) => {
  const [iconSet, setIconSet] = useState(() => GetUiSettings().IconSet);

  useEffect(() => {
    const handler = (event) => {
      setIconSet(event.detail?.IconSet || GetUiSettings().IconSet);
    };
    window.addEventListener("ui-settings-changed", handler);
    return () => window.removeEventListener("ui-settings-changed", handler);
  }, []);

  const value = IconMap[name]?.[iconSet] || IconMap[name]?.phosphor;
  if (!value) {
    return null;
  }
  return <iconify-icon icon={value} className={className} {...props} />;
};

export default Icon;
