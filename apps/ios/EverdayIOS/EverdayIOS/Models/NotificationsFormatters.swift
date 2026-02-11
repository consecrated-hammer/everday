import Foundation

enum NotificationsFormatters {
    static let isoDateTimeFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    static func parseDateTime(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        if let parsed = isoDateTimeFormatter.date(from: value) {
            return parsed
        }
        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: value)
    }

    static func formatDateTime(_ value: String?) -> String {
        guard let date = parseDateTime(value) else { return "-" }
        return displayFormatter.string(from: date)
    }

    static func firstName(_ value: String?) -> String {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "" }
        return trimmed.split(separator: " ").first.map(String.init) ?? ""
    }

    static func metaLabel(createdAt: String?, createdByName: String?) -> String {
        var parts: [String] = []
        if let createdAt, !createdAt.isEmpty {
            parts.append(formatDateTime(createdAt))
        }
        let first = firstName(createdByName)
        if !first.isEmpty {
            parts.append("From \(first)")
        }
        return parts.joined(separator: " | ")
    }

    static func statusLabel(isRead: Bool, isDismissed: Bool) -> String {
        if isDismissed { return "Dismissed" }
        if isRead { return "Read" }
        return "Unread"
    }

    static func resolvedUrl(_ value: String?) -> URL? {
        guard let value, !value.isEmpty else { return nil }
        if let url = URL(string: value), url.scheme != nil {
            return url
        }
        let base = EnvironmentStore.resolvedEnvironment().baseUrl
        let path = value.hasPrefix("/") ? value : "/\(value)"
        return URL(string: base + path)
    }
}
