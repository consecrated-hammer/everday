import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
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

const EmptyTemplateForm = {
  TemplateName: "",
  Servings: "1",
  IsFavourite: false,
  Items: []
};

const DefaultMealType = "Breakfast";
const MealDraftKey = "health.mealDraft";

const LoadMealDraft = () => {
  try {
    const raw = sessionStorage.getItem(MealDraftKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const SaveMealDraft = (draft) => {
  try {
    sessionStorage.setItem(MealDraftKey, JSON.stringify(draft));
  } catch (error) {
    // Ignore storage failures.
  }
};

const ClearMealDraft = () => {
  try {
    sessionStorage.removeItem(MealDraftKey);
  } catch (error) {
    // Ignore storage failures.
  }
};

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
  onFoodChange,
  imageUrl
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
    {imageUrl ? (
      <div className="health-food-image-preview">
        <img src={imageUrl} alt={`${foodForm.FoodName || "Food"} photo`} loading="lazy" />
      </div>
    ) : null}
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
  const [activeTab, setActiveTab] = useState("all");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [mobileFilter, setMobileFilter] = useState("all");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const addHandledRef = useRef(null);
  const sortMenuRef = useRef(null);
  const filterMenuRef = useRef(null);

  const [foodForm, setFoodForm] = useState(EmptyFoodForm);
  const [foodImageUrl, setFoodImageUrl] = useState("");
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

  const [templateForm, setTemplateForm] = useState(EmptyTemplateForm);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealEntryMode, setMealEntryMode] = useState("assistant");
  const [expandedItemKey, setExpandedItemKey] = useState(null);

  const [mealParseText, setMealParseText] = useState("");
  const [mealParseResult, setMealParseResult] = useState(null);
  const [isMealParsing, setIsMealParsing] = useState(false);
  const [aiMealNutrition, setAiMealNutrition] = useState(null);
  const [aiMealDescription, setAiMealDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mealFoodSearch, setMealFoodSearch] = useState("");
  const [mealFoodQuantities, setMealFoodQuantities] = useState({});
  const foodFormRef = useRef(null);
  const returnTarget = searchParams.get("return");
  const returnMeal = searchParams.get("meal");
  const returnLink = useMemo(() => {
    if (returnTarget !== "log") {
      return "";
    }
    const params = new URLSearchParams();
    if (returnMeal) {
      params.set("meal", returnMeal);
    }
    params.set("add", "1");
    return `/health/log?${params.toString()}`;
  }, [returnMeal, returnTarget]);

  const applyMealDraft = (draft) => {
    setActiveTab("meals");
    setMobileFilter("meals");
    setShowMealForm(true);
    setMealEntryMode(draft?.MealEntryMode || "assistant");
    setTemplateForm({ ...EmptyTemplateForm, ...(draft?.TemplateForm || {}) });
    setMealParseText(draft?.MealParseText || "");
    setMealParseResult(draft?.MealParseResult || null);
    setMealFoodSearch(draft?.MealFoodSearch || "");
    setMealFoodQuantities(draft?.MealFoodQuantities || {});
    setAiMealNutrition(draft?.AiMealNutrition || null);
    setAiMealDescription(draft?.AiMealDescription || "");
    if (draft?.EditingTemplateId) {
      setEditingTemplateId(draft.EditingTemplateId);
    }
  };

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
    return () => {
      ClearMealDraft();
    };
  }, []);

  useEffect(() => {
    if (!showMealForm) {
      return;
    }
    SaveMealDraft({
      TemplateForm: templateForm,
      MealEntryMode: mealEntryMode,
      MealParseText: mealParseText,
      MealParseResult: mealParseResult,
      MealFoodSearch: mealFoodSearch,
      MealFoodQuantities: mealFoodQuantities,
      AiMealNutrition: aiMealNutrition,
      AiMealDescription: aiMealDescription,
      EditingTemplateId: editingTemplateId
    });
  }, [
    showMealForm,
    templateForm,
    mealEntryMode,
    mealParseText,
    mealParseResult,
    mealFoodSearch,
    mealFoodQuantities,
    aiMealNutrition,
    aiMealDescription,
    editingTemplateId
  ]);

  useEffect(() => {
    const addMode = searchParams.get("add");
    const draft = LoadMealDraft();
    if (!addMode) {
      addHandledRef.current = null;
      if (draft && !showMealForm) {
        applyMealDraft(draft);
      }
      return;
    }
    if (addHandledRef.current === addMode) {
      return;
    }
    if (addMode === "meal" && draft) {
      applyMealDraft(draft);
      addHandledRef.current = addMode;
      return;
    }
    if (addMode === "food") {
      startAddFood();
    }
    if (addMode === "meal") {
      startAddMeal();
    }
    addHandledRef.current = addMode;
  }, [searchParams, showMealForm]);

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
    if (!sortMenuOpen && !filterMenuOpen) {
      return undefined;
    }
    const handleClick = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setSortMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setSortMenuOpen(false);
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [sortMenuOpen, filterMenuOpen]);


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

  const favouriteFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = foods.filter((food) => food.IsFavourite);
    if (!query) {
      return next;
    }
    return next.filter((food) => food.FoodName.toLowerCase().includes(query));
  }, [foods, search]);

  const favouriteTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = templates.filter((template) => template.Template.IsFavourite);
    if (!query) {
      return next;
    }
    return next.filter((template) =>
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

  const filteredMealTemplates = useMemo(() => {
    const query = mealFoodSearch.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      template.Template.TemplateName.toLowerCase().includes(query)
    );
  }, [templates, mealFoodSearch]);

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
    setFoodImageUrl(food.ImageUrl || "");
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
    setFoodImageUrl("");
    setLookupQuery("");
    setFoodEntryMode("lookup");
    setSearchResults({ openfoodfacts: [], ai: [], aiFallbackAvailable: false });
    setDataSourceUsed(null);
  };

  const clearAddModeParam = () => {
    if (!searchParams.get("add")) {
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("add");
      return next;
    }, { replace: true });
  };

  const startAddFood = () => {
    if (searchParams.get("add") !== "food") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("add", "food");
        return next;
      }, { replace: true });
    }
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
    clearAddModeParam();
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
    setFoodImageUrl("");
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

  const buildMealQuantityKey = (type, id) => `${type}:${id}`;
  const getMealQuantity = (type, id) =>
    mealFoodQuantities[buildMealQuantityKey(type, id)] ?? "1";

  const mergeTemplateItem = (items, nextItem) => {
    const matchIndex = items.findIndex((item) => item.FoodId === nextItem.FoodId);
    if (matchIndex === -1) {
      return [...items, nextItem];
    }
    const existing = items[matchIndex];
    const nextQuantity = Number(existing.Quantity || 0) + Number(nextItem.Quantity || 0);
    const merged = { ...existing, Quantity: String(nextQuantity) };
    if (
      existing.EntryUnit &&
      nextItem.EntryUnit &&
      existing.EntryUnit === nextItem.EntryUnit
    ) {
      const existingEntry = Number(existing.EntryQuantity || 0);
      const incomingEntry = Number(nextItem.EntryQuantity || 0);
      merged.EntryQuantity = existingEntry + incomingEntry;
    }
    return items.map((item, index) => (index === matchIndex ? merged : item));
  };

  const addTemplateItem = (food, quantityValue) => {
    if (!food?.FoodId) {
      setError("Select a food for the meal.");
      return;
    }
    const quantity = Number(quantityValue || getMealQuantity("food", food.FoodId));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    const nextItem = {
      FoodId: food.FoodId,
      MealType: DefaultMealType,
      Quantity: String(quantity),
      EntryQuantity: null,
      EntryUnit: null,
      EntryNotes: ""
    };
    setTemplateForm((prev) => ({
      ...prev,
      Items: mergeTemplateItem(prev.Items, nextItem)
    }));
    setError("");
    setMealFoodQuantities((prev) => ({
      ...prev,
      [buildMealQuantityKey("food", food.FoodId)]: "1"
    }));
  };

  const addMealTemplateItems = (template, quantityValue) => {
    if (!template?.Template?.MealTemplateId) {
      setError("Select a meal to add.");
      return;
    }
    const servings = resolveTemplateServings(template);
    const quantity = Number(
      quantityValue || getMealQuantity("meal", template.Template.MealTemplateId)
    );
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    const newItems = template.Items.map((item) => {
      const baseQuantity = Number(item.Quantity || 1);
      const baseEntryQuantity = item.EntryQuantity ?? baseQuantity;
      const perServingQuantity = baseQuantity / servings;
      const perServingEntryQuantity = baseEntryQuantity / servings;
      const entryUnit = item.EntryUnit || "serving";
      return {
        FoodId: item.FoodId,
        MealType: DefaultMealType,
        Quantity: String(perServingQuantity * quantity),
        EntryQuantity: perServingEntryQuantity * quantity,
        EntryUnit: entryUnit,
        EntryNotes: item.EntryNotes || ""
      };
    });
    setTemplateForm((prev) => ({
      ...prev,
      Items: newItems.reduce((items, item) => mergeTemplateItem(items, item), prev.Items)
    }));
    setError("");
    setMealFoodQuantities((prev) => ({
      ...prev,
      [buildMealQuantityKey("meal", template.Template.MealTemplateId)]: "1"
    }));
  };

  const updateMealFoodQuantity = (type, id, value) => {
    setMealFoodQuantities((prev) => ({
      ...prev,
      [buildMealQuantityKey(type, id)]: value
    }));
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
    const servingsValue = Number(templateForm.Servings || 1);
    if (!Number.isFinite(servingsValue) || servingsValue <= 0) {
      setError("Servings must be greater than zero.");
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
        Servings: servingsValue,
        IsFavourite: !!templateForm.IsFavourite,
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
      setTemplateForm({ ...EmptyTemplateForm });
      setEditingTemplateId(null);
      setShowMealForm(false);
      clearAddModeParam();
      ClearMealDraft();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save meal");
    }
  };

  const selectTemplate = (template) => {
    setEditingTemplateId(template.Template.MealTemplateId);
    setTemplateForm({
      TemplateName: template.Template.TemplateName,
      Servings: template.Template.Servings ? String(template.Template.Servings) : "1",
      IsFavourite: !!template.Template.IsFavourite,
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
        setTemplateForm({ ...EmptyTemplateForm });
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
        Servings: 1,
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
    const keepMealDraft = showMealForm;
    if (nextTab === "all") {
      setMobileFilter("all");
      closeFoodForm();
      if (!keepMealDraft) {
        setShowMealForm(false);
        clearAddModeParam();
        setEditingTemplateId(null);
        setTemplateForm({ ...EmptyTemplateForm });
        setMealEntryMode("assistant");
        setMealParseText("");
        setMealParseResult(null);
        setMealFoodSearch("");
        setMealFoodQuantities({});
        setAiMealNutrition(null);
        setAiMealDescription("");
      }
      return;
    }
    if (nextTab === "foods" || nextTab === "meals") {
      setMobileFilter(nextTab);
    }
    if (nextTab === "favourites") {
      setMobileFilter("favourites");
      closeFoodForm();
      if (!keepMealDraft) {
        setShowMealForm(false);
        clearAddModeParam();
        setEditingTemplateId(null);
        setTemplateForm({ ...EmptyTemplateForm });
        setMealEntryMode("assistant");
        setMealParseText("");
        setMealParseResult(null);
        setMealFoodSearch("");
        setMealFoodQuantities({});
        setAiMealNutrition(null);
        setAiMealDescription("");
      }
      return;
    }
    if (nextTab === "foods") {
      if (!keepMealDraft) {
        setShowMealForm(false);
        clearAddModeParam();
        setEditingTemplateId(null);
        setTemplateForm({ ...EmptyTemplateForm });
        setMealEntryMode("assistant");
        setMealParseText("");
        setMealParseResult(null);
        setMealFoodSearch("");
        setMealFoodQuantities({});
        setAiMealNutrition(null);
        setAiMealDescription("");
      }
    } else {
      closeFoodForm();
    }
  };

  const startAddMeal = () => {
    if (searchParams.get("add") !== "meal") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("add", "meal");
        return next;
      }, { replace: true });
    }
    handleTabChange("meals");
    setShowMealForm(true);
    setMealEntryMode("assistant");
    setEditingTemplateId(null);
    setTemplateForm({ ...EmptyTemplateForm });
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
    setTemplateForm({ ...EmptyTemplateForm });
    setMealParseResult(null);
    setMealParseText("");
    setMealEntryMode("assistant");
    setMealFoodSearch("");
    setMealFoodQuantities({});
    setAiMealNutrition(null);
    setAiMealDescription("");
    clearAddModeParam();
    ClearMealDraft();
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
  const showCombinedList =
    activeTab === "all" && showMealsInline && !showMealForm && (!showFoodForm || selectedFoodId);
  const showFavouritesList =
    activeTab === "favourites" && !showMealForm && (!showFoodForm || selectedFoodId);
  const showFoodsList =
    !showCombinedList &&
    !showFavouritesList &&
    activeTab === "foods" &&
    (!showFoodForm || selectedFoodId) &&
    !showMealForm;
  const showMealsList =
    !showCombinedList && !showFavouritesList && activeTab === "meals" && !showMealForm && !showFoodForm;

  const applyMobileFilter = (value) => {
    if (value === "meals") {
      handleTabChange("meals");
    } else if (value === "all") {
      handleTabChange("all");
    } else if (value === "favourites") {
      handleTabChange("favourites");
    } else {
      handleTabChange("foods");
    }
    setMobileFilter(value);
  };

  const resolveTemplateServings = (template) => {
    const servings = Number(template?.Template?.Servings || 1);
    return Number.isFinite(servings) && servings > 0 ? servings : 1;
  };

  const getMealTotals = (template) => {
    const totals = template.Items.reduce(
      (acc, item) => {
        const food = foodsById[item.FoodId];
        if (!food) {
          return acc;
        }
        const quantity = item.EntryQuantity || item.Quantity || 1;
        return {
          calories: acc.calories + (food.CaloriesPerServing || 0) * quantity,
          protein: acc.protein + (food.ProteinPerServing || 0) * quantity,
          carbs: acc.carbs + (food.CarbsPerServing || 0) * quantity,
          fat: acc.fat + (food.FatPerServing || 0) * quantity,
          fibre: acc.fibre + (food.FibrePerServing || 0) * quantity
        };
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fibre: 0
      }
    );
    const servings = resolveTemplateServings(template);
    return {
      calories: totals.calories / servings,
      protein: totals.protein / servings,
      carbs: totals.carbs / servings,
      fat: totals.fat / servings,
      fibre: totals.fibre / servings
    };
  };

  const addedMealCalories = useMemo(
    () =>
      templateForm.Items.reduce((sum, item) => {
        const food = foodsById[item.FoodId];
        if (!food) {
          return sum;
        }
        const quantity = Number(item.Quantity || 0);
        return sum + (food.CaloriesPerServing || 0) * quantity;
      }, 0),
    [templateForm.Items, foodsById]
  );

  const manualSelectItems = useMemo(() => {
    const foodItems = filteredMealFoods.map((food) => ({
      type: "food",
      id: food.FoodId,
      name: food.FoodName,
      calories: Number(food.CaloriesPerServing || 0),
      servingLabel: food.ServingDescription || `${food.ServingQuantity} ${food.ServingUnit}`,
      food
    }));
    const mealItems = filteredMealTemplates.map((template) => {
      const totals = getMealTotals(template);
      const servings = resolveTemplateServings(template);
      return {
        type: "meal",
        id: template.Template.MealTemplateId,
        name: template.Template.TemplateName,
        calories: Number(totals.calories || 0),
        servingLabel: servings > 1 ? `1 of ${FormatNumber(servings)} servings` : "1 serving",
        template,
        totals
      };
    });
    return [...foodItems, ...mealItems];
  }, [filteredMealFoods, filteredMealTemplates, foodsById]);

  const buildCombinedItems = (foodList, templateList) => {
    const items = [
      ...foodList.map((food) => ({
        type: "food",
        id: food.FoodId,
        name: food.FoodName,
        calories: Number(food.CaloriesPerServing || 0),
        protein: Number(food.ProteinPerServing || 0),
        carbs: Number(food.CarbsPerServing || 0),
        fat: Number(food.FatPerServing || 0),
        fibre: Number(food.FibrePerServing || 0),
        servingLabel: food.ServingDescription || `${food.ServingQuantity} ${food.ServingUnit}`,
        createdAt: food.CreatedAt,
        source: food.DataSource || "manual",
        addedBy:
          food.CreatedByName || (food.OwnerUserId ? `User ${food.OwnerUserId}` : "Unknown"),
        food
      })),
      ...templateList.map((template) => {
        const totals = getMealTotals(template);
        const servings = resolveTemplateServings(template);
        const sourceFood =
          template.Items.length === 1 ? foodsById[template.Items[0].FoodId] : null;
        const sourceLabel =
          sourceFood && (sourceFood.DataSource || "manual") === "ai" ? "ai" : "manual";
        return {
          type: "meal",
          id: template.Template.MealTemplateId,
          name: template.Template.TemplateName,
          calories: Number(totals.calories || 0),
          protein: Number(totals.protein || 0),
          carbs: Number(totals.carbs || 0),
          fat: Number(totals.fat || 0),
          fibre: Number(totals.fibre || 0),
          servingLabel: servings > 1 ? `1 of ${FormatNumber(servings)} servings` : "1 serving",
          createdAt: template.Template.CreatedAt,
          source: sourceLabel,
          itemsCount: template.Items.length,
          template
        };
      })
    ];
    const direction = sortDirection === "asc" ? 1 : -1;
    items.sort((a, b) => {
      if (sortBy === "name") {
        return direction * a.name.localeCompare(b.name);
      }
      if (sortBy === "calories") {
        return direction * (a.calories - b.calories);
      }
      if (sortBy === "protein") {
        return direction * ((a.protein || 0) - (b.protein || 0));
      }
      if (sortBy === "date") {
        const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return direction * (left - right);
      }
      return 0;
    });
    return items;
  };

  const combinedItems = showMealsInline ? buildCombinedItems(filteredFoods, filteredTemplates) : [];
  const favouriteItems = buildCombinedItems(favouriteFoods, favouriteTemplates);

  const toggleItemDetails = (type, id) => {
    const key = `${type}:${id}`;
    setExpandedItemKey((prev) => (prev === key ? null : key));
  };

  const renderSummaryList = (items) => (
    <ul className="health-food-summary-list">
      {items.map((item) => {
        const isFood = item.type === "food";
        const isExpanded = expandedItemKey === `${isFood ? "food" : "meal"}:${item.id}`;
        const toggleDetails = () => toggleItemDetails(isFood ? "food" : "meal", item.id);
        const servings = isFood ? 1 : resolveTemplateServings(item.template);
        return (
          <li key={`${item.type}-${item.id}`}>
            <div
              className="health-food-summary-row"
              role="button"
              tabIndex={0}
              onClick={toggleDetails}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  toggleDetails();
                }
              }}
            >
              <span
                className={`health-food-summary-icon ${isFood ? "is-food" : "is-meal"}${
                  isFood && item.food?.ImageUrl ? " has-image" : ""
                }`}
              >
                {isFood && item.food?.ImageUrl ? (
                  <img src={item.food.ImageUrl} alt={`${item.name} photo`} loading="lazy" />
                ) : (
                  <span aria-hidden="true">
                    <Icon name={isFood ? "food" : "meal"} className="icon" />
                  </span>
                )}
              </span>
              <div className="health-food-summary-main">
                <p>{item.name}</p>
              </div>
              <div className="health-food-summary-meta">
                <span className="health-food-summary-calories">
                  {FormatNumber(item.calories || 0)} kcal
                </span>
                <span className="health-food-summary-serving">{item.servingLabel}</span>
              </div>
              <button
                type="button"
                className="health-food-summary-toggle"
                aria-label={isExpanded ? "Hide details" : "Show details"}
                aria-expanded={isExpanded}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleDetails();
                }}
              >
                <Icon name={isExpanded ? "chevronUp" : "chevronDown"} className="icon" />
              </button>
            </div>
            {isExpanded ? (
              <div className="health-food-summary-details">
                {isFood ? (
                  <>
                    {item.food?.ImageUrl ? (
                      <div className="health-food-detail-image">
                        <img
                          src={item.food.ImageUrl}
                          alt={`${item.name} photo`}
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <div className="health-food-summary-detail">
                      <span>Protein</span>
                      <span>{FormatNumber(item.protein || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Carbs</span>
                      <span>{FormatNumber(item.carbs || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Fat</span>
                      <span>{FormatNumber(item.fat || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Fibre</span>
                      <span>{FormatNumber(item.fibre || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Source</span>
                      <span>{item.source}</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Added by</span>
                      <span>{item.addedBy}</span>
                    </div>
                    <div className="health-food-summary-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          handleTabChange("foods");
                          selectFood(item.food);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-danger"
                        onClick={() => deleteFood(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="health-food-summary-detail">
                      <span>Items</span>
                      <span>{item.itemsCount}</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Servings</span>
                      <span>{FormatNumber(servings)}</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Protein</span>
                      <span>{FormatNumber(item.protein || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Carbs</span>
                      <span>{FormatNumber(item.carbs || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Fat</span>
                      <span>{FormatNumber(item.fat || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Fibre</span>
                      <span>{FormatNumber(item.fibre || 0)} g</span>
                    </div>
                    <div className="health-food-summary-detail">
                      <span>Source</span>
                      <span>{item.source}</span>
                    </div>
                    <div className="health-food-summary-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          handleTabChange("meals");
                          selectTemplate(item.template);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-danger"
                        onClick={() => removeTemplate(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="health-foods">
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
            <div className="health-sort-control" ref={sortMenuRef}>
              <button
                type="button"
                className="health-sort-button"
                onClick={() => setSortMenuOpen((prev) => !prev)}
                aria-expanded={sortMenuOpen}
              >
                Sort: {sortBy === "name" ? "Name" : sortBy === "calories" ? "Calories" : sortBy === "protein" ? "Protein" : "Date"}
                <Icon name="chevronDown" className="icon" />
              </button>
              {sortMenuOpen ? (
                <div className="dropdown dropdown-right health-toolbar-dropdown">
                  {[
                    { key: "name", label: "Name" },
                    { key: "calories", label: "Calories" },
                    { key: "protein", label: "Protein" },
                    { key: "date", label: "Date" }
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setSortBy(option.key);
                        setSortMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setSortDirection("asc");
                      setSortMenuOpen(false);
                    }}
                  >
                    Ascending
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setSortDirection("desc");
                      setSortMenuOpen(false);
                    }}
                  >
                    Descending
                  </button>
                </div>
              ) : null}
            </div>
            <div className="health-filter-control" ref={filterMenuRef}>
              <button
                type="button"
                className={`button-secondary health-filter-button${
                  mobileFilter !== "all" ? " is-active" : ""
                }`}
                onClick={() => setFilterMenuOpen((prev) => !prev)}
                aria-expanded={filterMenuOpen}
              >
                <Icon name="filter" className="icon" />
                Filter
              </button>
              {filterMenuOpen ? (
                <div className="dropdown dropdown-right health-toolbar-dropdown">
                  {[
                    { key: "all", label: "All" },
                    { key: "foods", label: "Foods" },
                    { key: "meals", label: "Meals" },
                    { key: "favourites", label: "Favourites" },
                    { key: "seed", label: "Seed" },
                    { key: "ai", label: "AI" }
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        applyMobileFilter(option.key);
                        setFilterMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                ) : null}
            </div>
            <button type="button" className="primary-button" onClick={startAddFood}>
              Add food
            </button>
          </div>
        </div>
      ) : null}

      <div className="health-foods-tabs">
        <div className="module-nav" aria-label="Foods and meals">
          <button
            type="button"
            className={`module-link${activeTab === "all" ? " is-active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            All
          </button>
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
          <button
            type="button"
            className={`module-link${activeTab === "favourites" ? " is-active" : ""}`}
            onClick={() => handleTabChange("favourites")}
          >
            Favourites
          </button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {showCombinedList ? (
        <section className="module-panel">
          <header className="module-panel-header food-library-header">
            <div>
              <h3>Foods and meals</h3>
              <p>{combinedItems.length} items</p>
            </div>
            <div className="module-panel-actions">
              <input
                className="health-search"
                type="search"
                placeholder="Search foods or meals"
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
                onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                aria-label="Toggle sort direction"
              >
                <Icon name={sortDirection === "asc" ? "sortUp" : "sortDown"} className="icon" />
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setOnlyFavourites((prev) => !prev)}
              >
                {onlyFavourites ? "Favourites only" : "All foods"}
              </button>
            </div>
          </header>
          {status === "loading" ? (
            <p className="health-empty">Loading foods...</p>
          ) : null}
          {status !== "loading" && combinedItems.length === 0 ? (
            <p className="health-empty">No foods or meals yet.</p>
          ) : null}
          {combinedItems.length ? renderSummaryList(combinedItems) : null}
        </section>
      ) : null}

      {showFavouritesList ? (
        <section className="module-panel">
          <header className="module-panel-header food-library-header">
            <div>
              <h3>Favourites</h3>
              <p>{favouriteItems.length} items</p>
            </div>
            <div className="module-panel-actions">
              <input
                className="health-search"
                type="search"
                placeholder="Search favourites"
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
            </div>
          </header>
          {status === "loading" ? <p className="health-empty">Loading favourites...</p> : null}
          {status !== "loading" && favouriteItems.length === 0 ? (
            <p className="health-empty">No favourites yet.</p>
          ) : null}
          {favouriteItems.length ? renderSummaryList(favouriteItems) : null}
        </section>
      ) : null}

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
            <ul className="health-food-summary-list">
              {sortedFoods.map((food) => {
                const servingLabel =
                  food.ServingDescription || `${food.ServingQuantity} ${food.ServingUnit}`;
                const isExpanded = expandedItemKey === `food:${food.FoodId}`;
                return (
                  <li key={food.FoodId}>
                    <div
                      className="health-food-summary-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleItemDetails("food", food.FoodId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          toggleItemDetails("food", food.FoodId);
                        }
                      }}
                    >
                      <span
                        className={`health-food-summary-icon is-food${food.ImageUrl ? " has-image" : ""}`}
                      >
                        {food.ImageUrl ? (
                          <img src={food.ImageUrl} alt={`${food.FoodName} photo`} loading="lazy" />
                        ) : (
                          <span aria-hidden="true">
                            <Icon name="food" className="icon" />
                          </span>
                        )}
                      </span>
                      <div className="health-food-summary-main">
                        <p>{food.FoodName}</p>
                      </div>
                      <div className="health-food-summary-meta">
                        <span className="health-food-summary-calories">
                          {FormatNumber(food.CaloriesPerServing || 0)} kcal
                        </span>
                        <span className="health-food-summary-serving">{servingLabel}</span>
                      </div>
                      <button
                        type="button"
                        className="health-food-summary-toggle"
                        aria-label={isExpanded ? "Hide details" : "Show details"}
                        aria-expanded={isExpanded}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleItemDetails("food", food.FoodId);
                        }}
                      >
                        <Icon name={isExpanded ? "chevronUp" : "chevronDown"} className="icon" />
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="health-food-summary-details">
                        <div className="health-food-summary-detail">
                          <span>Protein</span>
                          <span>{FormatNumber(food.ProteinPerServing || 0)} g</span>
                        </div>
                        <div className="health-food-summary-detail">
                          <span>Carbs</span>
                          <span>{FormatNumber(food.CarbsPerServing || 0)} g</span>
                        </div>
                        <div className="health-food-summary-detail">
                          <span>Fat</span>
                          <span>{FormatNumber(food.FatPerServing || 0)} g</span>
                        </div>
                        <div className="health-food-summary-detail">
                          <span>Fibre</span>
                          <span>{FormatNumber(food.FibrePerServing || 0)} g</span>
                        </div>
                        <div className="health-food-summary-detail">
                          <span>Source</span>
                          <span>{food.DataSource || "manual"}</span>
                        </div>
                        <div className="health-food-summary-detail">
                          <span>Added by</span>
                          <span>
                            {food.CreatedByName ||
                              (food.OwnerUserId ? `User ${food.OwnerUserId}` : "Unknown")}
                          </span>
                        </div>
                        <div className="health-food-summary-actions">
                          <button type="button" className="button-secondary" onClick={() => selectFood(food)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button-secondary button-danger"
                            onClick={() => deleteFood(food.FoodId)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {activeTab === "foods" && showFoodForm ? (
        <section className="module-panel" ref={foodFormRef}>
          <header className="module-panel-header">
            <div className="health-panel-title-block">
              <div className="health-panel-title-row">
                {returnLink ? (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => navigate(returnLink)}
                    aria-label="Back to log"
                  >
                    <Icon name="chevronLeft" className="icon" />
                  </button>
                ) : null}
                <h3>{selectedFoodId ? "Edit food" : "Add food"}</h3>
              </div>
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
                  <FoodEditEssentialsSection
                    foodForm={foodForm}
                    onFoodChange={onFoodChange}
                    imageUrl={foodImageUrl}
                  />
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
          data-health-modal-label="Lookup results"
        >
          <div className="modal health-edit-modal" onClick={(event) => event.stopPropagation()}>
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
          {filteredTemplates.length === 0 ? <p className="health-empty">No meals yet.</p> : null}
          <ul className="health-food-summary-list health-template-summary-list">
            {filteredTemplates.map((template) => {
              const totals = getMealTotals(template);
              const servings = resolveTemplateServings(template);
              const sourceFood =
                template.Items.length === 1 ? foodsById[template.Items[0].FoodId] : null;
              const sourceLabel =
                sourceFood && (sourceFood.DataSource || "manual") === "ai" ? "ai" : "manual";
              const isExpanded =
                expandedItemKey === `meal:${template.Template.MealTemplateId}`;
              return (
                <li key={template.Template.MealTemplateId}>
                  <div
                    className="health-food-summary-row"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      toggleItemDetails("meal", template.Template.MealTemplateId)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        toggleItemDetails("meal", template.Template.MealTemplateId);
                      }
                    }}
                  >
                    <span className="health-food-summary-icon is-meal" aria-hidden="true">
                      <Icon name="meal" className="icon" />
                    </span>
                    <div className="health-food-summary-main">
                      <p>{template.Template.TemplateName}</p>
                    </div>
                    <div className="health-food-summary-meta">
                      <span className="health-food-summary-calories">
                        {FormatNumber(totals.calories || 0)} kcal
                      </span>
                      <span className="health-food-summary-serving">
                        {servings > 1
                          ? `1 of ${FormatNumber(servings)} servings`
                          : "1 serving"}
                      </span>
                    </div>
                      <button
                        type="button"
                        className="health-food-summary-toggle"
                      aria-label={isExpanded ? "Hide details" : "Show details"}
                      aria-expanded={isExpanded}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleItemDetails("meal", template.Template.MealTemplateId);
                      }}
                    >
                      <Icon name={isExpanded ? "chevronUp" : "chevronDown"} className="icon" />
                    </button>
                  </div>
                  {isExpanded ? (
                    <div className="health-food-summary-details">
                      <div className="health-food-summary-detail">
                        <span>Items</span>
                        <span>{template.Items.length}</span>
                      </div>
                      <div className="health-food-summary-detail">
                        <span>Servings</span>
                        <span>{FormatNumber(servings)}</span>
                      </div>
                      <div className="health-food-summary-detail">
                        <span>Protein</span>
                        <span>{FormatNumber(totals.protein || 0)} g</span>
                      </div>
                      <div className="health-food-summary-detail">
                        <span>Carbs</span>
                        <span>{FormatNumber(totals.carbs || 0)} g</span>
                      </div>
                      <div className="health-food-summary-detail">
                        <span>Fat</span>
                        <span>{FormatNumber(totals.fat || 0)} g</span>
                      </div>
                      <div className="health-food-summary-detail">
                        <span>Fibre</span>
                        <span>{FormatNumber(totals.fibre || 0)} g</span>
                      </div>
                      <div className="health-food-summary-detail">
                        <span>Source</span>
                        <span>{sourceLabel}</span>
                      </div>
                      <div className="health-food-summary-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => selectTemplate(template)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-secondary button-danger"
                          onClick={() => removeTemplate(template.Template.MealTemplateId)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
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
            {returnLink ? (
              <button
                type="button"
                className="icon-button"
                onClick={() => navigate(returnLink)}
                aria-label="Back to log"
              >
                <Icon name="chevronLeft" className="icon" />
              </button>
            ) : null}
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
              <div className="health-form-row health-form-row--compact">
                <label className="health-form-inline">
                  <span>Meal name</span>
                  <input
                    value={templateForm.TemplateName}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({ ...prev, TemplateName: event.target.value }))
                    }
                  />
                </label>
                <label className="health-form-inline health-form-inline--compact">
                  <span>Servings</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={templateForm.Servings}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        Servings: event.target.value
                      }))
                    }
                  />
                </label>
                {editingTemplateId ? (
                  <div className="health-toggle-inline health-toggle-inline--meal">
                    <input
                      id="meal-favourite"
                      type="checkbox"
                      checked={templateForm.IsFavourite}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          IsFavourite: event.target.checked
                        }))
                      }
                    />
                    <label htmlFor="meal-favourite">Favourite</label>
                  </div>
                ) : null}
              </div>
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
                  <h4 className="health-template-added-header">
                    Added foods
                    {templateForm.Items.length ? (
                      <span className="health-template-added-kcal">
                        {FormatNumber(addedMealCalories)} kcal
                      </span>
                    ) : null}
                  </h4>
                  {templateForm.Items.length ? (
                    <ul className="health-manual-select-list health-manual-select-list--added">
                      {templateForm.Items.map((item, index) => {
                        const food = foodsById[item.FoodId];
                        const servingLabel =
                          food?.ServingDescription ||
                          (food ? `${food.ServingQuantity} ${food.ServingUnit}` : "");
                        return (
                          <li key={`${item.FoodId}-${index}`}>
                            <div className="health-manual-select-row">
                              <span className="health-food-summary-icon is-food" aria-hidden="true">
                                <Icon name="food" className="icon" />
                              </span>
                              <div className="health-manual-select-main">
                                <p>{food?.FoodName || "Food"}</p>
                                <div className="health-manual-select-meta">
                                  <span>{FormatNumber(food?.CaloriesPerServing || 0)} kcal</span>
                                  <span>{servingLabel}</span>
                                </div>
                              </div>
                              <div className="health-manual-select-actions">
                                <span className="health-manual-select-qty-label">
                                  x{FormatNumber(item.Quantity || 1)}
                                </span>
                                <button
                                  type="button"
                                  className="button-secondary-pill health-manual-remove"
                                  onClick={() => removeTemplateItem(index)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
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
                    <input
                      value={mealFoodSearch}
                      onChange={(event) => setMealFoodSearch(event.target.value)}
                      placeholder="Search foods or meals"
                    />
                  </label>
                  {manualSelectItems.length ? (
                    <ul className="health-manual-select-list">
                      {manualSelectItems.map((item) => (
                        <li key={`${item.type}-${item.id}`}>
                          <div className="health-manual-select-row">
                            <span
                              className={`health-food-summary-icon ${
                                item.type === "meal" ? "is-meal" : "is-food"
                              }`}
                              aria-hidden="true"
                            >
                              <Icon name={item.type === "meal" ? "meal" : "food"} className="icon" />
                            </span>
                            <div className="health-manual-select-main">
                              <p>{item.name}</p>
                              <div className="health-manual-select-meta">
                                <span>{FormatNumber(item.calories || 0)} kcal</span>
                                <span>{item.servingLabel}</span>
                              </div>
                            </div>
                            <div className="health-manual-select-actions">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                className="health-manual-select-qty"
                                value={getMealQuantity(item.type, item.id)}
                                onChange={(event) =>
                                  updateMealFoodQuantity(item.type, item.id, event.target.value)
                                }
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`${item.name} quantity`}
                              />
                              <button
                                type="button"
                                className="button-secondary health-manual-select-add"
                                onClick={() => {
                                  if (item.type === "meal") {
                                    addMealTemplateItems(item.template, getMealQuantity(item.type, item.id));
                                  } else {
                                    addTemplateItem(item.food, getMealQuantity(item.type, item.id));
                                  }
                                }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="health-empty">No foods or meals match your search.</p>
                  )}
                </div>
              ) : null}
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
