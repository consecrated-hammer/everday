import PhotosUI
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
    @State private var browseTab: EntryBrowseTab = .recent
    @State private var selectedMealType: HealthMealType
    @State private var selectedFoodId: String?
    @State private var selectedTemplateId: String?
    @State private var searchText = ""
    @State private var quantityText = "1"
    @State private var selectedPortionId: String?
    @State private var portionOptions: HealthPortionOptionsResponse?
    @State private var notesText = ""
    @State private var shareUserId: Int?

    @State private var recentStatus: LoadState = .idle
    @State private var recentFoodIds: [String] = []
    @State private var recentTemplateIds: [String] = []

    @State private var describeText = ""
    @State private var describeStatus: LoadState = .idle
    @State private var describeResult: HealthMealTextParseResponse?

    @State private var scanMode: HealthImageScanMode = .meal
    @State private var scanStatus: LoadState = .idle
    @State private var scanError = ""
    @State private var scanResult: HealthImageScanResponse?
    @State private var scanImageItem: PhotosPickerItem?
    @State private var scanImageBase64: String?
    @State private var scanNote = ""
    @State private var aiQuantityText = "1"

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
                if existingEntry == nil {
                    aiSection
                }
                browseSection
                entryTypeSection
                if browseTab == .search {
                    searchSection
                }
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
            .task(id: recentTaskKey) {
                await loadRecentItems()
            }
            .task(id: scanImageItem) {
                await loadScanImage()
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
    private var aiSection: some View {
        Section("AI quick log") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Describe meal")
                    .font(.subheadline.weight(.semibold))
                TextField("Describe your meal", text: $describeText, axis: .vertical)
                HStack(spacing: 10) {
                    Button(describeStatus == .loading ? "Parsing..." : "Parse meal") {
                        Task { await parseMealDescription() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(describeText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || describeStatus == .loading)

                    if describeResult != nil {
                        Button("Log parsed meal") {
                            Task { await logParsedMeal() }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(describeStatus == .loading || status == .loading)
                    }
                }

                if let result = describeResult {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(result.MealName)
                            .font(.footnote.weight(.semibold))
                        Text(result.Summary)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Text("\(result.CaloriesPerServing) kcal | \(HealthFormatters.formatNumber(result.ProteinPerServing, decimals: 1)) g protein")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Divider()

            VStack(alignment: .leading, spacing: 10) {
                Text("Scan photo")
                    .font(.subheadline.weight(.semibold))

                Picker("Scan mode", selection: $scanMode) {
                    Text("Meal photo").tag(HealthImageScanMode.meal)
                    Text("Nutrition label").tag(HealthImageScanMode.label)
                }
                .pickerStyle(.segmented)

                PhotosPicker(selection: $scanImageItem, matching: .images) {
                    Text(scanImageBase64 == nil ? "Choose photo" : "Change photo")
                }

                TextField("Context note (optional)", text: $scanNote, axis: .vertical)

                Button(scanStatus == .loading ? "Analyzing..." : "Analyze photo") {
                    Task { await analyzeScanPhoto() }
                }
                .buttonStyle(.bordered)
                .disabled(scanImageBase64 == nil || scanStatus == .loading)

                if let result = scanResult {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(result.FoodName)
                            .font(.footnote.weight(.semibold))
                        Text(result.Summary)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Text("Confidence: \(result.Confidence)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !result.Questions.isEmpty {
                            ForEach(result.Questions, id: \.self) { question in
                                Text("• \(question)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Button("Log scan result") {
                            Task { await logScanResult() }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(scanStatus == .loading || status == .loading)
                    }
                }

                if !scanError.isEmpty {
                    HealthErrorBanner(message: scanError)
                }

                TextField("AI log quantity", text: $aiQuantityText)
                    .keyboardType(.decimalPad)
            }
        }
    }

    @ViewBuilder
    private var browseSection: some View {
        Section("Browse") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(EntryBrowseTab.allCases) { tab in
                        HealthChip(title: tab.label, isSelected: browseTab == tab) {
                            browseTab = tab
                        }
                    }
                }
                .padding(.vertical, 2)
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
            TextField("Search foods and meals", text: $searchText)
        }
    }

    @ViewBuilder
    private var selectionSection: some View {
        Section(selectionMode == .food ? "Foods" : "Templates") {
            if browseTab == .recent && recentStatus == .loading {
                ProgressView("Loading recent items...")
            }

            if selectionMode == .food {
                if displayedFoods.isEmpty {
                    Text(emptySelectionMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(displayedFoods) { food in
                        foodRow(food)
                    }
                }
            } else {
                if displayedTemplates.isEmpty {
                    Text(emptySelectionMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(displayedTemplates) { template in
                        templateRow(template)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func foodRow(_ food: HealthFood) -> some View {
        Button {
            selectionMode = .food
            selectedFoodId = food.FoodId
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(food.FoodName)
                    Text("\(food.ServingDescription) | \(Int(food.CaloriesPerServing.rounded())) kcal")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if selectedFoodId == food.FoodId && selectionMode == .food {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }

    @ViewBuilder
    private func templateRow(_ template: HealthMealTemplateWithItems) -> some View {
        Button {
            selectionMode = .template
            selectedTemplateId = template.Template.MealTemplateId
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.Template.TemplateName)
                    Text(templateSubtitle(template))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if selectedTemplateId == template.Template.MealTemplateId && selectionMode == .template {
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

    private var recentTaskKey: String {
        "\(logDate)-\(selectedMealType.rawValue)-\(existingEntry == nil ? "add" : "edit")"
    }

    private var trimmedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var foodsById: [String: HealthFood] {
        Dictionary(uniqueKeysWithValues: foods.map { ($0.FoodId, $0) })
    }

    private var templatesById: [String: HealthMealTemplateWithItems] {
        Dictionary(uniqueKeysWithValues: templates.map { ($0.Template.MealTemplateId, $0) })
    }

    private var sortedFoods: [HealthFood] {
        foods.sorted { $0.FoodName.localizedCaseInsensitiveCompare($1.FoodName) == .orderedAscending }
    }

    private var sortedTemplates: [HealthMealTemplateWithItems] {
        templates.sorted { $0.Template.TemplateName.localizedCaseInsensitiveCompare($1.Template.TemplateName) == .orderedAscending }
    }

    private var displayedFoods: [HealthFood] {
        switch browseTab {
        case .recent:
            return recentFoodIds.compactMap { foodsById[$0] }
        case .favourites:
            return sortedFoods.filter { $0.IsFavourite }
        case .search:
            guard !trimmedSearchText.isEmpty else { return [] }
            return sortedFoods.filter { $0.FoodName.localizedCaseInsensitiveContains(trimmedSearchText) }
        case .library:
            return sortedFoods
        }
    }

    private var displayedTemplates: [HealthMealTemplateWithItems] {
        switch browseTab {
        case .recent:
            return recentTemplateIds.compactMap { templatesById[$0] }
        case .favourites:
            return sortedTemplates.filter { $0.Template.IsFavourite }
        case .search:
            guard !trimmedSearchText.isEmpty else { return [] }
            return sortedTemplates.filter { $0.Template.TemplateName.localizedCaseInsensitiveContains(trimmedSearchText) }
        case .library:
            return sortedTemplates
        }
    }

    private var emptySelectionMessage: String {
        switch browseTab {
        case .recent:
            return recentStatus == .loading ? "Loading recent items..." : "No recent items yet."
        case .favourites:
            return "No favourites yet."
        case .search:
            return trimmedSearchText.isEmpty ? "Enter a search term." : "No matching items found."
        case .library:
            return selectionMode == .food ? "No foods yet." : "No templates yet."
        }
    }

    private var templateCaloriesById: [String: Int] {
        var values: [String: Int] = [:]
        for template in templates {
            let totalCalories = template.Items.reduce(0.0) { partial, item in
                guard let food = foodsById[item.FoodId] else { return partial }
                let quantity = item.EntryQuantity ?? item.Quantity
                return partial + (food.CaloriesPerServing * quantity)
            }
            let servings = template.Template.Servings > 0 ? template.Template.Servings : 1
            values[template.Template.MealTemplateId] = Int((totalCalories / servings).rounded())
        }
        return values
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

    private func templateSubtitle(_ template: HealthMealTemplateWithItems) -> String {
        let count = template.Items.count
        let calories = templateCaloriesById[template.Template.MealTemplateId]
        if let calories {
            return "\(count) items | \(calories) kcal"
        }
        return "\(count) items"
    }

    private func loadRecentItems() async {
        guard existingEntry == nil else {
            recentFoodIds = []
            recentTemplateIds = []
            recentStatus = .idle
            return
        }

        recentStatus = .loading
        recentFoodIds = []
        recentTemplateIds = []

        let dates = buildRecentDates(anchor: logDate, days: 14)
        var logs: [HealthDailyLogResponse] = []

        await withTaskGroup(of: HealthDailyLogResponse?.self) { group in
            for date in dates {
                group.addTask {
                    do {
                        return try await HealthApi.fetchDailyLog(date: date)
                    } catch {
                        return nil
                    }
                }
            }

            for await response in group {
                if let response {
                    logs.append(response)
                }
            }
        }

        var foodStats: [String: RecentUsage] = [:]
        var templateStats: [String: RecentUsage] = [:]

        for log in logs {
            let dateKey = log.DailyLog?.LogDate ?? log.Summary.LogDate
            let lastUsed = HealthFormatters.date(from: dateKey)?.timeIntervalSince1970 ?? 0
            for entry in log.Entries where entry.MealType == selectedMealType {
                if let foodId = entry.FoodId {
                    updateRecentUsage(&foodStats, id: foodId, lastUsed: lastUsed)
                }
                if let templateId = entry.MealTemplateId {
                    updateRecentUsage(&templateStats, id: templateId, lastUsed: lastUsed)
                }
            }
        }

        recentFoodIds = sortRecentIds(foodStats)
        recentTemplateIds = sortRecentIds(templateStats)
        recentStatus = .ready
    }

    private func updateRecentUsage(_ stats: inout [String: RecentUsage], id: String, lastUsed: TimeInterval) {
        var usage = stats[id] ?? RecentUsage(count: 0, lastUsed: 0)
        usage.count += 1
        usage.lastUsed = max(usage.lastUsed, lastUsed)
        stats[id] = usage
    }

    private func sortRecentIds(_ stats: [String: RecentUsage]) -> [String] {
        stats
            .sorted { lhs, rhs in
                if lhs.value.count != rhs.value.count {
                    return lhs.value.count > rhs.value.count
                }
                if lhs.value.lastUsed != rhs.value.lastUsed {
                    return lhs.value.lastUsed > rhs.value.lastUsed
                }
                return lhs.key < rhs.key
            }
            .map(\.key)
    }

    private func buildRecentDates(anchor: String, days: Int) -> [String] {
        guard days > 0 else { return [] }
        let anchorDate = HealthFormatters.date(from: anchor) ?? Date()
        return (0..<days).compactMap { offset in
            guard let date = Calendar.current.date(byAdding: .day, value: -offset, to: anchorDate) else {
                return nil
            }
            return HealthFormatters.dateKey(from: date)
        }
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
                        EntryNotes: trimmedOrNil(notesText)
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
                    EntryNotes: trimmedOrNil(notesText),
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
                        EntryNotes: trimmedOrNil(notesText),
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

    private func parseMealDescription() async {
        describeStatus = .loading
        errorMessage = ""
        do {
            describeResult = try await HealthApi.parseMealTemplateText(
                HealthMealTextParseRequest(Text: describeText.trimmingCharacters(in: .whitespacesAndNewlines), KnownFoods: nil)
            )
            describeStatus = .ready
        } catch {
            describeStatus = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to parse meal description."
        }
    }

    private func logParsedMeal() async {
        guard let result = describeResult else { return }
        describeStatus = .loading
        errorMessage = ""
        do {
            let quantity = try parseAiQuantity()
            let food = try await createAiFood(
                name: "\(result.MealName) (AI total)",
                servingQuantity: result.ServingQuantity,
                servingUnit: result.ServingUnit,
                calories: Double(result.CaloriesPerServing),
                protein: result.ProteinPerServing,
                fibre: result.FibrePerServing,
                carbs: result.CarbsPerServing,
                fat: result.FatPerServing,
                saturatedFat: result.SaturatedFatPerServing,
                sugar: result.SugarPerServing,
                sodium: result.SodiumPerServing,
                imageBase64: nil
            )
            try await logAiFood(food: food, quantity: quantity, notes: result.Summary)
            describeStatus = .ready
            onSaved()
            dismiss()
        } catch {
            describeStatus = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to log parsed meal."
        }
    }

    private func analyzeScanPhoto() async {
        guard let scanImageBase64 else {
            scanError = "Choose a photo first."
            return
        }
        scanStatus = .loading
        scanError = ""
        errorMessage = ""
        do {
            scanResult = try await HealthApi.scanFoodImage(
                HealthImageScanRequest(
                    ImageBase64: scanImageBase64,
                    Mode: scanMode,
                    Note: trimmedOrNil(scanNote)
                )
            )
            scanStatus = .ready
        } catch {
            scanStatus = .error
            scanError = (error as? ApiError)?.message ?? "Unable to scan photo."
        }
    }

    private func logScanResult() async {
        guard let result = scanResult else { return }
        scanStatus = .loading
        scanError = ""
        errorMessage = ""
        do {
            let quantity = try parseAiQuantity()
            let food = try await createAiFood(
                name: result.FoodName,
                servingQuantity: result.ServingQuantity,
                servingUnit: result.ServingUnit,
                calories: Double(result.CaloriesPerServing),
                protein: result.ProteinPerServing,
                fibre: result.FibrePerServing,
                carbs: result.CarbsPerServing,
                fat: result.FatPerServing,
                saturatedFat: result.SaturatedFatPerServing,
                sugar: result.SugarPerServing,
                sodium: result.SodiumPerServing,
                imageBase64: scanImageBase64
            )
            try await logAiFood(food: food, quantity: quantity, notes: result.Summary)
            scanStatus = .ready
            onSaved()
            dismiss()
        } catch {
            scanStatus = .error
            scanError = (error as? ApiError)?.message ?? "Unable to log scan result."
        }
    }

    private func loadScanImage() async {
        guard let scanImageItem else { return }
        do {
            if let data = try await scanImageItem.loadTransferable(type: Data.self) {
                scanImageBase64 = data.base64EncodedString()
            } else {
                scanImageBase64 = nil
            }
        } catch {
            scanImageBase64 = nil
        }
    }

    private func createAiFood(
        name: String,
        servingQuantity: Double,
        servingUnit: String,
        calories: Double,
        protein: Double,
        fibre: Double?,
        carbs: Double?,
        fat: Double?,
        saturatedFat: Double?,
        sugar: Double?,
        sodium: Double?,
        imageBase64: String?
    ) async throws -> HealthFood {
        try await HealthApi.createFood(
            HealthCreateFoodRequest(
                FoodName: name,
                ServingDescription: "\(servingQuantity) \(servingUnit)",
                ServingQuantity: servingQuantity,
                ServingUnit: servingUnit,
                CaloriesPerServing: calories,
                ProteinPerServing: protein,
                FibrePerServing: fibre,
                CarbsPerServing: carbs,
                FatPerServing: fat,
                SaturatedFatPerServing: saturatedFat,
                SugarPerServing: sugar,
                SodiumPerServing: sodium,
                DataSource: "ai",
                CountryCode: "AU",
                IsFavourite: false,
                ImageBase64: imageBase64
            )
        )
    }

    private func logAiFood(food: HealthFood, quantity: Double, notes: String?) async throws {
        let logId = try await ensureDailyLogId()
        let portionLabel: String
        if food.ServingDescription.isEmpty {
            portionLabel = "\(HealthFormatters.formatNumber(food.ServingQuantity, decimals: 2)) \(food.ServingUnit)"
        } else {
            portionLabel = food.ServingDescription
        }

        _ = try await HealthApi.createMealEntry(
            HealthCreateMealEntryRequest(
                DailyLogId: logId,
                MealType: selectedMealType,
                FoodId: food.FoodId,
                MealTemplateId: nil,
                Quantity: quantity,
                PortionOptionId: nil,
                PortionLabel: portionLabel,
                PortionBaseUnit: food.ServingUnit,
                PortionBaseAmount: max(food.ServingQuantity, 0.0001),
                EntryNotes: trimmedOrNil(notes),
                SortOrder: nextSortOrder,
                ScheduleSlotId: nil
            )
        )

        if let shareUserId {
            _ = try await HealthApi.shareMealEntry(
                HealthShareMealEntryRequest(
                    LogDate: logDate,
                    TargetUserId: shareUserId,
                    MealType: selectedMealType,
                    FoodId: food.FoodId,
                    MealTemplateId: nil,
                    Quantity: quantity,
                    PortionOptionId: nil,
                    PortionLabel: portionLabel,
                    PortionBaseUnit: food.ServingUnit,
                    PortionBaseAmount: max(food.ServingQuantity, 0.0001),
                    EntryNotes: trimmedOrNil(notes),
                    ScheduleSlotId: nil
                )
            )
        }
    }

    private func parseAiQuantity() throws -> Double {
        guard let quantity = Double(aiQuantityText), quantity > 0 else {
            throw ApiError(message: "AI log quantity must be greater than zero.")
        }
        return quantity
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

    private func trimmedOrNil(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private enum SelectionMode: String, CaseIterable {
    case food
    case template
}

private enum EntryBrowseTab: String, CaseIterable, Identifiable {
    case recent
    case favourites
    case search
    case library

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recent:
            return "Recent"
        case .favourites:
            return "Favourites"
        case .search:
            return "Search"
        case .library:
            return "Foods"
        }
    }
}

private struct RecentUsage {
    var count: Int
    var lastUsed: TimeInterval
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
