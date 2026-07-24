import Foundation

/// Shared identifiers used by both the main app and its extensions (e.g. the
/// chores widget). The widget runs in a separate process, so anything it needs
/// to read from the app — the auth token and the selected environment — must be
/// stored in a container both processes can reach.
enum AppGroup {
    /// App Group container id. Must match the `com.apple.security.application-groups`
    /// entitlement on both the app and the widget extension.
    static let identifier = "group.au.batserver.everday"

    /// Keychain access group used for the shared auth token. The value must match
    /// the `keychain-access-groups` entitlement on both targets. The leading
    /// component is the Apple team id (App Identifier Prefix), `8G8SGDTGM9`.
    static let keychainAccessGroup = "8G8SGDTGM9.au.batserver.everday.shared"

    /// UserDefaults suite shared across the app group. Falls back to `.standard`
    /// if the suite cannot be created (e.g. entitlement missing in a dev build).
    static let userDefaults: UserDefaults = UserDefaults(suiteName: identifier) ?? .standard
}
