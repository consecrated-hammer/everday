import SwiftUI

struct DashboardView: View {
    @State private var editMode: EditMode = .inactive
    @State private var modules: [DashboardModule]

    let onSelectModule: (DashboardModule) -> Void
    let onQuickAction: (DashboardQuickAction) -> Void

    init(
        visibleModules: [DashboardModule] = DashboardModule.defaultOrder,
        onSelectModule: @escaping (DashboardModule) -> Void,
        onQuickAction: @escaping (DashboardQuickAction) -> Void
    ) {
        self.onSelectModule = onSelectModule
        self.onQuickAction = onQuickAction
        _modules = State(initialValue: visibleModules)
    }

    var body: some View {
        List {
            quickActionsRow
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 8, trailing: 16))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)

            ForEach(modules) { module in
                moduleRow(module)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
            }
            .onMove(perform: moveModule)
        }
        .environment(\.editMode, $editMode)
        .listStyle(.plain)
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Everday")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(editMode.isEditing ? "Done" : "Edit") {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        editMode = editMode.isEditing ? .inactive : .active
                    }
                }
            }
            ToolbarItem(placement: .principal) {
                DashboardTitleView()
            }
        }
    }

    private func moveModule(from source: IndexSet, to destination: Int) {
        modules.move(fromOffsets: source, toOffset: destination)
    }

    @ViewBuilder
    private func moduleRow(_ module: DashboardModule) -> some View {
        if editMode.isEditing {
            DashboardModuleRow(module: module, isEditing: true)
        } else {
            Button {
                onSelectModule(module)
            } label: {
                DashboardModuleRow(module: module, isEditing: false, showsChevron: true)
            }
            .buttonStyle(.plain)
        }
    }

    private var quickActionsRow: some View {
        HStack(spacing: 10) {
            Button {
                onQuickAction(.logMeal)
            } label: {
                Label("Log meal", systemImage: "fork.knife")
                    .font(.headline.weight(.semibold))
                    .frame(maxWidth: .infinity)
            }
            .labelStyle(.titleAndIcon)
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .accessibilityLabel("Log meal")

            Menu {
                Button {
                    onQuickAction(.logSteps)
                } label: {
                    Label("Log steps", systemImage: "figure.walk")
                }
                Button {
                    onQuickAction(.logWeight)
                } label: {
                    Label("Log weight", systemImage: "scalemass")
                }
                Divider()
                Button {
                    onQuickAction(.openMealLog)
                } label: {
                    Label("Open meal log", systemImage: "list.bullet")
                }
                Button {
                    onQuickAction(.openFoods)
                } label: {
                    Label("Open foods", systemImage: "fork.knife.circle")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 36, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More actions")
        }
    }
}

private struct DashboardTitleView: View {
    var body: some View {
        HStack(spacing: 8) {
            Image("EverdayMark")
                .resizable()
                .scaledToFit()
                .frame(width: 32, height: 32)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            Text("Everday")
                .font(.headline)
                .lineLimit(1)
            Spacer()
        }
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }
}

enum DashboardQuickAction {
    case logMeal
    case logSteps
    case logWeight
    case openMealLog
    case openFoods
}

enum DashboardModule: String, CaseIterable, Identifiable {
    case health
    case shopping
    case kidsAdmin
    case tasks
    case budget
    case lifeAdmin
    case notes

    static let defaultOrder: [DashboardModule] = [
        .health,
        .shopping,
        .kidsAdmin,
        .tasks,
        .budget,
        .lifeAdmin,
        .notes,
    ]

    static let coreOrder: [DashboardModule] = [
        .health,
        .shopping,
        .kidsAdmin,
    ]

    var id: String { rawValue }

    var title: String {
        switch self {
        case .health:
            return "Health"
        case .shopping:
            return "Shopping"
        case .kidsAdmin:
            return "Kids admin"
        case .tasks:
            return "Tasks"
        case .budget:
            return "Budget"
        case .lifeAdmin:
            return "Life admin"
        case .notes:
            return "Notes"
        }
    }

    var subtitle: String {
        switch self {
        case .health:
            return "Track health and meals"
        case .shopping:
            return "Shared lists and groceries"
        case .kidsAdmin:
            return "Schedules, chores, permissions"
        case .tasks:
            return "Personal and shared tasks"
        case .budget:
            return "Income, expenses, allocations"
        case .lifeAdmin:
            return "Records, library, builder"
        case .notes:
            return "Capture and organise notes"
        }
    }

    var systemImage: String {
        switch self {
        case .health:
            return "heart.text.square"
        case .shopping:
            return "cart.fill"
        case .kidsAdmin:
            return "person.2.fill"
        case .tasks:
            return "checklist"
        case .budget:
            return "chart.pie.fill"
        case .lifeAdmin:
            return "folder.fill"
        case .notes:
            return "note.text"
        }
    }
}

private struct DashboardModuleRow: View {
    let module: DashboardModule
    let isEditing: Bool
    var showsChevron: Bool = true

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color(.secondarySystemBackground))
                    .frame(width: 40, height: 40)
                Image(systemName: module.systemImage)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.primary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(module.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(module.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            if !isEditing && showsChevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.primary.opacity(0.06), lineWidth: 1)
                )
        )
    }
}

private extension EditMode {
    var isEditing: Bool {
        self == .active
    }
}
