import Foundation

struct NotificationItem: Decodable, Identifiable {
    let Id: Int
    let Title: String
    let Body: String?
    let LinkUrl: String?
    let ActionLabel: String?
    let CreatedByName: String?
    let NotificationType: String
    let IsRead: Bool
    let IsDismissed: Bool
    let CreatedAt: String
    let UpdatedAt: String

    var id: Int { Id }

    enum CodingKeys: String, CodingKey {
        case Id
        case Title
        case Body
        case LinkUrl
        case ActionLabel
        case CreatedByName
        case NotificationType = "Type"
        case IsRead
        case IsDismissed
        case CreatedAt
        case UpdatedAt
    }
}

struct NotificationsListResponse: Decodable {
    let Notifications: [NotificationItem]
    let UnreadCount: Int
}

struct NotificationsBulkUpdateResponse: Decodable {
    let UpdatedCount: Int
}

struct NotificationBadgeCountResponse: Decodable {
    let UnreadCount: Int
}

struct NotificationDeviceRegisterRequest: Encodable {
    let Platform: String
    let DeviceToken: String
    let DeviceId: String?
    let PushEnvironment: String
    let AppVersion: String?
    let BuildNumber: String?
}

struct NotificationDeviceRegistrationResponse: Decodable {
    let Id: Int
    let Platform: String
    let DeviceId: String?
    let PushEnvironment: String
    let IsActive: Bool
}

struct NotificationDeviceUnregisterRequest: Encodable {
    let Platform: String
    let DeviceToken: String?
    let DeviceId: String?
}

struct NotificationDeviceUnregisterResponse: Decodable {
    let UpdatedCount: Int
}
