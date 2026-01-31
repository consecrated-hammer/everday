import Foundation

protocol TokenStore {
    func loadTokens() -> AuthTokens?
    func saveTokens(_ tokens: AuthTokens)
    func clearTokens()
}

final class KeychainTokenStore: TokenStore {
    private let service = "au.batserver.everday"
    private let account = "authTokens"

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

    private func save(_ data: Data) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

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
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: kCFBooleanTrue as Any,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    private func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
