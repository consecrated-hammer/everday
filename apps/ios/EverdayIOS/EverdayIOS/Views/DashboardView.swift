import Charts
import SwiftUI

struct DashboardView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @ObservedObject var sharedData: HealthSharedDataStore

    let visibleModules: [DashboardModule]
    let onSelectModule: (DashboardModule) -> Void

    init(
        sharedData: HealthSharedDataStore,
        visibleModules: [DashboardModule] = DashboardModule.defaultOrder,
        onSelectModule: @escaping (DashboardModule) -> Void
    ) {
        self.sharedData = sharedData
        self.visibleModules = visibleModules
        self.onSelectModule = onSelectModule
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                progressCard
                weeklySummaryCard

                if !otherModules.isEmpty {
                    otherModulesCard
                }

                if !sharedData.errorMessage.isEmpty {
                    HealthErrorBanner(message: sharedData.errorMessage)
                }
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await sharedData.refresh()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Today")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Today")
                }
            }
        }
        .task {
            if sharedData.status == .idle {
                await sharedData.loadIfNeeded()
            }
        }
        .onAppear {
            guard sharedData.status != .idle, sharedData.status != .loading else { return }
            Task { await sharedData.refresh() }
        }
    }

    private var progressCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Daily progress",
                subtitle: progressSubtitle
            )

            if sharedData.status == .loading {
                ProgressView("Loading progress...")
            } else if progressRows.isEmpty {
                HealthEmptyState(message: "Set targets in Health to track progress here.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(progressRows, id: \.title) { row in
                        HealthProgressRow(title: row.title, value: row.value, target: row.target, unit: row.unit)
                    }
                }
            }
        }
    }

    private var weeklySummaryCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "This week",
                subtitle: "A light summary for the last 7 days."
            )

            if sharedData.status == .loading {
                ProgressView("Loading weekly summary...")
            } else if weeklySummaryDays.isEmpty {
                HealthEmptyState(message: "Log a few days to see your weekly pattern.")
            } else {
                Chart(weeklySummaryDays) { point in
                    BarMark(
                        x: .value("Day", point.label),
                        y: .value("Calories", point.calories)
                    )
                    .foregroundStyle(.blue.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
                .frame(height: 160)
                .chartYAxis {
                    AxisMarks(position: .leading)
                }

                HStack(spacing: 12) {
                    weekStat(title: "Avg calories", value: averageCaloriesText)
                    weekStat(title: "Logged days", value: "\(loggedDaysCount)/7")
                    weekStat(title: "Steps", value: weeklyStepsText)
                }
            }
        }
    }

    private var otherModulesCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Other modules",
                subtitle: "Keep the rest of Everday one tap away."
            )

            VStack(alignment: .leading, spacing: 10) {
                ForEach(otherModules) { module in
                    Button {
                        onSelectModule(module)
                    } label: {
                        DashboardModuleRow(module: module)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var progressSubtitle: String {
        guard let targets = logResponse?.Targets else { return "Targets appear after Health is configured." }
        let calorieTarget = adjustedCalorieTarget(targets: targets)
        if calorieTarget > 0 {
            return "Calories adjust using today's steps."
        }
        return "Track the targets you use most often."
    }

    private var progressRows: [TodayProgressRowModel] {
        guard let response = logResponse else { return [] }
        let targets = response.Targets
        let totals = response.Totals
        var rows: [TodayProgressRowModel] = []

        let adjustedCalories = adjustedCalorieTarget(targets: targets)
        if adjustedCalories > 0 {
            rows.append(.init(title: "Calories", value: totals.TotalCalories, target: adjustedCalories, unit: "kcal"))
        }
        if let target = targets.ProteinTargetMax ?? targets.ProteinTargetMin, target > 0 {
            rows.append(.init(title: "Protein", value: totals.TotalProtein, target: target, unit: "g"))
        }
        if let target = targets.StepTarget, target > 0 {
            rows.append(.init(title: "Steps", value: Double(currentSteps), target: Double(target), unit: "steps"))
        }

        return Array(rows.prefix(3))
    }

    private var currentSteps: Int {
        logResponse?.DailyLog?.Steps ?? logResponse?.Summary.Steps ?? 0
    }

    private var weeklySummaryDays: [TodayWeeklyPoint] {
        guard let weeklySummary else { return [] }
        return weeklySummary.Days.compactMap { day in
            guard let date = HealthFormatters.date(from: day.LogDate) else { return nil }
            return TodayWeeklyPoint(
                label: shortWeekday(from: date),
                date: date,
                calories: day.TotalCalories,
                steps: day.Steps
            )
        }
    }

    private var averageCaloriesText: String {
        guard !weeklySummaryDays.isEmpty else { return "-" }
        let total = weeklySummaryDays.reduce(0) { $0 + $1.calories }
        let average = total / Double(weeklySummaryDays.count)
        return HealthFormatters.formatCalories(average)
    }

    private var loggedDaysCount: Int {
        weeklySummaryDays.filter { $0.calories > 0 || $0.steps > 0 }.count
    }

    private var weeklyStepsText: String {
        let total = weeklySummaryDays.reduce(0) { $0 + $1.steps }
        return HealthFormatters.formatInteger(total)
    }

    private var otherModules: [DashboardModule] {
        visibleModules.filter { $0 != .health }
    }

    private var logResponse: HealthDailyLogResponse? {
        sharedData.logResponse
    }

    private var weeklySummary: HealthWeeklySummary? {
        sharedData.weeklySummary
    }

    private func adjustedCalorieTarget(targets: HealthTargets) -> Double {
        let base = Double(targets.DailyCalorieTarget ?? 0)
        if base == 0 {
            return 0
        }
        let stepFactor = logResponse?.DailyLog?.StepKcalFactorOverride ?? targets.StepKcalFactor ?? 0
        return max(0, base + Double(currentSteps) * stepFactor)
    }

    private func shortWeekday(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("EEE")
        return formatter.string(from: date)
    }

    @ViewBuilder
    private func weekStat(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
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
            return "Track meals, steps, and weight"
        case .shopping:
            return "Shared household list"
        case .kidsAdmin:
            return "Schedules and balances"
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
            return "cart"
        case .kidsAdmin:
            return "person.2"
        case .tasks:
            return "checklist"
        case .budget:
            return "chart.pie"
        case .lifeAdmin:
            return "folder"
        case .notes:
            return "note.text"
        }
    }
}

private struct DashboardModuleRow: View {
    let module: DashboardModule

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: module.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(.teal)
                .frame(width: 36, height: 36)
                .background(Color.teal.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(module.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(module.subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct TodayProgressRowModel {
    let title: String
    let value: Double
    let target: Double
    let unit: String
}

private struct TodayWeeklyPoint: Identifiable {
    let id = UUID()
    let label: String
    let date: Date
    let calories: Double
    let steps: Int
}
