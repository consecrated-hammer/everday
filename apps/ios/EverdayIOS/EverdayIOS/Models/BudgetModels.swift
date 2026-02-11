import Foundation

private extension KeyedDecodingContainer where Key: CodingKey {
    func decodeFlexibleDouble(forKey key: Key) throws -> Double {
        if let value = try? decode(Double.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return Double(value)
        }
        if let value = try? decode(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if let doubleValue = Double(trimmed) {
                return doubleValue
            }
        }
        throw DecodingError.typeMismatch(
            Double.self,
            DecodingError.Context(
                codingPath: codingPath + [key],
                debugDescription: "Expected a number or numeric string."
            )
        )
    }

    func decodeFlexibleDoubleIfPresent(forKey key: Key) throws -> Double? {
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return Double(value)
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return nil }
            if let doubleValue = Double(trimmed) {
                return doubleValue
            }
        }
        return nil
    }
}

struct IncomeStream: Decodable, Identifiable {
    let Id: Int
    let OwnerUserId: Int
    let Label: String
    let NetAmount: Double
    let GrossAmount: Double
    let FirstPayDate: String
    let Frequency: String
    let EndDate: String?
    let Notes: String?
    let CreatedAt: String
    let LastPayDate: String?
    let NextPayDate: String?
    let NetPerDay: Double?
    let NetPerWeek: Double?
    let NetPerFortnight: Double?
    let NetPerMonth: Double?
    let NetPerYear: Double?
    let GrossPerDay: Double?
    let GrossPerWeek: Double?
    let GrossPerFortnight: Double?
    let GrossPerMonth: Double?
    let GrossPerYear: Double?

    var id: Int { Id }

    enum CodingKeys: String, CodingKey {
        case Id
        case OwnerUserId
        case Label
        case NetAmount
        case GrossAmount
        case FirstPayDate
        case Frequency
        case EndDate
        case Notes
        case CreatedAt
        case LastPayDate
        case NextPayDate
        case NetPerDay
        case NetPerWeek
        case NetPerFortnight
        case NetPerMonth
        case NetPerYear
        case GrossPerDay
        case GrossPerWeek
        case GrossPerFortnight
        case GrossPerMonth
        case GrossPerYear
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        Id = try container.decode(Int.self, forKey: .Id)
        OwnerUserId = try container.decode(Int.self, forKey: .OwnerUserId)
        Label = try container.decode(String.self, forKey: .Label)
        NetAmount = try container.decodeFlexibleDouble(forKey: .NetAmount)
        GrossAmount = try container.decodeFlexibleDouble(forKey: .GrossAmount)
        FirstPayDate = try container.decode(String.self, forKey: .FirstPayDate)
        Frequency = try container.decode(String.self, forKey: .Frequency)
        EndDate = try container.decodeIfPresent(String.self, forKey: .EndDate)
        Notes = try container.decodeIfPresent(String.self, forKey: .Notes)
        CreatedAt = try container.decode(String.self, forKey: .CreatedAt)
        LastPayDate = try container.decodeIfPresent(String.self, forKey: .LastPayDate)
        NextPayDate = try container.decodeIfPresent(String.self, forKey: .NextPayDate)
        NetPerDay = try container.decodeFlexibleDoubleIfPresent(forKey: .NetPerDay)
        NetPerWeek = try container.decodeFlexibleDoubleIfPresent(forKey: .NetPerWeek)
        NetPerFortnight = try container.decodeFlexibleDoubleIfPresent(forKey: .NetPerFortnight)
        NetPerMonth = try container.decodeFlexibleDoubleIfPresent(forKey: .NetPerMonth)
        NetPerYear = try container.decodeFlexibleDoubleIfPresent(forKey: .NetPerYear)
        GrossPerDay = try container.decodeFlexibleDoubleIfPresent(forKey: .GrossPerDay)
        GrossPerWeek = try container.decodeFlexibleDoubleIfPresent(forKey: .GrossPerWeek)
        GrossPerFortnight = try container.decodeFlexibleDoubleIfPresent(forKey: .GrossPerFortnight)
        GrossPerMonth = try container.decodeFlexibleDoubleIfPresent(forKey: .GrossPerMonth)
        GrossPerYear = try container.decodeFlexibleDoubleIfPresent(forKey: .GrossPerYear)
    }
}

struct IncomeStreamCreate: Encodable {
    let Label: String
    let NetAmount: Double
    let GrossAmount: Double
    let FirstPayDate: String
    let Frequency: String
    let EndDate: String?
    let Notes: String?
}

struct IncomeStreamUpdate: Encodable {
    let Label: String
    let NetAmount: Double
    let GrossAmount: Double
    let FirstPayDate: String
    let Frequency: String
    let EndDate: String?
    let Notes: String?
}

struct Expense: Decodable, Identifiable {
    let Id: Int
    let OwnerUserId: Int
    let Label: String
    let Amount: Double
    let Frequency: String
    let Account: String?
    let ExpenseType: String?
    let NextDueDate: String?
    let Cadence: String?
    let Interval: Int?
    let Month: Int?
    let DayOfMonth: Int?
    let Enabled: Bool
    let Notes: String?
    let DisplayOrder: Int
    let CreatedAt: String
    let PerDay: Double
    let PerWeek: Double
    let PerFortnight: Double
    let PerMonth: Double
    let PerYear: Double

    var id: Int { Id }

    enum CodingKeys: String, CodingKey {
        case Id
        case OwnerUserId
        case Label
        case Amount
        case Frequency
        case Account
        case ExpenseType = "Type"
        case NextDueDate
        case Cadence
        case Interval
        case Month
        case DayOfMonth
        case Enabled
        case Notes
        case DisplayOrder
        case CreatedAt
        case PerDay
        case PerWeek
        case PerFortnight
        case PerMonth
        case PerYear
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        Id = try container.decode(Int.self, forKey: .Id)
        OwnerUserId = try container.decode(Int.self, forKey: .OwnerUserId)
        Label = try container.decode(String.self, forKey: .Label)
        Amount = try container.decodeFlexibleDouble(forKey: .Amount)
        Frequency = try container.decode(String.self, forKey: .Frequency)
        Account = try container.decodeIfPresent(String.self, forKey: .Account)
        ExpenseType = try container.decodeIfPresent(String.self, forKey: .ExpenseType)
        NextDueDate = try container.decodeIfPresent(String.self, forKey: .NextDueDate)
        Cadence = try container.decodeIfPresent(String.self, forKey: .Cadence)
        Interval = try container.decodeIfPresent(Int.self, forKey: .Interval)
        Month = try container.decodeIfPresent(Int.self, forKey: .Month)
        DayOfMonth = try container.decodeIfPresent(Int.self, forKey: .DayOfMonth)
        Enabled = try container.decode(Bool.self, forKey: .Enabled)
        Notes = try container.decodeIfPresent(String.self, forKey: .Notes)
        DisplayOrder = try container.decode(Int.self, forKey: .DisplayOrder)
        CreatedAt = try container.decode(String.self, forKey: .CreatedAt)
        PerDay = try container.decodeFlexibleDouble(forKey: .PerDay)
        PerWeek = try container.decodeFlexibleDouble(forKey: .PerWeek)
        PerFortnight = try container.decodeFlexibleDouble(forKey: .PerFortnight)
        PerMonth = try container.decodeFlexibleDouble(forKey: .PerMonth)
        PerYear = try container.decodeFlexibleDouble(forKey: .PerYear)
    }
}

struct ExpenseCreate: Encodable {
    let Label: String
    let Amount: Double
    let Frequency: String
    let Account: String?
    let ExpenseType: String?
    let NextDueDate: String?
    let Cadence: String?
    let Interval: Int?
    let Month: Int?
    let DayOfMonth: Int?
    let Enabled: Bool
    let Notes: String?

    enum CodingKeys: String, CodingKey {
        case Label
        case Amount
        case Frequency
        case Account
        case ExpenseType = "Type"
        case NextDueDate
        case Cadence
        case Interval
        case Month
        case DayOfMonth
        case Enabled
        case Notes
    }
}

struct ExpenseUpdate: Encodable {
    let Label: String
    let Amount: Double
    let Frequency: String
    let Account: String?
    let ExpenseType: String?
    let NextDueDate: String?
    let Cadence: String?
    let Interval: Int?
    let Month: Int?
    let DayOfMonth: Int?
    let Enabled: Bool
    let Notes: String?

    enum CodingKeys: String, CodingKey {
        case Label
        case Amount
        case Frequency
        case Account
        case ExpenseType = "Type"
        case NextDueDate
        case Cadence
        case Interval
        case Month
        case DayOfMonth
        case Enabled
        case Notes
    }
}

struct ExpenseAccount: Decodable, Identifiable {
    let Id: Int
    let OwnerUserId: Int
    let Name: String
    let Enabled: Bool
    let CreatedAt: String

    var id: Int { Id }
}

struct ExpenseAccountCreate: Encodable {
    let Name: String
    let Enabled: Bool
}

struct ExpenseAccountUpdate: Encodable {
    let Name: String
    let Enabled: Bool
}

struct ExpenseType: Decodable, Identifiable {
    let Id: Int
    let OwnerUserId: Int
    let Name: String
    let Enabled: Bool
    let CreatedAt: String

    var id: Int { Id }
}

struct ExpenseTypeCreate: Encodable {
    let Name: String
    let Enabled: Bool
}

struct ExpenseTypeUpdate: Encodable {
    let Name: String
    let Enabled: Bool
}

struct AllocationAccount: Decodable, Identifiable {
    let Id: Int
    let OwnerUserId: Int
    let Name: String
    let Percent: Double
    let Enabled: Bool
    let CreatedAt: String

    var id: Int { Id }

    enum CodingKeys: String, CodingKey {
        case Id
        case OwnerUserId
        case Name
        case Percent
        case Enabled
        case CreatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        Id = try container.decode(Int.self, forKey: .Id)
        OwnerUserId = try container.decode(Int.self, forKey: .OwnerUserId)
        Name = try container.decode(String.self, forKey: .Name)
        Percent = try container.decodeFlexibleDouble(forKey: .Percent)
        Enabled = try container.decode(Bool.self, forKey: .Enabled)
        CreatedAt = try container.decode(String.self, forKey: .CreatedAt)
    }
}

struct AllocationAccountCreate: Encodable {
    let Name: String
    let Percent: Double
    let Enabled: Bool
}

struct AllocationAccountUpdate: Encodable {
    let Name: String
    let Percent: Double
    let Enabled: Bool
}
