import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Icon from "./Icon.jsx";

const MealActions = [
  { key: "breakfast", label: "Breakfast", icon: "breakfast", mealType: "Breakfast" },
  { key: "morningSnack", label: "Morning snack", icon: "morningSnack", mealType: "Snack1" },
  { key: "lunch", label: "Lunch", icon: "lunch", mealType: "Lunch" },
  { key: "afternoonSnack", label: "Afternoon snack", icon: "afternoonSnack", mealType: "Snack2" },
  { key: "dinner", label: "Dinner", icon: "dinner", mealType: "Dinner" },
  { key: "eveningSnack", label: "Evening snack", icon: "eveningSnack", mealType: "Snack3" }
];

const UtilityActions = [
  { key: "steps", label: "Steps", icon: "steps", route: "/health/today?steps=1" },
  { key: "weight", label: "Weight", icon: "weight", route: "/health/today?weight=1" }
];

const BuildMealRoute = (mealType) => `/health/log?add=1&meal=${encodeURIComponent(mealType)}`;
const BuildFoodRoute = (mode) => `/health/foods?add=${mode}`;

const HealthFab = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);

  const actions = useMemo(() => {
    const baseActions = [...MealActions, ...UtilityActions];
    if (location.pathname.startsWith("/health/foods")) {
      return [
        ...baseActions,
        { key: "addFood", label: "Add food", icon: "food", route: BuildFoodRoute("food") },
        { key: "addMeal", label: "Add meal", icon: "meal", route: BuildFoodRoute("meal") }
      ];
    }
    return baseActions;
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  const handleAction = (action) => {
    setOpen(false);
    if (action.mealType) {
      navigate(BuildMealRoute(action.mealType));
      return;
    }
    if (action.route) {
      navigate(action.route);
    }
  };

  return (
    <div className="health-fab">
      <div className="health-fab-stack" ref={menuRef}>
        {open ? (
          <div className="health-fab-menu" role="menu">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="health-fab-menu-item"
                role="menuitem"
                onClick={() => handleAction(action)}
              >
                <Icon name={action.icon} className="icon" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="health-fab-button"
          aria-label={open ? "Close log options" : "Open log options"}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Icon name={open ? "close" : "plus"} className="icon" />
        </button>
      </div>
    </div>
  );
};

export default HealthFab;
