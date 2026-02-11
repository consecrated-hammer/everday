import Foundation

enum NotificationsApi {
    static func fetchNotifications(includeRead: Bool, includeDismissed: Bool, limit: Int = 200, offset: Int = 0) async throws -> NotificationsListResponse {
        let readValue = includeRead ? "true" : "false"
        let dismissedValue = includeDismissed ? "true" : "false"
        return try await ApiClient.shared.request(
            path: "notifications?include_read=\(readValue)&include_dismissed=\(dismissedValue)&limit=\(limit)&offset=\(offset)",
            requiresAuth: true
        )
    }

    static func markRead(notificationId: Int) async throws -> NotificationItem {
        try await ApiClient.shared.request(
            path: "notifications/\(notificationId)/read",
            method: "POST",
            requiresAuth: true
        )
    }

    static func dismiss(notificationId: Int) async throws -> NotificationItem {
        try await ApiClient.shared.request(
            path: "notifications/\(notificationId)/dismiss",
            method: "POST",
            requiresAuth: true
        )
    }

    static func markAllRead() async throws -> NotificationsBulkUpdateResponse {
        try await ApiClient.shared.request(
            path: "notifications/read-all",
            method: "POST",
            requiresAuth: true
        )
    }
}
