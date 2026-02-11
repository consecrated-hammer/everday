import Foundation

enum TasksFormatters {
    static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        return formatter
    }()

    static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static func parseDateKey(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return apiDateFormatter.date(from: value)
    }

    static func formatDateKey(_ date: Date) -> String {
        apiDateFormatter.string(from: date)
    }

    static func formatDueDate(_ value: String?) -> String {
        guard let date = parseDateKey(value) else { return "" }
        return displayDateFormatter.string(from: date)
    }

    static func isOverdue(_ value: String?) -> Bool {
        guard let date = parseDateKey(value) else { return false }
        let today = Calendar.current.startOfDay(for: Date())
        return date < today
    }
}
