import Foundation

struct AuthTokens: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int
    let username: String
    let requirePasswordChange: Bool
    let role: String
    let firstName: String?
    let lastName: String?
    let email: String?
    let discordHandle: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "AccessToken"
        case refreshToken = "RefreshToken"
        case tokenType = "TokenType"
        case expiresIn = "ExpiresIn"
        case username = "Username"
        case requirePasswordChange = "RequirePasswordChange"
        case role = "Role"
        case firstName = "FirstName"
        case lastName = "LastName"
        case email = "Email"
        case discordHandle = "DiscordHandle"
    }
}
