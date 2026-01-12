import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
import SwipeableEntryRow from "../../components/SwipeableEntryRow.jsx";
import {
  CreateDailyLog,
  CreateMealEntry,
  CreatePortionOption,
  DeleteMealEntry,
  FetchDailyLog,
  FetchFoods,
  FetchMealTemplates,
  FetchPortionOptions,
  UpdateMealEntry
} from "../../lib/healthApi.js";

const FormatDate = (value) => {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  const local = new Date(value.getTime() - offsetMs);
  return local.toISOString().slice(0, 10);
};
const FormatAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
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
  const initialDate = InitialDate || fallbackDate;
  const initialAddMode = InitialAddMode ?? searchParams.get("add") === "1";
  const initialEditId = InitialEditId ?? searchParams.get("edit");

  const [logDate, setLogDate] = useState(initialDate);
  const [dailyLog, setDailyLog] = useState(null);
  const [entries, setEntries] = useState([]);
  const [foods, setFoods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [foodSearch, setFoodSearch] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef(null);
  const searchInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(initialAddMode || !!initialEditId);
  const [toast, setToast] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [mealTypeTouched, setMealTypeTouched] = useState(false);
  const [editContext, setEditContext] = useState(null);
  const pendingDeletesRef = useRef(new Map());
  const handledEditRef = useRef(null);

  const [form, setForm] = useState({
    MealType: GetDefaultMealType(),
    SelectedId: "",
    Quantity: "1",
    EntryNotes: ""
  });

  const [portionOptions, setPortionOptions] = useState([]);
  const [portionBaseUnit, setPortionBaseUnit] = useState("each");
  const [selectedPortion, setSelectedPortion] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    const nextDate = searchParams.get("date");
    if (nextDate && nextDate !== logDate) {
      setLogDate(nextDate);
    }
    setShowForm(searchParams.get("add") === "1" || !!searchParams.get("edit"));
  }, [searchParams, logDate]);

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
    setForm((prev) => ({ ...prev, MealType: GetDefaultMealType() }));
  }, [editingEntryId, logDate]);

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
          Label: "meal",
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
      setSelectedPortion("custom");
      setPortionOverride({
        Label: editContext.PortionLabel || "",
        BaseAmount: String(editContext.PortionBaseAmount),
        BaseUnit: editContext.PortionBaseUnit || portionBaseUnit,
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

  const filteredTemplates = useMemo(() => {
    const query = foodSearch.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      template.Template.TemplateName.toLowerCase().includes(query)
    );
  }, [templates, foodSearch]);

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
    : selectedOption?.Label || "portion";
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
      setError("Quantity must be greater than zero.");
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
        PortionLabel: "meal",
        PortionBaseUnit: "each",
        PortionBaseAmount: 1
      };

      if (isFoodEntry) {
        if (!effectiveBaseAmount || !effectiveBaseUnit) {
          setStatus("error");
          setError("Select a portion and base amount.");
          return;
        }
        portionPayload = {
          PortionOptionId: selectedOption?.PortionOptionId || null,
          PortionLabel: effectiveLabel || "portion",
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

  return (
    <div className="health-log">
      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h2>Log</h2>
            <p>Track meals for any date.</p>
          </div>
          <label className="health-date">
            Date
            <input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} />
          </label>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {showForm ? (
          <form className="health-log-form" onSubmit={onSubmit}>
            <label>
              Meal type
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
              Quantity
              <div className="health-stepper">
                <button
                  type="button"
                  className="icon-button is-secondary"
                  aria-label="Decrease quantity"
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
                  aria-label="Increase quantity"
                  onClick={() => onAdjustQuantity(0.25)}
                >
                  +
                </button>
              </div>
            </label>
            <label>
              Portion
              <select
                value={selectedPortion}
                onChange={onSelectPortion}
                disabled={!form.SelectedId}
              >
                <option value="">Select</option>
                {portionOptions.map((option) => (
                  <option key={option.OptionKey} value={option.OptionKey}>
                    {option.Label} ({FormatAmount(option.BaseAmount)} {option.BaseUnit})
                  </option>
                ))}
                {isFoodSelected ? <option value="custom">Custom...</option> : null}
              </select>
            </label>
            {effectiveBaseAmount && effectiveBaseUnit ? (
              <p className="health-equivalent health-form-span">
                Equivalent: {FormatAmount(equivalentValue)} {effectiveBaseUnit}
                {Number.isFinite(estimatedCalories) ? ` | Est: ${estimatedCalories} kcal` : ""}
              </p>
            ) : null}
            <div className="health-form-span">
              <button
                type="button"
                className="button-secondary health-details-toggle"
                onClick={() => setDetailsOpen((prev) => !prev)}
              >
                <Icon name={detailsOpen ? "chevronDown" : "chevronRight"} className="icon" />
                {detailsOpen ? "Hide serving options" : "Serving size options"}
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
                    <span className="health-nutrition-empty">
                      Nutrition preview available for foods.
                    </span>
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
                        {portionBaseUnit ? (
                          <option value={portionBaseUnit}>{portionBaseUnit}</option>
                        ) : null}
                      </select>
                    </label>
                  </div>
                  <label>
                    Portion label
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
                <button type="button" className="button-secondary" onClick={onCancelEdit}>
                  Cancel
                </button>
              ) : (
                <button type="button" className="button-secondary" onClick={() => setShowForm(false)}>
                  Close
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="form-actions">
            <button type="button" onClick={() => setShowForm(true)}>
              Log meal
            </button>
          </div>
        )}
      </section>

      {!showForm ? (
        <>
          <section className="module-panel module-panel--stretch">
            <header className="module-panel-header">
              <div>
                <h3>Entries</h3>
                <p>{entries.length} logged items</p>
              </div>
            </header>
            <div className="health-meal-list">
              {Object.entries(groupedEntries).length === 0 ? (
                <p className="health-empty">No entries yet.</p>
              ) : (
                Object.entries(groupedEntries).map(([mealType, items]) => (
                  <div key={mealType} className="health-meal-group">
                    <div className="health-meal-header">
                      <h4>{mealType}</h4>
                      <span>{items.length} items</span>
                    </div>
                    <ul>
                      {items.map((entry) => (
                        <li key={entry.MealEntryId}>
                          <SwipeableEntryRow
                            onEdit={() => onEditEntry(entry)}
                            onDelete={() => scheduleDelete(entry)}
                          >
                            <div className="health-entry-row">
                              <div>
                                <p>{entry.FoodName}</p>
                                <div className="health-entry-meta">
                                  <span className="health-detail">
                                    {FormatAmount(entry.DisplayQuantity ?? entry.Quantity)}{" "}
                                    {entry.PortionLabel || entry.ServingDescription || "serving"}
                                  </span>
                                  <span className="health-entry-calories">
                                    {Math.round(entry.CaloriesPerServing * entry.Quantity)} kcal
                                  </span>
                                </div>
                              </div>
                              <div className="health-entry-actions-inline">
                                <button
                                  type="button"
                                  className="icon-button is-secondary"
                                  aria-label="Edit entry"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onEditEntry(entry);
                                  }}
                                >
                                  <Icon name="edit" className="icon" />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button is-danger"
                                  aria-label="Delete entry"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    scheduleDelete(entry);
                                  }}
                                >
                                  <Icon name="trash" className="icon" />
                                </button>
                              </div>
                            </div>
                          </SwipeableEntryRow>
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
