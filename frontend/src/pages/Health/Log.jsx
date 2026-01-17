import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
import {
  CreateDailyLog,
  CreateMealEntry,
  CreatePortionOption,
  DeleteMealEntry,
  FetchHealthProfile,
  FetchDailyLog,
  FetchFoods,
  FetchMealTemplates,
  FetchPortionOptions,
  ShareMealEntry,
  UpdateMealEntry
} from "../../lib/healthApi.js";
import { FetchUsers } from "../../lib/settingsApi.js";

const FormatDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const ParseIsoDate = (value) => {
  const [year, month, day] = (value || "").split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
};
const FormatDayLabel = (value) => {
  const date = ParseIsoDate(value);
  return date
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
};
const WeekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FormatMonthLabel = (value) => {
  const [year, month] = (value || "").split("-").map((part) => Number(part));
  if (!year || !month) {
    return "";
  }
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
const BuildMonthDates = (value) => {
  const [year, month] = (value || "").split("-").map((part) => Number(part));
  if (!year || !month) {
    return [];
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    FormatDate(new Date(year, month - 1, index + 1))
  );
};
const BuildMonthGrid = (value) => {
  const [year, month] = (value || "").split("-").map((part) => Number(part));
  if (!year || !month) {
    return [];
  }
  const firstDay = new Date(year, month - 1, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const dates = BuildMonthDates(value);
  const cells = Array.from({ length: offset }, () => null);
  cells.push(...dates);
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
};
const ShiftMonth = (value, delta) => {
  const [year, month] = (value || "").split("-").map((part) => Number(part));
  if (!year || !month) {
    return value;
  }
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const FormatAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
};
const FormatUserLabel = (user) => {
  return user.FirstName || user.Username || `User ${user.Id}`;
};
const CalculateEntryCalories = (entry) => {
  const calories = Number(entry?.CaloriesPerServing) * Number(entry?.Quantity);
  return Number.isFinite(calories) ? calories : 0;
};
const NormalizeServingLabel = (value) => {
  const label = (value || "").trim();
  if (!label) {
    return "";
  }
  const normalized = label.toLowerCase();
  if (normalized === "serve" || normalized === "meal") {
    return "serving";
  }
  return label;
};

const GetDefaultMealType = (value = new Date()) => {
  const hour = value.getHours();
  if (hour < 10) {
    return "Breakfast";
  }
  if (hour < 12) {
    return "Snack1";
  }
  if (hour < 14) {
    return "Lunch";
  }
  if (hour < 17) {
    return "Snack2";
  }
  if (hour < 20) {
    return "Dinner";
  }
  return "Snack3";
};

const MealTypes = new Set(["Breakfast", "Snack1", "Lunch", "Snack2", "Dinner", "Snack3"]);

const ResolveMealType = (value) => (MealTypes.has(value) ? value : "");

const MealTypeLabels = {
  Breakfast: "Breakfast",
  Snack1: "Morning snack",
  Lunch: "Lunch",
  Snack2: "Afternoon snack",
  Dinner: "Dinner",
  Snack3: "Evening snack"
};

const FormatMealTypeLabel = (value) => MealTypeLabels[value] || value || "Meal";
const MealTypeIcons = {
  Breakfast: "breakfast",
  Snack1: "morningSnack",
  Lunch: "lunch",
  Snack2: "afternoonSnack",
  Dinner: "dinner",
  Snack3: "eveningSnack"
};
const MealOrder = ["Breakfast", "Snack1", "Lunch", "Snack2", "Dinner", "Snack3"];

const MassUnits = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592
};

const VolumeUnits = {
  mL: 1,
  L: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 250
};

const CountUnits = new Set(["serving", "piece", "slice", "biscuit", "egg", "can", "bar", "handful"]);

const UnitAliases = {
  gram: "g",
  grams: "g",
  gr: "g",
  kilogram: "kg",
  kilograms: "kg",
  ml: "mL",
  milliliter: "mL",
  milliliters: "mL",
  millilitre: "mL",
  millilitres: "mL",
  liter: "L",
  liters: "L",
  litre: "L",
  litres: "L",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cups: "cup",
  servings: "serving",
  pieces: "piece",
  slices: "slice",
  biscuits: "biscuit",
  eggs: "egg",
  cans: "can",
  bars: "bar",
  handfuls: "handful"
};

const NormalizeUnit = (unit) => {
  const value = (unit || "").trim();
  if (!value) {
    return "serving";
  }
  const lower = value.toLowerCase();
  if (UnitAliases[lower]) {
    return UnitAliases[lower];
  }
  if (MassUnits[lower]) {
    return lower;
  }
  if (lower === "ml" || lower === "l") {
    return lower === "ml" ? "mL" : "L";
  }
  if (VolumeUnits[lower]) {
    return lower;
  }
  if (CountUnits.has(lower)) {
    return lower;
  }
  if (lower.endsWith("s") && lower.length > 1) {
    const trimmed = lower.slice(0, -1);
    if (UnitAliases[trimmed]) {
      return UnitAliases[trimmed];
    }
    if (CountUnits.has(trimmed)) {
      return trimmed;
    }
  }
  return value;
};

const ResolveServingBase = (food) => {
  const servingQuantity = Number(food?.ServingQuantity || 1);
  const normalizedUnit = NormalizeUnit(food?.ServingUnit || "serving");
  if (normalizedUnit === "serving") {
    return { amount: servingQuantity, unit: "each" };
  }
  if (MassUnits[normalizedUnit]) {
    return { amount: servingQuantity * MassUnits[normalizedUnit], unit: "g" };
  }
  if (VolumeUnits[normalizedUnit]) {
    return { amount: servingQuantity * VolumeUnits[normalizedUnit], unit: "mL" };
  }
  if (CountUnits.has(normalizedUnit)) {
    return { amount: servingQuantity, unit: "each" };
  }
  return { amount: servingQuantity, unit: normalizedUnit };
};

const ResolveServingMultiplier = (food, baseTotal, baseUnit) => {
  if (!food || !baseTotal || !baseUnit) {
    return null;
  }
  const normalizedBaseUnit = NormalizeUnit(baseUnit);
  const servingBase = ResolveServingBase(food);
  if (!servingBase.amount || !servingBase.unit) {
    return null;
  }
  if (normalizedBaseUnit !== servingBase.unit) {
    return null;
  }
  const servings = Number(baseTotal) / Number(servingBase.amount);
  if (!Number.isFinite(servings)) {
    return null;
  }
  return servings;
};

const EstimateCalories = (food, baseTotal, baseUnit) => {
  const servings = ResolveServingMultiplier(food, baseTotal, baseUnit);
  if (!Number.isFinite(servings)) {
    return null;
  }
  return Math.round(servings * Number(food.CaloriesPerServing || 0));
};

const EstimateNutrition = (food, baseTotal, baseUnit) => {
  const servings = ResolveServingMultiplier(food, baseTotal, baseUnit);
  if (!Number.isFinite(servings)) {
    return null;
  }
  const calories = Math.round(servings * Number(food.CaloriesPerServing || 0));
  const protein = servings * Number(food.ProteinPerServing || 0);
  const carbs = servings * Number(food.CarbsPerServing || 0);
  const fat = servings * Number(food.FatPerServing || 0);
  const fibre = servings * Number(food.FibrePerServing || 0);
  return { calories, protein, carbs, fat, fibre };
};

const BuildOptionKey = (option) =>
  option.PortionOptionId || `${option.Label}:${option.BaseUnit}:${option.BaseAmount}`;

const GroupEntriesByMeal = (entries) => {
  const grouped = entries.reduce((acc, entry) => {
    const key = entry.MealType;
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});
  Object.values(grouped).forEach((items) => items.sort((a, b) => a.SortOrder - b.SortOrder));
  return grouped;
};

const Log = ({ InitialDate, InitialAddMode, InitialEditId }) => {
  const [searchParams] = useSearchParams();
  const fallbackDate = searchParams.get("date") || FormatDate(new Date());
  const defaultMealType = ResolveMealType(searchParams.get("meal")) || GetDefaultMealType();
  const initialDate = InitialDate || fallbackDate;
  const initialMonth = initialDate.slice(0, 7);
  const initialAddMode = InitialAddMode ?? searchParams.get("add") === "1";
  const initialEditId = InitialEditId ?? searchParams.get("edit");
  const today = useMemo(() => FormatDate(new Date()), []);

  const [logDate, setLogDate] = useState(initialDate);
  const [dailyLog, setDailyLog] = useState(null);
  const [dailyTotals, setDailyTotals] = useState(null);
  const [dailyTargets, setDailyTargets] = useState(null);
  const [entries, setEntries] = useState([]);
  const [foods, setFoods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [foodSearch, setFoodSearch] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef(null);
  const searchInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const quickSearchRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(initialAddMode || !!initialEditId);
  const [toast, setToast] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [mealTypeTouched, setMealTypeTouched] = useState(false);
  const [editContext, setEditContext] = useState(null);
  const pendingDeletesRef = useRef(new Map());
  const handledEditRef = useRef(null);
  const [quickPickerOpen, setQuickPickerOpen] = useState(initialAddMode && !initialEditId);
  const [quickTab, setQuickTab] = useState("foods");
  const [quickSearch, setQuickSearch] = useState("");
  const [quickSelectedKeys, setQuickSelectedKeys] = useState([]);
  const [quickQuantities, setQuickQuantities] = useState({});
  const [shareUsers, setShareUsers] = useState([]);
  const [shareTargetUserId, setShareTargetUserId] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loggedDays, setLoggedDays] = useState([]);
  const [pickerMonth, setPickerMonth] = useState(initialMonth);
  const datePickerRef = useRef(null);

  const [form, setForm] = useState({
    MealType: defaultMealType,
    SelectedId: "",
    Quantity: "1",
    EntryNotes: ""
  });

  const [portionOptions, setPortionOptions] = useState([]);
  const [portionBaseUnit, setPortionBaseUnit] = useState("each");
  const [selectedPortion, setSelectedPortion] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showFoodDetails, setShowFoodDetails] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [portionOverride, setPortionOverride] = useState({
    Label: "",
    BaseAmount: "",
    BaseUnit: "",
    SaveAsDefault: false
  });

  const loadData = async (dateValue) => {
    try {
      setStatus("loading");
      setError("");
      const [logData, foodData, templateData] = await Promise.all([
        FetchDailyLog(dateValue),
        FetchFoods(),
        FetchMealTemplates()
      ]);
      setDailyLog(logData.DailyLog || null);
      setEntries(logData.Entries || []);
      setDailyTotals(logData.Totals || null);
      setDailyTargets(logData.Targets || null);
      setFoods(foodData);
      setTemplates(templateData.Templates || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load log");
    }
  };

  useEffect(() => {
    loadData(logDate);
  }, [logDate]);

  useEffect(() => {
    let isActive = true;
    const loadShareUsers = async () => {
      try {
        const [profile, users] = await Promise.all([FetchHealthProfile(), FetchUsers()]);
        if (!isActive) {
          return;
        }
        const currentId = profile?.UserId;
        const filtered = Array.isArray(users)
          ? users.filter(
              (entry) => entry.Id !== currentId && String(entry.Role || "") === "Parent"
            )
          : [];
        setShareUsers(filtered);
      } catch {
        if (isActive) {
          setShareUsers([]);
        }
      }
    };
    loadShareUsers();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!shareTargetUserId) {
      return;
    }
    if (!shareUsers.some((user) => String(user.Id) === String(shareTargetUserId))) {
      setShareTargetUserId("");
    }
  }, [shareTargetUserId, shareUsers]);

  useEffect(() => {
    if (logDate > today) {
      setLogDate(today);
    }
  }, [logDate, today]);

  useEffect(() => {
    const nextDate = searchParams.get("date");
    if (nextDate && nextDate !== logDate) {
      setLogDate(nextDate);
    }
    const shouldShowForm = searchParams.get("add") === "1" || !!searchParams.get("edit");
    if (shouldShowForm) {
      setShowForm(true);
    } else if (!editingEntryId) {
      setShowForm(false);
    }
    const nextMealType = ResolveMealType(searchParams.get("meal"));
    if (nextMealType && !editingEntryId && !mealTypeTouched) {
      setForm((prev) => ({ ...prev, MealType: nextMealType }));
    }
  }, [searchParams, logDate, editingEntryId, mealTypeTouched]);

  useEffect(() => {
    if (!datePickerOpen) {
      const currentMonth = today.slice(0, 7);
      const selectedMonth = logDate.slice(0, 7);
      setPickerMonth(selectedMonth > currentMonth ? currentMonth : selectedMonth);
    }
  }, [datePickerOpen, logDate, today]);

  useEffect(() => {
    if (!showForm) {
      setQuickPickerOpen(false);
      return;
    }
    if (editingEntryId || form.SelectedId) {
      setQuickPickerOpen(false);
      return;
    }
    if (searchParams.get("add") === "1") {
      setQuickPickerOpen(true);
    }
  }, [editingEntryId, form.SelectedId, searchParams, showForm]);

  useEffect(() => {
    if (quickPickerOpen && quickSearchRef.current) {
      quickSearchRef.current.focus();
    }
  }, [quickPickerOpen]);

  useEffect(() => {
    if (!datePickerOpen) {
      return undefined;
    }
    const handleClick = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [datePickerOpen]);

  useEffect(() => {
    if (!datePickerOpen) {
      return undefined;
    }
    let isActive = true;
    const loadLoggedDays = async () => {
      const dates = BuildMonthDates(pickerMonth);
      try {
        const results = await Promise.all(
          dates.map(async (date) => {
            try {
              const data = await FetchDailyLog(date);
              return data?.Entries?.length ? date : null;
            } catch {
              return null;
            }
          })
        );
        if (!isActive) {
          return;
        }
        const unique = Array.from(new Set(results.filter(Boolean)));
        setLoggedDays(unique);
      } catch {
        if (isActive) {
          setLoggedDays([]);
        }
      }
    };
    loadLoggedDays();
    return () => {
      isActive = false;
    };
  }, [datePickerOpen, pickerMonth]);

  useEffect(() => {
    return () => {
      pendingDeletesRef.current.forEach((pending) => clearTimeout(pending.timeoutId));
      pendingDeletesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (editingEntryId) {
      return;
    }
    setMealTypeTouched(false);
    const nextMealType = ResolveMealType(searchParams.get("meal")) || GetDefaultMealType();
    setForm((prev) => ({ ...prev, MealType: nextMealType }));
  }, [editingEntryId, logDate, searchParams]);

  useEffect(() => {
    if (!selectorOpen) {
      setFoodSearch("");
      return;
    }
    const handleClick = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setSelectorOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [selectorOpen]);

  const [selectedType, selectedValue] = form.SelectedId ? form.SelectedId.split(":") : ["", ""];
  const isFoodSelected = selectedType === "food";
  const isTemplateSelected = selectedType === "template";

  useEffect(() => {
    let isActive = true;

    const resetOptions = () => {
      if (!isActive) {
        return;
      }
      setPortionOptions([]);
      setPortionBaseUnit("each");
      setSelectedPortion("");
      setPortionOverride({
        Label: "",
        BaseAmount: "",
        BaseUnit: "",
        SaveAsDefault: false
      });
    };

    if (!form.SelectedId) {
      resetOptions();
      return () => {
        isActive = false;
      };
    }

    if (isTemplateSelected) {
      const options = [
        {
          Label: "serving",
          BaseUnit: "each",
          BaseAmount: 1,
          Scope: "global",
          SortOrder: 0,
          IsDefault: true
        }
      ].map((option) => ({ ...option, OptionKey: BuildOptionKey(option) }));
      if (isActive) {
        setPortionBaseUnit("each");
        setPortionOptions(options);
        setSelectedPortion(options[0]?.OptionKey || "");
        setPortionOverride({
          Label: "",
          BaseAmount: "",
          BaseUnit: "each",
          SaveAsDefault: false
        });
      }
      return () => {
        isActive = false;
      };
    }

    if (!isFoodSelected) {
      resetOptions();
      return () => {
        isActive = false;
      };
    }

    const loadOptions = async () => {
      try {
        const response = await FetchPortionOptions(selectedValue);
        if (!isActive) {
          return;
        }
        const options = (response.Options || []).map((option) => ({
          ...option,
          OptionKey: BuildOptionKey(option)
        }));
        const baseUnit = response.BaseUnit || "each";
        const defaultOption = options.find((option) => option.IsDefault) || options[0];
        setPortionBaseUnit(baseUnit);
        setPortionOptions(options);
        setSelectedPortion(defaultOption ? defaultOption.OptionKey : "");
        setPortionOverride({
          Label: "",
          BaseAmount: "",
          BaseUnit: baseUnit,
          SaveAsDefault: false
        });
      } catch (err) {
        if (!isActive) {
          return;
        }
        setPortionOptions([]);
        setSelectedPortion("");
        setPortionBaseUnit("each");
      }
    };

    loadOptions();
    return () => {
      isActive = false;
    };
  }, [form.SelectedId, isFoodSelected, isTemplateSelected, selectedValue]);

  useEffect(() => {
    if (!editContext || editContext.SelectedId !== form.SelectedId) {
      return;
    }
    if (isTemplateSelected) {
      if (portionOptions.length) {
        setSelectedPortion(portionOptions[0].OptionKey || "");
        setPortionOverride({
          Label: "",
          BaseAmount: "",
          BaseUnit: "each",
          SaveAsDefault: false
        });
        setEditContext(null);
      }
      return;
    }
    if (!isFoodSelected || !portionOptions.length) {
      return;
    }
    if (editContext.PortionOptionId) {
      const match = portionOptions.find(
        (option) => option.PortionOptionId === editContext.PortionOptionId
      );
      if (match) {
        setSelectedPortion(match.OptionKey);
        setPortionOverride({
          Label: "",
          BaseAmount: "",
          BaseUnit: portionBaseUnit,
          SaveAsDefault: false
        });
        setEditContext(null);
        return;
      }
    }
    if (editContext.PortionBaseAmount) {
      const baseAmount = Number(editContext.PortionBaseAmount);
      const baseUnit = editContext.PortionBaseUnit || portionBaseUnit;
      const baseLabel = (editContext.PortionLabel || "").trim().toLowerCase();
      const matchByBase = portionOptions.find((option) => {
        const optionLabel = (option.Label || "").trim().toLowerCase();
        return (
          Number(option.BaseAmount) === baseAmount &&
          option.BaseUnit === baseUnit &&
          (!baseLabel || optionLabel === baseLabel)
        );
      });
      if (matchByBase) {
        setSelectedPortion(matchByBase.OptionKey);
        setPortionOverride({
          Label: "",
          BaseAmount: "",
          BaseUnit: portionBaseUnit,
          SaveAsDefault: false
        });
        setEditContext(null);
        return;
      }
      setSelectedPortion("custom");
      setPortionOverride({
        Label: editContext.PortionLabel || "",
        BaseAmount: String(editContext.PortionBaseAmount),
        BaseUnit: baseUnit,
        SaveAsDefault: false
      });
      setEditContext(null);
      return;
    }
    setSelectedPortion(portionOptions[0]?.OptionKey || "");
    setEditContext(null);
  }, [
    editContext,
    form.SelectedId,
    isFoodSelected,
    isTemplateSelected,
    portionOptions,
    portionBaseUnit
  ]);

  const filteredFoods = useMemo(() => {
    const query = foodSearch.trim().toLowerCase();
    if (!query) {
      return foods;
    }
    return foods.filter((food) => food.FoodName.toLowerCase().includes(query));
  }, [foods, foodSearch]);

  const foodsById = useMemo(
    () =>
      foods.reduce((map, food) => {
        map[food.FoodId] = food;
        return map;
      }, {}),
    [foods]
  );

  const resolveTemplateServings = (template) => {
    const servings = Number(template?.Template?.Servings || 1);
    return Number.isFinite(servings) && servings > 0 ? servings : 1;
  };

  const getTemplateServingLabel = (template) => {
    const servings = resolveTemplateServings(template);
    return servings > 1 ? `1 of ${FormatAmount(servings)} servings` : "1 serving";
  };

  const templateCalories = useMemo(() => {
    const totals = {};
    templates.forEach((template) => {
      let calories = 0;
      template.Items.forEach((item) => {
        const food = foodsById[item.FoodId];
        if (!food) {
          return;
        }
        const quantity = item.EntryQuantity || item.Quantity || 1;
        calories += (food.CaloriesPerServing || 0) * quantity;
      });
      const servings = resolveTemplateServings(template);
      totals[template.Template.MealTemplateId] = Math.round(calories / servings);
    });
    return totals;
  }, [templates, foodsById]);

  const filteredTemplates = useMemo(() => {
    const query = foodSearch.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      template.Template.TemplateName.toLowerCase().includes(query)
    );
  }, [templates, foodSearch]);

  const quickQuery = quickSearch.trim().toLowerCase();
  const quickFoodItems = useMemo(() => {
    const list = foods.map((food) => ({
      type: "food",
      id: food.FoodId,
      name: food.FoodName,
      serving: food.ServingDescription || `${food.ServingQuantity} ${food.ServingUnit}`,
      calories: Math.round(food.CaloriesPerServing || 0),
      createdAt: food.CreatedAt ? new Date(food.CreatedAt).getTime() : 0
    }));
    if (!quickQuery) {
      return list;
    }
    return list.filter((item) => item.name.toLowerCase().includes(quickQuery));
  }, [foods, quickQuery]);

  const quickMealItems = useMemo(() => {
    const list = templates.map((template) => ({
      type: "meal",
      id: template.Template.MealTemplateId,
      name: template.Template.TemplateName,
      serving: getTemplateServingLabel(template),
      calories: templateCalories[template.Template.MealTemplateId] ?? null,
      createdAt: template.Template.CreatedAt ? new Date(template.Template.CreatedAt).getTime() : 0
    }));
    if (!quickQuery) {
      return list;
    }
    return list.filter((item) => item.name.toLowerCase().includes(quickQuery));
  }, [templates, templateCalories, quickQuery]);

  const quickRecentItems = useMemo(() => {
    const combined = [...quickFoodItems, ...quickMealItems];
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined.slice(0, 20);
  }, [quickFoodItems, quickMealItems]);

  const quickAllItems = useMemo(() => {
    const combined = [...quickFoodItems, ...quickMealItems];
    combined.sort((a, b) => a.name.localeCompare(b.name));
    return combined;
  }, [quickFoodItems, quickMealItems]);

  const quickItemMap = useMemo(() => {
    const map = new Map();
    quickAllItems.forEach((item) => {
      map.set(`${item.type}:${item.id}`, item);
    });
    return map;
  }, [quickAllItems]);

  const quickSelectedSet = useMemo(
    () => new Set(quickSelectedKeys),
    [quickSelectedKeys]
  );

  const getQuickQuantity = (key) => quickQuantities[key] ?? "1";
  const updateQuickQuantity = (key, value) => {
    setQuickQuantities((prev) => ({ ...prev, [key]: value }));
  };

  const quickItems =
    quickTab === "all"
      ? quickAllItems
      : quickTab === "foods"
        ? quickFoodItems
        : quickTab === "meals"
          ? quickMealItems
          : quickRecentItems;

  const selectedLabel = useMemo(() => {
    if (!form.SelectedId) {
      return "Select food or meal";
    }
    if (isFoodSelected) {
      const food = foods.find((item) => item.FoodId === selectedValue);
      return food?.FoodName || "Select food or meal";
    }
    if (isTemplateSelected) {
      const template = templates.find(
        (item) => item.Template.MealTemplateId === selectedValue
      );
      return template?.Template.TemplateName || "Select food or meal";
    }
    return "Select food or meal";
  }, [form.SelectedId, foods, isFoodSelected, isTemplateSelected, selectedValue, templates]);

  const selectedFood = useMemo(() => {
    if (!isFoodSelected) {
      return null;
    }
    return foods.find((food) => food.FoodId === selectedValue) || null;
  }, [foods, isFoodSelected, selectedValue]);

  const selectedOption = portionOptions.find((option) => option.OptionKey === selectedPortion) || null;
  const isCustomPortion = selectedPortion === "custom";
  const overrideAmount = portionOverride.BaseAmount ? Number(portionOverride.BaseAmount) : null;
  const overrideUnit = portionOverride.BaseUnit || portionBaseUnit;
  const effectiveBaseAmount = overrideAmount ?? selectedOption?.BaseAmount ?? null;
  const effectiveBaseUnit = overrideAmount ? overrideUnit : selectedOption?.BaseUnit;
  const effectiveLabel = isCustomPortion
    ? portionOverride.Label.trim() || "custom"
    : selectedOption?.Label || "serving";
  const quantityValue = Number(form.Quantity || 0);
  const equivalentValue =
    Number.isFinite(quantityValue) && effectiveBaseAmount
      ? quantityValue * Number(effectiveBaseAmount)
      : null;
  const estimatedCalories = useMemo(
    () =>
      selectedFood && equivalentValue && effectiveBaseUnit
        ? EstimateCalories(selectedFood, equivalentValue, effectiveBaseUnit)
        : null,
    [selectedFood, equivalentValue, effectiveBaseUnit]
  );
  const estimatedNutrition = useMemo(
    () =>
      selectedFood && equivalentValue && effectiveBaseUnit
        ? EstimateNutrition(selectedFood, equivalentValue, effectiveBaseUnit)
        : null,
    [selectedFood, equivalentValue, effectiveBaseUnit]
  );
  const foodDetailRows = useMemo(() => {
    if (!estimatedNutrition) {
      return [];
    }
    const targets = dailyTargets || {};
    const proteinTarget = targets.ProteinTargetMax ?? targets.ProteinTargetMin ?? 0;
    return [
      {
        label: "Calories",
        value: estimatedNutrition.calories,
        unit: "kcal",
        target: targets.DailyCalorieTarget ?? 0
      },
      {
        label: "Protein",
        value: estimatedNutrition.protein,
        unit: "g",
        target: proteinTarget
      },
      {
        label: "Carbs",
        value: estimatedNutrition.carbs,
        unit: "g",
        target: targets.CarbsTarget ?? 0
      },
      {
        label: "Fat",
        value: estimatedNutrition.fat,
        unit: "g",
        target: targets.FatTarget ?? 0
      },
      {
        label: "Fibre",
        value: estimatedNutrition.fibre,
        unit: "g",
        target: targets.FibreTarget ?? 0
      }
    ].map((row) => {
      const percent =
        row.target > 0 ? Math.round((Number(row.value) / Number(row.target)) * 100) : null;
      return {
        ...row,
        percentLabel: percent === null ? "No target" : `${percent}% of daily target`
      };
    });
  }, [dailyTargets, estimatedNutrition]);
  const editCalories = useMemo(() => {
    if (!form.SelectedId || !Number.isFinite(quantityValue)) {
      return null;
    }
    if (isFoodSelected) {
      if (Number.isFinite(estimatedCalories)) {
        return estimatedCalories;
      }
      const base = Number(selectedFood?.CaloriesPerServing || 0);
      return Math.round(base * quantityValue);
    }
    if (isTemplateSelected) {
      const base = Number(templateCalories[selectedValue] || 0);
      return Math.round(base * quantityValue);
    }
    return null;
  }, [
    estimatedCalories,
    form.SelectedId,
    isFoodSelected,
    isTemplateSelected,
    quantityValue,
    selectedFood,
    selectedValue,
    templateCalories
  ]);

  const onFormChange = (event) => {
    const { name, value } = event.target;
    if (name === "MealType") {
      setMealTypeTouched(true);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSelectItem = (event, type, id) => {
    event.preventDefault();
    event.stopPropagation();
    setForm((prev) => ({ ...prev, SelectedId: `${type}:${id}` }));
    setSelectorOpen(false);
    setFoodSearch("");
    requestAnimationFrame(() => {
      quantityInputRef.current?.focus();
    });
  };

  const selectQuickItem = (type, id) => {
    const nextSelected = `${type}:${id}`;
    setForm((prev) => ({ ...prev, SelectedId: nextSelected }));
    setSelectorOpen(false);
    setFoodSearch("");
    setQuickSearch("");
    setQuickPickerOpen(false);
    requestAnimationFrame(() => {
      quantityInputRef.current?.focus();
    });
  };

  const closeQuickPicker = () => {
    setQuickPickerOpen(false);
    setShowForm(false);
    setEditingEntryId(null);
    setEditContext(null);
    setForm((prev) => ({
      ...prev,
      SelectedId: "",
      Quantity: "1",
      EntryNotes: "",
      MealType: prev.MealType || GetDefaultMealType()
    }));
    setFoodSearch("");
    setQuickSearch("");
    setSelectedPortion("");
    setPortionOptions([]);
    setPortionBaseUnit("each");
    setPortionOverride({
      Label: "",
      BaseAmount: "",
      BaseUnit: "",
      SaveAsDefault: false
    });
    setDetailsOpen(false);
    setQuickSelectedKeys([]);
    setQuickQuantities({});
    setShareTargetUserId("");
  };

  const toggleQuickSelection = (key) => {
    setQuickSelectedKeys((prev) => {
      if (prev.includes(key)) {
        setQuickQuantities((quantities) => {
          const next = { ...quantities };
          delete next[key];
          return next;
        });
        return prev.filter((item) => item !== key);
      }
      setQuickQuantities((quantities) =>
        Object.prototype.hasOwnProperty.call(quantities, key)
          ? quantities
          : { ...quantities, [key]: "1" }
      );
      return [...prev, key];
    });
  };

  const logQuickSelections = async () => {
    if (!quickSelectedKeys.length) {
      return;
    }
    const invalidKey = quickSelectedKeys.find((key) => {
      const value = Number(getQuickQuantity(key));
      return !Number.isFinite(value) || value <= 0;
    });
    if (invalidKey) {
      setStatus("error");
      setError("Enter a valid amount for each selected item.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const log = await ensureDailyLog();
      const maxSort = entries.length ? Math.max(...entries.map((entry) => entry.SortOrder || 0)) + 1 : 0;
      const mealType = form.MealType || GetDefaultMealType();
      const shareUserId = Number(shareTargetUserId || 0);
      const shouldShare = Number.isFinite(shareUserId) && shareUserId > 0;

      const payloads = quickSelectedKeys
        .map((key, index) => {
          const item = quickItemMap.get(key);
          if (!item) {
            return null;
          }
          const quantity = Number(getQuickQuantity(key));
          if (item.type === "meal") {
            return {
              DailyLogId: log.DailyLogId,
              MealType: mealType,
              FoodId: null,
              MealTemplateId: item.id,
              Quantity: quantity,
              PortionOptionId: null,
              PortionLabel: "serving",
              PortionBaseUnit: "each",
              PortionBaseAmount: 1,
              EntryNotes: null,
              SortOrder: maxSort + index
            };
          }
          const food = foodsById[item.id];
          if (!food) {
            return null;
          }
          const base = ResolveServingBase(food);
          return {
            DailyLogId: log.DailyLogId,
            MealType: mealType,
            FoodId: item.id,
            MealTemplateId: null,
            Quantity: quantity,
            PortionOptionId: null,
            PortionLabel: "serving",
            PortionBaseUnit: base.unit,
            PortionBaseAmount: base.amount,
            EntryNotes: null,
            SortOrder: maxSort + index
          };
        })
        .filter(Boolean);

      await Promise.all(payloads.map((payload) => CreateMealEntry(payload)));
      if (shouldShare) {
        const sharePayloads = payloads.map((payload) => ({
          LogDate: logDate,
          TargetUserId: shareUserId,
          MealType: payload.MealType,
          FoodId: payload.FoodId,
          MealTemplateId: payload.MealTemplateId,
          Quantity: payload.Quantity,
          PortionOptionId: payload.PortionOptionId,
          PortionLabel: payload.PortionLabel,
          PortionBaseUnit: payload.PortionBaseUnit,
          PortionBaseAmount: payload.PortionBaseAmount,
          EntryNotes: payload.EntryNotes || null,
          ScheduleSlotId: null
        }));
        await Promise.all(sharePayloads.map((payload) => ShareMealEntry(payload)));
      }
      await loadData(logDate);
      setQuickSelectedKeys([]);
      setQuickQuantities({});
      setQuickPickerOpen(false);
      setShowForm(false);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to log selections");
    }
  };

  const onCancelEdit = () => {
    setEditingEntryId(null);
    setShowForm(false);
    setEditContext(null);
    setForm((prev) => ({
      ...prev,
      SelectedId: "",
      Quantity: "1",
      EntryNotes: "",
      MealType: prev.MealType || GetDefaultMealType()
    }));
    setFoodSearch("");
    setSelectedPortion("");
    setPortionOptions([]);
    setPortionBaseUnit("each");
    setPortionOverride({
      Label: "",
      BaseAmount: "",
      BaseUnit: "",
      SaveAsDefault: false
    });
    setDetailsOpen(false);
    setShowFoodDetails(false);
    setShowNotes(false);
    setQuickQuantities({});
    setShareTargetUserId("");
  };

  const openAddEntry = () => {
    setEditingEntryId(null);
    setEditContext(null);
    setForm((prev) => ({
      ...prev,
      SelectedId: "",
      Quantity: "1",
      EntryNotes: "",
      MealType: prev.MealType || GetDefaultMealType()
    }));
    setFoodSearch("");
    setQuickSearch("");
    setSelectedPortion("");
    setPortionOptions([]);
    setPortionBaseUnit("each");
    setPortionOverride({
      Label: "",
      BaseAmount: "",
      BaseUnit: "",
      SaveAsDefault: false
    });
    setDetailsOpen(false);
    setShowFoodDetails(false);
    setShowNotes(false);
    setQuickSelectedKeys([]);
    setQuickQuantities({});
    setShowForm(true);
    setQuickPickerOpen(true);
  };

  const onDeleteEditingEntry = () => {
    if (!editingEntryId) {
      return;
    }
    const entry = entries.find((item) => item.MealEntryId === editingEntryId);
    if (entry) {
      scheduleDelete(entry);
    }
    setEditingEntryId(null);
    setShowForm(false);
  };

  const onPortionOverrideChange = (event) => {
    const { name, value, type, checked } = event.target;
    setPortionOverride((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onAdjustQuantity = (delta) => {
    const current = Number(form.Quantity);
    const baseValue = Number.isFinite(current) ? current : 0;
    const nextValue = Math.max(0.25, Math.round((baseValue + delta) * 100) / 100);
    setForm((prev) => ({ ...prev, Quantity: String(nextValue) }));
  };

  const onSelectPortion = (event) => {
    const value = event.target.value;
    setSelectedPortion(value);
    setPortionOverride((prev) => ({
      ...prev,
      BaseAmount: "",
      Label: value === "custom" ? prev.Label : "",
      SaveAsDefault: false
    }));
  };

  const onEditEntry = (entry) => {
    const nextSelectedId = entry.FoodId
      ? `food:${entry.FoodId}`
      : entry.MealTemplateId
      ? `template:${entry.MealTemplateId}`
      : "";
    setShowForm(true);
    setEditingEntryId(entry.MealEntryId);
    setSelectorOpen(false);
    setMealTypeTouched(true);
    setForm((prev) => ({
      ...prev,
      MealType: entry.MealType,
      SelectedId: nextSelectedId,
      Quantity: String(entry.DisplayQuantity ?? entry.Quantity ?? 1),
      EntryNotes: entry.EntryNotes || ""
    }));
    requestAnimationFrame(() => {
      quantityInputRef.current?.focus();
    });
    setEditContext({
      SelectedId: nextSelectedId,
      PortionOptionId: entry.PortionOptionId,
      PortionLabel: entry.PortionLabel,
      PortionBaseUnit: entry.PortionBaseUnit,
      PortionBaseAmount: entry.PortionBaseAmount
    });
    setDetailsOpen(false);
    setShowFoodDetails(false);
    setShowNotes(false);
  };

  useEffect(() => {
    const editEntryId = searchParams.get("edit");
    if (!editEntryId) {
      handledEditRef.current = null;
      return;
    }
    if (handledEditRef.current === editEntryId) {
      return;
    }
    const entry = entries.find((item) => item.MealEntryId === editEntryId);
    if (!entry) {
      return;
    }
    onEditEntry(entry);
    handledEditRef.current = editEntryId;
  }, [entries, searchParams]);

  const ensureDailyLog = async () => {
    if (dailyLog) {
      return dailyLog;
    }
    const created = await CreateDailyLog({ LogDate: logDate, Steps: 0 });
    setDailyLog(created.DailyLog);
    return created.DailyLog;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.SelectedId) {
      setError("Select a food or meal.");
      return;
    }
    const quantity = Number(form.Quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const log = await ensureDailyLog();
      const [type, id] = form.SelectedId.split(":");
      const maxSort = entries.length ? Math.max(...entries.map((entry) => entry.SortOrder || 0)) + 1 : 0;
      const isFoodEntry = type === "food";

      let portionPayload = {
        PortionOptionId: null,
        PortionLabel: "serving",
        PortionBaseUnit: "each",
        PortionBaseAmount: 1
      };

      if (isFoodEntry) {
        if (!effectiveBaseAmount || !effectiveBaseUnit) {
          setStatus("error");
          setError("Select a serving size.");
          return;
        }
        portionPayload = {
          PortionOptionId: selectedOption?.PortionOptionId || null,
          PortionLabel: effectiveLabel || "serving",
          PortionBaseUnit: effectiveBaseUnit,
          PortionBaseAmount: Number(effectiveBaseAmount)
        };

        if (portionOverride.SaveAsDefault && overrideAmount) {
          await CreatePortionOption({
            FoodId: id,
            Label: portionOverride.Label.trim() || portionPayload.PortionLabel,
            BaseUnit: portionPayload.PortionBaseUnit,
            BaseAmount: portionPayload.PortionBaseAmount,
            IsDefault: true,
            SortOrder: 0
          });
        }
      }

      if (editingEntryId) {
        const payload = {
          MealType: form.MealType,
          Quantity: quantity,
          ...portionPayload,
          EntryNotes: form.EntryNotes || null
        };
        await UpdateMealEntry(editingEntryId, payload);
        setShowForm(false);
      } else {
        const payload = {
          DailyLogId: log.DailyLogId,
          MealType: form.MealType,
          FoodId: isFoodEntry ? id : null,
          MealTemplateId: type === "template" ? id : null,
          Quantity: quantity,
          ...portionPayload,
          EntryNotes: form.EntryNotes || null,
          SortOrder: maxSort
        };
        await CreateMealEntry(payload);
        setShowForm(false);
      }
      await loadData(logDate);
      setForm((prev) => ({
        ...prev,
        SelectedId: "",
        Quantity: "1",
        EntryNotes: ""
      }));
      setFoodSearch("");
      setSelectedPortion("");
      setPortionOptions([]);
      setPortionBaseUnit("each");
      setPortionOverride({
        Label: "",
        BaseAmount: "",
        BaseUnit: "",
        SaveAsDefault: false
      });
      setDetailsOpen(false);
      setEditingEntryId(null);
      setEditContext(null);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save entry");
    }
  };

  const scheduleDelete = (entry) => {
    const entryId = entry.MealEntryId;
    if (pendingDeletesRef.current.has(entryId)) {
      return;
    }
    const entryIndex = entries.findIndex((item) => item.MealEntryId === entryId);
    setEntries((prev) => prev.filter((item) => item.MealEntryId !== entryId));
    const timeoutId = window.setTimeout(async () => {
      try {
        await DeleteMealEntry(entryId);
      } catch (err) {
        setError(err?.message || "Failed to delete entry");
        await loadData(logDate);
      } finally {
        pendingDeletesRef.current.delete(entryId);
        setToast((prev) => (prev?.entryId === entryId ? null : prev));
      }
    }, 4500);
    pendingDeletesRef.current.set(entryId, { entry, entryIndex, timeoutId });
    setToast({ entryId, message: "Entry deleted" });
  };

  const undoDelete = () => {
    if (!toast?.entryId) {
      return;
    }
    const pending = pendingDeletesRef.current.get(toast.entryId);
    if (!pending) {
      setToast(null);
      return;
    }
    clearTimeout(pending.timeoutId);
    pendingDeletesRef.current.delete(toast.entryId);
    setEntries((prev) => {
      const next = [...prev];
      const index = pending.entryIndex >= 0 ? pending.entryIndex : 0;
      next.splice(Math.min(index, next.length), 0, pending.entry);
      return next;
    });
    setToast(null);
  };

  const groupedEntries = useMemo(() => GroupEntriesByMeal(entries), [entries]);
  const orderedGroups = useMemo(() => {
    const ordered = MealOrder.filter((meal) => groupedEntries[meal]?.length).map((meal) => ({
      meal,
      items: groupedEntries[meal]
    }));
    Object.entries(groupedEntries).forEach(([meal, items]) => {
      if (!MealOrder.includes(meal)) {
        ordered.push({ meal, items });
      }
    });
    return ordered;
  }, [groupedEntries]);
  const slotTotals = useMemo(() => {
    const totals = {};
    Object.entries(groupedEntries).forEach(([meal, items]) => {
      totals[meal] = items.reduce((sum, entry) => sum + CalculateEntryCalories(entry), 0);
    });
    return totals;
  }, [groupedEntries]);
  const macroRows = useMemo(() => {
    if (!dailyTotals || !dailyTargets) {
      return [];
    }
    const buildTargetRow = ({
      label,
      value,
      unit,
      target,
      minTarget,
      maxTarget
    }) => {
      const min = minTarget ?? 0;
      const max = maxTarget ?? 0;
      const rangeTarget = max || min;
      const singleTarget = target ?? 0;
      const effectiveTarget = rangeTarget || singleTarget;
      if (!effectiveTarget || effectiveTarget <= 0) {
        return null;
      }
      const percent = Math.round((value / effectiveTarget) * 100);
      const percentClamped = Math.min(100, Math.max(0, percent));
      const diffPercent = (current, goal) =>
        goal > 0 ? Math.abs((current - goal) / goal) * 100 : 0;
      const resolveTone = (difference) => {
        if (difference <= 5) {
          return "is-on";
        }
        if (difference <= 15) {
          return "is-near";
        }
        return "is-far";
      };
      let percentLabel = `${percent}% of target`;
      let deltaLabel = "";
      let barClass = resolveTone(diffPercent(value, effectiveTarget));
      if (rangeTarget) {
        if (max) {
          percentLabel = `${percent}% of max`;
        } else if (min) {
          percentLabel = `${percent}% of min`;
        }
        if (min && value < min) {
          deltaLabel = `${FormatAmount(min - value)}${unit} under min`;
          barClass = resolveTone(diffPercent(value, min));
        } else if (max && value > max) {
          deltaLabel = `${FormatAmount(value - max)}${unit} over max`;
          barClass = resolveTone(diffPercent(value, max));
        } else {
          deltaLabel = "Within range";
          barClass = "is-on";
        }
      } else {
        const delta = value - effectiveTarget;
        deltaLabel =
          delta > 0
            ? `${FormatAmount(delta)}${unit} over`
            : `${FormatAmount(Math.abs(delta))}${unit} under`;
      }
      return {
        label,
        value,
        unit,
        percentLabel,
        percentClamped,
        deltaLabel,
        barClass
      };
    };

    return [
      buildTargetRow({
        label: "Calories",
        value: dailyTotals.TotalCalories,
        unit: "kcal",
        target: dailyTargets.DailyCalorieTarget ?? 0
      }),
      buildTargetRow({
        label: "Protein",
        value: dailyTotals.TotalProtein,
        unit: "g",
        minTarget: dailyTargets.ProteinTargetMin ?? 0,
        maxTarget: dailyTargets.ProteinTargetMax ?? 0
      }),
      buildTargetRow({
        label: "Carbs",
        value: dailyTotals.TotalCarbs,
        unit: "g",
        target: dailyTargets.CarbsTarget ?? 0
      }),
      buildTargetRow({
        label: "Fat",
        value: dailyTotals.TotalFat,
        unit: "g",
        target: dailyTargets.FatTarget ?? 0
      }),
      buildTargetRow({
        label: "Fibre",
        value: dailyTotals.TotalFibre,
        unit: "g",
        target: dailyTargets.FibreTarget ?? 0
      }),
      buildTargetRow({
        label: "Saturated fat",
        value: dailyTotals.TotalSaturatedFat,
        unit: "g",
        target: dailyTargets.SaturatedFatTarget ?? 0
      }),
      buildTargetRow({
        label: "Sugar",
        value: dailyTotals.TotalSugar,
        unit: "g",
        target: dailyTargets.SugarTarget ?? 0
      }),
      buildTargetRow({
        label: "Sodium",
        value: dailyTotals.TotalSodium,
        unit: "g",
        target: dailyTargets.SodiumTarget ?? 0
      })
    ].filter(Boolean);
  }, [dailyTotals, dailyTargets]);
  const loggedDaysSet = useMemo(() => new Set(loggedDays), [loggedDays]);
  const monthCells = useMemo(() => BuildMonthGrid(pickerMonth), [pickerMonth]);
  const dayLabel = logDate === today ? "Today" : FormatDayLabel(logDate);
  const parsedDate = ParseIsoDate(logDate);
  const previousDate = FormatDate(
    new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate() - 1)
  );
  const nextDate = FormatDate(
    new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate() + 1)
  );
  const isLatestDate = logDate >= today;
  const currentMonth = today.slice(0, 7);
  const nextMonth = ShiftMonth(pickerMonth, 1);
  const isNextMonthDisabled = nextMonth > currentMonth;
  const handleLogDateChange = (value) => {
    setLogDate(value);
    setDatePickerOpen(false);
  };
  const logForm = (
    <form className="health-log-form" onSubmit={onSubmit}>
      <label>
        Meal slot
        <select name="MealType" value={form.MealType} onChange={onFormChange}>
          <option value="Breakfast">Breakfast</option>
          <option value="Snack1">Snack 1</option>
          <option value="Lunch">Lunch</option>
          <option value="Snack2">Snack 2</option>
          <option value="Dinner">Dinner</option>
          <option value="Snack3">Snack 3</option>
        </select>
      </label>
      <label>
        Food or meal
        <div className="health-select" ref={selectorRef}>
          <button
            type="button"
            className="health-select-trigger"
            onClick={() => setSelectorOpen((prev) => !prev)}
            aria-expanded={selectorOpen}
            disabled={!!editingEntryId}
          >
            <span>{selectedLabel}</span>
            <Icon name={selectorOpen ? "chevronDown" : "chevronRight"} className="icon" />
          </button>
          {selectorOpen ? (
            <div className="health-select-menu">
              <div className="health-select-search">
                <Icon name="search" className="icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={foodSearch}
                  onChange={(event) => setFoodSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                    }
                  }}
                  placeholder="Search foods or meals"
                />
              </div>
              <div className="health-search-meta">
                Showing {filteredFoods.length} foods and {filteredTemplates.length} meals
              </div>
              <div className="health-select-group">
                <span className="health-select-heading">Foods</span>
                {filteredFoods.length ? (
                  filteredFoods.map((food) => (
                    <button
                      key={food.FoodId}
                      type="button"
                      className="health-select-item"
                      onClick={(event) => onSelectItem(event, "food", food.FoodId)}
                    >
                      {food.FoodName}
                    </button>
                  ))
                ) : (
                  <span className="health-select-empty">No foods found.</span>
                )}
              </div>
              <div className="health-select-group">
                <span className="health-select-heading">Meals</span>
                {filteredTemplates.length ? (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.Template.MealTemplateId}
                      type="button"
                      className="health-select-item"
                      onClick={(event) =>
                        onSelectItem(event, "template", template.Template.MealTemplateId)
                      }
                    >
                      {template.Template.TemplateName}
                    </button>
                  ))
                ) : (
                  <span className="health-select-empty">No meals found.</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </label>
      <label>
        Amount
        <div className="health-stepper">
          <button
            type="button"
            className="icon-button is-secondary"
            aria-label="Decrease amount"
            onClick={() => onAdjustQuantity(-0.25)}
          >
            -
          </button>
          <input
            ref={quantityInputRef}
            type="number"
            name="Quantity"
            min="0.25"
            step="any"
            value={form.Quantity}
            onChange={onFormChange}
          />
          <button
            type="button"
            className="icon-button is-secondary"
            aria-label="Increase amount"
            onClick={() => onAdjustQuantity(0.25)}
          >
            +
          </button>
        </div>
      </label>
      <label>
        Serving size
        <select value={selectedPortion} onChange={onSelectPortion} disabled={!form.SelectedId}>
          <option value="">Select</option>
          {portionOptions.map((option) => (
            <option key={option.OptionKey} value={option.OptionKey}>
              {option.Label} ({FormatAmount(option.BaseAmount)} {option.BaseUnit})
            </option>
          ))}
          {isFoodSelected ? <option value="custom">Custom...</option> : null}
        </select>
      </label>
      {isFoodSelected && effectiveBaseAmount && effectiveBaseUnit ? (
        <p className="health-equivalent health-form-span">
          Logs: {FormatAmount(equivalentValue)} {effectiveBaseUnit}
          {Number.isFinite(estimatedCalories)
            ? ` | Estimated calories: ${estimatedCalories} kcal`
            : ""}
        </p>
      ) : null}
      <div className="health-form-span">
        <button
          type="button"
          className="button-secondary health-details-toggle"
          onClick={() => setDetailsOpen((prev) => !prev)}
        >
          <Icon name={detailsOpen ? "chevronDown" : "chevronRight"} className="icon" />
          {detailsOpen ? "Hide options" : "More options"}
        </button>
        {detailsOpen ? (
          <div className="health-details-panel">
            {estimatedNutrition ? (
              <div className="health-nutrition">
                {equivalentValue && effectiveBaseUnit ? (
                  <span>
                    {FormatAmount(equivalentValue)} {effectiveBaseUnit}
                  </span>
                ) : null}
                <span>{estimatedNutrition.calories} kcal</span>
                <span>{FormatAmount(estimatedNutrition.protein)} g protein</span>
                <span>{FormatAmount(estimatedNutrition.carbs)} g carbs</span>
                <span>{FormatAmount(estimatedNutrition.fat)} g fat</span>
                <span>{FormatAmount(estimatedNutrition.fibre)} g fibre</span>
              </div>
            ) : (
              <span className="health-nutrition-empty">Nutrition preview available for foods.</span>
            )}
            <div className="health-portion-override">
              <label>
                Serving size amount
                <input
                  type="number"
                  name="BaseAmount"
                  min="0.1"
                  step="0.1"
                  value={portionOverride.BaseAmount}
                  onChange={onPortionOverrideChange}
                  placeholder={`Optional (${portionBaseUnit})`}
                />
              </label>
              <label>
                Serving size unit
                <select
                  name="BaseUnit"
                  value={portionOverride.BaseUnit || portionBaseUnit}
                  onChange={onPortionOverrideChange}
                  disabled={!portionBaseUnit}
                >
                  {portionBaseUnit ? <option value={portionBaseUnit}>{portionBaseUnit}</option> : null}
                </select>
              </label>
            </div>
            <label>
              Serving size label
              <input
                name="Label"
                value={portionOverride.Label}
                onChange={onPortionOverrideChange}
                placeholder="Optional"
              />
            </label>
            {isFoodSelected ? (
              <label className="health-checkbox">
                <input
                  type="checkbox"
                  name="SaveAsDefault"
                  checked={portionOverride.SaveAsDefault}
                  onChange={onPortionOverrideChange}
                  disabled={!portionOverride.BaseAmount}
                />
                Save as default for this food
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      <label className="health-form-span">
        Notes
        <input
          type="text"
          name="EntryNotes"
          value={form.EntryNotes}
          onChange={onFormChange}
          placeholder="Optional"
        />
      </label>
      <div className="form-actions">
        <button type="submit">{editingEntryId ? "Update" : "Add entry"}</button>
        {editingEntryId ? (
          <>
            <button type="button" className="button-secondary" onClick={onCancelEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="button-secondary button-danger"
              onClick={onDeleteEditingEntry}
            >
              Delete
            </button>
          </>
        ) : (
          <button type="button" className="button-secondary" onClick={() => setShowForm(false)}>
            Close
          </button>
        )}
      </div>
    </form>
  );

  const editForm = (
    <form className="health-log-form health-edit-form" onSubmit={onSubmit}>
      <label>
        Meal slot
        <select name="MealType" value={form.MealType} onChange={onFormChange}>
          <option value="Breakfast">Breakfast</option>
          <option value="Snack1">Snack 1</option>
          <option value="Lunch">Lunch</option>
          <option value="Snack2">Snack 2</option>
          <option value="Dinner">Dinner</option>
          <option value="Snack3">Snack 3</option>
        </select>
      </label>
      <div className="health-edit-row">
        <label>
          Amount
          <div className="health-stepper">
            <button
              type="button"
              className="icon-button is-secondary"
              aria-label="Decrease amount"
              onClick={() => onAdjustQuantity(-0.25)}
            >
              -
            </button>
            <input
              ref={quantityInputRef}
              type="number"
              name="Quantity"
              min="0.25"
              step="any"
              value={form.Quantity}
              onChange={onFormChange}
            />
            <button
              type="button"
              className="icon-button is-secondary"
              aria-label="Increase amount"
              onClick={() => onAdjustQuantity(0.25)}
            >
              +
            </button>
          </div>
        </label>
        <label>
          Serving size
          <select value={selectedPortion} onChange={onSelectPortion} disabled={!form.SelectedId}>
            <option value="">Select</option>
            {portionOptions.map((option) => (
              <option key={option.OptionKey} value={option.OptionKey}>
                {option.Label} ({FormatAmount(option.BaseAmount)} {option.BaseUnit})
              </option>
            ))}
            {isFoodSelected ? <option value="custom">Custom...</option> : null}
          </select>
        </label>
      </div>
      <div className="health-edit-actions">
        <button
          type="button"
          className="button-secondary health-details-toggle"
          onClick={() => setShowFoodDetails((prev) => !prev)}
        >
          <Icon name={showFoodDetails ? "chevronDown" : "chevronRight"} className="icon" />
          {showFoodDetails ? "Hide food details" : "Food details"}
        </button>
        {showFoodDetails ? (
          <div className="health-details-panel">
            {foodDetailRows.length ? (
              <div className="health-food-details">
                {foodDetailRows.map((row) => (
                  <div key={row.label} className="health-food-detail-row">
                    <span>{row.label}</span>
                    <span>
                      {FormatAmount(row.value)} {row.unit}
                    </span>
                    <span>{row.percentLabel}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="health-nutrition-empty">Food details available for foods.</span>
            )}
          </div>
        ) : null}
      </div>
      <div className="health-edit-actions">
        <button
          type="button"
          className="button-secondary health-details-toggle"
          onClick={() => setShowNotes((prev) => !prev)}
        >
          <Icon name={showNotes ? "chevronDown" : "chevronRight"} className="icon" />
          {showNotes ? "Hide notes" : "Notes"}
        </button>
        {showNotes ? (
          <div className="health-edit-notes">
            <input
              type="text"
              name="EntryNotes"
              value={form.EntryNotes}
              onChange={onFormChange}
              placeholder="Notes"
              aria-label="Notes"
            />
          </div>
        ) : null}
      </div>
      <div className="form-actions">
        <button type="submit">Update</button>
        <button type="button" className="button-secondary" onClick={onCancelEdit}>
          Cancel
        </button>
        <button
          type="button"
          className="button-danger"
          onClick={onDeleteEditingEntry}
        >
          Delete
        </button>
      </div>
    </form>
  );

  return (
    <div className="health-log">
      {quickPickerOpen ? (
        <div className="health-quick-overlay" role="dialog" aria-modal="true">
          <div className="health-quick-panel">
            <header className="health-quick-header">
              <button
                type="button"
                className="icon-button"
                aria-label="Close logging"
                onClick={closeQuickPicker}
              >
                <Icon name="close" className="icon" />
              </button>
              <div>
                <p className="eyebrow">Log</p>
                <h3>{FormatMealTypeLabel(form.MealType)}</h3>
              </div>
              <div className="health-quick-actions">
                {shareUsers.length && quickSelectedKeys.length ? (
                  <label className="health-quick-share">
                    <span>Share</span>
                    <select
                      value={shareTargetUserId}
                      onChange={(event) => setShareTargetUserId(event.target.value)}
                    >
                      <option value="">None</option>
                      {shareUsers.map((user) => (
                        <option key={user.Id} value={user.Id}>
                          {FormatUserLabel(user)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {quickSelectedKeys.length ? (
                  <button type="button" className="health-quick-log" onClick={logQuickSelections}>
                    Log {quickSelectedKeys.length}
                  </button>
                ) : null}
              </div>
            </header>
            <div className="health-quick-header-group">
              <div className="health-quick-tabs" role="tablist" aria-label="Log categories">
                {[
                  { key: "all", label: "All items", icon: "list" },
                  { key: "foods", label: "Foods", icon: "food" },
                  { key: "meals", label: "Meals", icon: "meal" },
                  { key: "recent", label: "Recent", icon: "recent" }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`health-quick-tab${quickTab === tab.key ? " is-active" : ""}`}
                    onClick={() => setQuickTab(tab.key)}
                    role="tab"
                    aria-selected={quickTab === tab.key}
                  >
                    <span className="health-quick-tab-icon" aria-hidden="true">
                      <Icon name={tab.icon} className="icon" />
                    </span>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="health-quick-search">
                <Icon name="search" className="icon" />
                <input
                  ref={quickSearchRef}
                  type="search"
                  placeholder="Search foods or meals"
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && quickSelectedKeys.length) {
                      event.preventDefault();
                      logQuickSelections();
                    }
                  }}
                />
              </div>
            </div>
            <div className="health-quick-list">
              {quickItems.map((item) => {
                const itemKey = `${item.type}:${item.id}`;
                const isSelected = quickSelectedSet.has(itemKey);
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="health-quick-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleQuickSelection(itemKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleQuickSelection(itemKey);
                      }
                    }}
                  >
                    <span
                      className={`health-quick-type-icon ${
                        item.type === "meal" ? "is-meal" : "is-food"
                      }`}
                      aria-hidden="true"
                    >
                      <Icon name={item.type === "meal" ? "meal" : "food"} className="icon" />
                    </span>
                    <div className="health-quick-item-name">
                      <p>{item.name}</p>
                    </div>
                    <div className="health-quick-right">
                      <div className="health-quick-meta">
                        <span className="health-quick-calories">
                          {item.calories !== null && item.calories !== undefined
                            ? `${item.calories} kcal`
                            : "kcal"}
                        </span>
                        <span className="health-quick-serving">{item.serving}</span>
                      </div>
                      {isSelected ? (
                        <div className="health-quick-qty">
                          <span>x</span>
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={getQuickQuantity(itemKey)}
                            onChange={(event) => updateQuickQuantity(itemKey, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                logQuickSelections();
                              }
                            }}
                            aria-label={`${item.name} quantity`}
                          />
                        </div>
                      ) : null}
                      <span
                        className={`health-quick-select${isSelected ? " is-selected" : ""}`}
                        aria-hidden="true"
                      >
                        <Icon name="check" className="icon" />
                      </span>
                    </div>
                  </div>
                );
              })}
              {quickItems.length === 0 ? (
                <p className="health-empty">No matches yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <section className="module-panel health-log-nav-panel">
        <header className="module-panel-header health-log-header">
          <div className="health-log-date-nav" ref={datePickerRef}>
            <button
              type="button"
              className="icon-button is-secondary"
              onClick={() => handleLogDateChange(previousDate)}
              aria-label="Previous day"
            >
              <Icon name="chevronLeft" className="icon" />
            </button>
            <button
              type="button"
              className="health-log-date-button"
              onClick={() => setDatePickerOpen((prev) => !prev)}
              aria-haspopup="dialog"
              aria-expanded={datePickerOpen}
              aria-label="Choose log date"
            >
              <span>{dayLabel}</span>
              <Icon name="agenda" className="icon" />
            </button>
            <button
              type="button"
              className="icon-button is-secondary"
              onClick={() => handleLogDateChange(nextDate)}
              aria-label="Next day"
              disabled={isLatestDate}
            >
              <Icon name="chevronRight" className="icon" />
            </button>
            {datePickerOpen ? (
              <div className="health-date-picker" role="dialog" aria-label="Select log date">
                <div className="health-date-picker-header">
                  <button
                    type="button"
                    className="icon-button is-secondary"
                    onClick={() => setPickerMonth((prev) => ShiftMonth(prev, -1))}
                    aria-label="Previous month"
                  >
                    <Icon name="chevronLeft" className="icon" />
                  </button>
                  <span>{FormatMonthLabel(pickerMonth)}</span>
                  <button
                    type="button"
                    className="icon-button is-secondary"
                    onClick={() => {
                      const nextValue = ShiftMonth(pickerMonth, 1);
                      if (nextValue <= currentMonth) {
                        setPickerMonth(nextValue);
                      }
                    }}
                    aria-label="Next month"
                    disabled={isNextMonthDisabled}
                  >
                    <Icon name="chevronRight" className="icon" />
                  </button>
                </div>
                <div className="health-date-picker-weekdays">
                  {WeekdayLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="health-date-picker-grid">
                  {monthCells.map((dateValue, index) => {
                    if (!dateValue) {
                      return (
                        <span
                          key={`empty-${index}`}
                          className="health-date-picker-cell is-empty"
                        />
                      );
                    }
                    const isSelected = dateValue === logDate;
                    const isLogged = loggedDaysSet.has(dateValue);
                    const isToday = dateValue === today;
                    const isFuture = dateValue > today;
                    return (
                      <button
                        key={dateValue}
                        type="button"
                        className={`health-date-picker-day${
                          isSelected ? " is-selected" : ""
                        }${isLogged ? " is-logged" : ""}${isToday ? " is-today" : ""}${
                          isFuture ? " is-disabled" : ""
                        }`}
                        onClick={() => handleLogDateChange(dateValue)}
                        disabled={isFuture}
                        aria-label={`Select ${FormatDayLabel(dateValue)}`}
                      >
                        {Number(dateValue.slice(8, 10))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div className="module-panel-actions">
            <button type="button" className="button-pill health-log-add-entry" onClick={openAddEntry}>
              Add entry
            </button>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {showForm && !editingEntryId ? logForm : null}
      </section>

      {showForm && editingEntryId ? (
        <div className="modal-backdrop" onClick={onCancelEdit}>
          <div
            className="modal modal--health health-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="health-edit-header">
                <h3>{selectedLabel}</h3>
                <p className="health-edit-subtitle">
                  {FormatAmount(quantityValue)} {NormalizeServingLabel(effectiveLabel) || "serving"} •{" "}
                  {Number.isFinite(editCalories) ? `${editCalories} kcal` : "kcal"}
                </p>
              </div>
              <button type="button" className="icon-button" onClick={onCancelEdit} aria-label="Close">
                <Icon name="close" className="icon" />
              </button>
            </div>
            {editForm}
          </div>
        </div>
      ) : null}

      {!showForm ? (
        <>
          <section className="module-panel module-panel--stretch">
            {dailyTotals ? (
              <div className="health-log-summary">
                <div className="health-log-summary-header">
                  <span>Day totals</span>
                  <span className="health-log-summary-calories">
                    {dailyTotals.TotalCalories} kcal
                  </span>
                </div>
                {macroRows.length ? (
                  <div className="health-log-summary-macros">
                    {macroRows.map((row) => (
                      <div key={row.label} className="health-log-summary-item">
                        <div className="health-log-summary-row">
                          <span>{row.label}</span>
                          <span>
                            {FormatAmount(row.value)}
                            {row.unit}
                          </span>
                          <span>{row.percentLabel}</span>
                          <span>{row.deltaLabel}</span>
                        </div>
                        <div
                          className={`health-log-summary-bar ${row.barClass}`}
                          aria-hidden="true"
                        >
                          <span style={{ width: `${row.percentClamped}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="health-log-list">
              {orderedGroups.length === 0 ? (
                <p className="health-empty">No entries yet.</p>
              ) : (
                orderedGroups.map(({ meal, items }) => (
                  <div key={meal} className="health-log-group">
                    <div className="health-log-group-header">
                      <div className="health-log-group-title">
                        <Icon name={MealTypeIcons[meal] || "meal"} className="icon" />
                        <span>{FormatMealTypeLabel(meal)}</span>
                      </div>
                      <span className="health-log-group-total">
                        {Math.round(slotTotals[meal] ?? 0)} kcal
                      </span>
                    </div>
                    <ul>
                      {items.map((entry) => (
                        <li key={entry.MealEntryId}>
                          <div
                            className="health-log-entry"
                            role="button"
                            tabIndex={0}
                            onClick={() => onEditEntry(entry)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                onEditEntry(entry);
                              }
                            }}
                          >
                            <div className="health-log-entry-main">
                              <p>{entry.TemplateName || entry.FoodName || "Entry"}</p>
                            </div>
                            <div className="health-log-entry-meta">
                              <span className="health-log-entry-calories">
                                {Math.round(entry.CaloriesPerServing * entry.Quantity)} kcal
                              </span>
                              <span className="health-log-entry-serving">
                                {FormatAmount(entry.DisplayQuantity ?? entry.Quantity)}{" "}
                                {NormalizeServingLabel(entry.PortionLabel) ||
                                  entry.ServingDescription ||
                                  "serving"}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>
          {toast ? (
            <div className="health-toast" role="status" aria-live="polite">
              <span>{toast.message}</span>
              <button type="button" onClick={undoDelete}>
                Undo
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default Log;
