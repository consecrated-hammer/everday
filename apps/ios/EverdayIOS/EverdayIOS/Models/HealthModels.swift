import Foundation

enum HealthMealType: String, Codable, CaseIterable {
    case Breakfast
    case Snack1
    case Lunch
    case Snack2
    case Dinner
    case Snack3

    var label: String {
        switch self {
        case .Breakfast: return "Breakfast"
        case .Snack1: return "Morning snack"
        case .Lunch: return "Lunch"
        case .Snack2: return "Afternoon snack"
        case .Dinner: return "Dinner"
        case .Snack3: return "Evening snack"
        }
    }
}

extension HealthMealType {
    static func defaultForCurrentTime(_ value: Date = Date(), calendar: Calendar = .current) -> HealthMealType {
        let hour = calendar.component(.hour, from: value)
        if hour < 10 {
            return .Breakfast
        }
        if hour < 12 {
            return .Snack1
        }
        if hour < 14 {
            return .Lunch
        }
        if hour < 17 {
            return .Snack2
        }
        if hour < 20 {
            return .Dinner
        }
        return .Snack3
    }
}

enum HealthImageScanMode: String, Codable, CaseIterable {
    case meal = "meal"
    case label = "label"
}

struct HealthFood: Decodable, Identifiable {
    let FoodId: String
    let OwnerUserId: Int?
    let CreatedByName: String?
    let FoodName: String
    let ServingDescription: String
    let ServingQuantity: Double
    let ServingUnit: String
    let CaloriesPerServing: Double
    let ProteinPerServing: Double
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let DataSource: String?
    let CountryCode: String?
    let IsFavourite: Bool
    let ImageUrl: String?
    let CreatedAt: String?

    var id: String { FoodId }
}

struct HealthFoodInfo: Decodable, Identifiable {
    let FoodName: String
    let ServingDescription: String
    let CaloriesPerServing: Int?
    let ProteinPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let CarbohydratesPerServing: Double?
    let SugarPerServing: Double?
    let FiberPerServing: Double?
    let SodiumPerServing: Double?

    var id: String { "\(FoodName)-\(ServingDescription)" }
}

struct HealthDailyLog: Decodable {
    let DailyLogId: String
    let LogDate: String
    let Steps: Int
    let StepKcalFactorOverride: Double?
    let WeightKg: Double?
    let Notes: String?
}

struct HealthMealEntry: Decodable, Identifiable {
    let MealEntryId: String
    let DailyLogId: String
    let MealType: HealthMealType
    let FoodId: String?
    let MealTemplateId: String?
    let Quantity: Double
    let DisplayQuantity: Double?
    let PortionOptionId: String?
    let PortionLabel: String?
    let PortionBaseUnit: String?
    let PortionBaseAmount: Double?
    let PortionBaseTotal: Double?
    let EntryNotes: String?
    let SortOrder: Int
    let ScheduleSlotId: String?
    let CreatedAt: String?

    var id: String { MealEntryId }
}

struct HealthMealEntryWithFood: Decodable, Identifiable {
    let MealEntryId: String
    let DailyLogId: String
    let MealType: HealthMealType
    let FoodId: String?
    let MealTemplateId: String?
    let TemplateName: String?
    let FoodName: String
    let ServingDescription: String
    let CaloriesPerServing: Double
    let ProteinPerServing: Double
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let ImageUrl: String?
    let Quantity: Double
    let DisplayQuantity: Double?
    let PortionOptionId: String?
    let PortionLabel: String?
    let PortionBaseUnit: String?
    let PortionBaseAmount: Double?
    let PortionBaseTotal: Double?
    let EntryNotes: String?
    let SortOrder: Int
    let ScheduleSlotId: String?
    let CreatedAt: String?

    var id: String { MealEntryId }
}

struct HealthDailyTotals: Decodable {
    let TotalCalories: Double
    let TotalProtein: Double
    let TotalFibre: Double
    let TotalCarbs: Double
    let TotalFat: Double
    let TotalSaturatedFat: Double
    let TotalSugar: Double
    let TotalSodium: Double
    let CaloriesBurnedFromSteps: Double
    let NetCalories: Double
    let RemainingCalories: Double
    let RemainingProteinMin: Double
    let RemainingProteinMax: Double
    let RemainingFibre: Double
    let RemainingCarbs: Double
    let RemainingFat: Double
    let RemainingSaturatedFat: Double
    let RemainingSugar: Double
    let RemainingSodium: Double
}

struct HealthDailySummary: Decodable {
    let LogDate: String
    let TotalCalories: Double
    let TotalProtein: Double
    let TotalFibre: Double
    let TotalCarbs: Double
    let TotalFat: Double
    let TotalSaturatedFat: Double
    let TotalSugar: Double
    let TotalSodium: Double
    let Steps: Int
    let NetCalories: Double
}

struct HealthDailyLogResponse: Decodable {
    let DailyLog: HealthDailyLog?
    let Entries: [HealthMealEntryWithFood]
    let Totals: HealthDailyTotals
    let Summary: HealthDailySummary
    let Targets: HealthTargets
}

struct HealthDailyLogCreateResponse: Decodable {
    let DailyLog: HealthDailyLog
}

struct HealthMealEntryResponse: Decodable {
    let MealEntry: HealthMealEntry
}

struct HealthWeeklySummary: Decodable {
    let Days: [HealthDailySummary]
    let Totals: [String: Double]
    let Averages: [String: Double]
}

struct HealthWeightHistoryEntry: Decodable, Identifiable {
    let LogDate: String
    let WeightKg: Double

    var id: String { LogDate }
}

struct HealthWeightHistoryResponse: Decodable {
    let Weights: [HealthWeightHistoryEntry]
}

struct HealthStepsHistoryEntry: Decodable, Identifiable {
    let LogDate: String
    let Steps: Int

    var id: String { LogDate }
}

struct HealthStepsHistoryResponse: Decodable {
    let Steps: [HealthStepsHistoryEntry]
}

struct HealthSuggestion: Decodable, Identifiable {
    let SuggestionType: String
    let Title: String
    let Detail: String

    var id: String { "\(SuggestionType)-\(Title)" }
}

struct HealthSuggestionsResponse: Decodable {
    let Suggestions: [HealthSuggestion]
    let ModelUsed: String?
}

struct HealthPortionOption: Decodable, Identifiable {
    let PortionOptionId: String?
    let FoodId: String?
    let Label: String
    let BaseUnit: String
    let BaseAmount: Double
    let Scope: String
    let SortOrder: Int
    let IsDefault: Bool

    var id: String { PortionOptionId ?? "\(Label)-\(BaseUnit)-\(BaseAmount)" }
}

struct HealthPortionOptionsResponse: Decodable {
    let BaseUnit: String
    let Options: [HealthPortionOption]
}

struct HealthMealTemplate: Decodable, Identifiable {
    let MealTemplateId: String
    let TemplateName: String
    let Servings: Double
    let IsFavourite: Bool
    let CreatedAt: String

    var id: String { MealTemplateId }
}

struct HealthMealTemplateItem: Decodable, Identifiable {
    let MealTemplateItemId: String
    let MealTemplateId: String
    let FoodId: String
    let MealType: HealthMealType
    let Quantity: Double
    let EntryQuantity: Double?
    let EntryUnit: String?
    let EntryNotes: String?
    let SortOrder: Int
    let FoodName: String
    let ServingDescription: String

    var id: String { MealTemplateItemId }
}

struct HealthMealTemplateWithItems: Decodable, Identifiable {
    let Template: HealthMealTemplate
    let Items: [HealthMealTemplateItem]

    var id: String { Template.MealTemplateId }
}

struct HealthMealTemplateListResponse: Decodable {
    let Templates: [HealthMealTemplateWithItems]
}

struct HealthMealTextParseResponse: Decodable {
    let MealName: String
    let ServingQuantity: Double
    let ServingUnit: String
    let CaloriesPerServing: Int
    let ProteinPerServing: Double
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let Summary: String
}

struct HealthImageScanResponse: Decodable {
    let FoodName: String
    let ServingQuantity: Double
    let ServingUnit: String
    let CaloriesPerServing: Int
    let ProteinPerServing: Double
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let Summary: String
    let Confidence: String
    let Questions: [String]
}

struct HealthFoodLookupResponse: Decodable, Identifiable {
    let FoodName: String
    let ServingQuantity: Double
    let ServingUnit: String
    let CaloriesPerServing: Int
    let ProteinPerServing: Double
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let Source: String
    let Confidence: String

    var id: String { "\(FoodName)-\(ServingUnit)-\(Source)" }
}

struct HealthTextLookupResponse: Decodable {
    let Result: HealthFoodLookupResponse
}

struct HealthTextLookupOptionsResponse: Decodable {
    let Results: [HealthFoodLookupResponse]
}

struct HealthImageLookupResponse: Decodable {
    let Results: [HealthFoodLookupResponse]
}

struct HealthBarcodeLookupResponse: Decodable {
    let Result: HealthFoodLookupResponse?
}

struct HealthFoodSuggestionsResponse: Decodable {
    let Suggestions: [String]
}

struct HealthMultiSourceSearchResponse: Decodable {
    let Openfoodfacts: [HealthFoodInfo]
    let AiFallbackAvailable: Bool
}

struct HealthScheduleSlot: Decodable, Identifiable {
    let ScheduleSlotId: String
    let SlotName: String
    let SlotTime: String
    let MealType: HealthMealType
    let SortOrder: Int

    var id: String { ScheduleSlotId }
}

struct HealthScheduleSlotsResponse: Decodable {
    let Slots: [HealthScheduleSlot]
}

struct HealthCreateFoodRequest: Encodable {
    let FoodName: String
    let ServingDescription: String
    let ServingQuantity: Double
    let ServingUnit: String
    let CaloriesPerServing: Double
    let ProteinPerServing: Double
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let DataSource: String
    let CountryCode: String
    let IsFavourite: Bool
    let ImageBase64: String?
}

struct HealthUpdateFoodRequest: Encodable {
    let FoodName: String?
    let ServingQuantity: Double?
    let ServingUnit: String?
    let CaloriesPerServing: Double?
    let ProteinPerServing: Double?
    let FibrePerServing: Double?
    let CarbsPerServing: Double?
    let FatPerServing: Double?
    let SaturatedFatPerServing: Double?
    let SugarPerServing: Double?
    let SodiumPerServing: Double?
    let IsFavourite: Bool?
    let ImageBase64: String?
}

struct HealthCreateDailyLogRequest: Encodable {
    let LogDate: String
    let Steps: Int
    let StepKcalFactorOverride: Double?
    let WeightKg: Double?
    let Notes: String?
}

struct HealthStepUpdateRequest: Encodable {
    let Steps: Int
    let StepKcalFactorOverride: Double?
    let WeightKg: Double?
}

struct HealthCreateMealEntryRequest: Encodable {
    let DailyLogId: String
    let MealType: HealthMealType
    let FoodId: String?
    let MealTemplateId: String?
    let Quantity: Double
    let PortionOptionId: String?
    let PortionLabel: String
    let PortionBaseUnit: String
    let PortionBaseAmount: Double
    let EntryNotes: String?
    let SortOrder: Int
    let ScheduleSlotId: String?
}

struct HealthShareMealEntryRequest: Encodable {
    let LogDate: String
    let TargetUserId: Int
    let MealType: HealthMealType
    let FoodId: String?
    let MealTemplateId: String?
    let Quantity: Double
    let PortionOptionId: String?
    let PortionLabel: String
    let PortionBaseUnit: String
    let PortionBaseAmount: Double
    let EntryNotes: String?
    let ScheduleSlotId: String?
}

struct HealthUpdateMealEntryRequest: Encodable {
    let MealType: HealthMealType?
    let Quantity: Double
    let PortionOptionId: String?
    let PortionLabel: String
    let PortionBaseUnit: String
    let PortionBaseAmount: Double
    let EntryNotes: String?
}

struct HealthCreatePortionOptionRequest: Encodable {
    let FoodId: String?
    let Label: String
    let BaseUnit: String
    let BaseAmount: Double
    let IsDefault: Bool
    let SortOrder: Int
}

struct HealthMealTemplateItemInput: Encodable {
    let FoodId: String
    let MealType: HealthMealType
    let Quantity: Double
    let EntryQuantity: Double?
    let EntryUnit: String?
    let EntryNotes: String?
    let SortOrder: Int
}

struct HealthCreateMealTemplateRequest: Encodable {
    let TemplateName: String
    let Servings: Double
    let IsFavourite: Bool
    let Items: [HealthMealTemplateItemInput]
}

struct HealthUpdateMealTemplateRequest: Encodable {
    let TemplateName: String?
    let Servings: Double?
    let IsFavourite: Bool?
    let Items: [HealthMealTemplateItemInput]?
}

struct HealthApplyMealTemplateRequest: Encodable {
    let LogDate: String
}

struct HealthMealTextParseRequest: Encodable {
    let Text: String
    let KnownFoods: [String]?
}

struct HealthFoodLookupTextRequest: Encodable {
    let Query: String
}

struct HealthFoodLookupImageRequest: Encodable {
    let ImageBase64: String
}

struct HealthFoodLookupBarcodeRequest: Encodable {
    let Barcode: String
}

struct HealthImageScanRequest: Encodable {
    let ImageBase64: String
    let Mode: HealthImageScanMode
    let Note: String?
}

struct HealthMultiSourceSearchRequest: Encodable {
    let Query: String
}

struct HealthScheduleSlotInput: Encodable {
    let ScheduleSlotId: String?
    let SlotName: String
    let SlotTime: String
    let MealType: HealthMealType
    let SortOrder: Int
}

struct HealthScheduleSlotsUpdateRequest: Encodable {
    let Slots: [HealthScheduleSlotInput]
}
