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
}
