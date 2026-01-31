import Foundation

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var tokens: AuthTokens?

    private let authService: AuthService
    private let tokenStore: TokenStore

    init(authService: AuthService = AuthService(), tokenStore: TokenStore = KeychainTokenStore()) {
        self.authService = authService
        self.tokenStore = tokenStore
        self.tokens = tokenStore.loadTokens()
        ApiClient.shared.tokensProvider = { [weak self] in self?.tokens }
        ApiClient.shared.tokensHandler = { [weak self] tokens in
            Task { @MainActor in
                self?.save(tokens)
            }
        }
        self.authService.tokensProvider = { [weak self] in self?.tokens }
        self.authService.tokensHandler = { [weak self] tokens in
            Task { @MainActor in
                self?.save(tokens)
            }
        }
    }

    var isAuthenticated: Bool {
        tokens?.accessToken.isEmpty == false
    }

    var displayName: String {
        let first = tokens?.firstName ?? ""
        let last = tokens?.lastName ?? ""
        let combined = [first, last].filter { !$0.isEmpty }.joined(separator: " ")
        if !combined.isEmpty {
            return combined
        }
        return tokens?.username ?? "Account"
    }

    func login(username: String, password: String) async throws {
        let result = try await authService.login(username: username, password: password)
        save(result)
    }

    func logout() {
        tokens = nil
        tokenStore.clearTokens()
    }

    private func save(_ tokens: AuthTokens) {
        self.tokens = tokens
        tokenStore.saveTokens(tokens)
    }
}
