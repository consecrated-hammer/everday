import WidgetKit
import SwiftUI

struct ChoresWidget: Widget {
    static let kind = "EverdayChoresWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: ChoresProvider()) { entry in
            ChoresWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("My Chores")
        .description("Check off today's chores without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct ChoresWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ChoresEntry

    private var maxRows: Int {
        switch family {
        case .systemSmall: return 3
        case .systemMedium: return 4
        default: return 8
        }
    }

    var body: some View {
        switch entry.state {
        case .loggedOut:
            messageView("Open Everday to sign in", systemImage: "person.crop.circle.badge.exclamationmark")
        case .failed:
            messageView("Couldn't load chores", systemImage: "exclamationmark.triangle")
        case .empty:
            messageView("No chores today 🎉", systemImage: "checkmark.seal")
        case .loaded(let items):
            loadedView(items)
        }
    }

    private func loadedView(_ items: [ChoreItem]) -> some View {
        let visible = Array(items.prefix(maxRows))
        let remaining = items.count - visible.count
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Today's chores")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(items.filter { $0.isDone }.count)/\(items.count)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            ForEach(visible) { item in
                choreRow(item)
            }
            if remaining > 0 {
                Text("+\(remaining) more")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
    }

    private func choreRow(_ item: ChoreItem) -> some View {
        Button(intent: CompleteChoreIntent(item: item)) {
            HStack(spacing: 8) {
                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.isDone ? Color.green : Color.secondary)
                if !item.emoji.isEmpty {
                    Text(item.emoji)
                }
                Text(item.label)
                    .font(.subheadline)
                    .strikethrough(item.isDone, color: .secondary)
                    .foregroundStyle(item.isDone ? .secondary : .primary)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private func messageView(_ text: String, systemImage: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(text)
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
