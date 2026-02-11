import Foundation

final class AuthService {
    var tokensProvider: (() -> AuthTokens?)?
    var tokensHandler: ((AuthTokens) -> Void)?

    private let client: ApiClient

    init(client: ApiClient = .shared) {
        self.client = client
    }

    func login(username: String, password: String) async throws -> AuthTokens {
        struct LoginRequest: Encodable {
            let Username: String
            let Password: String
        }
        let tokens: AuthTokens = try await client.request(path: "auth/login", method: "POST", body: LoginRequest(Username: username, Password: password), requiresAuth: false)
        tokensHandler?(tokens)
        return tokens
    }

    func requestPasswordReset(identifier: String) async throws {
        struct ForgotRequest: Encodable {
            let Identifier: String
        }
        try await client.requestVoid(
            path: "auth/forgot",
            method: "POST",
            body: ForgotRequest(Identifier: identifier),
            requiresAuth: false
        )
    }

    func resetPassword(token: String, newPassword: String) async throws {
        struct ResetRequest: Encodable {
            let Token: String
            let NewPassword: String
        }
        try await client.requestVoid(
            path: "auth/reset-password",
            method: "POST",
            body: ResetRequest(Token: token, NewPassword: newPassword),
            requiresAuth: false
        )
    }
}
