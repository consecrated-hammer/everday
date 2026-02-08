import SwiftUI

struct HealthMealEntrySheet: View {
    @Environment(\.dismiss) private var dismiss
    let logDate: String
    let dailyLogId: String?
    let initialMealType: HealthMealType
    let existingEntry: HealthMealEntryWithFood?
    let foods: [HealthFood]
    let templates: [HealthMealTemplateWithItems]
    let shareUsers: [SettingsUser]
    let nextSortOrder: Int
    let onSaved: () -> Void

    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var selectionMode: SelectionMode
    @State private var selectedMealType: HealthMealType
    @State private var selectedFoodId: String?
    @State private var selectedTemplateId: String?
    @State private var searchText = ""
    @State private var quantityText = "1"
    @State private var selectedPortionId: String?
    @State private var portionOptions: HealthPortionOptionsResponse?
    @State private var notesText = ""
    @State private var shareUserId: Int?

    init(
        logDate: String,
        dailyLogId: String?,
        initialMealType: HealthMealType,
        existingEntry: HealthMealEntryWithFood?,
        foods: [HealthFood],
        templates: [HealthMealTemplateWithItems],
        shareUsers: [SettingsUser],
        nextSortOrder: Int,
        onSaved: @escaping () -> Void
    ) {
        self.logDate = logDate
        self.dailyLogId = dailyLogId
        self.initialMealType = initialMealType
        self.existingEntry = existingEntry
        self.foods = foods
        self.templates = templates
        self.shareUsers = shareUsers
        self.nextSortOrder = nextSortOrder
        self.onSaved = onSaved
        let initialMode: SelectionMode = existingEntry?.MealTemplateId != nil ? .template : .food
        _selectionMode = State(initialValue: initialMode)
        _selectedMealType = State(initialValue: existingEntry?.MealType ?? initialMealType)
        _selectedFoodId = State(initialValue: existingEntry?.FoodId)
        _selectedTemplateId = State(initialValue: existingEntry?.MealTemplateId)
        _quantityText = State(initialValue: existingEntry.map { HealthFormatters.formatNumber($0.Quantity, decimals: 2) } ?? "1")
        _notesText = State(initialValue: existingEntry?.EntryNotes ?? "")
        _selectedPortionId = State(initialValue: existingEntry?.PortionOptionId ?? "base")
    }

    var body: some View {
        NavigationStack {
            List {
                mealSection
                entryTypeSection
                searchSection
                selectionSection
                servingSection
                notesSection
                shareSection
                errorSection
            }
            .navigationTitle(existingEntry == nil ? "Add entry" : "Edit entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(status == .loading ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || status == .loading)
                }
            }
            .task(id: selectedFoodId) {
                await loadPortionOptions()
            }
        }
    }

    @ViewBuilder
    private var mealSection: some View {
        Section("Meal") {
            Picker("Meal", selection: $selectedMealType) {
                ForEach(HealthMealType.allCases, id: \.self) { meal in
                    Text(meal.label).tag(meal)
                }
            }
        }
    }

    @ViewBuilder
    private var entryTypeSection: some View {
        Section("Entry type") {
            Picker("Entry type", selection: $selectionMode) {
                Text("Food").tag(SelectionMode.food)
                Text("Template").tag(SelectionMode.template)
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var searchSection: some View {
        Section("Search") {
            TextField("Search", text: $searchText)
        }
    }

    @ViewBuilder
    private var selectionSection: some View {
        Section(selectionMode == .food ? "Foods" : "Templates") {
            if selectionMode == .food {
                ForEach(filteredFoods) { food in
                    foodRow(food)
                }
            } else {
                ForEach(filteredTemplates) { template in
                    templateRow(template)
                }
            }
        }
    }

    @ViewBuilder
    private func foodRow(_ food: HealthFood) -> some View {
        Button {
            selectedFoodId = food.FoodId
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(food.FoodName)
                    Text(food.ServingDescription)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if selectedFoodId == food.FoodId {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }

    @ViewBuilder
    private func templateRow(_ template: HealthMealTemplateWithItems) -> some View {
        Button {
            selectedTemplateId = template.Template.MealTemplateId
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.Template.TemplateName)
                    Text("\(template.Items.count) items")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if selectedTemplateId == template.Template.MealTemplateId {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }

    @ViewBuilder
    private var servingSection: some View {
        Section("Serving") {
            TextField("Quantity", text: $quantityText)
                .keyboardType(.decimalPad)

            if selectionMode == .food {
                Picker("Portion", selection: $selectedPortionId) {
                    ForEach(portionChoices) { choice in
                        Text(choice.label).tag(choice.id as String?)
                    }
                }
            } else {
                Text("Templates log as 1 serving by default.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var notesSection: some View {
        Section("Notes") {
            TextField("Optional notes", text: $notesText, axis: .vertical)
        }
    }

    @ViewBuilder
    private var shareSection: some View {
        if !shareUsers.isEmpty && existingEntry == nil {
            Section("Share") {
                Picker("Share with", selection: $shareUserId) {
                    Text("Do not share").tag(Int?.none)
                    ForEach(shareUsers) { user in
                        Text(user.displayName).tag(Int?.some(user.Id))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if !errorMessage.isEmpty {
            Section {
                HealthErrorBanner(message: errorMessage)
            }
        }
    }

    private var filteredFoods: [HealthFood] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return foods }
        return foods.filter { $0.FoodName.localizedCaseInsensitiveContains(trimmed) }
    }

    private var filteredTemplates: [HealthMealTemplateWithItems] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return templates }
        return templates.filter { $0.Template.TemplateName.localizedCaseInsensitiveContains(trimmed) }
    }

    private var portionChoices: [PortionChoice] {
        guard let selectedFood else { return [] }
        var choices: [PortionChoice] = []
        let baseLabel = selectedFood.ServingDescription.isEmpty
            ? "\(HealthFormatters.formatNumber(selectedFood.ServingQuantity, decimals: 2)) \(selectedFood.ServingUnit)"
            : selectedFood.ServingDescription
        choices.append(PortionChoice(
            id: "base",
            label: baseLabel,
            baseUnit: selectedFood.ServingUnit,
            baseAmount: selectedFood.ServingQuantity,
            optionId: nil
        ))

        if let options = portionOptions?.Options {
            for option in options {
                let label = option.Label
                choices.append(PortionChoice(
                    id: option.PortionOptionId ?? label,
                    label: label,
                    baseUnit: option.BaseUnit,
                    baseAmount: option.BaseAmount,
                    optionId: option.PortionOptionId
                ))
            }
        }

        return choices
    }

    private var selectedFood: HealthFood? {
        foods.first { $0.FoodId == selectedFoodId }
    }

    private var selectedTemplate: HealthMealTemplateWithItems? {
        templates.first { $0.Template.MealTemplateId == selectedTemplateId }
    }

    private var isDirty: Bool {
        if existingEntry == nil {
            return selectedFoodId != nil || selectedTemplateId != nil || !notesText.isEmpty
        }
        let mealChanged = selectedMealType != existingEntry?.MealType
        let notesChanged = notesText != (existingEntry?.EntryNotes ?? "")
        let quantityChanged = quantityText != (existingEntry.map { HealthFormatters.formatNumber($0.Quantity, decimals: 2) } ?? "")
        return mealChanged || notesChanged || quantityChanged
    }

    private var isValid: Bool {
        if selectionMode == .food && selectedFoodId == nil { return false }
        if selectionMode == .template && selectedTemplateId == nil { return false }
        if Double(quantityText) == nil || (Double(quantityText) ?? 0) <= 0 { return false }
        if selectionMode == .food && portionChoices.isEmpty { return false }
        return true
    }

    private func loadPortionOptions() async {
        guard selectionMode == .food, let foodId = selectedFoodId else {
            portionOptions = nil
            return
        }
        do {
            portionOptions = try await HealthApi.fetchPortionOptions(foodId: foodId)
            if selectedPortionId == nil {
                selectedPortionId = "base"
            }
        } catch {
            portionOptions = nil
        }
    }

    private func save() async {
        guard isValid else { return }
        status = .loading
        errorMessage = ""
        do {
            let quantity = Double(quantityText) ?? 1
            let portionPayload = try buildPortionPayload()
            let logId = try await ensureDailyLogId()

            if let existingEntry {
                _ = try await HealthApi.updateMealEntry(
                    mealEntryId: existingEntry.MealEntryId,
                    request: HealthUpdateMealEntryRequest(
                        MealType: selectedMealType,
                        Quantity: quantity,
                        PortionOptionId: portionPayload.optionId,
                        PortionLabel: portionPayload.label,
                        PortionBaseUnit: portionPayload.baseUnit,
                        PortionBaseAmount: portionPayload.baseAmount,
                        EntryNotes: notesText.isEmpty ? nil : notesText
                    )
                )
            } else {
                let request = HealthCreateMealEntryRequest(
                    DailyLogId: logId,
                    MealType: selectedMealType,
                    FoodId: selectionMode == .food ? selectedFoodId : nil,
                    MealTemplateId: selectionMode == .template ? selectedTemplateId : nil,
                    Quantity: quantity,
                    PortionOptionId: portionPayload.optionId,
                    PortionLabel: portionPayload.label,
                    PortionBaseUnit: portionPayload.baseUnit,
                    PortionBaseAmount: portionPayload.baseAmount,
                    EntryNotes: notesText.isEmpty ? nil : notesText,
                    SortOrder: nextSortOrder,
                    ScheduleSlotId: nil
                )
                _ = try await HealthApi.createMealEntry(request)
                if let shareUserId {
                    let shareRequest = HealthShareMealEntryRequest(
                        LogDate: logDate,
                        TargetUserId: shareUserId,
                        MealType: selectedMealType,
                        FoodId: selectionMode == .food ? selectedFoodId : nil,
                        MealTemplateId: selectionMode == .template ? selectedTemplateId : nil,
                        Quantity: quantity,
                        PortionOptionId: portionPayload.optionId,
                        PortionLabel: portionPayload.label,
                        PortionBaseUnit: portionPayload.baseUnit,
                        PortionBaseAmount: portionPayload.baseAmount,
                        EntryNotes: notesText.isEmpty ? nil : notesText,
                        ScheduleSlotId: nil
                    )
                    _ = try await HealthApi.shareMealEntry(shareRequest)
                }
            }

            status = .ready
            onSaved()
            dismiss()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to save entry."
        }
    }

    private func ensureDailyLogId() async throws -> String {
        if let logId = dailyLogId {
            return logId
        }
        let created = try await HealthApi.createDailyLog(
            HealthCreateDailyLogRequest(
                LogDate: logDate,
                Steps: 0,
                StepKcalFactorOverride: nil,
                WeightKg: nil,
                Notes: nil
            )
        )
        return created.DailyLog.DailyLogId
    }

    private func buildPortionPayload() throws -> PortionPayload {
        if selectionMode == .template {
            return PortionPayload(optionId: nil, label: "serving", baseUnit: "each", baseAmount: 1)
        }
        guard let choice = portionChoices.first(where: { $0.id == selectedPortionId }) ?? portionChoices.first else {
            throw ApiError(message: "Select a serving size")
        }
        return PortionPayload(optionId: choice.optionId, label: choice.label, baseUnit: choice.baseUnit, baseAmount: choice.baseAmount)
    }
}

private enum SelectionMode: String, CaseIterable {
    case food
    case template
}

private struct PortionChoice: Identifiable {
    let id: String
    let label: String
    let baseUnit: String
    let baseAmount: Double
    let optionId: String?
}

private struct PortionPayload {
    let optionId: String?
    let label: String
    let baseUnit: String
    let baseAmount: Double
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
