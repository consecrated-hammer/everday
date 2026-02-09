import Foundation

enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
            return
        }
        if let value = try? container.decode(Bool.self) {
            self = .bool(value)
            return
        }
        if let value = try? container.decode(Int.self) {
            self = .number(Double(value))
            return
        }
        if let value = try? container.decode(Double.self) {
            self = .number(value)
            return
        }
        if let value = try? container.decode(String.self) {
            if let numeric = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)) {
                self = .number(numeric)
            } else {
                self = .string(value)
            }
            return
        }
        if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
            return
        }
        if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
            return
        }
        self = .null
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    var stringValue: String? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        default:
            return nil
        }
    }

    var numberValue: Double? {
        switch self {
        case .number(let value):
            return value
        case .string(let value):
            return Double(value.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            return nil
        }
    }

    var boolValue: Bool? {
        switch self {
        case .bool(let value):
            return value
        case .string(let value):
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if normalized == "true" { return true }
            if normalized == "false" { return false }
            return nil
        default:
            return nil
        }
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }
}

struct LifeCategory: Decodable, Identifiable {
    let Id: Int
    let Name: String
    let Slug: String
    let Description: String?
    let SortOrder: Int
    let IsActive: Bool
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeCategoryCreate: Encodable {
    let Name: String
    let Description: String?
    let SortOrder: Int
    let IsActive: Bool
}

struct LifeCategoryUpdate: Encodable {
    let Name: String
    let Description: String?
    let SortOrder: Int
    let IsActive: Bool
}

struct LifeField: Decodable, Identifiable {
    let Id: Int
    let CategoryId: Int
    let Name: String
    let Key: String
    let FieldType: String
    let IsRequired: Bool
    let IsMulti: Bool
    let SortOrder: Int
    let DropdownId: Int?
    let LinkedCategoryId: Int?
    let Config: [String: JSONValue]?
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeFieldCreate: Encodable {
    let Name: String
    let Key: String?
    let FieldType: String
    let IsRequired: Bool
    let IsMulti: Bool
    let SortOrder: Int
    let DropdownId: Int?
    let LinkedCategoryId: Int?
    let Config: [String: JSONValue]?
}

struct LifeFieldUpdate: Encodable {
    let Name: String
    let Key: String?
    let FieldType: String
    let IsRequired: Bool
    let IsMulti: Bool
    let SortOrder: Int
    let DropdownId: Int?
    let LinkedCategoryId: Int?
    let Config: [String: JSONValue]?
}

struct LifeDropdown: Decodable, Identifiable {
    let Id: Int
    let Name: String
    let Description: String?
    let InUseCount: Int
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeDropdownCreate: Encodable {
    let Name: String
    let Description: String?
}

struct LifeDropdownUpdate: Encodable {
    let Name: String
    let Description: String?
}

struct LifeDropdownOption: Decodable, Identifiable {
    let Id: Int
    let DropdownId: Int
    let Label: String
    let Value: String?
    let SortOrder: Int
    let IsActive: Bool
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeDropdownOptionCreate: Encodable {
    let Label: String
    let Value: String?
    let SortOrder: Int
    let IsActive: Bool
}

struct LifeDropdownOptionUpdate: Encodable {
    let Label: String
    let Value: String?
    let SortOrder: Int
    let IsActive: Bool
}

struct LifePerson: Decodable, Identifiable {
    let Id: Int
    let Name: String
    let UserId: Int?
    let Notes: String?
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifePersonCreate: Encodable {
    let Name: String
    let UserId: Int?
    let Notes: String?
}

struct LifePersonUpdate: Encodable {
    let Name: String
    let UserId: Int?
    let Notes: String?
}

struct LifeRecord: Decodable, Identifiable {
    let Id: Int
    let CategoryId: Int
    let Title: String?
    let Data: [String: JSONValue]
    let SortOrder: Int
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeRecordCreate: Encodable {
    let Title: String?
    let Data: [String: JSONValue]
}

struct LifeRecordUpdate: Encodable {
    let Title: String?
    let Data: [String: JSONValue]
}

struct LifeRecordLookup: Decodable, Identifiable {
    let Id: Int
    let Title: String

    var id: Int { Id }
}

struct LifeRecordOrderUpdate: Encodable {
    let OrderedIds: [Int]
}

struct LifeDocumentFolder: Decodable, Identifiable {
    let Id: Int
    let Name: String
    let SortOrder: Int
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeDocumentFolderCreate: Encodable {
    let Name: String
    let SortOrder: Int
}

struct LifeDocumentFolderUpdate: Encodable {
    let Name: String
    let SortOrder: Int
}

struct LifeDocumentTag: Decodable, Identifiable {
    let Id: Int
    let Name: String
    let Slug: String
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeDocument: Decodable, Identifiable {
    let Id: Int
    let Title: String?
    let FolderId: Int?
    let FolderName: String?
    let ContentType: String?
    let FileSizeBytes: Int?
    let OriginalFileName: String?
    let OcrStatus: String?
    let CreatedAt: String
    let UpdatedAt: String
    let FileUrl: String?
    let Tags: [LifeDocumentTag]
    let LinkCount: Int
    let ReminderCount: Int

    var id: Int { Id }
}

struct LifeDocumentUpdate: Encodable {
    let Title: String?
    let FolderId: Int?
}

struct LifeDocumentTagUpdate: Encodable {
    let TagNames: [String]
}

struct LifeDocumentLink: Decodable, Identifiable {
    let Id: Int
    let DocumentId: Int
    let LinkedEntityType: String
    let LinkedEntityId: Int
    let CreatedByUserId: Int
    let CreatedAt: String

    var id: Int { Id }
}

struct LifeDocumentLinkCreate: Encodable {
    let LinkedEntityType: String
    let LinkedEntityId: Int
}

struct LifeReminder: Decodable, Identifiable {
    let Id: Int
    let SourceType: String
    let SourceId: Int
    let Title: String
    let DueAt: String
    let RepeatRule: String?
    let Status: String
    let AssigneeUserId: Int?
    let CompletedAt: String?
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeReminderCreate: Encodable {
    let SourceType: String
    let SourceId: Int
    let Title: String
    let DueAt: String
    let RepeatRule: String?
    let AssigneeUserId: Int?
}

struct LifeReminderUpdate: Encodable {
    let Status: String
}

struct LifeDocumentAudit: Decodable, Identifiable {
    let Id: Int
    let DocumentId: Int
    let Action: String
    let ActorUserId: Int
    let Summary: String?
    let BeforeJson: [String: JSONValue]?
    let AfterJson: [String: JSONValue]?
    let CreatedAt: String

    var id: Int { Id }
}

struct LifeDocumentAiSuggestion: Decodable, Identifiable {
    let Id: Int
    let DocumentId: Int
    let Status: String
    let SuggestedFolderName: String?
    let SuggestedTags: [String]
    let SuggestedLinks: [JSONValue]
    let SuggestedReminder: [String: JSONValue]?
    let Confidence: String?
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct LifeDocumentDetail: Decodable, Identifiable {
    let Id: Int
    let Title: String?
    let FolderId: Int?
    let FolderName: String?
    let ContentType: String?
    let FileSizeBytes: Int?
    let OriginalFileName: String?
    let OcrStatus: String?
    let CreatedAt: String
    let UpdatedAt: String
    let FileUrl: String?
    let Tags: [LifeDocumentTag]
    let LinkCount: Int
    let ReminderCount: Int
    let StoragePath: String?
    let OcrText: String?
    let SourceType: String?
    let SourceDetail: String?
    let Links: [LifeDocumentLink]
    let Reminders: [LifeReminder]
    let Audits: [LifeDocumentAudit]
    let AiSuggestion: LifeDocumentAiSuggestion?

    var id: Int { Id }
}

struct LifeDocumentBulkUpdate: Encodable {
    let DocumentIds: [Int]
    let FolderId: Int?
    let TagNames: [String]?
}
