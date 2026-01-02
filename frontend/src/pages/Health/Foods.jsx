import { useEffect, useMemo, useState } from "react";

import {
  CreateFood,
  CreateMealTemplate,
  DeleteFood,
  DeleteMealTemplate,
  FetchFoods,
  FetchMealTemplates,
  LookupFoodText,
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

const EmptyTemplateItem = {
  FoodId: "",
  MealType: "Breakfast",
  Quantity: "1",
  EntryQuantity: "",
  EntryUnit: "",
  EntryNotes: ""
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

const Foods = () => {
  const [foods, setFoods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [foodForm, setFoodForm] = useState(EmptyFoodForm);
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [aiOptions, setAiOptions] = useState([]);
  const [mealParseText, setMealParseText] = useState("");
  const [mealParseResult, setMealParseResult] = useState(null);

  const [templateForm, setTemplateForm] = useState({
    TemplateName: "",
    Items: []
  });
  const [templateItem, setTemplateItem] = useState(EmptyTemplateItem);
  const [editingTemplateId, setEditingTemplateId] = useState(null);

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

  const filteredFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return foods;
    return foods.filter((food) => food.FoodName.toLowerCase().includes(query));
  }, [foods, search]);

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
  };

  const resetFoodForm = () => {
    setSelectedFoodId(null);
    setFoodForm(EmptyFoodForm);
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
      resetFoodForm();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save food");
    }
  };

  const deleteFood = async (foodId) => {
    try {
      setStatus("saving");
      setError("");
      await DeleteFood(foodId);
      await loadData();
      if (foodId === selectedFoodId) {
        resetFoodForm();
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete food");
    }
  };

  const runLookup = async () => {
    if (!lookupQuery.trim()) return;
    try {
      setStatus("loading");
      setError("");
      const result = await MultiSourceSearch({ Query: lookupQuery.trim() });
      setLookupResults(result.Openfoodfacts || []);
      if ((result.Openfoodfacts || []).length === 0) {
        const ai = await LookupFoodTextOptions({ Query: lookupQuery.trim() });
        setAiOptions(ai.Results || []);
      } else {
        setAiOptions([]);
      }
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Lookup failed");
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
      FibrePerServing: String(result.FibrePerServing || ""),
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
  };

  const runAiSingleLookup = async () => {
    if (!lookupQuery.trim()) return;
    try {
      setStatus("loading");
      setError("");
      const result = await LookupFoodText({ Query: lookupQuery.trim() });
      applyLookupResult(result.Result, "ai");
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "AI lookup failed");
    }
  };

  const onTemplateItemChange = (event) => {
    const { name, value } = event.target;
    setTemplateItem((prev) => ({ ...prev, [name]: value }));
  };

  const addTemplateItem = () => {
    if (!templateItem.FoodId) {
      setError("Select a food for the meal.");
      return;
    }
    setTemplateForm((prev) => ({
      ...prev,
      Items: [...prev.Items, { ...templateItem }]
    }));
    setTemplateItem(EmptyTemplateItem);
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
      const payload = {
        TemplateName: templateForm.TemplateName,
        Items: templateForm.Items.map((item, index) => ({
          FoodId: item.FoodId,
          MealType: item.MealType,
          Quantity: Number(item.Quantity || 1),
          EntryQuantity: item.EntryQuantity ? Number(item.EntryQuantity) : null,
          EntryUnit: item.EntryUnit || null,
          EntryNotes: item.EntryNotes || null,
          SortOrder: index
        }))
      };

      if (editingTemplateId) {
        await UpdateMealTemplate(editingTemplateId, payload);
      } else {
        await CreateMealTemplate(payload);
      }
      await loadData();
      setTemplateForm({ TemplateName: "", Items: [] });
      setEditingTemplateId(null);
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
  };

  const removeTemplate = async (templateId) => {
    try {
      setStatus("saving");
      setError("");
      await DeleteMealTemplate(templateId);
      await loadData();
      if (editingTemplateId === templateId) {
        setEditingTemplateId(null);
        setTemplateForm({ TemplateName: "", Items: [] });
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete meal");
    }
  };

  const runMealParse = async () => {
    if (!mealParseText.trim()) return;
    try {
      setStatus("loading");
      setError("");
      const parsed = await ParseMealTemplateText({ Text: mealParseText.trim() });
      setMealParseResult(parsed);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to parse meal");
    }
  };

  const createMealFromParse = async () => {
    if (!mealParseResult) return;
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

  return (
    <div className="health-foods">
      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h2>Food library</h2>
            <p>Search, add, and refine your food list.</p>
          </div>
          <input
            className="health-search"
            type="search"
            placeholder="Search foods"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="health-foods-grid">
          <div className="health-food-list">
            {filteredFoods.map((food) => (
              <button
                key={food.FoodId}
                type="button"
                className={`health-food-item${food.FoodId === selectedFoodId ? " is-active" : ""}`}
                onClick={() => selectFood(food)}
              >
                <div>
                  <p>{food.FoodName}</p>
                  <span>{food.ServingDescription}</span>
                </div>
                <span>{food.CaloriesPerServing} kcal</span>
              </button>
            ))}
          </div>

          <div className="health-food-editor">
            <form className="health-food-form" onSubmit={saveFood}>
              <div className="health-form-row">
                <label>
                  Food name
                  <input name="FoodName" value={foodForm.FoodName} onChange={onFoodChange} />
                </label>
                <label>
                  Serving qty
                  <input
                    name="ServingQuantity"
                    type="number"
                    step="0.1"
                    value={foodForm.ServingQuantity}
                    onChange={onFoodChange}
                  />
                </label>
                <label>
                  Serving unit
                  <input name="ServingUnit" value={foodForm.ServingUnit} onChange={onFoodChange} />
                </label>
              </div>
              <div className="health-form-row">
                <label>
                  Calories
                  <input
                    name="CaloriesPerServing"
                    type="number"
                    value={foodForm.CaloriesPerServing}
                    onChange={onFoodChange}
                  />
                </label>
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
                  Carbs (g)
                  <input
                    name="CarbsPerServing"
                    type="number"
                    step="0.1"
                    value={foodForm.CarbsPerServing}
                    onChange={onFoodChange}
                  />
                </label>
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
                  Sugar (g)
                  <input
                    name="SugarPerServing"
                    type="number"
                    step="0.1"
                    value={foodForm.SugarPerServing}
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
              <div className="health-form-row">
                <label className="health-checkbox">
                  <input
                    type="checkbox"
                    name="IsFavourite"
                    checked={foodForm.IsFavourite}
                    onChange={onFoodChange}
                  />
                  Favourite
                </label>
              </div>
              <div className="form-actions">
                <button type="submit">{selectedFoodId ? "Update" : "Add"} food</button>
                <button type="button" className="button-secondary" onClick={resetFoodForm}>
                  Reset
                </button>
                {selectedFoodId ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => deleteFood(selectedFoodId)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>Lookup assistant</h3>
            <p>Pull nutrition data before saving.</p>
          </div>
        </header>
        <div className="health-lookup">
          <input
            type="text"
            value={lookupQuery}
            onChange={(event) => setLookupQuery(event.target.value)}
            placeholder="Search food"
          />
          <div className="health-lookup-actions">
            <button type="button" onClick={runLookup}>
              Search sources
            </button>
            <button type="button" className="button-secondary" onClick={runAiSingleLookup}>
              AI single lookup
            </button>
          </div>
        </div>
        <div className="health-lookup-results">
          {lookupResults.map((result) => (
            <button
              key={result.FoodName}
              type="button"
              onClick={() => applyLookupResult(result, "openfoodfacts")}
            >
              {result.FoodName}
            </button>
          ))}
          {aiOptions.map((result) => (
            <button
              key={`${result.FoodName}-${result.ServingUnit}`}
              type="button"
              onClick={() => applyLookupResult(result, "ai")}
            >
              {result.FoodName}
            </button>
          ))}
        </div>
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>Saved meals</h3>
            <p>Save go-to meals for quick logging.</p>
          </div>
        </header>
        <div className="health-templates">
          <div className="health-template-list">
            {templates.map((template) => (
              <div key={template.Template.MealTemplateId} className="health-template-card">
                <button type="button" onClick={() => selectTemplate(template)}>
                  <h4>{template.Template.TemplateName}</h4>
                  <p>{template.Items.length} items</p>
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeTemplate(template.Template.MealTemplateId)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
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
            <div className="health-template-item">
              <label>
                Food
                <select
                  name="FoodId"
                  value={templateItem.FoodId}
                  onChange={onTemplateItemChange}
                >
                  <option value="">Select food</option>
                  {foods.map((food) => (
                    <option key={food.FoodId} value={food.FoodId}>
                      {food.FoodName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Meal type
                <select name="MealType" value={templateItem.MealType} onChange={onTemplateItemChange}>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Snack1">Snack 1</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Snack2">Snack 2</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack3">Snack 3</option>
                </select>
              </label>
              <label>
                Qty
                <input
                  name="Quantity"
                  type="number"
                  step="0.1"
                  value={templateItem.Quantity}
                  onChange={onTemplateItemChange}
                />
              </label>
              <label>
                Entry qty
                <input
                  name="EntryQuantity"
                  type="number"
                  step="0.1"
                  value={templateItem.EntryQuantity}
                  onChange={onTemplateItemChange}
                />
              </label>
              <label>
                Unit
                <input
                  name="EntryUnit"
                  value={templateItem.EntryUnit}
                  onChange={onTemplateItemChange}
                />
              </label>
              <label>
                Notes
                <input
                  name="EntryNotes"
                  value={templateItem.EntryNotes}
                  onChange={onTemplateItemChange}
                />
              </label>
              <button type="button" onClick={addTemplateItem}>
                Add item
              </button>
            </div>
            <div className="health-template-items">
              {templateForm.Items.map((item, index) => (
                <div key={`${item.FoodId}-${index}`}>
                  <span>{item.MealType}</span>
                  <span>
                    {foods.find((food) => food.FoodId === item.FoodId)?.FoodName || "Food"}
                  </span>
                  <span>{item.Quantity} serving</span>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" onClick={saveTemplate}>
                {editingTemplateId ? "Update" : "Save"} meal
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="module-panel">
        <header className="module-panel-header">
          <div>
            <h3>AI meal parse</h3>
            <p>Turn a free-text order into a saved meal.</p>
          </div>
        </header>
        <div className="health-ai-parse">
          <textarea
            value={mealParseText}
            onChange={(event) => setMealParseText(event.target.value)}
            placeholder="e.g. Chicken schnitzel, chips, side salad"
          />
          <div className="health-lookup-actions">
            <button type="button" onClick={runMealParse}>
              Parse meal
            </button>
            {mealParseResult ? (
              <button type="button" className="button-secondary" onClick={createMealFromParse}>
                Save as meal
              </button>
            ) : null}
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
        </div>
      </section>
    </div>
  );
};

export default Foods;
