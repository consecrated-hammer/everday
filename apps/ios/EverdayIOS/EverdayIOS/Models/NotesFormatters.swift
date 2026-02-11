import Foundation

enum NotesFormatters {
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

    static func extractPlainText(_ content: String?) -> String {
        guard let content, !content.isEmpty else { return "" }
        if let data = content.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) {
            var parts: [String] = []
            func walk(_ node: Any) {
                if let text = node as? String {
                    parts.append(text)
                    return
                }
                if let array = node as? [Any] {
                    array.forEach { walk($0) }
                    return
                }
                if let dict = node as? [String: Any] {
                    if let text = dict["text"] as? String {
                        parts.append(text)
                    }
                    if let content = dict["content"] {
                        walk(content)
                    }
                    if let children = dict["children"] {
                        walk(children)
                    }
                }
            }
            walk(json)
            let joined = parts.joined(separator: " ").replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            return joined.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func userTags(from labels: [String]) -> [String] {
        labels.filter { !$0.hasPrefix("everday:") }
    }

    static func scope(from labels: [String]) -> NotesScope {
        if labels.contains("everday:family") { return .family }
        if labels.contains("everday:shared") { return .shared }
        return .personal
    }

    static func applyScope(_ labels: [String], scope: NotesScope) -> [String] {
        var filtered = labels.filter { $0 != "everday:family" && $0 != "everday:shared" }
        switch scope {
        case .family:
            filtered.append("everday:family")
        case .shared:
            filtered.append("everday:shared")
        case .personal:
            break
        }
        return filtered
    }
}
