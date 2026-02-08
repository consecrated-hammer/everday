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
