import Foundation

enum NotesScope: String, CaseIterable, Identifiable {
    case personal
    case family
    case shared

    var id: String { rawValue }

    var label: String {
        switch self {
        case .personal:
            return "Personal"
        case .family:
            return "Family"
        case .shared:
            return "Shared"
        }
    }
}

struct NoteItem: Decodable, Identifiable {
    let Id: Int
    let Text: String
    let Checked: Bool
    let OrderIndex: Int
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct NoteAssociation: Decodable, Identifiable {
    let Id: Int
    let ModuleName: String
    let RecordId: Int

    var id: Int { Id }
}

struct NoteResponse: Decodable, Identifiable {
    let Id: Int
    let UserId: Int
    let Title: String
    let Content: String?
    let Labels: [String]
    let IsPinned: Bool
    let Items: [NoteItem]
    let Tags: [Int]
    let TaskIds: [Int]
    let Associations: [NoteAssociation]
    let ArchivedAt: String?
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }
}

struct NoteItemCreate: Encodable {
    let Text: String
    let Checked: Bool
    let OrderIndex: Int
}

struct NoteItemUpdate: Encodable {
    let Id: Int?
    let Text: String
    let Checked: Bool
    let OrderIndex: Int
}

struct NoteCreate: Encodable {
    let Title: String
    let Content: String?
    let Labels: [String]
    let IsPinned: Bool
    let Items: [NoteItemCreate]
    let SharedUserIds: [Int]
}

struct NoteUpdate: Encodable {
    let Title: String
    let Content: String?
    let Labels: [String]
    let IsPinned: Bool
    let Items: [NoteItemUpdate]
    let SharedUserIds: [Int]
}

struct NoteShareUser: Decodable, Identifiable {
    let Id: Int
    let Username: String
    let FirstName: String?
    let LastName: String?

    var id: Int { Id }

    var displayName: String {
        let combined = [FirstName ?? "", LastName ?? ""].joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        if !combined.isEmpty {
            return combined
        }
        return Username
    }
}
