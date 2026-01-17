import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
import {
  CreateDailyLog,
  CreateFood,
  CreateMealEntry,
  CreateMealTemplate,
  DeleteMealEntry,
  FetchDailyLog,
  FetchFoods,
  FetchHealthProfile,
  FetchMealTemplates,
  FetchPortionOptions,
  ParseMealTemplateText,
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
const FormatNumber = (value, options = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return numeric.toLocaleString("en-US", options);
};
const FormatUserLabel = (user) => {
  return user.FirstName || user.Username || `User ${user.Id}`;
};
const CalculateEntryCalories = (entry) => {
  const calories = Number(entry?.CaloriesPerServing) * Number(entry?.Quantity);
  return Number.isFinite(calories) ? calories : 0;
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

const BuildEasyLabel = (option) => {
  const label = option.Label || "serving";
  const normalized = label.toLowerCase();
  if (/^\d/.test(label)) {
    return label;
  }
  if (normalized === "serving" || normalized === "each") {
    return `1 ${label}`;
  }
  return `1 ${label}`;
};

const Log = ({ InitialDate, InitialAddMode }) => {
  const [searchParams] = useSearchParams();
  const fallbackDate = searchParams.get("date") || FormatDate(new Date());
  const defaultMealType = ResolveMealType(searchParams.get("meal")) || GetDefaultMealType();
  const initialDate = InitialDate || fallbackDate;
  const initialMonth = initialDate.slice(0, 7);
  const initialAddMode = InitialAddMode ?? searchParams.get("add") === "1";
  const today = useMemo(() => FormatDate(new Date()), []);

  const [logDate, setLogDate] = useState(initialDate);
  const [dailyLog, setDailyLog] = useState(null);
  const [entries, setEntries] = useState([]);
  const [foods, setFoods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const [view, setView] = useState(initialAddMode ? "add" : "slots");
  const [returnView, setReturnView] = useState("slots");
  const [activeMealType, setActiveMealType] = useState(defaultMealType);

  const [searchTab, setSearchTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  const [describeOpen, setDescribeOpen] = useState(false);
  const [describeText, setDescribeText] = useState("");
  const [describeResult, setDescribeResult] = useState(null);
  const [describeStatus, setDescribeStatus] = useState("idle");

  const [form, setForm] = useState({
    MealType: defaultMealType,
    SelectedId: "",
    Quantity: "1",
    EntryNotes: ""
  });

  const [portionOptions, setPortionOptions] = useState([]);
  const [portionBaseUnit, setPortionBaseUnit] = useState("each");
  const [selectedPortion, setSelectedPortion] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editContext, setEditContext] = useState(null);

  const [shareUsers, setShareUsers] = useState([]);
  const [shareTargetUserId, setShareTargetUserId] = useState("");
  const [shareSummaryUserId, setShareSummaryUserId] = useState("");

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loggedDays, setLoggedDays] = useState([]);
  const [pickerMonth, setPickerMonth] = useState(initialMonth);
  const datePickerRef = useRef(null);

  const [saveMealOpen, setSaveMealOpen] = useState(false);
  const [saveMealName, setSaveMealName] = useState("");
  const [saveMealServings, setSaveMealServings] = useState("1");
  const [saveMealError, setSaveMealError] = useState("");
  const [summaryDetailsOpen, setSummaryDetailsOpen] = useState(false);

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
    if (logDate > today) {
      setLogDate(today);
    }
  }, [logDate, today]);

  useEffect(() => {
    if (!datePickerOpen) {
      const currentMonth = today.slice(0, 7);
      const selectedMonth = logDate.slice(0, 7);
      setPickerMonth(selectedMonth > currentMonth ? currentMonth : selectedMonth);
    }
  }, [datePickerOpen, logDate, today]);

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
    if (!shareSummaryUserId) {
      return;
    }
    if (!shareUsers.some((user) => String(user.Id) === String(shareSummaryUserId))) {
      setShareSummaryUserId("");
    }
  }, [shareSummaryUserId, shareUsers]);

  useEffect(() => {
    if (view === "add" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [view]);

  const selectedValue = form.SelectedId ? form.SelectedId.split(":")[1] : "";
  const selectedType = form.SelectedId ? form.SelectedId.split(":")[0] : "";
  const isFoodSelected = selectedType === "food";
  const isTemplateSelected = selectedType === "template";

  useEffect(() => {
    let isActive = true;
    const resetOptions = () => {
      setPortionOptions([]);
      setSelectedPortion("");
      setPortionBaseUnit("each");
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
      } catch {
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
        setEditContext(null);
        return;
      }
      setSelectedPortion(portionOptions[0]?.OptionKey || "");
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

  const resolveTemplateServings = (template) => {
    const servings = Number(template?.Template?.Servings || 1);
    return Number.isFinite(servings) && servings > 0 ? servings : 1;
  };

  const templateCalories = useMemo(() => {
    const totals = {};
    templates.forEach((template) => {
      let calories = 0;
      template.Items.forEach((item) => {
        const food = foods.find((entry) => entry.FoodId === item.FoodId);
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
  }, [templates, foods]);

  const groupedEntries = useMemo(() => GroupEntriesByMeal(entries), [entries]);
  const slotTotals = useMemo(() => {
    const totals = {};
    Object.entries(groupedEntries).forEach(([meal, items]) => {
      totals[meal] = items.reduce((acc, entry) => acc + CalculateEntryCalories(entry), 0);
    });
    return totals;
  }, [groupedEntries]);

  const filteredFoods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return foods;
    }
    return foods.filter((food) => food.FoodName.toLowerCase().includes(query));
  }, [foods, searchQuery]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      template.Template.TemplateName.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const searchItems = useMemo(() => {
    if (searchTab === "meals") {
      return filteredTemplates.map((template) => ({
        type: "template",
        id: template.Template.MealTemplateId,
        name: template.Template.TemplateName,
        hint: templateCalories[template.Template.MealTemplateId]
          ? `${templateCalories[template.Template.MealTemplateId]} kcal`
          : "",
        template
      }));
    }
    if (searchTab === "favourites") {
      return [
        ...filteredFoods
          .filter((food) => food.IsFavourite)
          .map((food) => ({
            type: "food",
            id: food.FoodId,
            name: food.FoodName,
            hint: food.ServingDescription
              ? `${food.ServingDescription} · ${food.CaloriesPerServing || 0} kcal`
              : food.CaloriesPerServing
                ? `${food.CaloriesPerServing} kcal`
                : "",
            food
          })),
        ...filteredTemplates
          .filter((template) => template.Template.IsFavourite)
          .map((template) => ({
            type: "template",
            id: template.Template.MealTemplateId,
            name: template.Template.TemplateName,
            hint: templateCalories[template.Template.MealTemplateId]
              ? `${templateCalories[template.Template.MealTemplateId]} kcal`
              : "",
            template
          }))
      ];
    }
    return [
      ...filteredFoods.map((food) => ({
        type: "food",
        id: food.FoodId,
        name: food.FoodName,
        hint: food.ServingDescription
          ? `${food.ServingDescription} · ${food.CaloriesPerServing || 0} kcal`
          : food.CaloriesPerServing
            ? `${food.CaloriesPerServing} kcal`
            : "",
        food
      })),
      ...filteredTemplates.map((template) => ({
        type: "template",
        id: template.Template.MealTemplateId,
        name: template.Template.TemplateName,
        hint: templateCalories[template.Template.MealTemplateId]
          ? `${templateCalories[template.Template.MealTemplateId]} kcal`
          : "",
        template
      }))
    ];
  }, [filteredFoods, filteredTemplates, searchTab, templateCalories]);

  const selectedFood = isFoodSelected
    ? foods.find((item) => item.FoodId === selectedValue)
    : null;
  const selectedTemplate = isTemplateSelected
    ? templates.find((item) => item.Template.MealTemplateId === selectedValue)
    : null;

  const selectedOption = portionOptions.find((option) => option.OptionKey === selectedPortion) || null;
  const effectiveBaseAmount = selectedOption?.BaseAmount ?? null;
  const effectiveBaseUnit = selectedOption?.BaseUnit || null;
  const effectiveLabel = selectedOption?.Label || "serving";
  const quantityValue = Number(form.Quantity || 0);
  const estimatedCalories = useMemo(() => {
    if (!selectedFood || !effectiveBaseAmount || !effectiveBaseUnit) {
      return null;
    }
    return EstimateCalories(selectedFood, effectiveBaseAmount * quantityValue, effectiveBaseUnit);
  }, [effectiveBaseAmount, effectiveBaseUnit, quantityValue, selectedFood]);
  const estimatedNutrition = useMemo(() => {
    if (!selectedFood || !effectiveBaseAmount || !effectiveBaseUnit) {
      return null;
    }
    return EstimateNutrition(selectedFood, effectiveBaseAmount * quantityValue, effectiveBaseUnit);
  }, [effectiveBaseAmount, effectiveBaseUnit, quantityValue, selectedFood]);

  const ensureDailyLog = async () => {
    if (dailyLog) {
      return dailyLog;
    }
    const created = await CreateDailyLog({ LogDate: logDate, Steps: 0 });
    setDailyLog(created.DailyLog);
    return created.DailyLog;
  };

  const startMealFlow = (mealType, backTarget = "slots") => {
    setActiveMealType(mealType);
    setReturnView(backTarget);
    setView("add");
    setSearchQuery("");
    setSearchTab("search");
    setDescribeOpen(false);
    setDescribeText("");
    setDescribeResult(null);
    setForm((prev) => ({
      ...prev,
      MealType: mealType,
      SelectedId: "",
      Quantity: "1",
      EntryNotes: ""
    }));
    setSheetOpen(false);
    setAdvancedOpen(false);
    setEditingEntryId(null);
    setEditContext(null);
    setShowNotes(false);
  };

  const openSummary = (mealType) => {
    setActiveMealType(mealType);
    setView("summary");
  };

  const handleSelectItem = (item) => {
    setForm((prev) => ({
      ...prev,
      MealType: activeMealType,
      SelectedId: `${item.type}:${item.id}`,
      Quantity: "1",
      EntryNotes: ""
    }));
    setEditingEntryId(null);
    setEditContext(null);
    setSheetOpen(true);
    setAdvancedOpen(false);
    setShowNotes(false);
    setShareTargetUserId("");
  };

  const onAdjustQuantity = (delta) => {
    const current = Number(form.Quantity || 0);
    const nextValue = Math.max(0.25, Number.isFinite(current) ? current + delta : 1);
    setForm((prev) => ({ ...prev, Quantity: String(nextValue) }));
  };

  const buildPortionPayload = () => {
    if (isTemplateSelected) {
      return {
        PortionOptionId: null,
        PortionLabel: "serving",
        PortionBaseUnit: "each",
        PortionBaseAmount: 1
      };
    }
    if (!effectiveBaseAmount || !effectiveBaseUnit) {
      return null;
    }
    return {
      PortionOptionId: selectedOption?.PortionOptionId || null,
      PortionLabel: effectiveLabel || "serving",
      PortionBaseUnit: effectiveBaseUnit,
      PortionBaseAmount: Number(effectiveBaseAmount)
    };
  };

  const shareSlotEntries = async () => {
    if (!shareSummaryUserId) {
      setError("Choose someone to share with.");
      return;
    }
    if (!slotEntries.length) {
      setError("No items to share yet.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const targetId = Number(shareSummaryUserId);
      for (const entry of slotEntries) {
        await ShareMealEntry({
          LogDate: logDate,
          TargetUserId: targetId,
          MealType: entry.MealType,
          FoodId: entry.FoodId || null,
          MealTemplateId: entry.MealTemplateId || null,
          Quantity: Number(entry.Quantity || 1),
          PortionOptionId: entry.PortionOptionId || null,
          PortionLabel: entry.PortionLabel || "serving",
          PortionBaseUnit: entry.PortionBaseUnit || "each",
          PortionBaseAmount: Number(entry.PortionBaseAmount || 1),
          EntryNotes: entry.EntryNotes || null,
          ScheduleSlotId: null
        });
      }
      setShareSummaryUserId("");
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to share items");
    }
  };

  const submitEntry = async ({ closeToSummary = true } = {}) => {
    if (!form.SelectedId) {
      setError("Select a food or meal.");
      return;
    }
    const quantity = Number(form.Quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    const portionPayload = buildPortionPayload();
    if (!portionPayload) {
      setError("Select a serving size.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const log = await ensureDailyLog();
      const payloadBase = {
        MealType: form.MealType,
        Quantity: quantity,
        ...portionPayload,
        EntryNotes: form.EntryNotes || null
      };
      const [type, id] = form.SelectedId.split(":");
      if (editingEntryId) {
        await UpdateMealEntry(editingEntryId, payloadBase);
      } else {
        const maxSort = entries.length
          ? Math.max(...entries.map((entry) => entry.SortOrder || 0)) + 1
          : 0;
        await CreateMealEntry({
          DailyLogId: log.DailyLogId,
          MealType: form.MealType,
          FoodId: type === "food" ? id : null,
          MealTemplateId: type === "template" ? id : null,
          Quantity: quantity,
          ...portionPayload,
          EntryNotes: form.EntryNotes || null,
          SortOrder: maxSort
        });
      }

      const shareUserId = Number(shareTargetUserId || 0);
      if (!editingEntryId && Number.isFinite(shareUserId) && shareUserId > 0) {
        await ShareMealEntry({
          LogDate: logDate,
          TargetUserId: shareUserId,
          MealType: form.MealType,
          FoodId: type === "food" ? id : null,
          MealTemplateId: type === "template" ? id : null,
          Quantity: quantity,
          ...portionPayload,
          EntryNotes: form.EntryNotes || null,
          ScheduleSlotId: null
        });
      }

      await loadData(logDate);
      setSheetOpen(false);
      setAdvancedOpen(false);
      setEditingEntryId(null);
      setEditContext(null);
      setShareTargetUserId("");
      if (closeToSummary) {
        openSummary(form.MealType);
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save entry");
    }
  };

  const onEditEntry = (entry) => {
    setEditingEntryId(entry.MealEntryId);
    setReturnView("summary");
    setForm({
      MealType: entry.MealType,
      SelectedId: entry.FoodId
        ? `food:${entry.FoodId}`
        : entry.MealTemplateId
          ? `template:${entry.MealTemplateId}`
          : "",
      Quantity: String(entry.DisplayQuantity ?? entry.Quantity ?? 1),
      EntryNotes: entry.EntryNotes || ""
    });
    setEditContext({
      SelectedId: entry.FoodId
        ? `food:${entry.FoodId}`
        : entry.MealTemplateId
          ? `template:${entry.MealTemplateId}`
          : "",
      PortionOptionId: entry.PortionOptionId,
      PortionLabel: entry.PortionLabel,
      PortionBaseUnit: entry.PortionBaseUnit,
      PortionBaseAmount: entry.PortionBaseAmount
    });
    setAdvancedOpen(true);
    setSheetOpen(true);
    setShowNotes(false);
    setShareTargetUserId("");
    setView("summary");
  };

  const onDeleteEntry = async () => {
    if (!editingEntryId) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteMealEntry(editingEntryId);
      await loadData(logDate);
      setEditingEntryId(null);
      setSheetOpen(false);
      setAdvancedOpen(false);
      setView("summary");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete entry");
    }
  };

  const runDescribeMeal = async () => {
    if (!describeText.trim()) {
      setError("Describe the meal first.");
      return;
    }
    try {
      setDescribeStatus("loading");
      setError("");
      const result = await ParseMealTemplateText({ Text: describeText.trim() });
      setDescribeResult(result);
      setDescribeStatus("ready");
    } catch (err) {
      setDescribeStatus("error");
      setError(err?.message || "Failed to parse meal");
    }
  };

  const logDescribeResult = async () => {
    if (!describeResult) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const name = `${describeResult.MealName} (AI total)`;
      const created = await CreateFood({
        FoodName: name,
        ServingQuantity: describeResult.ServingQuantity,
        ServingUnit: describeResult.ServingUnit,
        CaloriesPerServing: describeResult.CaloriesPerServing,
        ProteinPerServing: describeResult.ProteinPerServing,
        FibrePerServing: describeResult.FibrePerServing,
        CarbsPerServing: describeResult.CarbsPerServing,
        FatPerServing: describeResult.FatPerServing,
        SaturatedFatPerServing: describeResult.SaturatedFatPerServing,
        SugarPerServing: describeResult.SugarPerServing,
        SodiumPerServing: describeResult.SodiumPerServing,
        DataSource: "ai",
        CountryCode: "AU",
        IsFavourite: false
      });
      const log = await ensureDailyLog();
      const base = ResolveServingBase(created);
      await CreateMealEntry({
        DailyLogId: log.DailyLogId,
        MealType: activeMealType,
        FoodId: created.FoodId,
        MealTemplateId: null,
        Quantity: 1,
        PortionOptionId: null,
        PortionLabel: "serving",
        PortionBaseUnit: base.unit,
        PortionBaseAmount: base.amount,
        EntryNotes: describeResult.Summary || null,
        SortOrder: entries.length
      });
      await loadData(logDate);
      setDescribeResult(null);
      setDescribeText("");
      openSummary(activeMealType);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to log AI meal");
    }
  };

  const slotEntries = groupedEntries[activeMealType] || [];
  const slotCalories = Math.round(slotTotals[activeMealType] || 0);
  const slotProtein = useMemo(() => {
    return slotEntries.reduce(
      (total, entry) => total + Number(entry.ProteinPerServing || 0) * Number(entry.Quantity || 1),
      0
    );
  }, [slotEntries]);
  const slotCaloriesLabel = FormatNumber(slotCalories);
  const slotProteinLabel = FormatNumber(slotProtein, { maximumFractionDigits: 2 });
  const slotMacros = useMemo(() => {
    return slotEntries.reduce(
      (totals, entry) => ({
        protein: totals.protein + Number(entry.ProteinPerServing || 0) * Number(entry.Quantity || 1),
        carbs: totals.carbs + Number(entry.CarbsPerServing || 0) * Number(entry.Quantity || 1),
        fat: totals.fat + Number(entry.FatPerServing || 0) * Number(entry.Quantity || 1),
        fibre: totals.fibre + Number(entry.FibrePerServing || 0) * Number(entry.Quantity || 1),
        sugar: totals.sugar + Number(entry.SugarPerServing || 0) * Number(entry.Quantity || 1),
        saturatedFat:
          totals.saturatedFat +
          Number(entry.SaturatedFatPerServing || 0) * Number(entry.Quantity || 1),
        sodium: totals.sodium + Number(entry.SodiumPerServing || 0) * Number(entry.Quantity || 1)
      }),
      {
        protein: 0,
        carbs: 0,
        fat: 0,
        fibre: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0
      }
    );
  }, [slotEntries]);
  const macroRows = [
    { key: "Protein", value: slotMacros.protein, unit: "g" },
    { key: "Carbs", value: slotMacros.carbs, unit: "g" },
    { key: "Fat", value: slotMacros.fat, unit: "g" },
    { key: "Fibre", value: slotMacros.fibre, unit: "g" },
    { key: "Sugar", value: slotMacros.sugar, unit: "g" },
    { key: "Saturated fat", value: slotMacros.saturatedFat, unit: "g" },
    { key: "Sodium", value: slotMacros.sodium, unit: "mg" }
  ].filter((row) => row.value > 0);

  const buildTemplateItemsFromEntries = () => {
    const items = [];
    slotEntries.forEach((entry) => {
      if (entry.FoodId) {
        items.push({
          FoodId: entry.FoodId,
          MealType: activeMealType,
          Quantity: Number(entry.Quantity || 1),
          EntryQuantity: entry.DisplayQuantity ? Number(entry.DisplayQuantity) : null,
          EntryUnit: entry.PortionLabel || null,
          EntryNotes: entry.EntryNotes || null
        });
        return;
      }
      if (entry.MealTemplateId) {
        const template = templates.find(
          (item) => item.Template.MealTemplateId === entry.MealTemplateId
        );
        if (!template) {
          return;
        }
        template.Items.forEach((item) => {
          const multiplier = Number(entry.Quantity || 1);
          const baseQuantity = Number(item.Quantity || 1) * multiplier;
          const baseEntryQuantity = item.EntryQuantity
            ? Number(item.EntryQuantity) * multiplier
            : null;
          items.push({
            FoodId: item.FoodId,
            MealType: activeMealType,
            Quantity: baseQuantity,
            EntryQuantity: baseEntryQuantity,
            EntryUnit: item.EntryUnit || null,
            EntryNotes: item.EntryNotes || null
          });
        });
      }
    });
    return items.map((item, index) => ({ ...item, SortOrder: index }));
  };

  const saveMealFromSlot = async () => {
    if (!saveMealName.trim()) {
      setSaveMealError("Meal name is required.");
      return;
    }
    const servings = Number(saveMealServings || 1);
    if (!Number.isFinite(servings) || servings <= 0) {
      setSaveMealError("Servings must be greater than zero.");
      return;
    }
    const items = buildTemplateItemsFromEntries();
    if (!items.length) {
      setSaveMealError("Add at least one item.");
      return;
    }
    try {
      setStatus("saving");
      setSaveMealError("");
      await CreateMealTemplate({
        TemplateName: saveMealName.trim(),
        Servings: servings,
        Items: items
      });
      await loadData(logDate);
      setSaveMealOpen(false);
      setSaveMealName("");
      setSaveMealServings("1");
    } catch (err) {
      setSaveMealError(err?.message || "Failed to save meal");
    }
  };

  const handlePreviousDate = () => {
    const date = ParseIsoDate(logDate);
    date.setDate(date.getDate() - 1);
    setLogDate(FormatDate(date));
  };

  const handleNextDate = () => {
    const date = ParseIsoDate(logDate);
    date.setDate(date.getDate() + 1);
    const nextValue = FormatDate(date);
    if (nextValue <= today) {
      setLogDate(nextValue);
    }
  };

  const dayLabel = FormatDayLabel(logDate);
  const isNextDisabled = logDate >= today;

  const easyOptions = useMemo(() => {
    if (isFoodSelected) {
      return portionOptions.slice(0, 6).map((option) => ({
        key: option.OptionKey,
        label: BuildEasyLabel(option),
        calories: selectedFood
          ? EstimateCalories(selectedFood, option.BaseAmount, option.BaseUnit)
          : null,
        option
      }));
    }
    if (isTemplateSelected && selectedTemplate) {
      const perServing = templateCalories[selectedTemplate.Template.MealTemplateId] || 0;
      return [0.5, 1, 2, 3].map((value) => ({
        key: String(value),
        label: value === 0.5 ? "1/2 serving" : `${FormatAmount(value)} serving${value > 1 ? "s" : ""}`,
        calories: perServing ? Math.round(perServing * value) : null,
        quantity: value
      }));
    }
    return [];
  }, [
    isFoodSelected,
    isTemplateSelected,
    portionOptions,
    selectedFood,
    selectedTemplate,
    templateCalories
  ]);

  const handleEasySelect = (option) => {
    if (isTemplateSelected) {
      setForm((prev) => ({ ...prev, Quantity: String(option.quantity || 1) }));
      return;
    }
    setSelectedPortion(option.key);
    setForm((prev) => ({ ...prev, Quantity: "1" }));
  };

  const showPortionSheet = sheetOpen && form.SelectedId;
  const portionModalLabel = editingEntryId ? "Edit entry" : "Portion picker";
  const showSearchList = searchTab !== "search" || searchQuery.trim();
  const emptyListLabel =
    searchTab === "meals"
      ? "No meals yet."
      : searchTab === "favourites"
        ? "No favourites yet."
        : "No foods or meals yet.";
  const handleSheetKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
      return;
    }
    if (event.target?.tagName === "TEXTAREA") {
      return;
    }
    event.preventDefault();
    submitEntry({ closeToSummary: true });
  };

  const viewLabel = view === "slots" ? "Slot list" : view === "add" ? "Slot add" : "Slot summary";

  return (
    <div className="health-log" data-health-view-label={viewLabel}>
      {view === "slots" ? (
        <section className="module-panel health-log-noom">
          <div className="health-log-date-row" ref={datePickerRef}>
            <button
              type="button"
              className="icon-button is-secondary"
              onClick={handlePreviousDate}
              aria-label="Previous day"
            >
              <Icon name="chevronLeft" className="icon" />
            </button>
            <button
              type="button"
              className="health-log-date-chip"
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
              onClick={handleNextDate}
              aria-label="Next day"
              disabled={isNextDisabled}
            >
              <Icon name="chevronRight" className="icon" />
            </button>
            {datePickerOpen ? (
              <div className="health-date-picker" role="dialog" aria-label="Choose date">
                <div className="health-date-picker-header">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPickerMonth((prev) => ShiftMonth(prev, -1))}
                    aria-label="Previous month"
                  >
                    <Icon name="chevronLeft" className="icon" />
                  </button>
                  <span>{FormatMonthLabel(pickerMonth)}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPickerMonth((prev) => ShiftMonth(prev, 1))}
                    aria-label="Next month"
                    disabled={pickerMonth >= today.slice(0, 7)}
                  >
                    <Icon name="chevronRight" className="icon" />
                  </button>
                </div>
                <div className="health-date-picker-weekdays">
                  {WeekdayLabels.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="health-date-picker-grid">
                  {BuildMonthGrid(pickerMonth).map((date, index) => {
                    if (!date) {
                      return <span key={`empty-${index}`} className="health-date-picker-cell is-empty" />;
                    }
                    const isSelected = date === logDate;
                    const isLogged = loggedDays.includes(date);
                    const isToday = date === today;
                    const isFuture = date > today;
                    return (
                      <div key={date} className="health-date-picker-cell">
                        <button
                          type="button"
                          className={`health-date-picker-day${isSelected ? " is-selected" : ""}${
                            isLogged ? " is-logged" : ""
                          }${isToday ? " is-today" : ""}${isFuture ? " is-disabled" : ""}`}
                          onClick={() => {
                            if (isFuture) {
                              return;
                            }
                            setLogDate(date);
                            setDatePickerOpen(false);
                          }}
                          disabled={isFuture}
                        >
                          {date.split("-")[2]}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div className="health-slot-list">
            {MealOrder.map((meal) => (
              <div key={meal} className="health-slot-row">
                <button
                  type="button"
                  className="health-slot-main"
                  onClick={() => openSummary(meal)}
                >
                  <span className="health-slot-icon" aria-hidden="true">
                    <Icon name={MealTypeIcons[meal] || "meal"} className="icon" />
                  </span>
                  <span className="health-slot-label">{FormatMealTypeLabel(meal)}</span>
                </button>
                <div className="health-slot-meta">
                  {slotTotals[meal] ? (
                    <span className="health-slot-calories">
                      {Math.round(slotTotals[meal])} kcal
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="health-slot-plus"
                    onClick={() => startMealFlow(meal, "slots")}
                    aria-label={`Add to ${FormatMealTypeLabel(meal)}`}
                  >
                    <Icon name="plus" className="icon" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view === "add" ? (
        <section className="module-panel health-log-add">
          <header className="health-add-header">
            <button
              type="button"
              className="icon-button"
              onClick={() => setView(returnView)}
              aria-label="Back"
            >
              <Icon name="chevronLeft" className="icon" />
            </button>
            <h2>{FormatMealTypeLabel(activeMealType)}</h2>
          </header>
          {slotEntries.length ? (
            <div className="health-slot-summary">
              <div className="health-slot-summary-header">
                <span>Already logged</span>
                <span>
                  {slotCaloriesLabel} kcal · {slotProteinLabel} g protein
                </span>
              </div>
              <ul className="health-slot-summary-list">
                {slotEntries.map((entry) => (
                  <li key={entry.MealEntryId}>
                    <button
                      type="button"
                      className="health-slot-summary-row"
                      onClick={() => onEditEntry(entry)}
                    >
                      <span>{entry.TemplateName || entry.FoodName || "Item"}</span>
                      <span className="health-slot-summary-kcal">
                        {FormatNumber(
                          Math.round((entry.CaloriesPerServing || 0) * (entry.Quantity || 1))
                        )}{" "}
                        kcal
                      </span>
                      <Icon name="chevronRight" className="icon" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="health-add-actions">
            <button
              type="button"
              className="health-action-tile"
              onClick={() => setDescribeOpen((prev) => !prev)}
            >
              <span className="health-action-icon" aria-hidden="true">
                <Icon name="edit" className="icon" />
              </span>
              <span>Describe meal</span>
            </button>
          </div>
          <div className="health-add-search">
            <Icon name="search" className="icon" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search for your food"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          {describeOpen ? (
            <div className="health-describe-panel">
              <textarea
                value={describeText}
                onChange={(event) => setDescribeText(event.target.value)}
                placeholder="Describe your meal"
              />
              <div className="health-describe-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={runDescribeMeal}
                  disabled={describeStatus === "loading"}
                >
                  {describeStatus === "loading" ? "Working..." : "Get nutrition"}
                </button>
                {describeResult ? (
                  <button type="button" className="primary-button" onClick={logDescribeResult}>
                    Log meal
                  </button>
                ) : null}
              </div>
              {describeResult ? (
                <div className="health-describe-result">
                  <h4>{describeResult.MealName}</h4>
                  <p>{describeResult.Summary}</p>
                  <span>
                    {describeResult.CaloriesPerServing} kcal · {describeResult.ProteinPerServing} g protein
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="health-add-tabs" role="tablist" aria-label="Log tabs">
            {[
              { key: "search", label: "Search" },
              { key: "meals", label: "My meals" },
              { key: "favourites", label: "Favourites" },
              { key: "foods", label: "Foods" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={searchTab === tab.key}
                className={`health-add-tab${searchTab === tab.key ? " is-active" : ""}`}
                onClick={() => setSearchTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {showSearchList ? (
            <ul className="health-result-list">
              {searchItems.length ? (
                searchItems.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      type="button"
                      className="health-result-row"
                      onClick={() => handleSelectItem(item)}
                    >
                      <span className="health-result-icon" aria-hidden="true">
                        <Icon name={item.type === "template" ? "meal" : "food"} className="icon" />
                      </span>
                      <span className="health-result-name">{item.name}</span>
                      {item.hint ? <span className="health-result-hint">{item.hint}</span> : null}
                    </button>
                  </li>
                ))
              ) : searchQuery.trim() && searchTab === "search" ? (
                <li>
                  <Link className="health-add-cta" to="/health/foods?add=food">
                    <Icon name="plus" className="icon" />
                    <span>Can't find it? Let's add it!</span>
                  </Link>
                </li>
              ) : (
                <li className="health-empty">{emptyListLabel}</li>
              )}
            </ul>
          ) : (
            <p className="health-empty">Start typing to see results.</p>
          )}
        </section>
      ) : null}

      {view === "summary" ? (
        <section className="module-panel health-log-summary-screen">
          <header className="health-summary-header">
            <button
              type="button"
              className="icon-button"
              onClick={() => setView("slots")}
              aria-label="Back"
            >
              <Icon name="chevronLeft" className="icon" />
            </button>
            <div>
              <h2>{FormatMealTypeLabel(activeMealType)}</h2>
              <span>{slotCalories} kcal</span>
            </div>
            <button type="button" className="primary-button" onClick={() => setView("slots")}>
              Done
            </button>
          </header>
          <ul className="health-summary-list">
            {slotEntries.length ? (
              slotEntries.map((entry) => (
                <li key={entry.MealEntryId}>
                  <button
                    type="button"
                    className="health-summary-row"
                    onClick={() => onEditEntry(entry)}
                  >
                    <span>{entry.TemplateName || entry.FoodName || "Item"}</span>
                    <span>
                      {Math.round((entry.CaloriesPerServing || 0) * (entry.Quantity || 1))} kcal
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="health-empty">No items yet.</li>
            )}
          </ul>
          {macroRows.length ? (
            <div className="health-summary-details">
              <button
                type="button"
                className="health-summary-toggle"
                onClick={() => setSummaryDetailsOpen((prev) => !prev)}
              >
                {summaryDetailsOpen ? "Hide details" : "More details"}
                <Icon
                  name="chevronDown"
                  className={`icon${summaryDetailsOpen ? " is-rotated" : ""}`}
                />
              </button>
              {summaryDetailsOpen ? (
                <div className="health-summary-macro-list">
                  {macroRows.map((row) => (
                    <div key={row.key} className="health-summary-macro-row">
                      <span>{row.key}</span>
                      <span>
                        {FormatNumber(row.value, { maximumFractionDigits: 2 })} {row.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="health-summary-actions">
            {shareUsers.length ? (
              <div className="health-summary-share">
                <label htmlFor="share-summary">Share with</label>
                <div className="health-summary-share-row">
                  <select
                    id="share-summary"
                    value={shareSummaryUserId}
                    onChange={(event) => setShareSummaryUserId(event.target.value)}
                  >
                    <option value="">Select a user</option>
                    {shareUsers.map((user) => (
                      <option key={user.Id} value={user.Id}>
                        {FormatUserLabel(user)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={shareSlotEntries}
                    disabled={!shareSummaryUserId}
                  >
                    Share
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="primary-button health-summary-button"
              onClick={() => startMealFlow(activeMealType, "summary")}
            >
              Add more items
            </button>
            {slotEntries.length ? (
              <button
                type="button"
                className="button-secondary health-summary-button"
                onClick={() => setSaveMealOpen(true)}
              >
                Save this meal
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {showPortionSheet ? (
        <div
          className="health-log-overlay"
          role="dialog"
          aria-modal="true"
          data-health-modal-label={portionModalLabel}
        >
          <div
            className={`health-log-sheet${advancedOpen ? " is-advanced" : ""}`}
            onKeyDown={handleSheetKeyDown}
          >
            <header className="health-sheet-header">
              <div>
                <span className="health-sheet-label">{isFoodSelected ? "Food" : "Meal"}</span>
                <h3>{selectedFood?.FoodName || selectedTemplate?.Template.TemplateName || "Item"}</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setSheetOpen(false);
                  setAdvancedOpen(false);
                  setView(returnView);
                }}
                aria-label="Close"
              >
                <Icon name="close" className="icon" />
              </button>
            </header>

            {!advancedOpen ? (
              <div className="health-sheet-body">
                <div className="health-easy-list">
                  {easyOptions.length ? (
                    easyOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`health-easy-row${
                          (isFoodSelected && selectedPortion === option.key) ||
                          (isTemplateSelected && Number(form.Quantity) === option.quantity)
                            ? " is-active"
                            : ""
                        }`}
                        onClick={() => handleEasySelect(option)}
                      >
                        <span>{option.label}</span>
                        {option.calories ? <span>{option.calories} kcal</span> : null}
                      </button>
                    ))
                  ) : (
                    <p className="health-empty">No serving options available.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="health-sheet-body">
                {editingEntryId ? (
                  <label className="health-sheet-field">
                    Meal slot
                    <select
                      value={form.MealType}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, MealType: event.target.value }))
                      }
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Snack1">Morning snack</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Snack2">Afternoon snack</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Snack3">Evening snack</option>
                    </select>
                  </label>
                ) : null}
                <div className="health-sheet-field">
                  <div className="health-sheet-row">
                    <label className="health-sheet-subfield">
                      <span>Amount</span>
                      <div className="health-sheet-stepper">
                        <button
                          type="button"
                          className="icon-button is-secondary"
                          onClick={() => onAdjustQuantity(-0.25)}
                          aria-label="Decrease amount"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={form.Quantity}
                          aria-label="Amount"
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, Quantity: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="icon-button is-secondary"
                          onClick={() => onAdjustQuantity(0.25)}
                          aria-label="Increase amount"
                        >
                          +
                        </button>
                      </div>
                    </label>
                    <label className="health-sheet-subfield">
                      <span>Serving size</span>
                      <select
                        value={selectedPortion}
                        aria-label="Serving size"
                        onChange={(event) => setSelectedPortion(event.target.value)}
                      >
                        {portionOptions.map((option) => (
                          <option key={option.OptionKey} value={option.OptionKey}>
                            {option.Label} ({FormatAmount(option.BaseAmount)} {option.BaseUnit})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                {estimatedCalories ? (
                  <div className="health-sheet-summary">
                    Estimated: {estimatedCalories} kcal
                    {estimatedNutrition?.protein
                      ? ` · ${FormatAmount(estimatedNutrition.protein)} g protein`
                      : ""}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="health-sheet-toggle"
                  onClick={() => setShowNotes((prev) => !prev)}
                >
                  {showNotes ? "Hide notes" : "Notes"}
                </button>
                {showNotes ? (
                  <input
                    type="text"
                    value={form.EntryNotes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, EntryNotes: event.target.value }))
                    }
                    placeholder="Notes"
                  />
                ) : null}
                {!editingEntryId && shareUsers.length ? (
                  <label className="health-sheet-field">
                    Share with
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
              </div>
            )}
            <footer className="health-sheet-footer">
              {!advancedOpen ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setAdvancedOpen(true)}
                >
                  Other units
                </button>
              ) : (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setAdvancedOpen(false)}
                >
                  Easy units
                </button>
              )}
              <button
                type="button"
                className="primary-button"
                onClick={() => submitEntry({ closeToSummary: true })}
              >
                {editingEntryId ? "Update" : "Log"}
              </button>
              {editingEntryId ? (
                <button type="button" className="button-secondary button-danger" onClick={onDeleteEntry}>
                  Delete
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}

      {saveMealOpen ? (
        <div
          className="health-log-overlay"
          role="dialog"
          aria-modal="true"
          data-health-modal-label="Save meal"
        >
          <div className="health-log-sheet">
            <header className="health-sheet-header">
              <div>
                <span className="health-sheet-label">Save meal</span>
                <h3>{FormatMealTypeLabel(activeMealType)}</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setSaveMealOpen(false);
                  setSaveMealError("");
                }}
                aria-label="Close"
              >
                <Icon name="close" className="icon" />
              </button>
            </header>
            <div className="health-sheet-body">
              <label className="health-sheet-inline">
                <span>Meal name</span>
                <input
                  value={saveMealName}
                  onChange={(event) => setSaveMealName(event.target.value)}
                  placeholder="Name your meal"
                />
              </label>
              <label className="health-sheet-inline">
                <span>Servings</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={saveMealServings}
                  onChange={(event) => setSaveMealServings(event.target.value)}
                />
              </label>
              {saveMealError ? <p className="form-error">{saveMealError}</p> : null}
            </div>
            <footer className="health-sheet-footer">
              <button type="button" className="button-secondary" onClick={() => setSaveMealOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={saveMealFromSlot}>
                Save meal
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {status === "loading" ? <p className="health-empty">Loading...</p> : null}
    </div>
  );
};

export default Log;
