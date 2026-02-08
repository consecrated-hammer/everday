import Foundation

enum HealthApi {
    static func fetchSettings() async throws -> HealthUserSettings {
        try await ApiClient.shared.request(path: "health/settings", requiresAuth: true)
    }

    static func fetchProfile() async throws -> HealthUserProfile {
        try await ApiClient.shared.request(path: "health/settings/profile", requiresAuth: true)
    }

    static func updateProfile(_ request: HealthUpdateProfileRequest) async throws -> HealthUserProfile {
        try await ApiClient.shared.request(path: "health/settings/profile", method: "PATCH", body: request, requiresAuth: true)
    }

    static func updateSettings(_ request: HealthUpdateSettingsRequest) async throws -> HealthUserSettings {
        try await ApiClient.shared.request(path: "health/settings", method: "PUT", body: request, requiresAuth: true)
    }

    static func applyGoal(_ request: GoalRecommendationRequest) async throws -> NutritionRecommendationResponse {
        try await ApiClient.shared.request(path: "health/settings/ai-recommendations", method: "POST", body: request, requiresAuth: true)
    }

    static func fetchRecommendations() async throws -> NutritionRecommendationResponse {
        try await ApiClient.shared.request(path: "health/settings/ai-recommendations", method: "POST", requiresAuth: true)
    }

    static func fetchDailyLog(date: String) async throws -> HealthDailyLogResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/\(date)", requiresAuth: true)
    }

    static func createDailyLog(_ request: HealthCreateDailyLogRequest) async throws -> HealthDailyLogCreateResponse {
        try await ApiClient.shared.request(path: "health/daily-logs", method: "POST", body: request, requiresAuth: true)
    }

    static func updateDailySteps(date: String, request: HealthStepUpdateRequest) async throws -> HealthDailyLogCreateResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/\(date)/steps", method: "PATCH", body: request, requiresAuth: true)
    }

    static func createMealEntry(_ request: HealthCreateMealEntryRequest) async throws -> HealthMealEntryResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/meal-entries", method: "POST", body: request, requiresAuth: true)
    }

    static func shareMealEntry(_ request: HealthShareMealEntryRequest) async throws -> HealthMealEntryResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/meal-entries/share", method: "POST", body: request, requiresAuth: true)
    }

    static func updateMealEntry(mealEntryId: String, request: HealthUpdateMealEntryRequest) async throws -> HealthMealEntryResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/meal-entries/\(mealEntryId)", method: "PATCH", body: request, requiresAuth: true)
    }

    static func deleteMealEntry(mealEntryId: String) async throws {
        try await ApiClient.shared.requestVoid(path: "health/daily-logs/meal-entries/\(mealEntryId)", method: "DELETE", requiresAuth: true)
    }

    static func fetchFoods() async throws -> [HealthFood] {
        try await ApiClient.shared.request(path: "health/foods", requiresAuth: true)
    }

    static func createFood(_ request: HealthCreateFoodRequest) async throws -> HealthFood {
        try await ApiClient.shared.request(path: "health/foods", method: "POST", body: request, requiresAuth: true)
    }

    static func updateFood(foodId: String, request: HealthUpdateFoodRequest) async throws -> HealthFood {
        try await ApiClient.shared.request(path: "health/foods/\(foodId)", method: "PATCH", body: request, requiresAuth: true)
    }

    static func deleteFood(foodId: String) async throws {
        try await ApiClient.shared.requestVoid(path: "health/foods/\(foodId)", method: "DELETE", requiresAuth: true)
    }

    static func fetchPortionOptions(foodId: String?) async throws -> HealthPortionOptionsResponse {
        let query = foodId.map { "?food_id=\($0)" } ?? ""
        return try await ApiClient.shared.request(path: "health/portion-options\(query)", requiresAuth: true)
    }

    static func createPortionOption(_ request: HealthCreatePortionOptionRequest) async throws -> HealthPortionOptionsResponse {
        try await ApiClient.shared.request(path: "health/portion-options", method: "POST", body: request, requiresAuth: true)
    }

    static func fetchMealTemplates() async throws -> HealthMealTemplateListResponse {
        try await ApiClient.shared.request(path: "health/meal-templates", requiresAuth: true)
    }

    static func createMealTemplate(_ request: HealthCreateMealTemplateRequest) async throws -> HealthMealTemplateWithItems {
        try await ApiClient.shared.request(path: "health/meal-templates", method: "POST", body: request, requiresAuth: true)
    }

    static func updateMealTemplate(templateId: String, request: HealthUpdateMealTemplateRequest) async throws -> HealthMealTemplateWithItems {
        try await ApiClient.shared.request(path: "health/meal-templates/\(templateId)", method: "PATCH", body: request, requiresAuth: true)
    }

    static func deleteMealTemplate(templateId: String) async throws {
        try await ApiClient.shared.requestVoid(path: "health/meal-templates/\(templateId)", method: "DELETE", requiresAuth: true)
    }

    static func applyMealTemplate(templateId: String, request: HealthApplyMealTemplateRequest) async throws -> HealthApplyMealTemplateResponse {
        try await ApiClient.shared.request(path: "health/meal-templates/\(templateId)/apply", method: "POST", body: request, requiresAuth: true)
    }

    static func parseMealTemplateText(_ request: HealthMealTextParseRequest) async throws -> HealthMealTextParseResponse {
        try await ApiClient.shared.request(path: "health/meal-templates/ai-parse", method: "POST", body: request, requiresAuth: true)
    }

    static func fetchWeeklySummary(startDate: String) async throws -> HealthWeeklySummary {
        try await ApiClient.shared.request(path: "health/summary/weekly?start_date=\(startDate)", requiresAuth: true)
    }

    static func fetchStepsHistory(startDate: String, endDate: String) async throws -> HealthStepsHistoryResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/steps/history?start_date=\(startDate)&end_date=\(endDate)", requiresAuth: true)
    }

    static func fetchWeightHistory(startDate: String, endDate: String) async throws -> HealthWeightHistoryResponse {
        try await ApiClient.shared.request(path: "health/daily-logs/weights/history?start_date=\(startDate)&end_date=\(endDate)", requiresAuth: true)
    }

    static func fetchAiSuggestions(logDate: String) async throws -> HealthSuggestionsResponse {
        try await ApiClient.shared.request(path: "health/suggestions/ai?LogDate=\(logDate)", requiresAuth: true)
    }

    static func lookupFoodText(_ request: HealthFoodLookupTextRequest) async throws -> HealthTextLookupResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/text", method: "POST", body: request, requiresAuth: true)
    }

    static func lookupFoodTextOptions(_ request: HealthFoodLookupTextRequest) async throws -> HealthTextLookupOptionsResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/text-options", method: "POST", body: request, requiresAuth: true)
    }

    static func lookupFoodImage(_ request: HealthFoodLookupImageRequest) async throws -> HealthImageLookupResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/image", method: "POST", body: request, requiresAuth: true)
    }

    static func scanFoodImage(_ request: HealthImageScanRequest) async throws -> HealthImageScanResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/scan", method: "POST", body: request, requiresAuth: true)
    }

    static func lookupFoodBarcode(_ request: HealthFoodLookupBarcodeRequest) async throws -> HealthBarcodeLookupResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/barcode", method: "POST", body: request, requiresAuth: true)
    }

    static func getFoodSuggestions(query: String, limit: Int = 10) async throws -> HealthFoodSuggestionsResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/suggestions?q=\(query)&limit=\(limit)", requiresAuth: true)
    }

    static func multiSourceSearch(_ request: HealthMultiSourceSearchRequest) async throws -> HealthMultiSourceSearchResponse {
        try await ApiClient.shared.request(path: "health/food-lookup/multi-source/search", method: "POST", body: request, requiresAuth: true)
    }

    static func fetchScheduleSlots() async throws -> HealthScheduleSlotsResponse {
        try await ApiClient.shared.request(path: "health/schedule", requiresAuth: true)
    }

    static func updateScheduleSlots(_ request: HealthScheduleSlotsUpdateRequest) async throws -> HealthScheduleSlotsResponse {
        try await ApiClient.shared.request(path: "health/schedule", method: "PUT", body: request, requiresAuth: true)
    }
}

struct HealthApplyMealTemplateResponse: Decodable {
    let CreatedCount: Int
}

struct NutritionRecommendationResponse: Decodable {
    let Explanation: String
    let DailyCalorieTarget: Int
    let ProteinTargetMin: Double
    let ProteinTargetMax: Double
    let FibreTarget: Double?
    let CarbsTarget: Double?
    let FatTarget: Double?
    let SaturatedFatTarget: Double?
    let SugarTarget: Double?
    let SodiumTarget: Double?
    let ModelUsed: String?
    let Goal: HealthGoalSummary?
}
