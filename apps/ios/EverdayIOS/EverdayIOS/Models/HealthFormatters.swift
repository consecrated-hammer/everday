import Foundation

enum HealthFormatters {
    static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE d MMM"
        return formatter
    }()

    static let longDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()

    static func dateKey(from date: Date) -> String {
        isoDateFormatter.string(from: date)
    }

    static func date(from key: String?) -> Date? {
        guard let key, !key.isEmpty else { return nil }
        return isoDateFormatter.date(from: key)
    }

    static func formatShortDate(_ key: String?) -> String {
        guard let date = date(from: key) else { return "" }
        return shortDateFormatter.string(from: date)
    }

    static func formatLongDate(_ key: String?) -> String {
        guard let date = date(from: key) else { return "" }
        return longDateFormatter.string(from: date)
    }

    static func formatNumber(_ value: Double, decimals: Int = 0) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = decimals
        formatter.maximumFractionDigits = decimals
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.*f", decimals, value)
    }

    static func formatInteger(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    static func formatCalories(_ value: Double) -> String {
        let rounded = Int(value.rounded())
        return "\(formatInteger(rounded)) kcal"
    }

    static func formatGrams(_ value: Double, decimals: Int = 1) -> String {
        return "\(formatNumber(value, decimals: decimals)) g"
    }
}
