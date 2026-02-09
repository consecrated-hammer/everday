import Foundation

enum ShoppingFormatters {
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
}
