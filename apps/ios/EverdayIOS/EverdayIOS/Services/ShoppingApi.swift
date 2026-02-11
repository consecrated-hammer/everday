import Foundation

enum ShoppingApi {
    static func fetchItems(householdId: Int, includeInactive: Bool = false) async throws -> [ShoppingItem] {
        let inactiveValue = includeInactive ? "true" : "false"
        return try await ApiClient.shared.request(
            path: "shopping/items?household_id=\(householdId)&include_inactive=\(inactiveValue)",
            requiresAuth: true
        )
    }

    static func createItem(_ request: ShoppingItemCreate) async throws -> ShoppingItem {
        try await ApiClient.shared.request(
            path: "shopping/items",
            method: "POST",
            body: request,
            requiresAuth: true
        )
    }

    static func updateItem(itemId: Int, householdId: Int, request: ShoppingItemUpdate) async throws -> ShoppingItem {
        try await ApiClient.shared.request(
            path: "shopping/items/\(itemId)?household_id=\(householdId)",
            method: "PUT",
            body: request,
            requiresAuth: true
        )
    }

    static func deleteItem(itemId: Int, householdId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "shopping/items/\(itemId)?household_id=\(householdId)",
            method: "DELETE",
            requiresAuth: true
        )
    }
}
