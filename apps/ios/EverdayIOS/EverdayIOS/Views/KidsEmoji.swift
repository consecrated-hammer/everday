import Foundation

enum KidsEmoji {
    static let header: [String: String] = [
        "Brand": "🌟",
        "Greeting": "👋",
        "Subtitle": "🧭",
        "AvailableNow": "💰",
        "DailyJobs": "🧹",
        "Habits": "✨",
        "BonusTasks": "⭐",
        "ThisMonth": "📈",
        "History": "🗓️"
    ]

    static let choreTypes: [String: String] = [
        "Daily": "🧹",
        "Habit": "✨",
        "Bonus": "⭐"
    ]

    private static let doneEmojis: [String] = [
        "✨", "🎉", "🌟", "🤩", "🙌", "😄", "🥳", "🎯", "✅", "💫"
    ]

    static func headerEmoji(_ key: String) -> String {
        header[key] ?? ""
    }

    static func choreEmoji(chore: KidsChore?) -> String {
        guard let chore else { return "" }
        return choreTypes[chore.ChoreType] ?? ""
    }

    static func choreEmoji(type: String?) -> String {
        guard let type else { return "" }
        return choreTypes[type] ?? ""
    }

    static func randomDoneEmoji() -> String {
        doneEmojis.randomElement() ?? "✨"
    }
}
