import Foundation

enum AppEnvironment: String, CaseIterable, Identifiable {
    case dev = "DEV"
    case prod = "PROD"

    var id: String { rawValue }

    var displayName: String { rawValue }

    var baseUrl: String {
        switch self {
        case .dev:
            return "https://everday-dev.batserver.au"
        case .prod:
            return "https://everday.batserver.au"
        }
    }
}

final class EnvironmentStore: ObservableObject {
    @Published private(set) var current: AppEnvironment

    private static let storageKey = "everday.app.environment"

    // Stored in the shared app-group suite so the widget extension resolves the
    // same backend the user selected in the app.
    private static var store: UserDefaults { AppGroup.userDefaults }

    init() {
        let defaultEnv = Self.defaultEnvironment()
        if let saved = Self.savedEnvironment() {
            current = saved
        } else {
            current = defaultEnv
            Self.store.set(defaultEnv.rawValue, forKey: Self.storageKey)
        }
    }

    func set(_ environment: AppEnvironment) {
        current = environment
        Self.store.set(environment.rawValue, forKey: Self.storageKey)
    }

    static func resolvedEnvironment() -> AppEnvironment {
        savedEnvironment() ?? defaultEnvironment()
    }

    /// Reads the saved environment from the shared suite, migrating a value
    /// previously written to `.standard` (pre app-group builds) if present.
    private static func savedEnvironment() -> AppEnvironment? {
        if let saved = store.string(forKey: storageKey),
           let env = AppEnvironment(rawValue: saved) {
            return env
        }
        if let legacy = UserDefaults.standard.string(forKey: storageKey),
           let env = AppEnvironment(rawValue: legacy) {
            store.set(env.rawValue, forKey: storageKey)
            return env
        }
        return nil
    }

    private static func defaultEnvironment() -> AppEnvironment {
        // Always default users to production unless they explicitly switch in Settings.
        return .prod
    }
}
