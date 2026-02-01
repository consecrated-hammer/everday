import Foundation

struct KidsChore: Decodable {
    let Id: Int
    let Label: String
    let ChoreType: String
    let Amount: Double
    let IsActive: Bool
    let SortOrder: Int
    let StartDate: String?
    let EndDate: String?
    let AssignedKidIds: [Int]?

    enum CodingKeys: String, CodingKey {
        case Id
        case Label
        case ChoreType = "Type"
        case Amount
        case IsActive
        case SortOrder
        case StartDate
        case EndDate
        case AssignedKidIds
    }
}

struct KidsChoreEntry: Decodable {
    let Id: Int
    let KidUserId: Int
    let ChoreId: Int
    let ChoreLabel: String
    let ChoreType: String?
    let Status: String
    let Amount: Double
    let EntryDate: String
    let Notes: String?
    let IsDeleted: Bool
    let CreatedByUserId: Int
    let UpdatedByUserId: Int?
    let ReviewedByUserId: Int?
    let ReviewedAt: String?
    let CreatedAt: String
    let UpdatedAt: String
}

struct KidsLedgerEntry: Decodable {
    let Id: Int
    let KidUserId: Int
    let EntryType: String
    let Amount: Double
    let EntryDate: String
    let Narrative: String?
    let Notes: String?
    let CreatedByUserId: Int
    let CreatedByName: String?
    let IsDeleted: Bool
    let CreatedAt: String
    let UpdatedAt: String
}

struct KidsLedgerResponse: Decodable {
    let Balance: Double
    let Entries: [KidsLedgerEntry]
}

struct KidsProjectionPoint: Decodable {
    let Date: String
    let Amount: Double
}

struct KidsOverviewResponse: Decodable {
    let Today: String
    let SelectedDate: String
    let AllowedStartDate: String
    let AllowedEndDate: String
    let MonthStart: String
    let MonthEnd: String
    let MonthlyAllowance: Double
    let DailySlice: Double
    let DayProtected: Bool
    let Chores: [KidsChore]
    let Entries: [KidsChoreEntry]
    let Projection: [KidsProjectionPoint]
}

struct KidsChoreEntryCreate: Encodable {
    let ChoreId: Int
    let EntryDate: String
    let Notes: String?
}
