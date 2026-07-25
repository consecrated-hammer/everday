import AppIntents
import WidgetKit

/// Toggles a chore's done state straight from the widget (iOS 17+ interactive
/// widgets). Mirrors the app's `onToggleChore`: if the chore already has an entry
/// today we delete it (uncheck), otherwise we create one (check off).
struct CompleteChoreIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Chore"
    static var description = IntentDescription("Check a chore off, or undo it, from the home screen.")

    @Parameter(title: "Chore Id")
    var choreId: Int

    /// The existing entry id when the chore is currently done; absent means "not done yet".
    @Parameter(title: "Entry Id")
    var entryId: Int?

    @Parameter(title: "Entry Date")
    var entryDate: String

    init() {}

    init(item: ChoreItem) {
        self.choreId = item.choreId
        self.entryId = item.entryId
        self.entryDate = item.entryDate
    }

    func perform() async throws -> some IntentResult {
        WidgetSession.configure()
        guard WidgetSession.isLoggedIn else {
            return .result()
        }

        if let entryId {
            // Currently done → undo.
            try await KidsApi.deleteChoreEntry(entryId: entryId)
        } else {
            // Not done yet → check off for today.
            let payload = KidsChoreEntryCreate(ChoreId: choreId, EntryDate: entryDate, Notes: nil)
            _ = try await KidsApi.createChoreEntry(payload)
        }

        WidgetCenter.shared.reloadTimelines(ofKind: ChoresWidget.kind)
        return .result()
    }
}
