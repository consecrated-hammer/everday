import { RequestJson, RequestWithAuth } from "./apiClient.js";

const Health = "/health";

export const FetchHealthSettings = () => RequestJson(`${Health}/settings`);
export const UpdateHealthSettings = (payload) =>
  RequestJson(`${Health}/settings`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
export const FetchHealthProfile = () => RequestJson(`${Health}/settings/profile`);
export const UpdateHealthProfile = (payload) =>
  RequestJson(`${Health}/settings/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
export const GetAiRecommendations = () =>
  RequestJson(`${Health}/settings/ai-recommendations`, {
    method: "POST"
  });
export const FetchRecommendationHistory = () =>
  RequestJson(`${Health}/settings/ai-recommendations/history`);

export const FetchDailyLog = (date) => RequestJson(`${Health}/daily-logs/${date}`);
export const CreateDailyLog = (payload) =>
  RequestJson(`${Health}/daily-logs`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const UpdateDailySteps = (date, payload) =>
  RequestJson(`${Health}/daily-logs/${date}/steps`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
export const CreateMealEntry = (payload) =>
  RequestJson(`${Health}/daily-logs/meal-entries`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const ShareMealEntry = (payload) =>
  RequestJson(`${Health}/daily-logs/meal-entries/share`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const UpdateMealEntry = (mealEntryId, payload) =>
  RequestJson(`${Health}/daily-logs/meal-entries/${mealEntryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
export const DeleteMealEntry = async (mealEntryId) => {
  const response = await RequestWithAuth(`${Health}/daily-logs/meal-entries/${mealEntryId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchFoods = () => RequestJson(`${Health}/foods`);
export const CreateFood = (payload) =>
  RequestJson(`${Health}/foods`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const UpdateFood = (foodId, payload) =>
  RequestJson(`${Health}/foods/${foodId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
export const DeleteFood = async (foodId) => {
  const response = await RequestWithAuth(`${Health}/foods/${foodId}`, { method: "DELETE" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};

export const FetchPortionOptions = (foodId) =>
  RequestJson(`${Health}/portion-options${foodId ? `?food_id=${encodeURIComponent(foodId)}` : ""}`);

export const CreatePortionOption = (payload) =>
  RequestJson(`${Health}/portion-options`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const FetchMealTemplates = () => RequestJson(`${Health}/meal-templates`);
export const CreateMealTemplate = (payload) =>
  RequestJson(`${Health}/meal-templates`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const UpdateMealTemplate = (templateId, payload) =>
  RequestJson(`${Health}/meal-templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
export const DeleteMealTemplate = async (templateId) => {
  const response = await RequestWithAuth(`${Health}/meal-templates/${templateId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
};
export const ApplyMealTemplate = (templateId, payload) =>
  RequestJson(`${Health}/meal-templates/${templateId}/apply`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const ParseMealTemplateText = (payload) =>
  RequestJson(`${Health}/meal-templates/ai-parse`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const FetchWeeklySummary = (startDate) =>
  RequestJson(`${Health}/summary/weekly?start_date=${encodeURIComponent(startDate)}`);

export const FetchAiSuggestions = (logDate) =>
  RequestJson(`${Health}/suggestions/ai?LogDate=${encodeURIComponent(logDate)}`);

export const LookupFoodText = (payload) =>
  RequestJson(`${Health}/food-lookup/text`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const LookupFoodTextOptions = (payload) =>
  RequestJson(`${Health}/food-lookup/text-options`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const LookupFoodImage = (payload) =>
  RequestJson(`${Health}/food-lookup/image`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const ScanFoodImage = (payload) =>
  RequestJson(`${Health}/food-lookup/scan`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const LookupFoodBarcode = (payload) =>
  RequestJson(`${Health}/food-lookup/barcode`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const GetFoodSuggestions = (query, limit = 10) =>
  RequestJson(
    `${Health}/food-lookup/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
  );
export const MultiSourceSearch = (payload) =>
  RequestJson(`${Health}/food-lookup/multi-source/search`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const FetchScheduleSlots = () => RequestJson(`${Health}/schedule`);
export const UpdateScheduleSlots = (payload) =>
  RequestJson(`${Health}/schedule`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
