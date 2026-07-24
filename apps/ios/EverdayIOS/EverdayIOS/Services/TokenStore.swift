import Foundation

protocol TokenStore {
    func loadTokens() -> AuthTokens?
    func saveTokens(_ tokens: AuthTokens)
    func clearTokens()
}

final class KeychainTokenStore: TokenStore {
    private let service = "au.batserver.everday"
    private let account = "authTokens"

    /// When set, the keychain item is shared via this access group so the widget
    /// extension can read/refresh the same token. Defaults to the shared group;
    /// pass `nil` to fall back to the app-private keychain (e.g. unit tests).
    private let accessGroup: String?

    init(accessGroup: String? = AppGroup.keychainAccessGroup) {
        self.accessGroup = accessGroup
    }

    func loadTokens() -> AuthTokens? {
        guard let data = read() else { return nil }
        return try? JSONDecoder().decode(AuthTokens.self, from: data)
    }

    func saveTokens(_ tokens: AuthTokens) {
        guard let data = try? JSONEncoder().encode(tokens) else { return }
        save(data)
    }

    func clearTokens() {
        delete()
    }

    private func baseQuery() -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }

    private func save(_ data: Data) {
        let query = baseQuery()
        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]

        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecSuccess {
            return
        }

        var insert = query
        insert[kSecValueData as String] = data
        SecItemAdd(insert as CFDictionary, nil)
    }

    private func read() -> Data? {
        var query = baseQuery()
        query[kSecReturnData as String] = kCFBooleanTrue as Any
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    private func delete() {
        SecItemDelete(baseQuery() as CFDictionary)
    }
}
