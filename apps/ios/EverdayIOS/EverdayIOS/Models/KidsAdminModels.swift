import Foundation

struct KidsLinkedKid: Decodable, Identifiable {
    let KidUserId: Int
    let Username: String
    let FirstName: String?
    let LastName: String?

    var id: Int { KidUserId }
}

struct KidsMonthSummaryResponse: Decodable {
    let MonthStart: String
    let MonthEnd: String
    let MonthlyAllowance: Double
    let DailySlice: Double
    let MissedDays: Int
    let MissedDeduction: Double
    let ApprovedBonusTotal: Double
    let PendingBonusTotal: Double
    let ProjectedPayout: Double
}

struct KidsMonthDayOut: Decodable {
    let Date: String
    let DailyDone: Int
    let DailyTotal: Int
    let BonusApprovedTotal: Double
    let PendingCount: Int
}

struct KidsMonthOverviewResponse: Decodable {
    let MonthStart: String
    let MonthEnd: String
    let Days: [KidsMonthDayOut]
}

struct KidsDayDetailResponse: Decodable {
    let Date: String
    let DailyJobs: [KidsChore]
    let Habits: [KidsChore]
    let BonusTasks: [KidsChore]
    let Entries: [KidsChoreEntry]
}

struct KidsApprovalOut: Decodable, Identifiable {
    let Id: Int
    let KidUserId: Int
    let KidName: String
    let ChoreId: Int
    let ChoreLabel: String
    let ChoreType: String?
    let EntryDate: String
    let Amount: Double
    let Notes: String?
    let Status: String
    let CreatedAt: String

    var id: Int { Id }
}

struct PocketMoneyRuleOut: Decodable {
    let Id: Int
    let KidUserId: Int
    let Amount: Double
    let Frequency: String
    let DayOfWeek: Int?
    let DayOfMonth: Int?
    let StartDate: String
    let LastPostedOn: String?
    let IsActive: Bool
    let CreatedByUserId: Int
    let CreatedAt: String
    let UpdatedAt: String
}

struct PocketMoneyRuleUpsert: Encodable {
    let Amount: Double
    let Frequency: String
    let DayOfWeek: Int?
    let DayOfMonth: Int?
    let StartDate: String
    let IsActive: Bool
}

struct LedgerEntryCreate: Encodable {
    let Amount: Double
    let EntryDate: String
    let Narrative: String
    let Notes: String?
}

struct ParentChoreCreate: Encodable {
    let Label: String
    let ChoreType: String
    let Amount: Double
    let IsActive: Bool
    let SortOrder: Int
    let StartDate: String?
    let EndDate: String?

    enum CodingKeys: String, CodingKey {
        case Label
        case ChoreType = "Type"
        case Amount
        case IsActive
        case SortOrder
        case StartDate
        case EndDate
    }
}

struct ParentChoreUpdate: Encodable {
    let Label: String?
    let ChoreType: String?
    let Amount: Double?
    let IsActive: Bool?
    let SortOrder: Int?
    let StartDate: String?
    let EndDate: String?

    enum CodingKeys: String, CodingKey {
        case Label
        case ChoreType = "Type"
        case Amount
        case IsActive
        case SortOrder
        case StartDate
        case EndDate
    }
}

struct ParentChoreEntryCreate: Encodable {
    let ChoreId: Int
    let EntryDate: String
    let Notes: String?
    let Amount: Double?
}

struct ParentChoreEntryUpdate: Encodable {
    let EntryDate: String?
    let Notes: String?
    let Amount: Double?
    let Status: String?
}

struct ChoreAssignmentRequest: Encodable {
    let KidUserIds: [Int]
}
