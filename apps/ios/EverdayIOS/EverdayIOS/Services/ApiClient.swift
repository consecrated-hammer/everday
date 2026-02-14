import Foundation

final class ApiClient {
    static let shared = ApiClient()

    var tokensProvider: (() -> AuthTokens?)?
    var tokensHandler: ((AuthTokens) -> Void)?

    private let jsonDecoder = JSONDecoder()
    private let jsonEncoder = JSONEncoder()

    private var baseUrl: URL {
        let environment = EnvironmentStore.resolvedEnvironment()
        let raw = environment.baseUrl
        let withScheme = raw.hasPrefix("http") ? raw : "https://\(raw)"
        let normalized = withScheme.hasSuffix("/api") ? withScheme : "\(withScheme)/api"
        return URL(string: normalized) ?? URL(string: "https://everday.batserver.au/api")!
    }

    func request<T: Decodable>(path: String, method: String = "GET", body: Encodable? = nil, requiresAuth: Bool = false) async throws -> T {
        let url = buildUrl(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body {
            request.httpBody = try jsonEncoder.encode(AnyEncodable(body))
        }

        if requiresAuth {
            if let tokens = tokensProvider?(), JwtHelper.isTokenExpired(tokens.accessToken) {
                _ = try? await refreshTokens(refreshToken: tokens.refreshToken)
            }
            if let token = tokensProvider?()?.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 401, requiresAuth {
            if let refresh = tokensProvider?()?.refreshToken {
                let refreshed = try await refreshTokens(refreshToken: refresh)
                var retry = request
                retry.setValue("Bearer \(refreshed.accessToken)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: retry)
                return try decodeOrThrow(retryData, response: retryResponse)
            }
        }

        return try decodeOrThrow(data, response: response)
    }

    func requestVoid(path: String, method: String = "GET", body: Encodable? = nil, requiresAuth: Bool = false) async throws {
        let url = buildUrl(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body {
            request.httpBody = try jsonEncoder.encode(AnyEncodable(body))
        }

        if requiresAuth {
            if let tokens = tokensProvider?(), JwtHelper.isTokenExpired(tokens.accessToken) {
                _ = try? await refreshTokens(refreshToken: tokens.refreshToken)
            }
            if let token = tokensProvider?()?.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 401, requiresAuth {
            if let refresh = tokensProvider?()?.refreshToken {
                let refreshed = try await refreshTokens(refreshToken: refresh)
                var retry = request
                retry.setValue("Bearer \(refreshed.accessToken)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: retry)
                try validateVoidResponse(retryData, response: retryResponse)
                return
            }
        }

        try validateVoidResponse(data, response: response)
    }

    private func decodeOrThrow<T: Decodable>(_ data: Data, response: URLResponse) throws -> T {
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if let message = errorMessage(from: data) {
                throw ApiError(message: message)
            }
            throw ApiError(message: "Request failed")
        }
        return try jsonDecoder.decode(T.self, from: data)
    }

    private func errorMessage(from data: Data) -> String? {
        if let text = String(data: data, encoding: .utf8), !text.isEmpty {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detail = json["detail"] as? String, !detail.isEmpty {
                return detail
            }
            return text
        }
        return nil
    }

    private func validateVoidResponse(_ data: Data, response: URLResponse) throws {
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if let message = errorMessage(from: data) {
                throw ApiError(message: message)
            }
            throw ApiError(message: "Request failed")
        }
    }

    private func refreshTokens(refreshToken: String) async throws -> AuthTokens {
        struct RefreshRequest: Encodable {
            let RefreshToken: String
        }
        let refreshed: AuthTokens = try await request(path: "auth/refresh", method: "POST", body: RefreshRequest(RefreshToken: refreshToken), requiresAuth: false)
        tokensHandler?(refreshed)
        return refreshed
    }

    private func buildUrl(path: String) -> URL {
        let parts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        let rawPath = String(parts.first ?? "")
        let trimmedPath = rawPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var url = baseUrl.appendingPathComponent(trimmedPath)
        if parts.count > 1 {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.percentEncodedQuery = String(parts[1])
            if let updated = components?.url {
                url = updated
            }
        }
        return url
    }
}

struct AnyEncodable: Encodable {
    private let encodeImpl: (Encoder) throws -> Void

    init(_ encodable: Encodable) {
        self.encodeImpl = encodable.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeImpl(encoder)
    }
}

enum JwtHelper {
    static func isTokenExpired(_ token: String, skewSeconds: TimeInterval = 30) -> Bool {
        guard let exp = decodeExp(token) else { return true }
        let now = Date().timeIntervalSince1970
        return now + skewSeconds >= exp
    }

    static func decodeSubjectUserId(_ token: String) -> Int? {
        guard let payload = decodePayload(token) else { return nil }
        if let sub = payload["sub"] as? String {
            return Int(sub)
        }
        if let sub = payload["sub"] as? Int {
            return sub
        }
        if let sub = payload["sub"] as? Double {
            return Int(sub)
        }
        return nil
    }

    private static func decodeExp(_ token: String) -> TimeInterval? {
        guard let payload = decodePayload(token) else { return nil }
        if let exp = payload["exp"] as? Double {
            return exp
        }
        if let exp = payload["exp"] as? Int {
            return TimeInterval(exp)
        }
        if let exp = payload["exp"] as? String {
            return TimeInterval(exp)
        }
        return nil
    }

    private static func decodePayload(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".")
        guard parts.count > 1 else { return nil }
        let payload = parts[1]
        let normalized = payload
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padded = normalized + String(repeating: "=", count: (4 - normalized.count % 4) % 4)
        guard let data = Data(base64Encoded: padded),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json
    }
}
