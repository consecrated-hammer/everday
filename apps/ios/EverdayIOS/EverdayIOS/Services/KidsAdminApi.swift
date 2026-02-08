import Foundation

enum KidsAdminApi {
    static func fetchLinkedKids() async throws -> [KidsLinkedKid] {
        try await ApiClient.shared.request(path: "kids/parents/children", requiresAuth: true)
    }

    static func fetchParentChores() async throws -> [KidsChore] {
        try await ApiClient.shared.request(path: "kids/parents/chores", requiresAuth: true)
    }

    static func fetchKidMonthSummary(kidId: Int, month: String? = nil) async throws -> KidsMonthSummaryResponse {
        let query = month.flatMap { $0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) }
            .map { "?month=\($0)" } ?? ""
        return try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/month-summary\(query)",
            requiresAuth: true
        )
    }

    static func fetchKidMonthOverview(kidId: Int, month: String? = nil) async throws -> KidsMonthOverviewResponse {
        let query = month.flatMap { $0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) }
            .map { "?month=\($0)" } ?? ""
        return try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/month-overview\(query)",
            requiresAuth: true
        )
    }

    static func fetchKidDayDetail(kidId: Int, entryDate: String) async throws -> KidsDayDetailResponse {
        let encoded = entryDate.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? entryDate
        return try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/day?entry_date=\(encoded)",
            requiresAuth: true
        )
    }

    static func fetchKidLedger(kidId: Int, limit: Int = 200) async throws -> KidsLedgerResponse {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/ledger?limit=\(limit)",
            requiresAuth: true
        )
    }

    static func fetchKidChoreEntries(
        kidId: Int,
        limit: Int = 200,
        includeDeleted: Bool = false
    ) async throws -> [KidsChoreEntry] {
        let include = includeDeleted ? "true" : "false"
        return try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/chore-entries?limit=\(limit)&include_deleted=\(include)",
            requiresAuth: true
        )
    }

    static func fetchPendingApprovals(
        kidId: Int? = nil,
        choreType: String? = nil
    ) async throws -> [KidsApprovalOut] {
        var params: [String] = []
        if let kidId {
            params.append("kid_id=\(kidId)")
        }
        if let choreType, !choreType.isEmpty {
            let encoded = choreType.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? choreType
            params.append("chore_type=\(encoded)")
        }
        let query = params.isEmpty ? "" : "?\(params.joined(separator: "&"))"
        return try await ApiClient.shared.request(
            path: "kids/parents/approvals\(query)",
            requiresAuth: true
        )
    }

    static func approveChoreEntry(entryId: Int) async throws -> KidsChoreEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/approvals/\(entryId)/approve",
            method: "POST",
            requiresAuth: true
        )
    }

    static func rejectChoreEntry(entryId: Int) async throws -> KidsChoreEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/approvals/\(entryId)/reject",
            method: "POST",
            requiresAuth: true
        )
    }

    static func createKidDeposit(kidId: Int, payload: LedgerEntryCreate) async throws -> KidsLedgerEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/ledger/deposit",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func createKidWithdrawal(kidId: Int, payload: LedgerEntryCreate) async throws -> KidsLedgerEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/ledger/withdrawal",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func createKidStartingBalance(kidId: Int, payload: LedgerEntryCreate) async throws -> KidsLedgerEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/ledger/starting-balance",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func fetchPocketMoneyRule(kidId: Int) async throws -> PocketMoneyRuleOut? {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/pocket-money",
            requiresAuth: true
        )
    }

    static func updatePocketMoneyRule(kidId: Int, payload: PocketMoneyRuleUpsert) async throws -> PocketMoneyRuleOut {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/pocket-money",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func createParentChore(payload: ParentChoreCreate) async throws -> KidsChore {
        try await ApiClient.shared.request(
            path: "kids/parents/chores",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateParentChore(choreId: Int, payload: ParentChoreUpdate) async throws -> KidsChore {
        try await ApiClient.shared.request(
            path: "kids/parents/chores/\(choreId)",
            method: "PATCH",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteParentChore(choreId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "kids/parents/chores/\(choreId)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func setChoreAssignments(choreId: Int, payload: ChoreAssignmentRequest) async throws {
        try await ApiClient.shared.requestVoid(
            path: "kids/parents/chores/\(choreId)/assignments",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func createParentKidChoreEntry(kidId: Int, payload: ParentChoreEntryCreate) async throws -> KidsChoreEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/chore-entries",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateParentKidChoreEntry(
        kidId: Int,
        entryId: Int,
        payload: ParentChoreEntryUpdate
    ) async throws -> KidsChoreEntry {
        try await ApiClient.shared.request(
            path: "kids/parents/children/\(kidId)/chore-entries/\(entryId)",
            method: "PATCH",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteParentKidChoreEntry(kidId: Int, entryId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "kids/parents/children/\(kidId)/chore-entries/\(entryId)",
            method: "DELETE",
            requiresAuth: true
        )
    }
}
