import Foundation

enum SettingsApi {
    static func fetchUsers() async throws -> [SettingsUser] {
        try await ApiClient.shared.request(path: "settings/users", requiresAuth: true)
    }
}
