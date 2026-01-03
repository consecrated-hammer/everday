import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "../../components/Icon.jsx";
import SwipeableEntryRow from "../../components/SwipeableEntryRow.jsx";
import { FormatNumber } from "../../lib/formatters.js";
import {
  CreateFood,
  CreateMealTemplate,
  DeleteFood,
  DeleteMealTemplate,
  FetchFoods,
  FetchMealTemplates,
  LookupFoodTextOptions,
  MultiSourceSearch,
  ParseMealTemplateText,
  UpdateFood,
  UpdateMealTemplate
} from "../../lib/healthApi.js";

const EmptyFoodForm = {
  FoodName: "",
  ServingQuantity: "1",
  ServingUnit: "serving",
  CaloriesPerServing: "",
  ProteinPerServing: "",
  FibrePerServing: "",
  CarbsPerServing: "",
  FatPerServing: "",
  SaturatedFatPerServing: "",
  SugarPerServing: "",
  SodiumPerServing: "",
  DataSource: "manual",
  CountryCode: "AU",
  IsFavourite: false
};

const DefaultMealType = "Breakfast";

const ParseServingDescription = (value) => {
  if (!value) {
    return { quantity: 1, unit: "serving" };
  }
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)/);
  if (!match) {
    return { quantity: 1, unit: "serving" };
  }
  const rawQty = match[1];
  const unit = match[2];
  if (rawQty.includes("/")) {
    const [num, den] = rawQty.split("/").map(Number);
    if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
      return { quantity: num / den, unit };
    }
  }
  const quantity = Number(rawQty);
  return Number.isNaN(quantity) ? { quantity: 1, unit: "serving" } : { quantity, unit };
};

const FoodEditEssentialsSection = ({
  foodForm,
  onFoodChange
}) => (
  <div className="health-food-section">
    <div className="health-section-header">
      <div>
        <h4>Essentials</h4>
        <p>Core details for everyday logging.</p>
      </div>
      <div className="health-toggle-inline">
        <input
          id="food-favourite"
          type="checkbox"
          name="IsFavourite"
          checked={foodForm.IsFavourite}
          onChange={onFoodChange}
        />
        <label htmlFor="food-favourite">Favourite</label>
      </div>
    </div>
    <div className="health-form-row">
      <label className="health-form-span">
        Food name
        <input
          name="FoodName"
          value={foodForm.FoodName}
          onChange={onFoodChange}
          placeholder="e.g. Banana, Greek yoghurt"
          required
        />
      </label>
      <label>
        Serving qty
        <input
          name="ServingQuantity"
          type="number"
          step="0.1"
          value={foodForm.ServingQuantity}
          onChange={onFoodChange}
          required
        />
      </label>
      <label>
        Serving unit
        <input
          name="ServingUnit"
          value={foodForm.ServingUnit}
          onChange={onFoodChange}
          required
        />
      </label>
    </div>
    <div className="health-form-row health-form-row--compact">
      <label>
        Protein (g)
        <input
          name="ProteinPerServing"
          type="number"
          step="0.1"
          value={foodForm.ProteinPerServing}
          onChange={onFoodChange}
        />
      </label>
      <label>
        Carbs (g)
        <input
          name="CarbsPerServing"
          type="number"
          step="0.1"
          value={foodForm.CarbsPerServing}
          onChange={onFoodChange}
        />
      </label>
    </div>
    <div className="health-form-row health-form-row--compact">
      <label>
        Fat (g)
        <input
          name="FatPerServing"
          type="number"
          step="0.1"
          value={foodForm.FatPerServing}
          onChange={onFoodChange}
        />
      </label>
      <label>
        Calories
        <input
          name="CaloriesPerServing"
          type="number"
          value={foodForm.CaloriesPerServing}
          onChange={onFoodChange}
        />
      </label>
    </div>
  </div>
);

const FoodEditAdvancedAccordion = ({ open, onToggle, foodForm, onFoodChange }) => (
  <div className="health-food-section">
    <button
      type="button"
      className="health-accordion-toggle"
      aria-expanded={open}
      onClick={onToggle}
    >
      Advanced nutrients
      <Icon name="chevronDown" className={`icon${open ? " is-open" : ""}`} />
    </button>
    {open ? (
      <div className="health-accordion-panel">
        <div className="health-form-row health-form-row--compact">
          <label>
            Fibre (g)
            <input
              name="FibrePerServing"
              type="number"
              step="0.1"
              value={foodForm.FibrePerServing}
              onChange={onFoodChange}
            />
          </label>
          <label>
            Sugar (g)
            <input
              name="SugarPerServing"
              type="number"
              step="0.1"
              value={foodForm.SugarPerServing}
              onChange={onFoodChange}
            />
          </label>
        </div>
        <div className="health-form-row health-form-row--compact">
          <label>
            Sat fat (g)
            <input
              name="SaturatedFatPerServing"
              type="number"
              step="0.1"
              value={foodForm.SaturatedFatPerServing}
              onChange={onFoodChange}
            />
          </label>
          <label>
            Sodium (mg)
            <input
              name="SodiumPerServing"
              type="number"
              step="0.1"
              value={foodForm.SodiumPerServing}
              onChange={onFoodChange}
            />
          </label>
        </div>
      </div>
    ) : null}
  </div>
);

const OverflowMenu = ({ open, onToggle, items }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onToggle(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onToggle(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onToggle]);

  return (
    <div className="health-overflow" ref={menuRef}>
      <button
        type="button"
        className="icon-button is-secondary"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        <Icon name="more" className="icon" />
      </button>
      {open ? (
        <div className="health-overflow-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`health-overflow-item${item.danger ? " is-danger" : ""}`}
              role="menuitem"
              onClick={() => {
                onToggle(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const StickyActionBar = ({ formId, onCancel, onDelete, showDelete, isSaving }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="health-sticky-actions">
      <div className="health-sticky-actions-inner">
        <button type="submit" className="primary-button" form={formId} disabled={isSaving}>
          Save
        </button>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
        {showDelete ? (
          <OverflowMenu
            open={open}
            onToggle={setOpen}
            items={[
              {
                label: "Delete food",
                danger: true,
                onClick: onDelete
              }
            ]}
          />
        ) : null}
      </div>
    </div>
  );
};

const Foods = () => {
  const [foods, setFoods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("foods");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [mobileFilter, setMobileFilter] = useState("foods");
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const mobileAddRef = useRef(null);

  const [foodForm, setFoodForm] = useState(EmptyFoodForm);
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [showFoodForm, setShowFoodForm] = useState(false);

  const [foodEntryMode, setFoodEntryMode] = useState("lookup");
  const [lookupQuery, setLookupQuery] = useState("");

  const [searchSources, setSearchSources] = useState({
    openfoodfacts: true,
    ai: true
  });
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const [searchResults, setSearchResults] = useState({
    openfoodfacts: [],
    ai: [],
    aiFallbackAvailable: false
  });
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [dataSourceUsed, setDataSourceUsed] = useState(null);

  const [templateForm, setTemplateForm] = useState({
    TemplateName: "",
    Items: []
  });
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealEntryMode, setMealEntryMode] = useState("assistant");

  const [mealParseText, setMealParseText] = useState("");
  const [mealParseResult, setMealParseResult] = useState(null);
  const [isMealParsing, setIsMealParsing] = useState(false);
  const [aiMealNutrition, setAiMealNutrition] = useState(null);
  const [aiMealDescription, setAiMealDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mealFoodSearch, setMealFoodSearch] = useState("");
  const [mealFoodQuantities, setMealFoodQuantities] = useState({});
  const foodFormRef = useRef(null);

  const loadData = async () => {
    try {
      setStatus("loading");
      setError("");
      const [foodData, templateData] = await Promise.all([
        FetchFoods(),
        FetchMealTemplates()
      ]);
      setFoods(foodData);
      setTemplates(templateData.Templates || []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load foods");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!lookupModalOpen) {
      return undefined;
    }
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setLookupModalOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [lookupModalOpen]);

  useEffect(() => {
    if (!mobileAddOpen) {
      return undefined;
    }
    const handleClick = (event) => {
      if (mobileAddRef.current && !mobileAddRef.current.contains(event.target)) {
        setMobileAddOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setMobileAddOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [mobileAddOpen]);

  useEffect(() => {
    if (!showFoodForm || !foodFormRef.current) {
      return;
    }
    const target = foodFormRef.current;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [showFoodForm, selectedFoodId]);

  const filteredFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = foods;
    if (onlyFavourites || mobileFilter === "favourites") {
      next = next.filter((food) => food.IsFavourite);
    }
    const sourceFilter =
      mobileFilter === "seed" ? "seed" : mobileFilter === "ai" ? "ai" : null;
    if (sourceFilter) {
      next = next.filter(
        (food) => (food.DataSource || "manual").toLowerCase() === sourceFilter
      );
    }
    if (!query) {
      return next;
    }
    return next.filter((food) => food.FoodName.toLowerCase().includes(query));
  }, [foods, search, onlyFavourites, mobileFilter]);

  const foodsById = useMemo(
    () =>
      foods.reduce((map, food) => {
        map[food.FoodId] = food;
        return map;
      }, {}),
    [foods]
  );

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      template.Template.TemplateName.toLowerCase().includes(query)
    );
  }, [templates, search]);

  const filteredMealFoods = useMemo(() => {
    const query = mealFoodSearch.trim().toLowerCase();
    if (!query) {
      return foods;
    }
    return foods.filter((food) => food.FoodName.toLowerCase().includes(query));
  }, [foods, mealFoodSearch]);

  const sortedFoods = useMemo(() => {
    const list = [...filteredFoods];
    const direction = sortDirection === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      if (sortBy === "name") {
        return direction * a.FoodName.localeCompare(b.FoodName);
      }
      if (sortBy === "calories") {
        return direction * ((a.CaloriesPerServing || 0) - (b.CaloriesPerServing || 0));
      }
      if (sortBy === "protein") {
        return direction * ((a.ProteinPerServing || 0) - (b.ProteinPerServing || 0));
      }
      if (sortBy === "date") {
        const left = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
        const right = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
        return direction * (left - right);
      }
      return 0;
    });
  }, [filteredFoods, sortBy, sortDirection]);

  const onFoodChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setFoodForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const selectFood = (food) => {
    setSelectedFoodId(food.FoodId);
    setFoodForm({
      FoodName: food.FoodName,
      ServingQuantity: String(food.ServingQuantity || 1),
      ServingUnit: food.ServingUnit || "serving",
      CaloriesPerServing: String(food.CaloriesPerServing || ""),
      ProteinPerServing: String(food.ProteinPerServing || ""),
      FibrePerServing: String(food.FibrePerServing || ""),
      CarbsPerServing: String(food.CarbsPerServing || ""),
      FatPerServing: String(food.FatPerServing || ""),
      SaturatedFatPerServing: String(food.SaturatedFatPerServing || ""),
      SugarPerServing: String(food.SugarPerServing || ""),
      SodiumPerServing: String(food.SodiumPerServing || ""),
      DataSource: food.DataSource || "manual",
      CountryCode: food.CountryCode || "AU",
      IsFavourite: !!food.IsFavourite
    });
    setDataSourceUsed(food.DataSource || null);
    setShowFoodForm(true);
    setShowAdvanced(false);
    setFoodEntryMode("manual");
    setLookupQuery(food.FoodName || "");
  };

  const resetFoodForm = () => {
    setSelectedFoodId(null);
    setFoodForm(EmptyFoodForm);
    setLookupQuery("");
    setFoodEntryMode("lookup");
    setSearchResults({ openfoodfacts: [], ai: [], aiFallbackAvailable: false });
    setDataSourceUsed(null);
  };

  const startAddFood = () => {
    handleTabChange("foods");
    resetFoodForm();
    setShowFoodForm(true);
    setShowAdvanced(false);
    setError("");
  };

  const closeFoodForm = () => {
    resetFoodForm();
    setShowFoodForm(false);
    setShowAdvanced(false);
  };

  const saveFood = async (event) => {
    event.preventDefault();
    try {
      setStatus("saving");
      setError("");
      const payload = {
        ...foodForm,
        ServingQuantity: Number(foodForm.ServingQuantity || 1),
        CaloriesPerServing: Number(foodForm.CaloriesPerServing || 0),
        ProteinPerServing: Number(foodForm.ProteinPerServing || 0),
        FibrePerServing: foodForm.FibrePerServing ? Number(foodForm.FibrePerServing) : null,
        CarbsPerServing: foodForm.CarbsPerServing ? Number(foodForm.CarbsPerServing) : null,
        FatPerServing: foodForm.FatPerServing ? Number(foodForm.FatPerServing) : null,
        SaturatedFatPerServing: foodForm.SaturatedFatPerServing
          ? Number(foodForm.SaturatedFatPerServing)
          : null,
        SugarPerServing: foodForm.SugarPerServing ? Number(foodForm.SugarPerServing) : null,
        SodiumPerServing: foodForm.SodiumPerServing ? Number(foodForm.SodiumPerServing) : null
      };

      if (selectedFoodId) {
        await UpdateFood(selectedFoodId, payload);
      } else {
        await CreateFood(payload);
      }
      await loadData();
      closeFoodForm();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save food");
    }
  };

  const deleteFood = async (foodId) => {
    if (!confirm("Delete this food? This cannot be undone.")) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteFood(foodId);
      await loadData();
      if (foodId === selectedFoodId) {
        closeFoodForm();
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete food");
    }
  };

  const applyLookupResult = (result, source = "openfoodfacts") => {
    const parsedServing = ParseServingDescription(result.ServingDescription || "");
    setFoodForm({
      ...EmptyFoodForm,
      FoodName: result.FoodName,
      ServingQuantity: String(result.ServingQuantity || parsedServing.quantity || 1),
      ServingUnit: result.ServingUnit || parsedServing.unit || "serving",
      CaloriesPerServing: String(result.CaloriesPerServing || ""),
      ProteinPerServing: String(result.ProteinPerServing || ""),
      FibrePerServing: String(result.FibrePerServing || result.FiberPerServing || ""),
      CarbsPerServing: String(result.CarbsPerServing || result.CarbohydratesPerServing || ""),
      FatPerServing: String(result.FatPerServing || ""),
      SaturatedFatPerServing: String(result.SaturatedFatPerServing || ""),
      SugarPerServing: String(result.SugarPerServing || ""),
      SodiumPerServing: String(result.SodiumPerServing || ""),
      DataSource: source,
      CountryCode: "AU",
      IsFavourite: false
    });
    setSelectedFoodId(null);
    setDataSourceUsed(source);
    setFoodEntryMode("manual");
    setLookupQuery(result.FoodName || "");
    setLookupModalOpen(false);
  };

  const runLookup = async () => {
    const query = lookupQuery.trim();
    if (query.length < 3) {
      setError("Enter at least 3 characters to search.");
      return;
    }
    if (!searchSources.openfoodfacts && !searchSources.ai) {
      setError("Select at least one source to search.");
      return;
    }

    try {
      setIsSearchingSources(true);
      setError("");
      setSearchResults({ openfoodfacts: [], ai: [], aiFallbackAvailable: false });
      const [openfoodfactsResult, aiResult] = await Promise.all([
        searchSources.openfoodfacts
          ? MultiSourceSearch({ Query: query })
          : Promise.resolve({ Openfoodfacts: [], AiFallbackAvailable: false }),
        searchSources.ai ? LookupFoodTextOptions({ Query: query }) : Promise.resolve({ Results: [] })
      ]);

      setSearchResults({
        openfoodfacts: openfoodfactsResult.Openfoodfacts || [],
        ai: aiResult.Results || [],
        aiFallbackAvailable: Boolean(
          searchSources.ai && openfoodfactsResult.AiFallbackAvailable
        )
      });
      const totalResults =
        (openfoodfactsResult.Openfoodfacts || []).length + (aiResult.Results || []).length;
      if (totalResults > 0) {
        setLookupModalOpen(true);
      }
    } catch (err) {
      setError(err?.message || "Lookup failed");
    } finally {
      setIsSearchingSources(false);
    }
  };

  const switchToManual = () => {
    setFoodEntryMode("manual");
    const fallbackName = lookupQuery.trim();
    if (!foodForm.FoodName && fallbackName) {
      setFoodForm((prev) => ({ ...prev, FoodName: fallbackName }));
    }
  };

  const isEditingFood = Boolean(selectedFoodId);
  const isManualMode = isEditingFood || foodEntryMode === "manual";
  const isLookupMode = !isEditingFood && foodEntryMode === "lookup";
  const lookupCount = searchResults.openfoodfacts.length + searchResults.ai.length;
  const headerNote = selectedFoodId
    ? "Update serving and nutrition details."
    : isLookupMode
      ? "Use lookup to prefill serving and nutrition details."
      : dataSourceUsed && dataSourceUsed !== "manual"
        ? "Review suggestion and save."
        : "Enter serving and nutrition details.";

  const addTemplateItem = (food, quantityValue) => {
    if (!food?.FoodId) {
      setError("Select a food for the meal.");
      return;
    }
    const quantity = Number(quantityValue || mealFoodQuantities[food.FoodId] || 1);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    setTemplateForm((prev) => ({
      ...prev,
      Items: [
        ...prev.Items,
        {
          FoodId: food.FoodId,
          MealType: DefaultMealType,
          Quantity: String(quantity),
          EntryQuantity: null,
          EntryUnit: null,
          EntryNotes: ""
        }
      ]
    }));
    setError("");
    setMealFoodQuantities((prev) => ({ ...prev, [food.FoodId]: "1" }));
  };

  const updateMealFoodQuantity = (foodId, value) => {
    setMealFoodQuantities((prev) => ({ ...prev, [foodId]: value }));
  };

  const removeTemplateItem = (index) => {
    setTemplateForm((prev) => ({
      ...prev,
      Items: prev.Items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const saveTemplate = async () => {
    if (!templateForm.TemplateName.trim()) {
      setError("Meal name is required.");
      return;
    }
    if (!templateForm.Items.length) {
      setError("Add at least one meal item.");
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const aiUpdatePayload = {};
      if (isEditingAiMeal && aiMealNutrition) {
        [
          "CaloriesPerServing",
          "ProteinPerServing",
          "CarbsPerServing",
          "FatPerServing",
          "FibrePerServing",
          "SugarPerServing",
          "SaturatedFatPerServing",
          "SodiumPerServing",
        ].forEach((key) => {
          const rawValue = aiMealNutrition[key];
          if (rawValue === "" || rawValue === null || rawValue === undefined) {
            return;
          }
          const parsedValue = Number(rawValue);
          if (Number.isNaN(parsedValue)) {
            return;
          }
          aiUpdatePayload[key] = parsedValue;
        });
      }
      const payload = {
        TemplateName: templateForm.TemplateName,
        Items: templateForm.Items.map((item, index) => ({
          FoodId: item.FoodId,
          MealType: item.MealType,
          Quantity: Number(item.Quantity || 1),
          EntryQuantity: item.EntryQuantity ? Number(item.EntryQuantity) : null,
          EntryUnit: item.EntryUnit || null,
          EntryNotes: isEditingAiMeal ? aiMealDescription || null : item.EntryNotes || null,
          SortOrder: index
        }))
      };

      if (editingTemplateId) {
        if (isEditingAiMeal && aiMealFood && Object.keys(aiUpdatePayload).length > 0) {
          await UpdateFood(aiMealFood.FoodId, aiUpdatePayload);
        }
        await UpdateMealTemplate(editingTemplateId, payload);
      } else {
        await CreateMealTemplate(payload);
      }
      await loadData();
      setTemplateForm({ TemplateName: "", Items: [] });
      setEditingTemplateId(null);
      setShowMealForm(false);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save meal");
    }
  };

  const selectTemplate = (template) => {
    setEditingTemplateId(template.Template.MealTemplateId);
    setTemplateForm({
      TemplateName: template.Template.TemplateName,
      Items: template.Items.map((item) => ({
        FoodId: item.FoodId,
        MealType: item.MealType,
        Quantity: String(item.Quantity),
        EntryQuantity: item.EntryQuantity ? String(item.EntryQuantity) : "",
        EntryUnit: item.EntryUnit || "",
        EntryNotes: item.EntryNotes || ""
      }))
    });
    const firstItem = template.Items[0];
    const firstFood = firstItem ? foodsById[firstItem.FoodId] : null;
    if (template.Items.length === 1 && firstFood && (firstFood.DataSource || "manual") === "ai") {
      setAiMealNutrition({
        CaloriesPerServing: firstFood.CaloriesPerServing ?? "",
        ProteinPerServing: firstFood.ProteinPerServing ?? "",
        CarbsPerServing: firstFood.CarbsPerServing ?? "",
        FatPerServing: firstFood.FatPerServing ?? "",
        FibrePerServing: firstFood.FibrePerServing ?? "",
        SugarPerServing: firstFood.SugarPerServing ?? "",
        SaturatedFatPerServing: firstFood.SaturatedFatPerServing ?? "",
        SodiumPerServing: firstFood.SodiumPerServing ?? "",
      });
      setAiMealDescription(firstItem?.EntryNotes || "");
    } else {
      setAiMealNutrition(null);
      setAiMealDescription("");
    }
    setShowMealForm(true);
    setMealEntryMode("manual");
    setMealParseResult(null);
  };

  const removeTemplate = async (templateId) => {
    if (!confirm("Delete this meal? This cannot be undone.")) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteMealTemplate(templateId);
      await loadData();
      if (editingTemplateId === templateId) {
        setEditingTemplateId(null);
        setTemplateForm({ TemplateName: "", Items: [] });
        setShowMealForm(false);
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete meal");
    }
  };

  const runMealParse = async () => {
    if (!mealParseText.trim()) {
      setError("Enter a meal description to parse.");
      return;
    }
    try {
      setStatus("loading");
      setIsMealParsing(true);
      setError("");
      const parsed = await ParseMealTemplateText({ Text: mealParseText.trim() });
      setMealParseResult(parsed);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to parse meal");
    } finally {
      setIsMealParsing(false);
    }
  };

  const createMealFromParse = async () => {
    if (!mealParseResult) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      const name = `${mealParseResult.MealName} (AI total)`;
      const newFood = await CreateFood({
        FoodName: name,
        ServingQuantity: mealParseResult.ServingQuantity,
        ServingUnit: mealParseResult.ServingUnit,
        CaloriesPerServing: mealParseResult.CaloriesPerServing,
        ProteinPerServing: mealParseResult.ProteinPerServing,
        FibrePerServing: mealParseResult.FibrePerServing,
        CarbsPerServing: mealParseResult.CarbsPerServing,
        FatPerServing: mealParseResult.FatPerServing,
        SaturatedFatPerServing: mealParseResult.SaturatedFatPerServing,
        SugarPerServing: mealParseResult.SugarPerServing,
        SodiumPerServing: mealParseResult.SodiumPerServing,
        DataSource: "ai",
        CountryCode: "AU",
        IsFavourite: false
      });
      await CreateMealTemplate({
        TemplateName: mealParseResult.MealName,
        Items: [
          {
            FoodId: newFood.FoodId,
            MealType: "Lunch",
            Quantity: 1,
            EntryQuantity: null,
            EntryUnit: null,
            EntryNotes: mealParseResult.Summary,
            SortOrder: 0
          }
        ]
      });
      setMealParseText("");
      setMealParseResult(null);
      await loadData();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save AI meal");
    }
  };

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    if (nextTab === "foods" || nextTab === "meals") {
      setMobileFilter(nextTab);
    }
    if (nextTab === "foods") {
      setShowMealForm(false);
      setEditingTemplateId(null);
      setTemplateForm({ TemplateName: "", Items: [] });
      setMealEntryMode("assistant");
      setMealParseText("");
      setMealParseResult(null);
      setMealFoodSearch("");
      setMealFoodQuantities({});
      setAiMealNutrition(null);
      setAiMealDescription("");
    } else {
      closeFoodForm();
    }
  };

  const startAddMeal = () => {
    handleTabChange("meals");
    setShowMealForm(true);
    setMealEntryMode("assistant");
    setEditingTemplateId(null);
    setTemplateForm({ TemplateName: "", Items: [] });
    setMealParseResult(null);
    setMealParseText("");
    setMealFoodSearch("");
    setMealFoodQuantities({});
    setAiMealNutrition(null);
    setAiMealDescription("");
  };

  const closeMealForm = () => {
    setShowMealForm(false);
    setEditingTemplateId(null);
    setTemplateForm({ TemplateName: "", Items: [] });
    setMealParseResult(null);
    setMealParseText("");
    setMealEntryMode("assistant");
    setMealFoodSearch("");
    setMealFoodQuantities({});
    setAiMealNutrition(null);
    setAiMealDescription("");
  };

  const isEditingMeal = Boolean(editingTemplateId);
  const isMealManualMode = isEditingMeal || mealEntryMode === "manual";
  const isMealAssistantMode = !isEditingMeal && mealEntryMode === "assistant";
  const aiMealFood =
    isEditingMeal && templateForm.Items.length === 1
      ? foodsById[templateForm.Items[0].FoodId]
      : null;
  const isEditingAiMeal = Boolean(aiMealFood && (aiMealFood.DataSource || "manual") === "ai");
  const showMealsInline = mobileFilter === "all";
  const showFoodsList =
    (activeTab === "foods" || showMealsInline) && (!showFoodForm || selectedFoodId) && !showMealForm;
  const showMealsList =
    (activeTab === "meals" || showMealsInline) && !showMealForm && !showFoodForm;

  const applyMobileFilter = (value) => {
    if (value === "meals") {
      handleTabChange("meals");
    } else {
      handleTabChange("foods");
    }
    setMobileFilter(value);
  };

  const getMealTotals = (template) =>
    template.Items.reduce(
      (acc, item) => {
        const food = foodsById[item.FoodId];
        if (!food) {
          return acc;
        }
        const quantity = item.EntryQuantity || item.Quantity || 1;
        return {
          calories: acc.calories + (food.CaloriesPerServing || 0) * quantity,
          protein: acc.protein + (food.ProteinPerServing || 0) * quantity
        };
      },
      { calories: 0, protein: 0 }
    );

  return (
    <div className="health-foods">
      <div className="health-foods-mobile-header">
        <div>
          <h2>Foods</h2>
          <p>
            {foods.length} {foods.length === 1 ? "food" : "foods"} • {templates.length}{" "}
            {templates.length === 1 ? "meal" : "meals"}
          </p>
        </div>
        <div className="health-foods-mobile-actions" ref={mobileAddRef}>
          <button
            type="button"
            className="icon-button is-primary"
            aria-label="Add food or meal"
            onClick={() => setMobileAddOpen((prev) => !prev)}
          >
            <Icon name="plus" className="icon" />
          </button>
          {mobileAddOpen ? (
            <div className="dropdown dropdown-right">
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setMobileAddOpen(false);
                  startAddFood();
                }}
              >
                Add food
              </button>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setMobileAddOpen(false);
                  startAddMeal();
                }}
              >
                Add meal
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {!showFoodForm && !showMealForm ? (
        <div className="health-foods-toolbar">
          <input
            className="health-search"
            type="search"
            placeholder="Search foods"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="health-foods-toolbar-row">
            <select
              className="health-foods-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="name">Sort by name</option>
              <option value="calories">Sort by calories</option>
              <option value="protein">Sort by protein</option>
              <option value="date">Sort by date</option>
            </select>
            <button
              type="button"
              className="icon-button is-secondary"
              onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              aria-label="Toggle sort direction"
            >
              <Icon name={sortDirection === "asc" ? "sortUp" : "sortDown"} className="icon" />
            </button>
          </div>
          <div className="health-foods-chips" role="tablist" aria-label="Filter foods and meals">
            {[
              { key: "all", label: "All" },
              { key: "foods", label: "Foods" },
              { key: "meals", label: "Meals" },
              { key: "favourites", label: "Favourites" },
              { key: "seed", label: "Seed" },
              { key: "ai", label: "AI" }
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`health-filter-chip${mobileFilter === chip.key ? " is-active" : ""}`}
                onClick={() => applyMobileFilter(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="module-panel foods-hero-card">
        <header className="module-panel-header">
          <div>
            <h2>Foods and meals</h2>
            <p>
              {foods.length} {foods.length === 1 ? "food" : "foods"}, {templates.length}{" "}
              {templates.length === 1 ? "meal" : "meals"}
            </p>
          </div>
          <div className="module-panel-actions">
            <button type="button" className="primary-button" onClick={startAddFood}>
              Add food
            </button>
            <button type="button" className="button-secondary" onClick={startAddMeal}>
              Add meal
            </button>
          </div>
        </header>
        <div className="module-nav" aria-label="Foods and meals">
          <button
            type="button"
            className={`module-link${activeTab === "foods" ? " is-active" : ""}`}
            onClick={() => handleTabChange("foods")}
          >
            Foods
          </button>
          <button
            type="button"
            className={`module-link${activeTab === "meals" ? " is-active" : ""}`}
            onClick={() => handleTabChange("meals")}
          >
            Meals
          </button>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {showFoodsList ? (
        <section className="module-panel">
          <header className="module-panel-header food-library-header">
            <div>
              <h3>Food library</h3>
              <p>{sortedFoods.length} items</p>
            </div>
            <div className="module-panel-actions">
              <input
                className="health-search"
                type="search"
                placeholder="Search foods"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="name">Sort by name</option>
                <option value="calories">Sort by calories</option>
                <option value="protein">Sort by protein</option>
                <option value="date">Sort by date</option>
              </select>
              <button
                type="button"
                className="icon-button is-secondary"
                onClick={() =>
                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                aria-label="Toggle sort direction"
              >
                <Icon name={sortDirection === "asc" ? "sortUp" : "sortDown"} className="icon" />
              </button>
              <button type="button" className="button-secondary" onClick={() => setOnlyFavourites((prev) => !prev)}>
                {onlyFavourites ? "Favourites only" : "All foods"}
              </button>
            </div>
          </header>

          {status === "loading" ? (
            <p className="health-empty">Loading foods...</p>
          ) : null}
          {status !== "loading" && sortedFoods.length === 0 ? (
            <p className="health-empty">No foods yet.</p>
          ) : null}
          {sortedFoods.length ? (
            <ul className="health-food-list">
              {sortedFoods.map((food) => (
                <li key={food.FoodId}>
                  <SwipeableEntryRow
                    onEdit={() => selectFood(food)}
                    onDelete={() => deleteFood(food.FoodId)}
                  >
                    <div
                      className={`health-food-item${
                        food.FoodId === selectedFoodId ? " is-active" : ""
                      }`}
                    >
                      <div>
                        <p>{food.FoodName}</p>
                        <div className="health-entry-meta">
                          <span className="health-detail">
                            {food.ServingDescription || `${food.ServingQuantity} ${food.ServingUnit}`}
                          </span>
                          <span className="health-detail">
                            {food.ProteinPerServing} g protein
                          </span>
                          <span className="health-entry-calories">
                            {food.CaloriesPerServing} kcal
                          </span>
                        </div>
                        <span className="health-detail">Source: {food.DataSource || "manual"}</span>
                      </div>
                      <div className="health-entry-actions-inline">
                        <button
                          type="button"
                          className="icon-button is-secondary"
                          aria-label="Edit food"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectFood(food);
                          }}
                        >
                          <Icon name="edit" className="icon" />
                        </button>
                        <button
                          type="button"
                          className="icon-button is-danger"
                          aria-label="Delete food"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteFood(food.FoodId);
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
          ) : null}
        </section>
      ) : null}

      {activeTab === "foods" && showFoodForm ? (
        <section className="module-panel" ref={foodFormRef}>
          <header className="module-panel-header">
            <div>
              <h3>{selectedFoodId ? "Edit food" : "Add food"}</h3>
              <p>{headerNote}</p>
            </div>
          </header>

          {!selectedFoodId ? (
            <>
              {isLookupMode ? (
                <div className="health-food-add-helper">
                  <p className="health-search-meta">
                    Start with lookup to prefill serving and nutrition details, then review essentials below.
                  </p>
                </div>
              ) : null}
              <div className="health-mode-toggle">
                <button
                  type="button"
                  className={`health-mode-button${foodEntryMode === "lookup" ? " is-active" : ""}`}
                  onClick={() => setFoodEntryMode("lookup")}
                >
                  Lookup
                </button>
                <button
                  type="button"
                  className={`health-mode-button${foodEntryMode === "manual" ? " is-active" : ""}`}
                  onClick={switchToManual}
                >
                  Manual
                </button>
              </div>
            </>
          ) : null}

          <div className="health-food-form-stack">
            {isLookupMode ? (
              <section className="health-food-lookup">
                <header className="health-lookup-header">
                  <div>
                    <h4>Lookup assistant</h4>
                    <p>Pull nutrition data before saving.</p>
                  </div>
                </header>

                <div className="health-lookup">
                  <label className="health-lookup-field">
                    Search foods
                    <input
                      value={lookupQuery}
                      onChange={(event) => setLookupQuery(event.target.value)}
                      placeholder="e.g. Greek yoghurt"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          runLookup();
                        }
                      }}
                      autoFocus
                    />
                  </label>
                  <div className="health-lookup-sources">
                    <div className="form-switch-row">
                      <label className="form-switch-label" htmlFor="lookup-openfoodfacts">
                        OpenFoodFacts
                      </label>
                      <label className="settings-switch-inline" htmlFor="lookup-openfoodfacts">
                        <input
                          id="lookup-openfoodfacts"
                          type="checkbox"
                          checked={searchSources.openfoodfacts}
                          onChange={(event) =>
                            setSearchSources((prev) => ({
                              ...prev,
                              openfoodfacts: event.target.checked
                            }))
                          }
                        />
                        <span className="switch-track" aria-hidden="true">
                          <span className="switch-thumb" />
                        </span>
                      </label>
                    </div>
                    <div className="form-switch-row">
                      <label className="form-switch-label" htmlFor="lookup-ai-options">
                        AI suggestions
                      </label>
                      <label className="settings-switch-inline" htmlFor="lookup-ai-options">
                        <input
                          id="lookup-ai-options"
                          type="checkbox"
                          checked={searchSources.ai}
                          onChange={(event) =>
                            setSearchSources((prev) => ({ ...prev, ai: event.target.checked }))
                          }
                        />
                        <span className="switch-track" aria-hidden="true">
                          <span className="switch-thumb" />
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="health-lookup-actions">
                    <button type="button" onClick={runLookup} disabled={isSearchingSources}>
                      Search sources
                    </button>
                    {lookupCount > 0 ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setLookupModalOpen(true)}
                      >
                        View results ({lookupCount})
                      </button>
                    ) : null}
                  </div>
                  {isSearchingSources ? (
                    <div className="health-lookup-loading">
                      <span className="loading-spinner" aria-hidden="true" />
                      <span>Searching sources...</span>
                    </div>
                  ) : null}
                  {lookupCount === 0 && !isSearchingSources ? (
                    <p className="health-search-meta">No lookup results yet.</p>
                  ) : null}
                </div>
              </section>
            ) : null}

          {isManualMode ? (
            <>
              <form
                id="food-edit-form"
                  className="health-food-form health-food-form--sticky"
                  onSubmit={saveFood}
                >
                  <FoodEditEssentialsSection foodForm={foodForm} onFoodChange={onFoodChange} />
                  <FoodEditAdvancedAccordion
                    open={showAdvanced}
                    onToggle={() => setShowAdvanced((prev) => !prev)}
                    foodForm={foodForm}
                    onFoodChange={onFoodChange}
                  />
                  <div className="health-food-meta">
                    Source: {dataSourceUsed || foodForm.DataSource || "manual"}
                  </div>
                </form>
                <StickyActionBar
                  formId="food-edit-form"
                  onCancel={closeFoodForm}
                  onDelete={() => deleteFood(selectedFoodId)}
                  showDelete={Boolean(selectedFoodId)}
                  isSaving={status === "saving"}
                />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {lookupModalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setLookupModalOpen(false)}
        >
          <div className="modal modal--health" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Lookup results</h3>
                <p className="health-search-meta">{lookupCount} results found</p>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setLookupModalOpen(false)}
                  aria-label="Close modal"
                >
                  <Icon name="close" className="icon" />
                </button>
              </div>
            </div>
            <div className="health-lookup-results">
              {searchResults.openfoodfacts.length > 0 ? (
                <div>
                  <span className="health-select-heading">OpenFoodFacts</span>
                  {searchResults.openfoodfacts.map((result) => (
                    <button
                      key={`${result.FoodName}-${result.ServingDescription}`}
                      type="button"
                      onClick={() => applyLookupResult(result, "openfoodfacts")}
                    >
                      <strong>{result.FoodName}</strong> · {result.ServingDescription} ·{" "}
                      {result.ProteinPerServing || 0} g protein · {result.CaloriesPerServing || 0}{" "}
                      kcal
                    </button>
                  ))}
                </div>
              ) : null}
              {searchResults.ai.length > 0 ? (
                <div>
                  <span className="health-select-heading">AI suggestions</span>
                  {searchResults.ai.map((result) => (
                    <button
                      key={`${result.FoodName}-${result.ServingUnit}`}
                      type="button"
                      onClick={() => applyLookupResult(result, "ai")}
                    >
                      <strong>{result.FoodName}</strong> · {result.ServingQuantity}{" "}
                      {result.ServingUnit} · {result.ProteinPerServing || 0} g protein ·{" "}
                      {result.CaloriesPerServing || 0} kcal
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showMealsList ? (
        <section className="module-panel">
          <header className="module-panel-header">
            <div>
              <h3>Saved meals</h3>
              <p>{filteredTemplates.length} meals</p>
            </div>
          </header>
          <div className="health-template-list">
            {filteredTemplates.length === 0 ? <p className="health-empty">No meals yet.</p> : null}
            {filteredTemplates.map((template) => {
              const totals = getMealTotals(template);
              const sourceFood =
                template.Items.length === 1 ? foodsById[template.Items[0].FoodId] : null;
              const sourceLabel =
                sourceFood && (sourceFood.DataSource || "manual") === "ai" ? "ai" : null;
              return (
                <div key={template.Template.MealTemplateId}>
                  <SwipeableEntryRow
                    onEdit={() => selectTemplate(template)}
                    onDelete={() => removeTemplate(template.Template.MealTemplateId)}
                  >
                    <div className="health-template-card">
                      <div>
                        <h4>{template.Template.TemplateName}</h4>
                        <div className="health-entry-meta">
                          <span className="health-detail">{template.Items.length} items</span>
                          <span className="health-detail">
                            {FormatNumber(totals.protein)} g protein
                          </span>
                          <span className="health-entry-calories">
                            {FormatNumber(totals.calories)} kcal
                          </span>
                        </div>
                        {sourceLabel ? (
                          <span className="health-detail">Source: {sourceLabel}</span>
                        ) : null}
                      </div>
                      <div className="health-entry-actions-inline">
                        <button
                          type="button"
                          className="icon-button is-secondary"
                          aria-label="Edit meal"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectTemplate(template);
                          }}
                        >
                          <Icon name="edit" className="icon" />
                        </button>
                        <button
                          type="button"
                          className="icon-button is-danger"
                          aria-label="Delete meal"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeTemplate(template.Template.MealTemplateId);
                          }}
                        >
                          <Icon name="trash" className="icon" />
                        </button>
                      </div>
                    </div>
                  </SwipeableEntryRow>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === "meals" && showMealForm ? (
        <section className="module-panel">
          <header className="module-panel-header">
            <div>
              <h3>{editingTemplateId ? "Edit meal" : "Add meal"}</h3>
              <p>
                {editingTemplateId
                  ? "Update this saved meal."
                  : isMealAssistantMode
                    ? mealParseResult
                      ? "Review suggestion and save."
                      : "Describe a meal to get a suggestion."
                    : "Build a meal from foods and save."}
              </p>
            </div>
          </header>

          {!editingTemplateId ? (
            <div className="health-mode-toggle">
              <button
                type="button"
                className={`health-mode-button${isMealAssistantMode ? " is-active" : ""}`}
                onClick={() => setMealEntryMode("assistant")}
              >
                AI assistant
              </button>
              <button
                type="button"
                className={`health-mode-button${isMealManualMode ? " is-active" : ""}`}
                onClick={() => setMealEntryMode("manual")}
              >
                Manual selection
              </button>
            </div>
          ) : null}

          {isMealManualMode ? (
            <div className="health-template-editor">
              <label>
                Meal name
                <input
                  value={templateForm.TemplateName}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, TemplateName: event.target.value }))
                  }
                />
              </label>
              {isEditingAiMeal && aiMealNutrition ? (
                <div className="health-ai-meal-edit">
                  <h4>Meal nutrition</h4>
                  <div className="health-form-row health-form-row--compact">
                    <label>
                      Calories
                      <input
                        name="CaloriesPerServing"
                        type="number"
                        value={aiMealNutrition.CaloriesPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            CaloriesPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Protein (g)
                      <input
                        name="ProteinPerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.ProteinPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            ProteinPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="health-form-row health-form-row--compact">
                    <label>
                      Carbs (g)
                      <input
                        name="CarbsPerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.CarbsPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            CarbsPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Fat (g)
                      <input
                        name="FatPerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.FatPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            FatPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="health-form-row health-form-row--compact">
                    <label>
                      Fibre (g)
                      <input
                        name="FibrePerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.FibrePerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            FibrePerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Sugar (g)
                      <input
                        name="SugarPerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.SugarPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            SugarPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="health-form-row health-form-row--compact">
                    <label>
                      Saturated fat (g)
                      <input
                        name="SaturatedFatPerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.SaturatedFatPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            SaturatedFatPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Sodium (mg)
                      <input
                        name="SodiumPerServing"
                        type="number"
                        step="0.1"
                        value={aiMealNutrition.SodiumPerServing}
                        onChange={(event) =>
                          setAiMealNutrition((prev) => ({
                            ...prev,
                            SodiumPerServing: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="health-form-span">
                    Description
                    <textarea
                      rows={3}
                      value={aiMealDescription}
                      onChange={(event) => setAiMealDescription(event.target.value)}
                      placeholder="Optional notes about this meal"
                    />
                  </label>
                </div>
              ) : (
                <div className="health-template-added">
                  <h4>Added foods</h4>
                  {templateForm.Items.length ? (
                    <ul className="health-template-items">
                      {templateForm.Items.map((item, index) => {
                        const food = foodsById[item.FoodId];
                        return (
                          <li key={`${item.FoodId}-${index}`} className="health-template-item-row">
                            <div className="health-template-item-info">
                              <p>{food?.FoodName || "Food"}</p>
                              <span className="health-detail">
                                {food?.ServingDescription ||
                                  (food ? `${food.ServingQuantity} ${food.ServingUnit}` : "")}
                              </span>
                            </div>
                            <span className="health-template-quantity">x{item.Quantity}</span>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => removeTemplateItem(index)}
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="health-empty">No foods added yet.</p>
                  )}
                </div>
              )}
              {!editingTemplateId ? (
                <div className="health-template-library">
                  <label className="health-form-span">
                    Search foods
                    <input
                      value={mealFoodSearch}
                      onChange={(event) => setMealFoodSearch(event.target.value)}
                      placeholder="Search foods"
                    />
                  </label>
                  {filteredMealFoods.length ? (
                    <ul className="health-food-list health-template-foods">
                      {filteredMealFoods.map((food) => (
                        <li key={food.FoodId}>
                          <div className="health-food-item">
                            <div>
                              <p>{food.FoodName}</p>
                              <div className="health-entry-meta">
                                <span className="health-detail">
                                  {food.ServingDescription || `${food.ServingQuantity} ${food.ServingUnit}`}
                                </span>
                                <span className="health-detail">
                                  {food.ProteinPerServing} g protein
                                </span>
                                <span className="health-entry-calories">
                                  {food.CaloriesPerServing} kcal
                                </span>
                              </div>
                            </div>
                            <div className="health-template-actions">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                className="health-template-qty"
                                value={mealFoodQuantities[food.FoodId] ?? "1"}
                                onChange={(event) =>
                                  updateMealFoodQuantity(food.FoodId, event.target.value)
                                }
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`${food.FoodName} quantity`}
                              />
                              <button
                                type="button"
                                className="button-secondary health-template-add"
                                onClick={() =>
                                  addTemplateItem(food, mealFoodQuantities[food.FoodId] ?? "1")
                                }
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="health-empty">No foods match your search.</p>
                  )}
                </div>
              ) : null}
              <div className="form-actions">
                <button type="button" onClick={saveTemplate}>
                  {editingTemplateId ? "Update" : "Save"} meal
                </button>
                <button type="button" className="text-button" onClick={closeMealForm}>
                  Cancel
                </button>
                {editingTemplateId ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => removeTemplate(editingTemplateId)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {isMealAssistantMode ? (
            <div className="health-ai-parse">
              <textarea
                value={mealParseText}
                onChange={(event) => setMealParseText(event.target.value)}
                placeholder="e.g. Chicken schnitzel, chips, side salad"
              />
              {isMealParsing ? (
                <div className="health-lookup-loading health-ai-loading">
                  <span className="loading-spinner loading-spinner--large" aria-hidden="true" />
                  <span>Getting nutrition...</span>
                </div>
              ) : null}
              <div className="health-lookup-actions">
                <button type="button" onClick={runMealParse} disabled={isMealParsing}>
                  Get nutrition
                </button>
              </div>
              {mealParseResult ? (
                <div className="health-ai-result">
                  <h4>{mealParseResult.MealName}</h4>
                  <p>{mealParseResult.Summary}</p>
                  <span>
                    {mealParseResult.CaloriesPerServing} kcal - {mealParseResult.ProteinPerServing} g protein
                  </span>
                </div>
              ) : null}
              <div className="form-actions">
                {mealParseResult ? (
                  <button type="button" onClick={createMealFromParse}>
                    Save as meal
                  </button>
                ) : null}
                <button type="button" className="text-button" onClick={closeMealForm}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default Foods;
