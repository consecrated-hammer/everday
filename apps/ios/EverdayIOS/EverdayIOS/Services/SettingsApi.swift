import Foundation

enum SettingsApi {
    static func fetchUsers() async throws -> [SettingsUser] {
        try await ApiClient.shared.request(path: "settings/users", requiresAuth: true)
    }

    static func createUser(_ request: SettingsUserCreateRequest) async throws -> SettingsUser {
        try await ApiClient.shared.request(path: "settings/users", method: "POST", body: request, requiresAuth: true)
    }

    static func updateUserRole(userId: Int, role: String) async throws -> SettingsUser {
        let payload = SettingsUserRoleUpdateRequest(Role: role)
        return try await ApiClient.shared.request(path: "settings/users/\(userId)/roles", method: "PUT", body: payload, requiresAuth: true)
    }

    static func updateUserProfile(userId: Int, request: SettingsUserProfileUpdateRequest) async throws -> SettingsUser {
        try await ApiClient.shared.request(path: "settings/users/\(userId)/profile", method: "PUT", body: request, requiresAuth: true)
    }

    static func updateUserPassword(userId: Int, newPassword: String) async throws -> SettingsUser {
        let payload = SettingsUserPasswordUpdateRequest(NewPassword: newPassword)
        return try await ApiClient.shared.request(path: "settings/users/\(userId)/password", method: "PUT", body: payload, requiresAuth: true)
    }

    static func fetchTaskSettings() async throws -> TaskSettings {
        try await ApiClient.shared.request(path: "tasks/settings", requiresAuth: true)
    }

    static func updateTaskSettings(_ request: TaskSettingsUpdateRequest) async throws -> TaskSettings {
        try await ApiClient.shared.request(path: "tasks/settings", method: "PUT", body: request, requiresAuth: true)
    }

    static func fetchTaskOverdueHistory(limit: Int = 20) async throws -> [TaskOverdueRun] {
        try await ApiClient.shared.request(path: "tasks/overdue/history?limit=\(limit)", requiresAuth: true)
    }

    static func runTaskNotifications() async throws -> TaskNotificationRunResponse {
        try await ApiClient.shared.request(path: "tasks/notifications/run", method: "POST", requiresAuth: true)
    }

    static func fetchGmailStatus(validate: Bool = false) async throws -> GmailIntegrationStatus {
        let query = validate ? "?validate=true" : ""
        return try await ApiClient.shared.request(path: "integrations/gmail/status\(query)", requiresAuth: true)
    }

    static func fetchGmailAuthUrl() async throws -> IntegrationAuthUrlResponse {
        try await ApiClient.shared.request(path: "integrations/gmail/oauth/start", requiresAuth: true)
    }

    static func fetchGoogleStatus(validate: Bool = false) async throws -> GoogleIntegrationStatus {
        let query = validate ? "?validate=true" : ""
        return try await ApiClient.shared.request(path: "integrations/google/status\(query)", requiresAuth: true)
    }

    static func fetchGoogleAuthUrl() async throws -> IntegrationAuthUrlResponse {
        try await ApiClient.shared.request(path: "integrations/google/oauth/start", requiresAuth: true)
    }
}
