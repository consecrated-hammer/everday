import Charts
import SwiftUI

struct HealthTodayView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var logResponse: HealthDailyLogResponse?
    @State private var settings: HealthUserSettings?
    @State private var weeklySummary: HealthWeeklySummary?
    @State private var weightHistory: [HealthWeightHistoryEntry] = []
    @State private var stepsHistory: [HealthStepsHistoryEntry] = []
    @State private var showStepsSheet = false
    @State private var showWeightSheet = false
    @State private var lastHandledQuickLogStepsRequestNonce = 0
    @State private var lastHandledQuickLogWeightRequestNonce = 0
    var onQuickLogMeal: () -> Void = {}
    var quickLogStepsRequestNonce: Int = 0
    var quickLogWeightRequestNonce: Int = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                progressCard
                if settings?.ShowStepsChartOnToday != false {
                    stepsChartCard
                }
                if settings?.ShowWeightChartOnToday != false {
                    weightChartCard
                }
                weeklySummaryCard

                if status == .loading {
                    HealthEmptyState(message: "Loading today...")
                }
                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .frame(maxWidth: 860)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showStepsSheet) {
            HealthTodayStepsSheet(
                initialSteps: currentSteps,
                onSave: { steps in
                    Task { await updateStepsValue(steps) }
                }
            )
        }
        .sheet(isPresented: $showWeightSheet) {
            HealthTodayWeightSheet(
                initialWeight: currentWeight,
                onSave: { weight in
                    Task { await updateWeightValue(weight) }
                }
            )
        }
        .task {
            if status == .idle {
                await load()
            }
        }
        .onAppear {
            handleQuickLogStepsRequest(quickLogStepsRequestNonce)
            handleQuickLogWeightRequest(quickLogWeightRequestNonce)
        }
        .onChange(of: quickLogStepsRequestNonce) { _, newValue in
            handleQuickLogStepsRequest(newValue)
        }
        .onChange(of: quickLogWeightRequestNonce) { _, newValue in
            handleQuickLogWeightRequest(newValue)
        }
    }

    private var headerCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Today",
                subtitle: nil,
                trailing: AnyView(
                    Button {
                        onQuickLogMeal()
                    } label: {
                        Label("Log meal", systemImage: "fork.knife")
                    }
                    .buttonStyle(.borderedProminent)
                )
            )

            let columns = Array(
                repeating: GridItem(.flexible(), spacing: 12),
                count: horizontalSizeClass == .regular ? 3 : 2
            )

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(metricTiles, id: \.title) { tile in
                    HealthMetricTile(title: tile.title, value: tile.value, detail: tile.detail)
                }
            }
        }
    }

    private var progressCard: some View {
        HealthSectionCard {
            HealthSectionHeader(title: "Daily progress", subtitle: "Targets adjusted for today's steps.")
            if progressRows.isEmpty {
                HealthEmptyState(message: "No targets configured yet.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(progressRows, id: \.title) { row in
                        HealthProgressRow(title: row.title, value: row.value, target: row.target, unit: row.unit)
                    }
                }
            }
        }
    }

    private var stepsChartCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Steps this week",
                subtitle: "7 day trend.",
                trailing: AnyView(
                    Button("Log steps") {
                        showStepsSheet = true
                    }
                    .buttonStyle(.bordered)
                )
            )
            if stepsHistory.isEmpty {
                HealthEmptyState(message: "No steps logged yet.")
            } else {
                Chart(stepsHistory) { entry in
                    if let date = HealthFormatters.date(from: entry.LogDate) {
                        LineMark(
                            x: .value("Date", date),
                            y: .value("Steps", entry.Steps)
                        )
                        .foregroundStyle(.teal)
                        .symbol(.circle)
                    }
                }
                .frame(height: 180)
            }
        }
    }

    private var weightChartCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Weight trend",
                subtitle: "Recent check ins.",
                trailing: AnyView(
                    Button("Log weight") {
                        showWeightSheet = true
                    }
                    .buttonStyle(.bordered)
                )
            )
            if weightHistory.isEmpty {
                HealthEmptyState(message: "No weight data yet.")
            } else {
                Chart(weightHistory) { entry in
                    if let date = HealthFormatters.date(from: entry.LogDate) {
                        LineMark(
                            x: .value("Date", date),
                            y: .value("Weight", entry.WeightKg)
                        )
                        .foregroundStyle(.mint)
                        .symbol(.circle)
                    }
                }
                .frame(height: 180)
            }
        }
    }

    private var weeklySummaryCard: some View {
        HealthSectionCard {
            HealthSectionHeader(title: "Weekly calories", subtitle: "Totals for the last 7 days.")
            let chartPoints = weeklySummaryDays
            if chartPoints.isEmpty {
                HealthEmptyState(message: "No weekly summary data yet.")
            } else {
                Chart(chartPoints) { point in
                    BarMark(
                        x: .value("Date", point.date),
                        y: .value("Calories", point.calories)
                    )
                    .foregroundStyle(.blue)
                }
                .frame(height: 180)
            }
        }
    }

    private var metricTiles: [HealthMetricTileModel] {
        guard let totals = logResponse?.Totals else {
            return [
                HealthMetricTileModel(title: "Calories", value: "-", detail: nil),
                HealthMetricTileModel(title: "Protein", value: "-", detail: nil),
                HealthMetricTileModel(title: "Steps", value: "-", detail: nil),
                HealthMetricTileModel(title: "Net calories", value: "-", detail: nil)
            ]
        }
        let steps = logResponse?.DailyLog?.Steps ?? logResponse?.Summary.Steps ?? 0
        return [
            HealthMetricTileModel(title: "Calories", value: HealthFormatters.formatCalories(totals.TotalCalories), detail: nil),
            HealthMetricTileModel(title: "Protein", value: HealthFormatters.formatGrams(totals.TotalProtein), detail: nil),
            HealthMetricTileModel(title: "Steps", value: HealthFormatters.formatInteger(steps), detail: "steps"),
            HealthMetricTileModel(title: "Net calories", value: HealthFormatters.formatCalories(totals.NetCalories), detail: nil)
        ]
    }

    private var progressRows: [HealthProgressRowModel] {
        guard let totals = logResponse?.Totals, let targets = logResponse?.Targets else { return [] }
        var rows: [HealthProgressRowModel] = []

        let adjustedCalories = adjustedCalorieTarget(targets: targets)
        if adjustedCalories > 0 {
            rows.append(.init(title: "Calories", value: totals.TotalCalories, target: adjustedCalories, unit: "kcal"))
        }
        if shouldShow(targets: targets, key: "Protein"), let target = targets.ProteinTargetMax ?? targets.ProteinTargetMin, target > 0 {
            rows.append(.init(title: "Protein", value: totals.TotalProtein, target: target, unit: "g"))
        }
        if shouldShow(targets: targets, key: "Steps"), let target = targets.StepTarget, target > 0 {
            rows.append(.init(title: "Steps", value: Double(logResponse?.DailyLog?.Steps ?? logResponse?.Summary.Steps ?? 0), target: Double(target), unit: "steps"))
        }
        if shouldShow(targets: targets, key: "Fibre"), let target = targets.FibreTarget, target > 0 {
            rows.append(.init(title: "Fibre", value: totals.TotalFibre, target: target, unit: "g"))
        }
        if shouldShow(targets: targets, key: "Carbs"), let target = targets.CarbsTarget, target > 0 {
            rows.append(.init(title: "Carbs", value: totals.TotalCarbs, target: target, unit: "g"))
        }
        if shouldShow(targets: targets, key: "Fat"), let target = targets.FatTarget, target > 0 {
            rows.append(.init(title: "Fat", value: totals.TotalFat, target: target, unit: "g"))
        }
        if shouldShow(targets: targets, key: "SaturatedFat"), let target = targets.SaturatedFatTarget, target > 0 {
            rows.append(.init(title: "Saturated fat", value: totals.TotalSaturatedFat, target: target, unit: "g"))
        }
        if shouldShow(targets: targets, key: "Sugar"), let target = targets.SugarTarget, target > 0 {
            rows.append(.init(title: "Sugar", value: totals.TotalSugar, target: target, unit: "g"))
        }
        if shouldShow(targets: targets, key: "Sodium"), let target = targets.SodiumTarget, target > 0 {
            rows.append(.init(title: "Sodium", value: totals.TotalSodium, target: target, unit: "g"))
        }

        return rows
    }

    private var weeklySummaryDays: [HealthChartPoint] {
        guard let weeklySummary else { return [] }
        return weeklySummary.Days.compactMap { day in
            guard let date = HealthFormatters.date(from: day.LogDate) else { return nil }
            return HealthChartPoint(date: date, calories: day.TotalCalories)
        }
    }

    private var todayKey: String {
        HealthFormatters.dateKey(from: Date())
    }

    private var weekStartKey: String {
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .day, value: -6, to: Date()) ?? Date()
        return HealthFormatters.dateKey(from: start)
    }

    private var currentSteps: Int {
        logResponse?.DailyLog?.Steps ?? logResponse?.Summary.Steps ?? 0
    }

    private var currentWeight: Double? {
        logResponse?.DailyLog?.WeightKg
    }

    private var currentStepFactor: Double? {
        logResponse?.DailyLog?.StepKcalFactorOverride ?? logResponse?.Targets.StepKcalFactor
    }

    private func adjustedCalorieTarget(targets: HealthTargets) -> Double {
        let base = Double(targets.DailyCalorieTarget ?? 0)
        if base == 0 { return 0 }
        let steps = Double(logResponse?.DailyLog?.Steps ?? logResponse?.Summary.Steps ?? 0)
        let stepFactor = logResponse?.DailyLog?.StepKcalFactorOverride ?? targets.StepKcalFactor ?? 0
        return max(0, base + steps * stepFactor)
    }

    private func shouldShow(targets: HealthTargets, key: String) -> Bool {
        switch key {
        case "Protein": return targets.ShowProteinOnToday ?? true
        case "Steps": return targets.ShowStepsOnToday ?? true
        case "Fibre": return targets.ShowFibreOnToday ?? false
        case "Carbs": return targets.ShowCarbsOnToday ?? false
        case "Fat": return targets.ShowFatOnToday ?? false
        case "SaturatedFat": return targets.ShowSaturatedFatOnToday ?? false
        case "Sugar": return targets.ShowSugarOnToday ?? false
        case "Sodium": return targets.ShowSodiumOnToday ?? false
        default: return true
        }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let settingsResult = HealthApi.fetchSettings()
            async let logResult = HealthApi.fetchDailyLog(date: todayKey)
            async let summaryResult = HealthApi.fetchWeeklySummary(startDate: weekStartKey)
            async let stepsResult = HealthApi.fetchStepsHistory(startDate: weekStartKey, endDate: todayKey)
            async let weightResult = HealthApi.fetchWeightHistory(startDate: weekStartKey, endDate: todayKey)

            settings = try await settingsResult
            logResponse = try await logResult
            weeklySummary = try await summaryResult
            let steps = try await stepsResult
            let weights = try await weightResult
            stepsHistory = steps.Steps
            weightHistory = weights.Weights
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load today."
        }
    }

    private func updateStepsValue(_ steps: Int) async {
        await updateTodayMetrics(steps: steps, weight: currentWeight)
    }

    private func updateWeightValue(_ weight: Double) async {
        await updateTodayMetrics(steps: currentSteps, weight: weight)
    }

    private func handleQuickLogStepsRequest(_ nonce: Int) {
        guard nonce > lastHandledQuickLogStepsRequestNonce else { return }
        lastHandledQuickLogStepsRequestNonce = nonce
        showWeightSheet = false
        showStepsSheet = true
    }

    private func handleQuickLogWeightRequest(_ nonce: Int) {
        guard nonce > lastHandledQuickLogWeightRequestNonce else { return }
        lastHandledQuickLogWeightRequestNonce = nonce
        showStepsSheet = false
        showWeightSheet = true
    }

    private func updateTodayMetrics(steps: Int, weight: Double?) async {
        guard logResponse != nil else { return }
        do {
            status = .loading
            errorMessage = ""
            _ = try await HealthApi.updateDailySteps(date: todayKey, request: HealthStepUpdateRequest(
                Steps: steps,
                StepKcalFactorOverride: currentStepFactor,
                WeightKg: weight
            ))
            showStepsSheet = false
            showWeightSheet = false
            await load()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to update today."
        }
    }
}

private struct HealthMetricTileModel {
    let title: String
    let value: String
    let detail: String?
}

private struct HealthProgressRowModel {
    let title: String
    let value: Double
    let target: Double
    let unit: String
}

private struct HealthChartPoint: Identifiable {
    let id = UUID()
    let date: Date
    let calories: Double
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}

private struct HealthTodayStepsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let initialSteps: Int
    let onSave: (Int) -> Void

    @State private var stepsText: String

    init(initialSteps: Int, onSave: @escaping (Int) -> Void) {
        self.initialSteps = initialSteps
        self.onSave = onSave
        _stepsText = State(initialValue: String(initialSteps))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Steps") {
                    TextField("Steps", text: $stepsText)
                        .keyboardType(.numberPad)
                }
            }
            .navigationTitle("Log steps")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(parsedSteps)
                    }
                    .disabled(!isDirty || !isValid)
                }
            }
        }
    }

    private var parsedSteps: Int {
        Int(stepsText) ?? 0
    }

    private var isDirty: Bool {
        stepsText != String(initialSteps)
    }

    private var isValid: Bool {
        guard let steps = Int(stepsText) else { return false }
        return steps >= 0
    }
}

private struct HealthTodayWeightSheet: View {
    @Environment(\.dismiss) private var dismiss
    let initialWeight: Double?
    let onSave: (Double) -> Void

    @State private var weightText: String

    init(initialWeight: Double?, onSave: @escaping (Double) -> Void) {
        self.initialWeight = initialWeight
        self.onSave = onSave
        _weightText = State(initialValue: initialWeight.map { String($0) } ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Weight") {
                    TextField("Weight (kg)", text: $weightText)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Log weight")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let parsedWeight else { return }
                        onSave(parsedWeight)
                    }
                    .disabled(!isDirty || !isValid)
                }
            }
        }
    }

    private var parsedWeight: Double? {
        Double(weightText)
    }

    private var isDirty: Bool {
        weightText != (initialWeight.map { String($0) } ?? "")
    }

    private var isValid: Bool {
        guard let weight = parsedWeight else { return false }
        return weight > 0
    }
}
