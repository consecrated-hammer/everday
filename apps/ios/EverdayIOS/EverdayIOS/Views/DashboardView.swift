import Charts
import SwiftUI

struct DashboardView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var status: TodayLoadState = .idle
    @State private var errorMessage = ""
    @State private var logResponse: HealthDailyLogResponse?
    @State private var weeklySummary: HealthWeeklySummary?

    let visibleModules: [DashboardModule]
    let onSelectModule: (DashboardModule) -> Void
    let onQuickAction: (DashboardQuickAction) -> Void

    init(
        visibleModules: [DashboardModule] = DashboardModule.defaultOrder,
        onSelectModule: @escaping (DashboardModule) -> Void,
        onQuickAction: @escaping (DashboardQuickAction) -> Void
    ) {
        self.visibleModules = visibleModules
        self.onSelectModule = onSelectModule
        self.onQuickAction = onQuickAction
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                heroCard
                quickActionsCard
                progressCard
                weeklySummaryCard

                if !otherModules.isEmpty {
                    otherModulesCard
                }

                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await load()
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
            if status == .idle {
                await load()
            }
        }
    }

    private var heroCard: some View {
        HealthSectionCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "heart.text.square.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Color.teal, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Health")
                        .font(.headline)
                    Text(heroTitle)
                        .font(.title3.weight(.semibold))
                    Text(heroSubtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }

            let columns = Array(
                repeating: GridItem(.flexible(), spacing: 12),
                count: horizontalSizeClass == .regular ? 4 : 2
            )

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(metricTiles, id: \.title) { tile in
                    HealthMetricTile(title: tile.title, value: tile.value, detail: tile.detail)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Button(heroPrimaryAction.title) {
                    onQuickAction(heroPrimaryAction.action)
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    onSelectModule(.health)
                } label: {
                    Label("Open full health view", systemImage: "arrow.right.circle")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var quickActionsCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Quick actions",
                subtitle: "Capture today without opening the full module."
            )

            LazyVGrid(columns: quickActionColumns, spacing: 12) {
                ForEach(quickActions) { item in
                    quickActionButton(item)
                }
            }
        }
    }

    private var progressCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Daily progress",
                subtitle: progressSubtitle
            )

            if status == .loading {
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

            if status == .loading {
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

    private var quickActions: [TodayQuickActionItem] {
        [
            TodayQuickActionItem(
                title: "Log meal",
                subtitle: "Capture your next meal quickly.",
                systemImage: "fork.knife",
                action: .logMeal,
                isPrimary: true,
                tint: .teal
            ),
            TodayQuickActionItem(
                title: "Log steps",
                subtitle: "Update steps for today.",
                systemImage: "figure.walk",
                action: .logSteps
            ),
            TodayQuickActionItem(
                title: "Log weight",
                subtitle: "Add a weight check-in.",
                systemImage: "scalemass",
                action: .logWeight
            ),
            TodayQuickActionItem(
                title: "Meal log",
                subtitle: "Review what you already logged.",
                systemImage: "list.bullet",
                action: .openMealLog
            ),
            TodayQuickActionItem(
                title: "Foods",
                subtitle: "Browse saved foods and portions.",
                systemImage: "fork.knife.circle",
                action: .openFoods
            ),
        ]
    }

    private var quickActionColumns: [GridItem] {
        let columnCount = horizontalSizeClass == .regular ? 3 : 2
        return Array(repeating: GridItem(.flexible(), spacing: 12), count: columnCount)
    }

    private var heroTitle: String {
        guard status != .loading else { return "Loading your health summary" }
        guard let response = logResponse else { return "Start with health today" }

        let remainingCalories = response.Totals.RemainingCalories
        if response.Entries.isEmpty {
            return "Start your food log for today"
        }
        if remainingCalories > 0 {
            return "\(HealthFormatters.formatCalories(remainingCalories)) remaining"
        }
        if remainingCalories < 0 {
            return "You are \(HealthFormatters.formatCalories(abs(remainingCalories))) over target"
        }
        return "You are right on today's target"
    }

    private var heroSubtitle: String {
        if status == .loading {
            return "Pulling together today's health view."
        }
        if let logDate = logResponse?.Summary.LogDate, !logDate.isEmpty {
            return "\(HealthFormatters.formatLongDate(logDate)). Use quick actions when you need to update something fast."
        }
        return "Meals, steps, and weight stay one tap away."
    }

    private var heroPrimaryAction: (title: String, action: DashboardQuickAction) {
        guard let response = logResponse else {
            return ("Log meal", .logMeal)
        }
        if response.Entries.isEmpty {
            return ("Log meal", .logMeal)
        }
        if currentSteps == 0 {
            return ("Log steps", .logSteps)
        }
        if currentWeight == nil {
            return ("Log weight", .logWeight)
        }
        return ("Open meal log", .openMealLog)
    }

    private var metricTiles: [TodayMetricTileModel] {
        guard let response = logResponse else {
            return [
                TodayMetricTileModel(title: "Calories", value: "-", detail: nil),
                TodayMetricTileModel(title: "Protein", value: "-", detail: nil),
                TodayMetricTileModel(title: "Steps", value: "-", detail: nil),
                TodayMetricTileModel(title: "Weight", value: "-", detail: nil),
            ]
        }

        return [
            TodayMetricTileModel(title: "Calories", value: HealthFormatters.formatCalories(response.Totals.TotalCalories), detail: nil),
            TodayMetricTileModel(title: "Protein", value: HealthFormatters.formatGrams(response.Totals.TotalProtein), detail: nil),
            TodayMetricTileModel(title: "Steps", value: HealthFormatters.formatInteger(currentSteps), detail: "today"),
            TodayMetricTileModel(
                title: "Weight",
                value: currentWeight.map { "\(HealthFormatters.formatNumber($0, decimals: 1)) kg" } ?? "-",
                detail: currentWeight == nil ? "not logged" : nil
            ),
        ]
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

    private var currentWeight: Double? {
        logResponse?.DailyLog?.WeightKg
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

    private var todayKey: String {
        HealthFormatters.dateKey(from: Date())
    }

    private var weekStartKey: String {
        let start = Calendar.current.date(byAdding: .day, value: -6, to: Date()) ?? Date()
        return HealthFormatters.dateKey(from: start)
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

    private func load() async {
        status = .loading
        errorMessage = ""

        do {
            async let logResult = HealthApi.fetchDailyLog(date: todayKey)
            async let summaryResult = HealthApi.fetchWeeklySummary(startDate: weekStartKey)
            logResponse = try await logResult
            weeklySummary = try await summaryResult
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load today's health summary."
        }
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

    @ViewBuilder
    private func quickActionButton(_ item: TodayQuickActionItem) -> some View {
        let button = Button {
            if let module = item.module {
                onSelectModule(module)
            } else if let action = item.action {
                onQuickAction(action)
            }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Label(item.title, systemImage: item.systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .labelStyle(.titleAndIcon)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(item.subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 88, alignment: .topLeading)
        }
        .tint(item.tint)

        if item.isPrimary {
            button.buttonStyle(.borderedProminent)
        } else {
            button.buttonStyle(.bordered)
        }
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

private enum TodayLoadState {
    case idle
    case loading
    case ready
    case error
}

private struct TodayMetricTileModel {
    let title: String
    let value: String
    let detail: String?
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

private struct TodayQuickActionItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let systemImage: String
    let action: DashboardQuickAction?
    let module: DashboardModule?
    var isPrimary = false
    var tint: Color = .accentColor

    init(
        title: String,
        subtitle: String,
        systemImage: String,
        action: DashboardQuickAction? = nil,
        module: DashboardModule? = nil,
        isPrimary: Bool = false,
        tint: Color = .accentColor
    ) {
        self.id = title
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.action = action
        self.module = module
        self.isPrimary = isPrimary
        self.tint = tint
    }
}
