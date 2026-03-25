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
        ApiClient.shared.authFailureHandler = { [weak self] in
            Task { @MainActor in
                await self?.handleInvalidSession()
            }
        }
        self.authService.tokensProvider = { [weak self] in self?.tokens }
        self.authService.tokensHandler = { [weak self] tokens in
            Task { @MainActor in
                self?.save(tokens)
            }
        }
        Task {
            await PushNotificationCoordinator.shared.handleAuthStateChanged(isAuthenticated: self.isAuthenticated)
        }
    }

    var isAuthenticated: Bool {
        tokens?.accessToken.isEmpty == false
    }

    var currentUserId: Int? {
        guard let token = tokens?.accessToken else { return nil }
        return JwtHelper.decodeSubjectUserId(token)
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

    func logout() async {
        await PushNotificationCoordinator.shared.unregisterCurrentDevice()
        clearLocalSession()
        await PushNotificationCoordinator.shared.clearBadge()
        await PushNotificationCoordinator.shared.handleAuthStateChanged(isAuthenticated: false)
    }

    func deleteAccount() async throws {
        try await authService.deleteAccount()
        await logout()
    }

    private func save(_ tokens: AuthTokens) {
        self.tokens = tokens
        tokenStore.saveTokens(tokens)
        Task {
            await PushNotificationCoordinator.shared.handleAuthStateChanged(isAuthenticated: true)
        }
    }

    private func clearLocalSession() {
        tokens = nil
        tokenStore.clearTokens()
    }

    private func handleInvalidSession() async {
        guard tokens != nil else { return }
        clearLocalSession()
        await PushNotificationCoordinator.shared.clearBadge()
        await PushNotificationCoordinator.shared.handleAuthStateChanged(isAuthenticated: false)
    }
}
