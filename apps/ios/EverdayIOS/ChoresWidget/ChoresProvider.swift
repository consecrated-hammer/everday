import WidgetKit
import Foundation

/// A single chore row shown in the widget.
struct ChoreItem: Identifiable, Hashable {
    let choreId: Int
    let label: String
    let emoji: String
    let isDone: Bool
    /// Set when the chore has a (non-deleted) entry today — used to delete/uncheck.
    let entryId: Int?
    /// Server "today" string used as the entry date when checking off.
    let entryDate: String
}

/// What the timeline currently knows about the kid's chores.
enum ChoresState: Hashable {
    case loggedOut
    case empty
    case loaded([ChoreItem])
    case failed
}

struct ChoresEntry: TimelineEntry {
    let date: Date
    let state: ChoresState
}

struct ChoresProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChoresEntry {
        ChoresEntry(date: Date(), state: .loaded([
            ChoreItem(choreId: -1, label: "Make your bed", emoji: "🧹", isDone: false, entryId: nil, entryDate: ""),
            ChoreItem(choreId: -2, label: "Brush teeth", emoji: "✨", isDone: true, entryId: -1, entryDate: "")
        ]))
    }

    func getSnapshot(in context: Context, completion: @escaping (ChoresEntry) -> Void) {
        Task {
            completion(await loadEntry())
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ChoresEntry>) -> Void) {
        Task {
            let entry = await loadEntry()
            // Refresh periodically so a new day's chores appear without opening the app.
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func loadEntry() async -> ChoresEntry {
        WidgetSession.configure()
        guard WidgetSession.isLoggedIn else {
            return ChoresEntry(date: Date(), state: .loggedOut)
        }
        do {
            let overview = try await KidsApi.fetchOverview()
            let items = Self.buildItems(from: overview)
            return ChoresEntry(date: Date(), state: items.isEmpty ? .empty : .loaded(items))
        } catch {
            return ChoresEntry(date: Date(), state: .failed)
        }
    }

    /// Maps the overview's chores + today's entries into rows, marking each chore
    /// done when it has a non-deleted entry for the day. Mirrors the app's
    /// KidsHomeView toggle model.
    static func buildItems(from overview: KidsOverviewResponse) -> [ChoreItem] {
        var entryByChore: [Int: KidsChoreEntry] = [:]
        for entry in overview.Entries where !entry.IsDeleted {
            entryByChore[entry.ChoreId] = entry
        }
        return overview.Chores
            .filter { $0.IsActive }
            .sorted { ($0.SortOrder, $0.Label.lowercased()) < ($1.SortOrder, $1.Label.lowercased()) }
            .map { chore in
                let entry = entryByChore[chore.Id]
                return ChoreItem(
                    choreId: chore.Id,
                    label: chore.Label,
                    emoji: KidsEmoji.choreEmoji(type: chore.ChoreType),
                    isDone: entry != nil,
                    entryId: entry?.Id,
                    entryDate: overview.Today
                )
            }
    }
}
