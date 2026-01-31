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

    init() {
        let defaultEnv = Self.defaultEnvironment()
        if let saved = UserDefaults.standard.string(forKey: Self.storageKey),
           let env = AppEnvironment(rawValue: saved) {
            current = env
        } else {
            current = defaultEnv
            UserDefaults.standard.set(defaultEnv.rawValue, forKey: Self.storageKey)
        }
    }

    func set(_ environment: AppEnvironment) {
        current = environment
        UserDefaults.standard.set(environment.rawValue, forKey: Self.storageKey)
    }

    static func resolvedEnvironment() -> AppEnvironment {
        if let saved = UserDefaults.standard.string(forKey: storageKey),
           let env = AppEnvironment(rawValue: saved) {
            return env
        }
        return defaultEnvironment()
    }

    private static func defaultEnvironment() -> AppEnvironment {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "API_ENVIRONMENT") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        return AppEnvironment(rawValue: raw) ?? .dev
    }
}
