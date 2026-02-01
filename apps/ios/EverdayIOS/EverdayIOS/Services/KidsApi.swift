import Foundation

enum KidsApi {
    static func fetchOverview(selectedDate: String? = nil) async throws -> KidsOverviewResponse {
        let query = selectedDate
            .flatMap { $0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) }
            .map { "?selected_date=\($0)" } ?? ""
        return try await ApiClient.shared.request(path: "kids/me/overview\(query)", requiresAuth: true)
    }

    static func fetchLedger(limit: Int = 200) async throws -> KidsLedgerResponse {
        try await ApiClient.shared.request(path: "kids/me/ledger?limit=\(limit)", requiresAuth: true)
    }

    static func fetchChoreEntries(limit: Int = 50, includeDeleted: Bool = false) async throws -> [KidsChoreEntry] {
        let include = includeDeleted ? "true" : "false"
        return try await ApiClient.shared.request(
            path: "kids/me/chore-entries?limit=\(limit)&include_deleted=\(include)",
            requiresAuth: true
        )
    }

    static func createChoreEntry(_ payload: KidsChoreEntryCreate) async throws -> KidsChoreEntry {
        try await ApiClient.shared.request(
            path: "kids/me/chore-entries",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteChoreEntry(entryId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "kids/me/chore-entries/\(entryId)",
            method: "DELETE",
            requiresAuth: true
        )
    }
}
