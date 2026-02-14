import SwiftUI

struct HealthLogView: View {
    @State private var logDate = Date()
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var logResponse: HealthDailyLogResponse?
    @State private var foods: [HealthFood] = []
    @State private var templates: [HealthMealTemplateWithItems] = []
    @State private var shareUsers: [SettingsUser] = []
    @State private var activeMealType: HealthMealType = .Breakfast
    @State private var editingEntry: HealthMealEntryWithFood?
    @State private var showEntrySheet = false
    @State private var entryToDelete: HealthMealEntryWithFood?

    @State private var mealActionLoading = false
    @State private var mealActionError = ""
    @State private var saveMealOpen = false
    @State private var saveMealMealType: HealthMealType = .Breakfast
    @State private var saveMealName = ""
    @State private var saveMealServings = "1"

    let quickAddMealNonce: Int
    let consumedQuickAddMealNonce: Int
    let onConsumeQuickAddMealNonce: (Int) -> Void

    init(
        quickAddMealNonce: Int = 0,
        consumedQuickAddMealNonce: Int = 0,
        onConsumeQuickAddMealNonce: @escaping (Int) -> Void = { _ in }
    ) {
        self.quickAddMealNonce = quickAddMealNonce
        self.consumedQuickAddMealNonce = consumedQuickAddMealNonce
        self.onConsumeQuickAddMealNonce = onConsumeQuickAddMealNonce
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                compactDateRow

                ForEach(mealOrder, id: \.self) { meal in
                    mealSection(meal)
                }

                if status == .loading {
                    HealthEmptyState(message: "Loading log...")
                }
                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }
                if !mealActionError.isEmpty {
                    HealthErrorBanner(message: mealActionError)
                }
            }
            .padding(16)
            .frame(maxWidth: 860)
            .frame(maxWidth: .infinity)
        }
        .fullScreenCover(isPresented: $showEntrySheet) {
            HealthMealEntrySheet(
                logDate: logDateKey,
                dailyLogId: logResponse?.DailyLog?.DailyLogId,
                initialMealType: activeMealType,
                existingEntry: editingEntry,
                foods: foods,
                templates: templates,
                shareUsers: shareUsers,
                nextSortOrder: nextSortOrder,
                flowMode: editingEntry == nil ? .quickAdd : .detailed,
                onSaved: { Task { await load() } }
            )
        }
        .alert("Delete entry", isPresented: Binding(
            get: { entryToDelete != nil },
            set: { if !$0 { entryToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let entry = entryToDelete {
                    Task { await deleteEntry(entry) }
                }
            }
            Button("Cancel", role: .cancel) { entryToDelete = nil }
        } message: {
            Text("This will remove the entry from the log.")
        }
        .alert("Save as meal", isPresented: $saveMealOpen) {
            TextField("Meal name", text: $saveMealName)
            TextField("Servings", text: $saveMealServings)
                .keyboardType(.decimalPad)
            Button(mealActionLoading ? "Saving..." : "Save") {
                Task { await saveMealTemplate() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Create a reusable meal from \(saveMealMealType.label.lowercased()).")
        }
        .task(id: logDateKey) {
            await load()
        }
        .onAppear {
            handleQuickAddMealIfNeeded()
        }
        .onChange(of: quickAddMealNonce) { _, _ in
            handleQuickAddMealIfNeeded()
        }
    }

    private var compactDateRow: some View {
        HStack(spacing: 10) {
            Button {
                shiftDate(days: -1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.bordered)

            DatePicker("", selection: $logDate, in: ...Date(), displayedComponents: .date)
                .labelsHidden()

            Button {
                shiftDate(days: 1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.bordered)
            .disabled(isNextDisabled)

            Spacer(minLength: 8)

            if let calories = logResponse?.Totals.TotalCalories {
                Text(HealthFormatters.formatCalories(calories))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func mealSection(_ meal: HealthMealType) -> some View {
        let entries = groupedEntries[meal] ?? []
        return HealthSectionCard {
            HealthSectionHeader(
                title: meal.label,
                subtitle: entries.isEmpty ? "No entries yet." : "\(entries.count) items",
                trailing: AnyView(
                    Button("Add") {
                        activeMealType = meal
                        editingEntry = nil
                        showEntrySheet = true
                    }
                    .buttonStyle(.borderedProminent)
                )
            )

            if entries.isEmpty {
                HealthEmptyState(message: "Nothing logged yet.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(entries) { entry in
                        HealthEntryRow(entry: entry) {
                            editingEntry = entry
                            activeMealType = entry.MealType
                            showEntrySheet = true
                        } onDelete: {
                            entryToDelete = entry
                        }
                    }

                    HStack(spacing: 10) {
                        Button("Save as meal") {
                            beginSaveMeal(for: meal)
                        }
                        .buttonStyle(.bordered)
                        .disabled(mealActionLoading)

                        if !shareUsers.isEmpty {
                            Menu {
                                ForEach(shareUsers) { user in
                                    Button(user.displayName) {
                                        Task { await shareSlotEntries(entries, targetUserId: user.Id) }
                                    }
                                }
                            } label: {
                                Label("Share this meal", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(.bordered)
                            .disabled(mealActionLoading)
                        }
                    }
                }
            }
        }
    }

    private var mealOrder: [HealthMealType] {
        [.Breakfast, .Snack1, .Lunch, .Snack2, .Dinner, .Snack3]
    }

    private var groupedEntries: [HealthMealType: [HealthMealEntryWithFood]] {
        let entries = logResponse?.Entries ?? []
        let sorted = entries.sorted { $0.SortOrder < $1.SortOrder }
        return Dictionary(grouping: sorted, by: { $0.MealType })
    }

    private var logDateKey: String {
        HealthFormatters.dateKey(from: logDate)
    }

    private var isNextDisabled: Bool {
        let todayKey = HealthFormatters.dateKey(from: Date())
        return logDateKey >= todayKey
    }

    private var nextSortOrder: Int {
        let entries = logResponse?.Entries ?? []
        let maxValue = entries.map { $0.SortOrder }.max() ?? 0
        return maxValue + 1
    }

    private func shiftDate(days: Int) {
        if let updated = Calendar.current.date(byAdding: .day, value: days, to: logDate) {
            if updated <= Date() {
                logDate = updated
            }
        }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let logResult = HealthApi.fetchDailyLog(date: logDateKey)
            if foods.isEmpty {
                foods = try await HealthApi.fetchFoods()
            }
            if templates.isEmpty {
                let response = try await HealthApi.fetchMealTemplates()
                templates = response.Templates
            }
            if shareUsers.isEmpty {
                do {
                    shareUsers = try await SettingsApi.fetchUsers()
                } catch {
                    shareUsers = []
                }
            }
            logResponse = try await logResult
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load log."
        }
    }

    private func deleteEntry(_ entry: HealthMealEntryWithFood) async {
        entryToDelete = nil
        do {
            status = .loading
            _ = try await HealthApi.deleteMealEntry(mealEntryId: entry.MealEntryId)
            await load()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to delete entry."
        }
    }

    private func beginSaveMeal(for meal: HealthMealType) {
        saveMealMealType = meal
        saveMealName = "\(meal.label) \(HealthFormatters.formatShortDate(logDateKey))"
        saveMealServings = "1"
        mealActionError = ""
        saveMealOpen = true
    }

    private func handleQuickAddMealIfNeeded() {
        guard quickAddMealNonce > consumedQuickAddMealNonce else { return }
        activeMealType = defaultMealTypeForCurrentTime()
        editingEntry = nil
        showEntrySheet = true
        onConsumeQuickAddMealNonce(quickAddMealNonce)
    }

    private func defaultMealTypeForCurrentTime(_ value: Date = Date()) -> HealthMealType {
        HealthMealType.defaultForCurrentTime(value)
    }

    private func saveMealTemplate() async {
        let name = saveMealName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            mealActionError = "Meal name is required."
            return
        }
        guard let servings = Double(saveMealServings), servings > 0 else {
            mealActionError = "Servings must be greater than zero."
            return
        }

        let entries = groupedEntries[saveMealMealType] ?? []
        let items = buildTemplateItems(from: entries, mealType: saveMealMealType)
        guard !items.isEmpty else {
            mealActionError = "Add at least one item before saving this meal."
            return
        }

        mealActionLoading = true
        mealActionError = ""
        do {
            let created = try await HealthApi.createMealTemplate(
                HealthCreateMealTemplateRequest(
                    TemplateName: name,
                    Servings: servings,
                    IsFavourite: false,
                    Items: items
                )
            )
            templates.append(created)
            mealActionLoading = false
            saveMealOpen = false
        } catch {
            mealActionLoading = false
            mealActionError = (error as? ApiError)?.message ?? "Unable to save meal."
        }
    }

    private func buildTemplateItems(from entries: [HealthMealEntryWithFood], mealType: HealthMealType) -> [HealthMealTemplateItemInput] {
        var drafts: [MealTemplateItemDraft] = []

        for entry in entries {
            if let foodId = entry.FoodId {
                drafts.append(
                    MealTemplateItemDraft(
                        FoodId: foodId,
                        MealType: mealType,
                        Quantity: entry.Quantity,
                        EntryQuantity: entry.DisplayQuantity,
                        EntryUnit: entry.PortionLabel,
                        EntryNotes: entry.EntryNotes
                    )
                )
                continue
            }

            guard let templateId = entry.MealTemplateId,
                  let sourceTemplate = templates.first(where: { $0.Template.MealTemplateId == templateId }) else {
                continue
            }

            let multiplier = max(entry.Quantity, 0)
            for item in sourceTemplate.Items {
                drafts.append(
                    MealTemplateItemDraft(
                        FoodId: item.FoodId,
                        MealType: mealType,
                        Quantity: item.Quantity * multiplier,
                        EntryQuantity: item.EntryQuantity.map { $0 * multiplier },
                        EntryUnit: item.EntryUnit,
                        EntryNotes: item.EntryNotes
                    )
                )
            }
        }

        return drafts.enumerated().compactMap { index, draft in
            guard draft.Quantity > 0 else { return nil }
            return HealthMealTemplateItemInput(
                FoodId: draft.FoodId,
                MealType: draft.MealType,
                Quantity: draft.Quantity,
                EntryQuantity: draft.EntryQuantity,
                EntryUnit: draft.EntryUnit,
                EntryNotes: draft.EntryNotes,
                SortOrder: index
            )
        }
    }

    private func shareSlotEntries(_ entries: [HealthMealEntryWithFood], targetUserId: Int) async {
        guard !entries.isEmpty else {
            mealActionError = "No items to share yet."
            return
        }

        mealActionLoading = true
        mealActionError = ""
        do {
            for entry in entries {
                _ = try await HealthApi.shareMealEntry(
                    HealthShareMealEntryRequest(
                        LogDate: logDateKey,
                        TargetUserId: targetUserId,
                        MealType: entry.MealType,
                        FoodId: entry.FoodId,
                        MealTemplateId: entry.MealTemplateId,
                        Quantity: entry.Quantity,
                        PortionOptionId: entry.PortionOptionId,
                        PortionLabel: entry.PortionLabel ?? "serving",
                        PortionBaseUnit: entry.PortionBaseUnit ?? "each",
                        PortionBaseAmount: entry.PortionBaseAmount ?? 1,
                        EntryNotes: entry.EntryNotes,
                        ScheduleSlotId: nil
                    )
                )
            }
            mealActionLoading = false
        } catch {
            mealActionLoading = false
            mealActionError = (error as? ApiError)?.message ?? "Unable to share meal entries."
        }
    }
}

private struct HealthEntryRow: View {
    let entry: HealthMealEntryWithFood
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.TemplateName ?? entry.FoodName)
                    .font(.subheadline.weight(.semibold))
                Text(detailLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Text(HealthFormatters.formatCalories(entry.CaloriesPerServing * entry.Quantity))
                    .font(.subheadline.weight(.semibold))
                HStack(spacing: 8) {
                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                    }
                    .buttonStyle(.borderless)

                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.borderless)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var detailLine: String {
        let quantity = HealthFormatters.formatNumber(entry.Quantity, decimals: 2)
        let unit = entry.PortionLabel ?? "serving"
        return "\(quantity) \(unit)"
    }
}

private struct MealTemplateItemDraft {
    let FoodId: String
    let MealType: HealthMealType
    let Quantity: Double
    let EntryQuantity: Double?
    let EntryUnit: String?
    let EntryNotes: String?
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
