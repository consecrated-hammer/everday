import SwiftUI

struct HealthSettingsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var birthDate = Date()
    @State private var heightCm = ""
    @State private var weightKg = ""
    @State private var activityLevel = ActivityLevel.moderatelyActive

    @State private var foodReminderEnabled: [String: Bool] = [:]
    @State private var foodReminderTimes: [String: Date] = [:]

    @State private var weightRemindersEnabled = false
    @State private var weightReminderTime = HealthSettingsView.dateFromTime("08:00")

    @State private var dailyCalories = ""
    @State private var proteinMin = ""
    @State private var proteinMax = ""
    @State private var stepTarget = ""
    @State private var stepKcalFactor = ""
    @State private var fibreTarget = ""
    @State private var carbsTarget = ""
    @State private var fatTarget = ""
    @State private var satFatTarget = ""
    @State private var sugarTarget = ""
    @State private var sodiumTarget = ""

    @State private var showProtein = true
    @State private var showSteps = true
    @State private var showFibre = false
    @State private var showCarbs = false
    @State private var showFat = false
    @State private var showSugar = false
    @State private var showSodium = false
    @State private var showSatFat = false

    @State private var showWeightChart = true
    @State private var showStepsChart = true

    @State private var autoTuneWeekly = false
    @State private var lastAutoTuneDate: Date?
    @State private var goalSummary: HealthGoalSummary?

    @State private var isLoading = false
    @State private var loadErrorMessage = ""
    @State private var saveErrorMessage = ""
    @State private var hasLoaded = false
    @State private var isSaving = false
    @State private var showGoalWizard = false
    @State private var showSuggestionSheet = false
    @State private var isFetchingSuggestions = false
    @State private var suggestionPreview: NutritionRecommendationResponse?
    @State private var autosaveTask: Task<Void, Never>?
    @State private var isApplyingRemote = false

    var body: some View {
        Group {
            if isLoading {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading health settings...")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemGroupedBackground))
            } else if !loadErrorMessage.isEmpty {
                VStack(spacing: 12) {
                    Text(loadErrorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        Task { await load() }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemGroupedBackground))
            } else {
                let formView = Form {
                    if !saveErrorMessage.isEmpty {
                        Section {
                            Text(saveErrorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                    }
                    Section {
                        DatePicker("Birth date", selection: $birthDate, displayedComponents: .date)
                        LabeledTextField(title: "Height (cm)", text: $heightCm, keyboard: .numberPad)
                        LabeledTextField(title: "Weight (kg)", text: $weightKg, keyboard: .decimalPad)
                        Picker("Activity level", selection: $activityLevel) {
                            ForEach(ActivityLevel.allCases) { level in
                                Text(level.label).tag(level)
                            }
                        }
                    } header: {
                        SectionHeader(title: "Profile", subtitle: "Keep your metrics up to date.")
                    }

                    Section {
                        if let goalSummary {
                            VStack(alignment: .leading, spacing: 12) {
                                GoalSummaryView(goal: goalSummary)
                                Button {
                                    showGoalWizard = true
                                } label: {
                                    Label("Update goal", systemImage: "sparkles")
                                }
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("No goal set yet.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Button {
                                    showGoalWizard = true
                                } label: {
                                    Label("Set goal", systemImage: "sparkles")
                                }
                            }
                        }
                    } header: {
                        SectionHeader(title: "Goal", subtitle: "Set BMI target, target weight and date, plus daily calories.")
                    }

                    Section {
                        ForEach(Self.mealSlots, id: \.key) { slot in
                            FoodReminderRow(
                                slot: slot,
                                isEnabled: Binding(
                                    get: { foodReminderEnabled[slot.key] ?? false },
                                    set: { foodReminderEnabled[slot.key] = $0 }
                                ),
                                time: Binding(
                                    get: { foodReminderTimes[slot.key] ?? Self.dateFromTime(slot.defaultTime) },
                                    set: { foodReminderTimes[slot.key] = $0 }
                                )
                            )
                        }
                    } header: {
                        SectionHeader(
                            title: "Food logging reminders",
                            subtitle: "Reminders are sent when the scheduled run matches the selected time and the slot has not been logged."
                        )
                    }

                    Section {
                        Toggle("Enable weight reminders", isOn: $weightRemindersEnabled)
                        DatePicker("Reminder time", selection: $weightReminderTime, displayedComponents: .hourAndMinute)
                            .disabled(!weightRemindersEnabled)
                    } header: {
                        SectionHeader(
                            title: "Weight logging reminders",
                            subtitle: "Reminders are sent automatically by the server scheduler when enabled."
                        )
                    }

                    Section {
                        LabeledTextField(title: "Daily calories", text: $dailyCalories, keyboard: .numberPad)
                        LabeledTextField(title: "Protein min (g)", text: $proteinMin, keyboard: .decimalPad)
                        LabeledTextField(title: "Protein max (g)", text: $proteinMax, keyboard: .decimalPad)
                        LabeledTextField(title: "Step target", text: $stepTarget, keyboard: .numberPad)
                        LabeledTextField(title: "Step kcal factor", text: $stepKcalFactor, keyboard: .decimalPad)
                        LabeledTextField(title: "Fibre target", text: $fibreTarget, keyboard: .decimalPad)
                        LabeledTextField(title: "Carbs target", text: $carbsTarget, keyboard: .decimalPad)
                        LabeledTextField(title: "Fat target", text: $fatTarget, keyboard: .decimalPad)
                        LabeledTextField(title: "Sat fat target", text: $satFatTarget, keyboard: .decimalPad)
                        LabeledTextField(title: "Sugar target", text: $sugarTarget, keyboard: .decimalPad)
                        LabeledTextField(title: "Sodium target", text: $sodiumTarget, keyboard: .decimalPad)
                    } header: {
                        SectionHeader(title: "Targets", subtitle: "Set calorie, protein, and step goals for today.")
                    }

                    Section {
                        Toggle("Show protein on Today", isOn: $showProtein)
                        Toggle("Show steps on Today", isOn: $showSteps)
                        Toggle("Show fibre on Today", isOn: $showFibre)
                        Toggle("Show carbs on Today", isOn: $showCarbs)
                        Toggle("Show fat on Today", isOn: $showFat)
                        Toggle("Show sugar on Today", isOn: $showSugar)
                        Toggle("Show sodium on Today", isOn: $showSodium)
                        Toggle("Show saturated fat on Today", isOn: $showSatFat)
                    } header: {
                        SectionHeader(title: "Visibility", subtitle: "Choose which targets show on Today.")
                    }

                    Section {
                        Toggle("Show weight chart on Today", isOn: $showWeightChart)
                        Toggle("Show steps chart on Today", isOn: $showStepsChart)
                    } header: {
                        SectionHeader(title: "Charts", subtitle: "Control which charts appear on Today.")
                    }

                    Section {
                        Toggle("Auto-tune targets weekly", isOn: $autoTuneWeekly)
                        Text(lastAutoTuneLabel)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button {
                            Task {
                                await fetchSuggestions()
                            }
                        } label: {
                            Label("Get suggestions", systemImage: "sparkles")
                        }
                        .disabled(isSaving || isFetchingSuggestions)
                        if isFetchingSuggestions {
                            AiWorkingBanner(label: "AI is preparing suggestions...")
                        }
                    } header: {
                        SectionHeader(title: "AI targets", subtitle: "Auto-tune runs once a week when you open the app.")
                    }
                }
                .listStyle(.insetGrouped)
                .safeAreaPadding(.bottom, 80)
                .onChange(of: autoSaveSnapshot) {
                    scheduleAutoSave()
                }

                if horizontalSizeClass == .regular {
                    formView
                        .frame(maxWidth: 720)
                        .frame(maxWidth: .infinity)
                } else {
                    formView
                }
            }
        }
        .navigationTitle("Health Settings")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Health Settings")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                if isSaving {
                    ProgressView()
                }
            }
        }
        .sheet(isPresented: $showGoalWizard) {
            GoalWizardView(isPresented: $showGoalWizard, currentGoal: goalSummary) { request in
                Task {
                    await applyGoal(request)
                }
            }
        }
        .sheet(isPresented: $showSuggestionSheet) {
            if let suggestionPreview {
                AiSuggestionsSheet(
                    preview: suggestionPreview,
                    onCancel: { showSuggestionSheet = false },
                    onApply: {
                        Task {
                            await applySuggestions(preview: suggestionPreview)
                            showSuggestionSheet = false
                        }
                    }
                )
            }
        }
        .task {
            if !hasLoaded {
                hasLoaded = true
                await load()
            }
        }
    }

    private static let mealSlots: [MealSlot] = [
        MealSlot(key: "Breakfast", label: "Breakfast", defaultTime: "08:00"),
        MealSlot(key: "Snack1", label: "Snack 1", defaultTime: "10:30"),
        MealSlot(key: "Lunch", label: "Lunch", defaultTime: "12:30"),
        MealSlot(key: "Snack2", label: "Snack 2", defaultTime: "15:30"),
        MealSlot(key: "Dinner", label: "Dinner", defaultTime: "18:30"),
        MealSlot(key: "Snack3", label: "Snack 3", defaultTime: "20:30")
    ]

    @MainActor
    private func load() async {
        isLoading = true
        loadErrorMessage = ""
        saveErrorMessage = ""
        do {
            async let settings = HealthApi.fetchSettings()
            async let profile = HealthApi.fetchProfile()
            let (settingsValue, profileValue) = try await (settings, profile)
            isApplyingRemote = true
            apply(settingsValue, profileValue)
            isApplyingRemote = false
            isLoading = false
        } catch {
            isLoading = false
            if let apiError = error as? ApiError {
                loadErrorMessage = apiError.message
            } else {
                loadErrorMessage = "Failed to load health settings"
            }
        }
    }

    private func apply(_ settings: HealthUserSettings, _ profile: HealthUserProfile) {
        if let birthDateValue = Self.dateFromIsoDate(profile.BirthDate) {
            birthDate = birthDateValue
        }
        heightCm = profile.HeightCm.map(String.init) ?? ""
        weightKg = profile.WeightKg.map { String(format: "%.1f", $0) } ?? ""
        activityLevel = ActivityLevel(rawValue: profile.ActivityLevel ?? "") ?? .moderatelyActive

        dailyCalories = settings.Targets.DailyCalorieTarget.map(String.init) ?? ""
        proteinMin = settings.Targets.ProteinTargetMin.map { String(format: "%.1f", $0) } ?? ""
        proteinMax = settings.Targets.ProteinTargetMax.map { String(format: "%.1f", $0) } ?? ""
        stepTarget = settings.Targets.StepTarget.map(String.init) ?? ""
        stepKcalFactor = settings.Targets.StepKcalFactor.map { String(format: "%.2f", $0) } ?? ""
        fibreTarget = settings.Targets.FibreTarget.map { String(format: "%.1f", $0) } ?? ""
        carbsTarget = settings.Targets.CarbsTarget.map { String(format: "%.1f", $0) } ?? ""
        fatTarget = settings.Targets.FatTarget.map { String(format: "%.1f", $0) } ?? ""
        satFatTarget = settings.Targets.SaturatedFatTarget.map { String(format: "%.1f", $0) } ?? ""
        sugarTarget = settings.Targets.SugarTarget.map { String(format: "%.1f", $0) } ?? ""
        sodiumTarget = settings.Targets.SodiumTarget.map { String(format: "%.1f", $0) } ?? ""

        showProtein = settings.Targets.ShowProteinOnToday ?? true
        showSteps = settings.Targets.ShowStepsOnToday ?? true
        showFibre = settings.Targets.ShowFibreOnToday ?? false
        showCarbs = settings.Targets.ShowCarbsOnToday ?? false
        showFat = settings.Targets.ShowFatOnToday ?? false
        showSugar = settings.Targets.ShowSugarOnToday ?? false
        showSodium = settings.Targets.ShowSodiumOnToday ?? false
        showSatFat = settings.Targets.ShowSaturatedFatOnToday ?? false

        showWeightChart = settings.ShowWeightChartOnToday ?? true
        showStepsChart = settings.ShowStepsChartOnToday ?? true

        goalSummary = settings.Goal

        autoTuneWeekly = settings.AutoTuneTargetsWeekly ?? false
        lastAutoTuneDate = Self.dateFromIsoDateTime(settings.LastAutoTuneAt)

        weightRemindersEnabled = settings.WeightRemindersEnabled ?? false
        let weightTime = Self.validTime(settings.WeightReminderTime) ?? "08:00"
        weightReminderTime = Self.dateFromTime(weightTime)

        var enabledMap: [String: Bool] = [:]
        var timeMap: [String: Date] = [:]
        let legacyTimes = Self.normalizeReminderTimes(settings.FoodReminderTimes)
        let legacyEnabled = settings.FoodRemindersEnabled ?? false
        Self.mealSlots.forEach { slot in
            let defaultTime = slot.defaultTime
            var enabled = legacyEnabled
            var timeValue = legacyTimes[slot.key] ?? defaultTime
            if let slotConfig = settings.FoodReminderSlots?[slot.key] {
                if let slotEnabled = slotConfig.Enabled {
                    enabled = slotEnabled
                }
                if let slotTime = Self.validTime(slotConfig.Time) {
                    timeValue = slotTime
                }
            }
            enabledMap[slot.key] = enabled
            timeMap[slot.key] = Self.dateFromTime(timeValue)
        }
        foodReminderEnabled = enabledMap
        foodReminderTimes = timeMap
    }

    private var lastAutoTuneLabel: String {
        guard let date = lastAutoTuneDate else {
            return "No auto-tune run yet."
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return "Last auto-tune: \(formatter.string(from: date))"
    }

    @MainActor
    private func save() async {
        guard hasLoaded, !isLoading, !isSaving else { return }
        isSaving = true
        saveErrorMessage = ""
        do {
            _ = try await HealthApi.updateProfile(buildProfileRequest())
            _ = try await HealthApi.updateSettings(buildSettingsRequest())
            isSaving = false
        } catch {
            isSaving = false
            if let apiError = error as? ApiError {
                saveErrorMessage = apiError.message
            } else {
                saveErrorMessage = "Failed to save health settings"
            }
        }
    }

    private func applyGoal(_ request: GoalRecommendationRequest) async {
        isSaving = true
        saveErrorMessage = ""
        do {
            let response = try await HealthApi.applyGoal(request)
            isApplyingRemote = true
            applyRecommendations(response)
            isApplyingRemote = false
            goalSummary = response.Goal ?? goalSummary
            isSaving = false
        } catch {
            isSaving = false
            if let apiError = error as? ApiError {
                saveErrorMessage = apiError.message
            } else {
                saveErrorMessage = "Failed to set goal"
            }
        }
    }

    @MainActor
    private func fetchSuggestions() async {
        guard !isFetchingSuggestions else { return }
        saveErrorMessage = ""
        isFetchingSuggestions = true
        do {
            let response = try await HealthApi.fetchRecommendations()
            suggestionPreview = response
            showSuggestionSheet = true
        } catch {
            if let apiError = error as? ApiError {
                saveErrorMessage = apiError.message
            } else {
                saveErrorMessage = "Failed to fetch AI suggestions"
            }
        }
        isFetchingSuggestions = false
    }

    @MainActor
    private func applySuggestions(preview: NutritionRecommendationResponse) async {
        isApplyingRemote = true
        applyRecommendations(preview)
        isApplyingRemote = false
        await save()
    }

    private func applyRecommendations(_ response: NutritionRecommendationResponse) {
        dailyCalories = String(response.DailyCalorieTarget)
        proteinMin = String(format: "%.1f", response.ProteinTargetMin)
        proteinMax = String(format: "%.1f", response.ProteinTargetMax)
        fibreTarget = response.FibreTarget.map { String(format: "%.1f", $0) } ?? fibreTarget
        carbsTarget = response.CarbsTarget.map { String(format: "%.1f", $0) } ?? carbsTarget
        fatTarget = response.FatTarget.map { String(format: "%.1f", $0) } ?? fatTarget
        satFatTarget = response.SaturatedFatTarget.map { String(format: "%.1f", $0) } ?? satFatTarget
        sugarTarget = response.SugarTarget.map { String(format: "%.1f", $0) } ?? sugarTarget
        sodiumTarget = response.SodiumTarget.map { String(format: "%.1f", $0) } ?? sodiumTarget
        if let goal = response.Goal {
            goalSummary = goal
        }
    }

    private func buildProfileRequest() -> HealthUpdateProfileRequest {
        HealthUpdateProfileRequest(
            BirthDate: Self.isoDateString(from: birthDate),
            HeightCm: Self.parseInt(heightCm),
            WeightKg: Self.parseDouble(weightKg),
            ActivityLevel: activityLevel.rawValue
        )
    }

    private func buildSettingsRequest() -> HealthUpdateSettingsRequest {
        let slots = Self.mealSlots.reduce(into: [String: HealthUpdateSettingsRequest.FoodReminderSlot]()) { result, slot in
            let enabled = foodReminderEnabled[slot.key] ?? false
            let timeValue = foodReminderTimes[slot.key] ?? Self.dateFromTime(slot.defaultTime)
            result[slot.key] = HealthUpdateSettingsRequest.FoodReminderSlot(
                Enabled: enabled,
                Time: Self.timeString(from: timeValue)
            )
        }

        return HealthUpdateSettingsRequest(
            DailyCalorieTarget: Self.parseInt(dailyCalories),
            ProteinTargetMin: Self.parseDouble(proteinMin),
            ProteinTargetMax: Self.parseDouble(proteinMax),
            StepTarget: Self.parseInt(stepTarget),
            StepKcalFactor: Self.parseDouble(stepKcalFactor),
            FibreTarget: Self.parseDouble(fibreTarget),
            CarbsTarget: Self.parseDouble(carbsTarget),
            FatTarget: Self.parseDouble(fatTarget),
            SaturatedFatTarget: Self.parseDouble(satFatTarget),
            SugarTarget: Self.parseDouble(sugarTarget),
            SodiumTarget: Self.parseDouble(sodiumTarget),
            ShowProteinOnToday: showProtein,
            ShowStepsOnToday: showSteps,
            ShowFibreOnToday: showFibre,
            ShowCarbsOnToday: showCarbs,
            ShowFatOnToday: showFat,
            ShowSugarOnToday: showSugar,
            ShowSodiumOnToday: showSodium,
            ShowSaturatedFatOnToday: showSatFat,
            AutoTuneTargetsWeekly: autoTuneWeekly,
            ShowWeightChartOnToday: showWeightChart,
            ShowStepsChartOnToday: showStepsChart,
            FoodReminderSlots: slots,
            WeightRemindersEnabled: weightRemindersEnabled,
            WeightReminderTime: Self.timeString(from: weightReminderTime)
        )
    }

    private var autoSaveSnapshot: AutoSaveSnapshot {
        AutoSaveSnapshot(
            birthDate: Self.isoDateString(from: birthDate),
            heightCm: heightCm,
            weightKg: weightKg,
            activityLevel: activityLevel.rawValue,
            remindersSignature: remindersSignature,
            weightRemindersEnabled: weightRemindersEnabled,
            weightReminderTime: Self.timeString(from: weightReminderTime),
            targetsSignature: targetsSignature,
            visibilitySignature: visibilitySignature,
            chartsSignature: "\(showWeightChart)-\(showStepsChart)",
            autoTuneWeekly: autoTuneWeekly
        )
    }

    private var remindersSignature: String {
        Self.mealSlots.map { slot in
            let enabled = foodReminderEnabled[slot.key] ?? false
            let timeValue = foodReminderTimes[slot.key] ?? Self.dateFromTime(slot.defaultTime)
            return "\(slot.key):\(enabled ? 1 : 0):\(Self.timeString(from: timeValue))"
        }.joined(separator: "|")
    }

    private var targetsSignature: String {
        [
            dailyCalories,
            proteinMin,
            proteinMax,
            stepTarget,
            stepKcalFactor,
            fibreTarget,
            carbsTarget,
            fatTarget,
            satFatTarget,
            sugarTarget,
            sodiumTarget
        ].joined(separator: "|")
    }

    private var visibilitySignature: String {
        [
            showProtein,
            showSteps,
            showFibre,
            showCarbs,
            showFat,
            showSugar,
            showSodium,
            showSatFat
        ].map { $0 ? "1" : "0" }.joined()
    }

    private func scheduleAutoSave() {
        guard hasLoaded, !isLoading, !isApplyingRemote else { return }
        autosaveTask?.cancel()
        autosaveTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            if Task.isCancelled { return }
            await save()
        }
    }

    fileprivate static func dateFromIsoDate(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    fileprivate static func isoDateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func dateFromIsoDateTime(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let parsed = formatter.date(from: value) {
            return parsed
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private static func dateFromTime(_ value: String) -> Date {
        let parts = value.split(separator: ":")
        let hour = Int(parts.first ?? "0") ?? 0
        let minute = Int(parts.dropFirst().first ?? "0") ?? 0
        var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        components.hour = hour
        components.minute = minute
        return Calendar.current.date(from: components) ?? Date()
    }

    private static func timeString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private static func validTime(_ value: String?) -> String? {
        guard let value else { return nil }
        let parts = value.split(separator: ":")
        if parts.count != 2 { return nil }
        let hour = Int(parts[0]) ?? -1
        let minute = Int(parts[1]) ?? -1
        guard (0...23).contains(hour), (0...59).contains(minute) else { return nil }
        return String(format: "%02d:%02d", hour, minute)
    }

    private static func normalizeReminderTimes(_ times: [String: String]?) -> [String: String] {
        var normalized: [String: String] = [:]
        mealSlots.forEach { slot in
            normalized[slot.key] = slot.defaultTime
        }
        times?.forEach { key, value in
            if let valid = validTime(value) {
                normalized[key] = valid
            }
        }
        return normalized
    }

    private static func parseInt(_ value: String) -> Int? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : Int(trimmed)
    }

    private static func parseDouble(_ value: String) -> Double? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed)
    }
}

private struct MealSlot {
    let key: String
    let label: String
    let defaultTime: String
}

private struct FoodReminderRow: View {
    let slot: MealSlot
    @Binding var isEnabled: Bool
    @Binding var time: Date
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showPicker = false

    var body: some View {
        HStack(spacing: 12) {
            Button {
                guard isEnabled else { return }
                showPicker = true
            } label: {
                HStack {
                    Text(slot.label)
                    Spacer()
                    Text(isEnabled ? timeString : "Off")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .opacity(isEnabled ? 1 : 0.5)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(Capsule())
                }
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())

            Toggle("", isOn: $isEnabled)
                .labelsHidden()
        }
        .frame(minHeight: 44)
        .popover(isPresented: popoverBinding) {
            TimePickerSheet(title: slot.label, time: $time)
                .presentationCompactAdaptation(.sheet)
        }
        .sheet(isPresented: sheetBinding) {
            TimePickerSheet(title: slot.label, time: $time)
                .presentationDetents([.medium])
        }
    }

    private var timeString: String {
        Self.formatter.string(from: time)
    }

    private var popoverBinding: Binding<Bool> {
        Binding(
            get: { showPicker && horizontalSizeClass == .regular },
            set: { showPicker = $0 }
        )
    }

    private var sheetBinding: Binding<Bool> {
        Binding(
            get: { showPicker && horizontalSizeClass != .regular },
            set: { showPicker = $0 }
        )
    }

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "HH:mm"
        return formatter
    }()
}

private struct SectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}

private struct AiWorkingBanner: View {
    let label: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles")
                .symbolEffect(.pulse)
                .foregroundStyle(.tint)
            ProgressView()
            Text(label)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct AutoSaveSnapshot: Equatable {
    let birthDate: String
    let heightCm: String
    let weightKg: String
    let activityLevel: String
    let remindersSignature: String
    let weightRemindersEnabled: Bool
    let weightReminderTime: String
    let targetsSignature: String
    let visibilitySignature: String
    let chartsSignature: String
    let autoTuneWeekly: Bool
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}

private struct TimePickerSheet: View {
    let title: String
    @Binding var time: Date
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack {
                DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
            }
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct GoalWizardView: View {
    @Binding var isPresented: Bool
    let currentGoal: HealthGoalSummary?
    let onApply: (GoalRecommendationRequest) -> Void

    @State private var goalType: GoalTypeOption
    @State private var bmiRange: BmiRangeOption
    @State private var durationMonths: Int
    @State private var preview: NutritionRecommendationResponse?
    @State private var previewStatus: LoadState = .idle
    @State private var previewError: String = ""

    @State private var overrideDailyCalories: String = ""
    @State private var overrideTargetWeight: String = ""
    @State private var overrideEndDate: Date = Date()

    init(
        isPresented: Binding<Bool>,
        currentGoal: HealthGoalSummary?,
        onApply: @escaping (GoalRecommendationRequest) -> Void
    ) {
        self._isPresented = isPresented
        self.currentGoal = currentGoal
        self.onApply = onApply

        let type = GoalTypeOption(rawValue: currentGoal?.GoalType ?? "") ?? .lose
        let range = BmiRangeOption.from(min: currentGoal?.BmiMin, max: currentGoal?.BmiMax) ?? .normal
        let months = Self.durationFromEndDate(currentGoal?.EndDate) ?? 6
        _goalType = State(initialValue: type)
        _bmiRange = State(initialValue: range)
        _durationMonths = State(initialValue: months)
    }

    var body: some View {
        NavigationStack {
            Form {
                if previewStatus == .loading {
                    Section {
                        AiWorkingBanner(label: "AI is generating your goal...")
                    }
                }
                Section {
                    Picker("Goal type", selection: $goalType) {
                        ForEach(GoalTypeOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    Picker("BMI range", selection: $bmiRange) {
                        ForEach(BmiRangeOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    Picker("Duration", selection: $durationMonths) {
                        ForEach([3, 6, 9, 12, 18, 24], id: \.self) { months in
                            Text("\(months) months").tag(months)
                        }
                    }
                    Button {
                        Task { await previewTargets() }
                    } label: {
                        Label("Refresh AI suggestion", systemImage: "sparkles")
                    }
                    .disabled(previewStatus == .loading)
                } header: {
                    SectionHeader(title: "Goal details", subtitle: "We will calculate a safe target and daily calories.")
                }

                if let preview {
                    Section {
                        LabeledContent("Daily calories") {
                            TextField("", text: $overrideDailyCalories)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                        }
                        LabeledContent("Target weight (kg)") {
                            TextField("", text: $overrideTargetWeight)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        DatePicker("Target date", selection: $overrideEndDate, displayedComponents: .date)
                    } header: {
                        SectionHeader(title: "Suggested targets", subtitle: preview.Explanation)
                    }
                } else if !previewError.isEmpty {
                    Section {
                        Text(previewError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Set goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        guard let preview else { return }
                        let request = buildApplyRequest(preview: preview)
                        onApply(request)
                        isPresented = false
                    }
                    .disabled(preview == nil)
                }
            }
        }
        .task {
            if preview == nil && previewStatus == .idle {
                await previewTargets()
            }
        }
    }

    @MainActor
    private func previewTargets() async {
        previewStatus = .loading
        previewError = ""
        do {
            let request = GoalRecommendationRequest(
                GoalType: goalType.rawValue,
                BmiMin: bmiRange.min,
                BmiMax: bmiRange.max,
                StartDate: HealthSettingsView.isoDateString(from: Date()),
                DurationMonths: durationMonths,
                ApplyGoal: false,
                TargetWeightKgOverride: nil,
                EndDateOverride: nil,
                DailyCalorieTargetOverride: nil
            )
            let response = try await HealthApi.applyGoal(request)
            preview = response
            overrideDailyCalories = "\(response.DailyCalorieTarget)"
            if let target = response.Goal?.TargetWeightKg {
                overrideTargetWeight = String(format: "%.1f", target)
            }
            if let endDate = HealthSettingsView.dateFromIsoDate(response.Goal?.EndDate) {
                overrideEndDate = endDate
            }
            previewStatus = .ready
        } catch {
            previewStatus = .error
            previewError = (error as? ApiError)?.message ?? "Failed to preview goal"
        }
    }

    private func buildApplyRequest(preview: NutritionRecommendationResponse) -> GoalRecommendationRequest {
        let previewWeight = preview.Goal?.TargetWeightKg
        let previewEndDate = preview.Goal?.EndDate ?? ""
        let previewDaily = preview.DailyCalorieTarget

        let nextDaily = Int(overrideDailyCalories.trimmingCharacters(in: .whitespacesAndNewlines))
        let nextWeight = Double(overrideTargetWeight.trimmingCharacters(in: .whitespacesAndNewlines))
        let nextEnd = HealthSettingsView.isoDateString(from: overrideEndDate)

        let dailyOverride = nextDaily != nil && nextDaily != previewDaily ? nextDaily : nil
        let weightOverride = nextWeight != nil && previewWeight != nil && nextWeight != previewWeight ? nextWeight : nil
        let endOverride = nextEnd != previewEndDate ? nextEnd : nil

        return GoalRecommendationRequest(
            GoalType: goalType.rawValue,
            BmiMin: bmiRange.min,
            BmiMax: bmiRange.max,
            StartDate: HealthSettingsView.isoDateString(from: Date()),
            DurationMonths: durationMonths,
            ApplyGoal: true,
            TargetWeightKgOverride: weightOverride,
            EndDateOverride: endOverride,
            DailyCalorieTargetOverride: dailyOverride
        )
    }

    private func formattedDate(_ value: String?) -> String {
        guard let value, let date = HealthSettingsView.dateFromIsoDate(value) else { return "Not set" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private static func durationFromEndDate(_ value: String?) -> Int? {
        guard let date = HealthSettingsView.dateFromIsoDate(value) else { return nil }
        let today = Calendar.current.startOfDay(for: Date())
        let months = Calendar.current.dateComponents([.month], from: today, to: date).month ?? 0
        let rounded = [3, 6, 9, 12, 18, 24].min(by: { abs($0 - months) < abs($1 - months) })
        return rounded
    }
}

    private struct GoalSummaryView: View {
        let goal: HealthGoalSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LabeledContent("Goal") {
                Text(goalTypeLabel)
                    .foregroundStyle(.secondary)
            }
            LabeledContent("BMI range") {
                Text("\(String(format: "%.1f", goal.BmiMin)) to \(String(format: "%.1f", goal.BmiMax))")
                    .foregroundStyle(.secondary)
            }
            LabeledContent("Current BMI") {
                Text(String(format: "%.1f", goal.CurrentBmi))
                    .foregroundStyle(.secondary)
            }
            LabeledContent("Target weight") {
                Text("\(String(format: "%.1f", goal.TargetWeightKg)) kg")
                    .foregroundStyle(.secondary)
            }
            LabeledContent("Target date") {
                Text(formattedDate(goal.EndDate))
                    .foregroundStyle(.secondary)
            }
            LabeledContent("Daily calories") {
                Text("\(goal.DailyCalorieTarget)")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var goalTypeLabel: String {
        switch goal.GoalType.lowercased() {
        case "lose":
            return "Lose weight"
        case "maintain":
            return "Maintain weight"
        case "gain":
            return "Gain weight"
        default:
            return goal.GoalType
        }
    }

    private func formattedDate(_ value: String) -> String {
        guard let date = HealthSettingsView.dateFromIsoDate(value) else {
            return value
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

private struct AiSuggestionsSheet: View {
    let preview: NutritionRecommendationResponse
    let onCancel: () -> Void
    let onApply: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Daily calories") {
                        Text("\(preview.DailyCalorieTarget)")
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("Protein min") {
                        Text(String(format: "%.1f g", preview.ProteinTargetMin))
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("Protein max") {
                        Text(String(format: "%.1f g", preview.ProteinTargetMax))
                            .foregroundStyle(.secondary)
                    }
                    if let value = preview.FibreTarget {
                        LabeledContent("Fibre") {
                            Text(String(format: "%.1f g", value))
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let value = preview.CarbsTarget {
                        LabeledContent("Carbs") {
                            Text(String(format: "%.1f g", value))
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let value = preview.FatTarget {
                        LabeledContent("Fat") {
                            Text(String(format: "%.1f g", value))
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let value = preview.SaturatedFatTarget {
                        LabeledContent("Sat fat") {
                            Text(String(format: "%.1f g", value))
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let value = preview.SugarTarget {
                        LabeledContent("Sugar") {
                            Text(String(format: "%.1f g", value))
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let value = preview.SodiumTarget {
                        LabeledContent("Sodium") {
                            Text(String(format: "%.1f mg", value))
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    SectionHeader(title: "Suggested targets", subtitle: preview.Explanation)
                }
            }
            .navigationTitle("AI suggestions")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onCancel()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        onApply()
                    }
                }
            }
        }
    }
}

private enum GoalTypeOption: String, CaseIterable, Identifiable {
    case lose
    case maintain
    case gain

    var id: String { rawValue }

    var label: String {
        switch self {
        case .lose: return "Lose weight"
        case .maintain: return "Maintain weight"
        case .gain: return "Gain weight"
        }
    }
}

private enum BmiRangeOption: String, CaseIterable, Identifiable {
    case underweight
    case normal
    case overweight
    case obese
    case severe

    var id: String { rawValue }

    var label: String {
        switch self {
        case .underweight: return "Underweight (below 18.5)"
        case .normal: return "Normal (18.5 to 24.9)"
        case .overweight: return "Overweight (25 to 29.9)"
        case .obese: return "Obese (30 to 34.9)"
        case .severe: return "Severe obesity (35 to 39.9)"
        }
    }

    var min: Double {
        switch self {
        case .underweight: return 0
        case .normal: return 18.5
        case .overweight: return 25
        case .obese: return 30
        case .severe: return 35
        }
    }

    var max: Double {
        switch self {
        case .underweight: return 18.4
        case .normal: return 24.9
        case .overweight: return 29.9
        case .obese: return 34.9
        case .severe: return 39.9
        }
    }

    static func from(min: Double?, max: Double?) -> BmiRangeOption? {
        guard let min, let max else { return nil }
        return Self.allCases.first(where: { abs($0.min - min) < 0.2 && abs($0.max - max) < 0.2 })
    }
}

private enum ActivityLevel: String, CaseIterable, Identifiable {
    case sedentary
    case lightlyActive = "lightly_active"
    case moderatelyActive = "moderately_active"
    case veryActive = "very_active"
    case extraActive = "extra_active"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sedentary: return "Sedentary"
        case .lightlyActive: return "Lightly active"
        case .moderatelyActive: return "Moderately active"
        case .veryActive: return "Very active"
        case .extraActive: return "Extra active"
        }
    }
}

private struct LabeledTextField: View {
    let title: String
    @Binding var text: String
    let keyboard: UIKeyboardType

    var body: some View {
        LabeledContent(title) {
            TextField("", text: $text)
                .keyboardType(keyboard)
                .multilineTextAlignment(.trailing)
        }
    }
}
