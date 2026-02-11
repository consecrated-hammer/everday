import Foundation

struct SettingsUser: Decodable, Identifiable {
    let Id: Int
    let Username: String
    let FirstName: String?
    let LastName: String?
    let Email: String?
    let DiscordHandle: String?
    let Role: String
    let CreatedAt: String
    let RequirePasswordChange: Bool

    var id: Int { Id }

    var displayName: String {
        if let first = FirstName, !first.isEmpty {
            return first
        }
        return Username
    }
}

struct SettingsUserCreateRequest: Encodable {
    let Username: String
    let Password: String
    let Role: String
    let FirstName: String?
    let LastName: String?
    let Email: String?
    let DiscordHandle: String?
    let RequirePasswordChange: Bool
}

struct SettingsUserProfileUpdateRequest: Encodable {
    let FirstName: String?
    let LastName: String?
    let Email: String?
    let DiscordHandle: String?
}

struct SettingsUserRoleUpdateRequest: Encodable {
    let Role: String
}

struct SettingsUserPasswordUpdateRequest: Encodable {
    let NewPassword: String
}

struct TaskSettings: Decodable, Equatable {
    let OverdueReminderTime: String?
    let OverdueReminderTimeZone: String?
    let OverdueLastNotifiedDate: String?
    let OverdueRemindersEnabled: Bool?
}

struct TaskSettingsUpdateRequest: Encodable {
    let OverdueReminderTime: String?
    let OverdueReminderTimeZone: String?
    let OverdueRemindersEnabled: Bool?
}

struct TaskOverdueRun: Decodable, Identifiable {
    let Id: Int
    let RanAt: String
    let Result: String
    let NotificationsSent: Int?
    let OverdueTasks: Int?
    let UsersProcessed: Int?
    let ErrorMessage: String?
    let TriggeredByUserId: Int?

    var id: Int { Id }
}

struct TaskNotificationRunResponse: Decodable {
    let RemindersSent: Int
    let OverdueSent: Int
}

struct IntegrationUserInfo: Decodable {
    let Id: Int
    let Username: String
    let FirstName: String?
    let LastName: String?
    let Role: String

    var displayName: String {
        let first = (FirstName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let last = (LastName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let combined = [first, last].filter { !$0.isEmpty }.joined(separator: " ")
        return combined.isEmpty ? Username : combined
    }
}

struct GmailIntegrationStatus: Decodable {
    let Connected: Bool
    let NeedsReauth: Bool
    let AccountEmail: String?
    let Scope: String?
    let ConnectedAt: String?
    let UpdatedAt: String?
    let ConnectedBy: IntegrationUserInfo?
    let ValidatedAt: String?
    let ValidationError: String?
}

struct GoogleIntegrationStatus: Decodable {
    let Connected: Bool
    let NeedsReauth: Bool
    let CalendarId: String?
    let TaskListId: String?
    let Scope: String?
    let ConnectedAt: String?
    let UpdatedAt: String?
    let ConnectedBy: IntegrationUserInfo?
    let ValidatedAt: String?
    let ValidationError: String?
}

struct IntegrationAuthUrlResponse: Decodable {
    let Url: String
}

struct SystemStatusResponse: Decodable {
    let status: String
    let detail: String?
}
