import Foundation

struct HealthUserProfile: Decodable {
    let UserId: Int
    let Username: String
    let FirstName: String?
    let LastName: String?
    let Email: String?
    let BirthDate: String?
    let HeightCm: Int?
    let WeightKg: Double?
    let ActivityLevel: String?
    let IsAdmin: Bool?
}

struct HealthFoodReminderSlot: Decodable {
    let Enabled: Bool?
    let Time: String?
}

struct HealthTargets: Decodable {
    let DailyCalorieTarget: Int?
    let ProteinTargetMin: Double?
    let ProteinTargetMax: Double?
    let StepKcalFactor: Double?
    let StepTarget: Int?
    let FibreTarget: Double?
    let CarbsTarget: Double?
    let FatTarget: Double?
    let SaturatedFatTarget: Double?
    let SugarTarget: Double?
    let SodiumTarget: Double?
    let ShowProteinOnToday: Bool?
    let ShowStepsOnToday: Bool?
    let ShowFibreOnToday: Bool?
    let ShowCarbsOnToday: Bool?
    let ShowFatOnToday: Bool?
    let ShowSaturatedFatOnToday: Bool?
    let ShowSugarOnToday: Bool?
    let ShowSodiumOnToday: Bool?
}

struct HealthUserSettings: Decodable {
    let Targets: HealthTargets
    let AutoTuneTargetsWeekly: Bool?
    let LastAutoTuneAt: String?
    let Goal: HealthGoalSummary?
    let ShowWeightChartOnToday: Bool?
    let ShowStepsChartOnToday: Bool?
    let FoodRemindersEnabled: Bool?
    let FoodReminderTimes: [String: String]?
    let FoodReminderSlots: [String: HealthFoodReminderSlot]?
    let WeightRemindersEnabled: Bool?
    let WeightReminderTime: String?
    let ReminderTimeZone: String?
    let HaeApiKeyConfigured: Bool?
    let HaeApiKeyLast4: String?
    let HaeApiKeyCreatedAt: String?
}

struct HealthGoalSummary: Decodable {
    let GoalType: String
    let BmiMin: Double
    let BmiMax: Double
    let CurrentBmi: Double
    let TargetWeightKg: Double
    let EndDate: String
    let DailyCalorieTarget: Int
}

struct HealthUpdateProfileRequest: Encodable {
    let BirthDate: String?
    let HeightCm: Int?
    let WeightKg: Double?
    let ActivityLevel: String?
}

struct HealthUpdateSettingsRequest: Encodable {
    struct FoodReminderSlot: Encodable {
        let Enabled: Bool
        let Time: String
    }

    let DailyCalorieTarget: Int?
    let ProteinTargetMin: Double?
    let ProteinTargetMax: Double?
    let StepTarget: Int?
    let StepKcalFactor: Double?
    let FibreTarget: Double?
    let CarbsTarget: Double?
    let FatTarget: Double?
    let SaturatedFatTarget: Double?
    let SugarTarget: Double?
    let SodiumTarget: Double?
    let ShowProteinOnToday: Bool
    let ShowStepsOnToday: Bool
    let ShowFibreOnToday: Bool
    let ShowCarbsOnToday: Bool
    let ShowFatOnToday: Bool
    let ShowSugarOnToday: Bool
    let ShowSodiumOnToday: Bool
    let ShowSaturatedFatOnToday: Bool
    let AutoTuneTargetsWeekly: Bool
    let ShowWeightChartOnToday: Bool
    let ShowStepsChartOnToday: Bool
    let FoodReminderSlots: [String: FoodReminderSlot]
    let WeightRemindersEnabled: Bool
    let WeightReminderTime: String
}

struct GoalRecommendationRequest: Encodable {
    let GoalType: String
    let BmiMin: Double
    let BmiMax: Double
    let StartDate: String?
    let DurationMonths: Int
    let ApplyGoal: Bool
    let TargetWeightKgOverride: Double?
    let EndDateOverride: String?
    let DailyCalorieTargetOverride: Int?

    enum CodingKeys: String, CodingKey {
        case GoalType
        case BmiMin
        case BmiMax
        case StartDate
        case DurationMonths
        case ApplyGoal
        case TargetWeightKgOverride
        case EndDateOverride
        case DailyCalorieTargetOverride
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(GoalType, forKey: .GoalType)
        try container.encode(BmiMin, forKey: .BmiMin)
        try container.encode(BmiMax, forKey: .BmiMax)
        try container.encodeIfPresent(StartDate, forKey: .StartDate)
        try container.encode(DurationMonths, forKey: .DurationMonths)
        try container.encode(ApplyGoal, forKey: .ApplyGoal)
        try container.encodeIfPresent(TargetWeightKgOverride, forKey: .TargetWeightKgOverride)
        try container.encodeIfPresent(EndDateOverride, forKey: .EndDateOverride)
        try container.encodeIfPresent(DailyCalorieTargetOverride, forKey: .DailyCalorieTargetOverride)
    }
}

struct HaeApiKeyResponse: Decodable {
    let ApiKey: String
    let Last4: String
    let CreatedAt: String
}
