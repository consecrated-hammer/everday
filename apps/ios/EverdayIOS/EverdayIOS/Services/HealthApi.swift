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
