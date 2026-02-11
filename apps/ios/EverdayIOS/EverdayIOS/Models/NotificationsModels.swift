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
