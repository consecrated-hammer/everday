import Foundation

struct ShoppingItem: Decodable, Identifiable {
    let Id: Int
    let HouseholdId: Int
    let OwnerUserId: Int
    let AddedByType: String
    let AddedByName: String?
    let Item: String
    let IsActive: Bool
    let SortOrder: Int
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct ShoppingItemCreate: Encodable {
    let HouseholdId: Int
    let Item: String
}

struct ShoppingItemUpdate: Encodable {
    let Item: String
}

enum ShoppingConfig {
    static func householdId() -> Int {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "SHOPPING_HOUSEHOLD_ID") as? String,
           let value = Int(raw), value > 0 {
            return value
        }
        if let raw = Bundle.main.object(forInfoDictionaryKey: "SHOPPING_HOUSEHOLD_ID") as? NSNumber {
            let value = raw.intValue
            return value > 0 ? value : 1
        }
        return 1
    }
}
