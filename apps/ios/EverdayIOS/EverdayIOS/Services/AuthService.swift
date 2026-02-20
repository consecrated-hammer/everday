import Foundation

final class AuthService {
    var tokensProvider: (() -> AuthTokens?)?
    var tokensHandler: ((AuthTokens) -> Void)?

    private let client: ApiClient

    init(client: ApiClient = .shared) {
        self.client = client
    }

    func login(username: String, password: String) async throws -> AuthTokens {
        let tokens: AuthTokens = try await client.request(
            path: "auth/login",
            method: "POST",
            body: LoginRequestPayload(username: username, password: password),
            requiresAuth: false
        )
        tokensHandler?(tokens)
        return tokens
    }

    func register(request payload: RegisterRequestPayload) async throws -> RegisterResponse {
        return try await client.request(
            path: "auth/register",
            method: "POST",
            body: payload,
            requiresAuth: false
        )
    }

    func requestPasswordReset(identifier: String) async throws {
        try await client.requestVoid(
            path: "auth/forgot",
            method: "POST",
            body: ForgotPasswordRequestPayload(identifier: identifier),
            requiresAuth: false
        )
    }

    func resetPassword(token: String, newPassword: String) async throws {
        try await client.requestVoid(
            path: "auth/reset-password",
            method: "POST",
            body: ResetPasswordRequestPayload(token: token, newPassword: newPassword),
            requiresAuth: false
        )
    }
}

struct LoginRequestPayload: Encodable {
    let username: String
    let password: String

    enum CodingKeys: String, CodingKey {
        case username = "Username"
        case password = "Password"
    }
}

struct ForgotPasswordRequestPayload: Encodable {
    let identifier: String

    enum CodingKeys: String, CodingKey {
        case identifier = "Identifier"
    }
}

struct ResetPasswordRequestPayload: Encodable {
    let token: String
    let newPassword: String

    enum CodingKeys: String, CodingKey {
        case token = "Token"
        case newPassword = "NewPassword"
    }
}

struct RegisterRequestPayload: Encodable {
    let username: String
    let password: String
    let firstName: String?
    let lastName: String?
    let email: String?
    let discordHandle: String?

    enum CodingKeys: String, CodingKey {
        case username = "Username"
        case password = "Password"
        case firstName = "FirstName"
        case lastName = "LastName"
        case email = "Email"
        case discordHandle = "DiscordHandle"
    }
}

struct RegisterResponse: Decodable {
    let status: String
    let message: String

    enum CodingKeys: String, CodingKey {
        case status = "Status"
        case message = "Message"
    }
}
