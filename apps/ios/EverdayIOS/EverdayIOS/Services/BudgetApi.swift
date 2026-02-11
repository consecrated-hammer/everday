import Foundation

enum BudgetApi {
    static func fetchIncomeStreams() async throws -> [IncomeStream] {
        try await ApiClient.shared.request(path: "budget/income-streams", requiresAuth: true)
    }

    static func createIncomeStream(_ payload: IncomeStreamCreate) async throws -> IncomeStream {
        try await ApiClient.shared.request(
            path: "budget/income-streams",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateIncomeStream(id: Int, payload: IncomeStreamUpdate) async throws -> IncomeStream {
        try await ApiClient.shared.request(
            path: "budget/income-streams/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteIncomeStream(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "budget/income-streams/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchExpenses() async throws -> [Expense] {
        try await ApiClient.shared.request(path: "budget/expenses", requiresAuth: true)
    }

    static func createExpense(_ payload: ExpenseCreate) async throws -> Expense {
        try await ApiClient.shared.request(
            path: "budget/expenses",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateExpense(id: Int, payload: ExpenseUpdate) async throws -> Expense {
        try await ApiClient.shared.request(
            path: "budget/expenses/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteExpense(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "budget/expenses/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchExpenseAccounts() async throws -> [ExpenseAccount] {
        try await ApiClient.shared.request(path: "budget/expense-accounts", requiresAuth: true)
    }

    static func createExpenseAccount(_ payload: ExpenseAccountCreate) async throws -> ExpenseAccount {
        try await ApiClient.shared.request(
            path: "budget/expense-accounts",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateExpenseAccount(id: Int, payload: ExpenseAccountUpdate) async throws -> ExpenseAccount {
        try await ApiClient.shared.request(
            path: "budget/expense-accounts/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteExpenseAccount(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "budget/expense-accounts/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchExpenseTypes() async throws -> [ExpenseType] {
        try await ApiClient.shared.request(path: "budget/expense-types", requiresAuth: true)
    }

    static func createExpenseType(_ payload: ExpenseTypeCreate) async throws -> ExpenseType {
        try await ApiClient.shared.request(
            path: "budget/expense-types",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateExpenseType(id: Int, payload: ExpenseTypeUpdate) async throws -> ExpenseType {
        try await ApiClient.shared.request(
            path: "budget/expense-types/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteExpenseType(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "budget/expense-types/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchAllocationAccounts() async throws -> [AllocationAccount] {
        try await ApiClient.shared.request(path: "budget/allocation-accounts", requiresAuth: true)
    }

    static func createAllocationAccount(_ payload: AllocationAccountCreate) async throws -> AllocationAccount {
        try await ApiClient.shared.request(
            path: "budget/allocation-accounts",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateAllocationAccount(id: Int, payload: AllocationAccountUpdate) async throws -> AllocationAccount {
        try await ApiClient.shared.request(
            path: "budget/allocation-accounts/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteAllocationAccount(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "budget/allocation-accounts/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }
}
