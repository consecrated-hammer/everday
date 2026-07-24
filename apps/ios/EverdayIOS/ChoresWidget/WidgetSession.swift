import Foundation

/// Wires the shared `ApiClient` to the keychain token in the widget process.
///
/// The widget runs separately from the app, so `ApiClient.shared` starts with no
/// token provider. We point it at the shared-keychain `KeychainTokenStore` (same
/// access group as the app) and persist any refreshed tokens back so the app and
/// widget stay in sync. There is no UI here, so an auth failure simply clears the
/// session and the widget renders its logged-out state.
enum WidgetSession {
    private static let tokenStore = KeychainTokenStore()

    /// Call once before issuing authenticated requests from the widget.
    static func configure() {
        ApiClient.shared.tokensProvider = { tokenStore.loadTokens() }
        ApiClient.shared.tokensHandler = { tokens in tokenStore.saveTokens(tokens) }
        ApiClient.shared.authFailureHandler = { tokenStore.clearTokens() }
    }

    static var isLoggedIn: Bool {
        tokenStore.loadTokens()?.accessToken.isEmpty == false
    }
}
