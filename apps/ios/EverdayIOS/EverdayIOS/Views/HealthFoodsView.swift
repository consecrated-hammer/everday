import PhotosUI
import SwiftUI

struct HealthFoodsView: View {
    @State private var tab: FoodTab = .foods
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var foods: [HealthFood] = []
    @State private var templates: [HealthMealTemplateWithItems] = []
    @State private var searchText = ""
    @State private var showFavouritesOnly = false
    @State private var showFoodSheet = false
    @State private var editingFood: HealthFood?
    @State private var foodDraft: FoodDraft?
    @State private var showTemplateSheet = false
    @State private var editingTemplate: HealthMealTemplateWithItems?
    @State private var showLookupSheet = false
    @State private var foodToDelete: HealthFood?
    @State private var templateToDelete: HealthMealTemplateWithItems?
    @State private var aiMealText = ""
    @State private var aiMealResult: HealthMealTextParseResponse?
    @State private var aiMealStatus: LoadState = .idle

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard

                if tab == .foods {
                    foodsList
                } else {
                    templatesList
                }

                if status == .loading {
                    HealthEmptyState(message: "Loading foods...")
                }
                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .frame(maxWidth: 860)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showFoodSheet, onDismiss: { editingFood = nil; foodDraft = nil }) {
            FoodFormSheet(
                food: editingFood,
                draft: foodDraft,
                onSaved: { Task { await load() } }
            )
        }
        .sheet(isPresented: $showTemplateSheet, onDismiss: { editingTemplate = nil }) {
            TemplateFormSheet(
                foods: foods,
                template: editingTemplate,
                onSaved: { Task { await load() } }
            )
        }
        .sheet(isPresented: $showLookupSheet, onDismiss: { }) {
            FoodLookupSheet { draft in
                foodDraft = draft
                showLookupSheet = false
                showFoodSheet = true
            }
        }
        .alert("Delete food", isPresented: Binding(
            get: { foodToDelete != nil },
            set: { if !$0 { foodToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let food = foodToDelete { Task { await deleteFood(food) } }
            }
            Button("Cancel", role: .cancel) { foodToDelete = nil }
        } message: {
            Text("This will remove the food from your library.")
        }
        .alert("Delete meal", isPresented: Binding(
            get: { templateToDelete != nil },
            set: { if !$0 { templateToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let template = templateToDelete { Task { await deleteTemplate(template) } }
            }
            Button("Cancel", role: .cancel) { templateToDelete = nil }
        } message: {
            Text("This will remove the meal.")
        }
        .task {
            if status == .idle {
                await load()
            }
        }
    }

    private var headerCard: some View {
        HealthSectionCard {
            HealthSectionHeader(title: "Foods", subtitle: "Manage foods and meals.")
            Picker("Tab", selection: $tab) {
                Text("Foods").tag(FoodTab.foods)
                Text("Meals").tag(FoodTab.templates)
            }
            .pickerStyle(.segmented)

            HStack(spacing: 12) {
                Button("Add") {
                    if tab == .foods {
                        editingFood = nil
                        foodDraft = nil
                        showFoodSheet = true
                    } else {
                        editingTemplate = nil
                        showTemplateSheet = true
                    }
                }
                .buttonStyle(.borderedProminent)

                if tab == .foods {
                    Button("Lookup") {
                        showLookupSheet = true
                    }
                    .buttonStyle(.bordered)
                }
            }

            TextField("Search", text: $searchText)
            Toggle("Favourites only", isOn: $showFavouritesOnly)
        }
    }

    private var foodsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(filteredFoods) { food in
                HealthSectionCard {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(food.FoodName)
                                .font(.headline)
                            Text("\(food.ServingDescription) | \(HealthFormatters.formatCalories(food.CaloriesPerServing))")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if food.IsFavourite {
                            Image(systemName: "star.fill")
                                .foregroundStyle(.yellow)
                        }
                        Button {
                            editingFood = food
                            foodDraft = nil
                            showFoodSheet = true
                        } label: {
                            Image(systemName: "pencil")
                        }
                        .buttonStyle(.borderless)
                        Button(role: .destructive) {
                            foodToDelete = food
                        } label: {
                            Image(systemName: "trash")
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }

            if filteredFoods.isEmpty {
                HealthEmptyState(message: "No foods yet. Add one to start logging.")
            }
        }
    }

    private var templatesList: some View {
        VStack(alignment: .leading, spacing: 12) {
            aiMealCard

            ForEach(filteredTemplates) { template in
                HealthSectionCard {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(template.Template.TemplateName)
                                .font(.headline)
                            Text("\(template.Items.count) items")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            editingTemplate = template
                            showTemplateSheet = true
                        } label: {
                            Image(systemName: "pencil")
                        }
                        .buttonStyle(.borderless)
                        Button(role: .destructive) {
                            templateToDelete = template
                        } label: {
                            Image(systemName: "trash")
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }

            if filteredTemplates.isEmpty {
                HealthEmptyState(message: "No meals yet.")
            }
        }
    }

    private var aiMealCard: some View {
        HealthSectionCard {
            HealthSectionHeader(title: "AI meal helper", subtitle: "Describe a meal to build a saved meal.")
            TextField("Describe your meal", text: $aiMealText, axis: .vertical)
            Button(aiMealStatus == .loading ? "Parsing..." : "Parse meal") {
                Task { await parseMeal() }
            }
            .buttonStyle(.bordered)
            .disabled(aiMealText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || aiMealStatus == .loading)

            if let result = aiMealResult {
                VStack(alignment: .leading, spacing: 6) {
                    Text(result.MealName)
                        .font(.headline)
                    Text(result.Summary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Text("\(result.CaloriesPerServing) kcal | \(HealthFormatters.formatNumber(result.ProteinPerServing, decimals: 1)) g protein")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Create meal") {
                        Task { await createMealFromParse(result) }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    private var filteredFoods: [HealthFood] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        var result = foods
        if showFavouritesOnly {
            result = result.filter { $0.IsFavourite }
        }
        if trimmed.isEmpty { return result }
        return result.filter { $0.FoodName.localizedCaseInsensitiveContains(trimmed) }
    }

    private var filteredTemplates: [HealthMealTemplateWithItems] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return templates }
        return templates.filter { $0.Template.TemplateName.localizedCaseInsensitiveContains(trimmed) }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let foodsResult = HealthApi.fetchFoods()
            async let templatesResult = HealthApi.fetchMealTemplates()
            foods = try await foodsResult
            foods.sort { $0.FoodName.localizedCaseInsensitiveCompare($1.FoodName) == .orderedAscending }
            templates = try await templatesResult.Templates
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load foods."
        }
    }

    private func deleteFood(_ food: HealthFood) async {
        foodToDelete = nil
        do {
            status = .loading
            try await HealthApi.deleteFood(foodId: food.FoodId)
            await load()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to delete food."
        }
    }

    private func deleteTemplate(_ template: HealthMealTemplateWithItems) async {
        templateToDelete = nil
        do {
            status = .loading
            try await HealthApi.deleteMealTemplate(templateId: template.Template.MealTemplateId)
            await load()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to delete meal."
        }
    }

    private func parseMeal() async {
        aiMealStatus = .loading
        do {
            aiMealResult = try await HealthApi.parseMealTemplateText(HealthMealTextParseRequest(Text: aiMealText, KnownFoods: nil))
            aiMealStatus = .ready
        } catch {
            aiMealStatus = .error
        }
    }

    private func createMealFromParse(_ result: HealthMealTextParseResponse) async {
        do {
            status = .loading
            let food = try await HealthApi.createFood(HealthCreateFoodRequest(
                FoodName: "\(result.MealName) (AI total)",
                ServingDescription: "\(result.ServingQuantity) \(result.ServingUnit)",
                ServingQuantity: result.ServingQuantity,
                ServingUnit: result.ServingUnit,
                CaloriesPerServing: Double(result.CaloriesPerServing),
                ProteinPerServing: result.ProteinPerServing,
                FibrePerServing: result.FibrePerServing,
                CarbsPerServing: result.CarbsPerServing,
                FatPerServing: result.FatPerServing,
                SaturatedFatPerServing: result.SaturatedFatPerServing,
                SugarPerServing: result.SugarPerServing,
                SodiumPerServing: result.SodiumPerServing,
                DataSource: "ai",
                CountryCode: "AU",
                IsFavourite: false,
                ImageBase64: nil
            ))
            _ = try await HealthApi.createMealTemplate(HealthCreateMealTemplateRequest(
                TemplateName: result.MealName,
                Servings: 1,
                IsFavourite: false,
                Items: [
                    HealthMealTemplateItemInput(
                        FoodId: food.FoodId,
                        MealType: .Lunch,
                        Quantity: 1,
                        EntryQuantity: nil,
                        EntryUnit: nil,
                        EntryNotes: result.Summary,
                        SortOrder: 0
                    )
                ]
            ))
            aiMealText = ""
            aiMealResult = nil
            await load()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to create meal."
        }
    }
}

private enum FoodTab {
    case foods
    case templates
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}

private struct FoodDraft {
    var FoodName: String
    var ServingQuantity: Double
    var ServingUnit: String
    var CaloriesPerServing: Double
    var ProteinPerServing: Double
    var FibrePerServing: Double?
    var CarbsPerServing: Double?
    var FatPerServing: Double?
    var SaturatedFatPerServing: Double?
    var SugarPerServing: Double?
    var SodiumPerServing: Double?
    var DataSource: String
    var CountryCode: String
    var IsFavourite: Bool
    var ImageBase64: String?
}

private struct FoodFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    let food: HealthFood?
    let draft: FoodDraft?
    let onSaved: () -> Void

    @State private var name: String
    @State private var servingQuantity: String
    @State private var servingUnit: String
    @State private var calories: String
    @State private var protein: String
    @State private var fibre: String
    @State private var carbs: String
    @State private var fat: String
    @State private var saturatedFat: String
    @State private var sugar: String
    @State private var sodium: String
    @State private var isFavourite: Bool
    @State private var dataSource: String
    @State private var imageItem: PhotosPickerItem?
    @State private var imageBase64: String?
    @State private var portionOptions: HealthPortionOptionsResponse?
    @State private var showPortionSheet = false
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    private let initialSnapshot: String

    init(food: HealthFood?, draft: FoodDraft?, onSaved: @escaping () -> Void) {
        self.food = food
        self.draft = draft
        self.onSaved = onSaved
        let sourceFoodName = food?.FoodName ?? draft?.FoodName ?? ""
        let sourceServingQuantity = food?.ServingQuantity ?? draft?.ServingQuantity ?? 1
        let sourceServingUnit = food?.ServingUnit ?? draft?.ServingUnit ?? "serving"
        let sourceCalories = food?.CaloriesPerServing ?? draft?.CaloriesPerServing ?? 0
        let sourceProtein = food?.ProteinPerServing ?? draft?.ProteinPerServing ?? 0
        let sourceFibre = food?.FibrePerServing ?? draft?.FibrePerServing
        let sourceCarbs = food?.CarbsPerServing ?? draft?.CarbsPerServing
        let sourceFat = food?.FatPerServing ?? draft?.FatPerServing
        let sourceSatFat = food?.SaturatedFatPerServing ?? draft?.SaturatedFatPerServing
        let sourceSugar = food?.SugarPerServing ?? draft?.SugarPerServing
        let sourceSodium = food?.SodiumPerServing ?? draft?.SodiumPerServing
        let sourceFavourite = food?.IsFavourite ?? draft?.IsFavourite ?? false
        let sourceData = food?.DataSource ?? draft?.DataSource ?? "manual"
        _name = State(initialValue: sourceFoodName)
        _servingQuantity = State(initialValue: HealthFormatters.formatNumber(sourceServingQuantity, decimals: 2))
        _servingUnit = State(initialValue: sourceServingUnit)
        _calories = State(initialValue: HealthFormatters.formatNumber(sourceCalories, decimals: 0))
        _protein = State(initialValue: HealthFormatters.formatNumber(sourceProtein, decimals: 1))
        _fibre = State(initialValue: sourceFibre.map { HealthFormatters.formatNumber($0, decimals: 1) } ?? "")
        _carbs = State(initialValue: sourceCarbs.map { HealthFormatters.formatNumber($0, decimals: 1) } ?? "")
        _fat = State(initialValue: sourceFat.map { HealthFormatters.formatNumber($0, decimals: 1) } ?? "")
        _saturatedFat = State(initialValue: sourceSatFat.map { HealthFormatters.formatNumber($0, decimals: 1) } ?? "")
        _sugar = State(initialValue: sourceSugar.map { HealthFormatters.formatNumber($0, decimals: 1) } ?? "")
        _sodium = State(initialValue: sourceSodium.map { HealthFormatters.formatNumber($0, decimals: 1) } ?? "")
        _isFavourite = State(initialValue: sourceFavourite)
        _dataSource = State(initialValue: sourceData)
        _imageBase64 = State(initialValue: draft?.ImageBase64)
        initialSnapshot = FoodFormSheet.snapshot(
            name: sourceFoodName,
            servingQuantity: String(sourceServingQuantity),
            servingUnit: sourceServingUnit,
            calories: String(sourceCalories),
            protein: String(sourceProtein),
            fibre: String(sourceFibre ?? 0),
            carbs: String(sourceCarbs ?? 0),
            fat: String(sourceFat ?? 0),
            saturatedFat: String(sourceSatFat ?? 0),
            sugar: String(sourceSugar ?? 0),
            sodium: String(sourceSodium ?? 0),
            favourite: sourceFavourite
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Essentials") {
                    TextField("Food name", text: $name)
                    TextField("Serving quantity", text: $servingQuantity)
                        .keyboardType(.decimalPad)
                    TextField("Serving unit", text: $servingUnit)
                    Toggle("Favourite", isOn: $isFavourite)
                }

                Section("Nutrition per serving") {
                    TextField("Calories", text: $calories)
                        .keyboardType(.decimalPad)
                    TextField("Protein (g)", text: $protein)
                        .keyboardType(.decimalPad)
                    TextField("Fibre (g)", text: $fibre)
                        .keyboardType(.decimalPad)
                    TextField("Carbs (g)", text: $carbs)
                        .keyboardType(.decimalPad)
                    TextField("Fat (g)", text: $fat)
                        .keyboardType(.decimalPad)
                    TextField("Saturated fat (g)", text: $saturatedFat)
                        .keyboardType(.decimalPad)
                    TextField("Sugar (g)", text: $sugar)
                        .keyboardType(.decimalPad)
                    TextField("Sodium (g)", text: $sodium)
                        .keyboardType(.decimalPad)
                }

                Section("Photo") {
                    PhotosPicker(selection: $imageItem, matching: .images) {
                        Text("Choose photo")
                    }
                }

                if food?.FoodId != nil {
                    Section("Portion options") {
                        if let options = portionOptions?.Options, !options.isEmpty {
                            ForEach(options) { option in
                                HStack {
                                    Text(option.Label)
                                    Spacer()
                                    Text("\(HealthFormatters.formatNumber(option.BaseAmount, decimals: 2)) \(option.BaseUnit)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } else {
                            HealthEmptyState(message: "No portion options yet.")
                        }
                        Button("Add portion option") {
                            showPortionSheet = true
                        }
                        .buttonStyle(.bordered)
                    }
                }

                if !errorMessage.isEmpty {
                    Section {
                        HealthErrorBanner(message: errorMessage)
                    }
                }
            }
            .navigationTitle(food == nil ? "Add food" : "Edit food")
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
            .task(id: imageItem) {
                await loadImageBase64()
            }
            .task {
                if let foodId = food?.FoodId {
                    await loadPortionOptions(foodId: foodId)
                }
            }
            .sheet(isPresented: $showPortionSheet) {
                if let foodId = food?.FoodId {
                    PortionOptionSheet(foodId: foodId) {
                        Task { await loadPortionOptions(foodId: foodId) }
                    }
                }
            }
        }
    }

    private var isDirty: Bool {
        let snapshot = FoodFormSheet.snapshot(
            name: name,
            servingQuantity: servingQuantity,
            servingUnit: servingUnit,
            calories: calories,
            protein: protein,
            fibre: fibre,
            carbs: carbs,
            fat: fat,
            saturatedFat: saturatedFat,
            sugar: sugar,
            sodium: sodium,
            favourite: isFavourite
        )
        return snapshot != initialSnapshot
    }

    private var isValid: Bool {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return false }
        if Double(servingQuantity) == nil || (Double(servingQuantity) ?? 0) <= 0 { return false }
        if servingUnit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return false }
        if Double(calories) == nil || (Double(calories) ?? 0) <= 0 { return false }
        if Double(protein) == nil { return false }
        return true
    }

    private func loadImageBase64() async {
        guard let imageItem else { return }
        do {
            if let data = try await imageItem.loadTransferable(type: Data.self) {
                imageBase64 = data.base64EncodedString()
            }
        } catch {
            imageBase64 = nil
        }
    }

    private func loadPortionOptions(foodId: String) async {
        do {
            portionOptions = try await HealthApi.fetchPortionOptions(foodId: foodId)
        } catch {
            portionOptions = nil
        }
    }

    private func save() async {
        status = .loading
        errorMessage = ""
        do {
            let servingDescription = "\(servingQuantity) \(servingUnit)".trimmingCharacters(in: .whitespacesAndNewlines)
            let request = HealthCreateFoodRequest(
                FoodName: name,
                ServingDescription: servingDescription,
                ServingQuantity: Double(servingQuantity) ?? 1,
                ServingUnit: servingUnit,
                CaloriesPerServing: Double(calories) ?? 0,
                ProteinPerServing: Double(protein) ?? 0,
                FibrePerServing: Double(fibre),
                CarbsPerServing: Double(carbs),
                FatPerServing: Double(fat),
                SaturatedFatPerServing: Double(saturatedFat),
                SugarPerServing: Double(sugar),
                SodiumPerServing: Double(sodium),
                DataSource: dataSource,
                CountryCode: "AU",
                IsFavourite: isFavourite,
                ImageBase64: imageBase64
            )

            if let food {
                _ = try await HealthApi.updateFood(foodId: food.FoodId, request: HealthUpdateFoodRequest(
                    FoodName: request.FoodName,
                    ServingQuantity: request.ServingQuantity,
                    ServingUnit: request.ServingUnit,
                    CaloriesPerServing: request.CaloriesPerServing,
                    ProteinPerServing: request.ProteinPerServing,
                    FibrePerServing: request.FibrePerServing,
                    CarbsPerServing: request.CarbsPerServing,
                    FatPerServing: request.FatPerServing,
                    SaturatedFatPerServing: request.SaturatedFatPerServing,
                    SugarPerServing: request.SugarPerServing,
                    SodiumPerServing: request.SodiumPerServing,
                    IsFavourite: request.IsFavourite,
                    ImageBase64: request.ImageBase64
                ))
            } else {
                _ = try await HealthApi.createFood(request)
            }
            status = .ready
            onSaved()
            dismiss()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to save food."
        }
    }

    private static func snapshot(
        name: String,
        servingQuantity: String,
        servingUnit: String,
        calories: String,
        protein: String,
        fibre: String,
        carbs: String,
        fat: String,
        saturatedFat: String,
        sugar: String,
        sodium: String,
        favourite: Bool
    ) -> String {
        [
            name,
            servingQuantity,
            servingUnit,
            calories,
            protein,
            fibre,
            carbs,
            fat,
            saturatedFat,
            sugar,
            sodium,
            String(favourite)
        ].joined(separator: "|")
    }
}

private struct PortionOptionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let foodId: String
    let onSaved: () -> Void

    @State private var label = ""
    @State private var baseUnit = "g"
    @State private var baseAmount = ""
    @State private var isDefault = false
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Label", text: $label)
                    TextField("Base unit", text: $baseUnit)
                    TextField("Base amount", text: $baseAmount)
                        .keyboardType(.decimalPad)
                    Toggle("Default option", isOn: $isDefault)
                }

                if !errorMessage.isEmpty {
                    Section {
                        HealthErrorBanner(message: errorMessage)
                    }
                }
            }
            .navigationTitle("Add portion option")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(status == .loading ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isValid || status == .loading)
                }
            }
        }
    }

    private var isValid: Bool {
        if label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return false }
        if baseUnit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return false }
        if Double(baseAmount) == nil || (Double(baseAmount) ?? 0) <= 0 { return false }
        return true
    }

    private func save() async {
        status = .loading
        errorMessage = ""
        do {
            let request = HealthCreatePortionOptionRequest(
                FoodId: foodId,
                Label: label,
                BaseUnit: baseUnit,
                BaseAmount: Double(baseAmount) ?? 0,
                IsDefault: isDefault,
                SortOrder: 0
            )
            _ = try await HealthApi.createPortionOption(request)
            status = .ready
            onSaved()
            dismiss()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to save portion option."
        }
    }
}

private struct TemplateFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    let foods: [HealthFood]
    let template: HealthMealTemplateWithItems?
    let onSaved: () -> Void

    @State private var name: String
    @State private var servings: String
    @State private var isFavourite: Bool
    @State private var items: [TemplateItemDraft]
    @State private var showItemSheet = false
    @State private var editingIndex: Int?
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    private let initialSnapshot: String

    init(foods: [HealthFood], template: HealthMealTemplateWithItems?, onSaved: @escaping () -> Void) {
        self.foods = foods
        self.template = template
        self.onSaved = onSaved
        let sourceName = template?.Template.TemplateName ?? ""
        let sourceServings = template?.Template.Servings ?? 1
        let sourceFavourite = template?.Template.IsFavourite ?? false
        let sourceItems = template?.Items.map { TemplateItemDraft(from: $0) } ?? []
        _name = State(initialValue: sourceName)
        _servings = State(initialValue: HealthFormatters.formatNumber(sourceServings, decimals: 1))
        _isFavourite = State(initialValue: sourceFavourite)
        _items = State(initialValue: sourceItems)
        initialSnapshot = TemplateFormSheet.snapshot(
            name: sourceName,
            servings: String(sourceServings),
            favourite: sourceFavourite,
            items: sourceItems
        )
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Details") {
                    TextField("Meal name", text: $name)
                    TextField("Servings", text: $servings)
                        .keyboardType(.decimalPad)
                    Toggle("Favourite", isOn: $isFavourite)
                }

                Section("Items") {
                    ForEach(items.indices, id: \.self) { index in
                        let item = items[index]
                        Button {
                            editingIndex = index
                            showItemSheet = true
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.foodName)
                                    Text("\(item.mealType.label) | \(HealthFormatters.formatNumber(item.quantity, decimals: 1))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "pencil")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { indexSet in
                        items.remove(atOffsets: indexSet)
                    }

                    Button("Add item") {
                        editingIndex = nil
                        showItemSheet = true
                    }
                }

                if !errorMessage.isEmpty {
                    Section {
                        HealthErrorBanner(message: errorMessage)
                    }
                }
            }
            .navigationTitle(template == nil ? "Add meal" : "Edit meal")
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
            .sheet(isPresented: $showItemSheet) {
                TemplateItemSheet(foods: foods, item: editingIndex.flatMap { items[$0] }) { draft in
                    if let index = editingIndex {
                        items[index] = draft
                    } else {
                        items.append(draft)
                    }
                }
            }
        }
    }

    private var isDirty: Bool {
        let snapshot = TemplateFormSheet.snapshot(
            name: name,
            servings: servings,
            favourite: isFavourite,
            items: items
        )
        return snapshot != initialSnapshot
    }

    private var isValid: Bool {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return false }
        if Double(servings) == nil || (Double(servings) ?? 0) <= 0 { return false }
        return !items.isEmpty
    }

    private func save() async {
        status = .loading
        errorMessage = ""
        do {
            let request = HealthCreateMealTemplateRequest(
                TemplateName: name,
                Servings: Double(servings) ?? 1,
                IsFavourite: isFavourite,
                Items: items.enumerated().map { index, item in
                    HealthMealTemplateItemInput(
                        FoodId: item.foodId,
                        MealType: item.mealType,
                        Quantity: item.quantity,
                        EntryQuantity: nil,
                        EntryUnit: nil,
                        EntryNotes: item.notes.isEmpty ? nil : item.notes,
                        SortOrder: index
                    )
                }
            )

            if let template {
                _ = try await HealthApi.updateMealTemplate(templateId: template.Template.MealTemplateId, request: HealthUpdateMealTemplateRequest(
                    TemplateName: request.TemplateName,
                    Servings: request.Servings,
                    IsFavourite: request.IsFavourite,
                    Items: request.Items
                ))
            } else {
                _ = try await HealthApi.createMealTemplate(request)
            }
            status = .ready
            onSaved()
            dismiss()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to save meal."
        }
    }

    private static func snapshot(name: String, servings: String, favourite: Bool, items: [TemplateItemDraft]) -> String {
        let itemsBlob = items.map { item in
            "\(item.foodId)-\(item.mealType.rawValue)-\(item.quantity)-\(item.notes)"
        }.joined(separator: "|")
        return [name, servings, String(favourite), itemsBlob].joined(separator: "||")
    }
}

private struct TemplateItemDraft: Identifiable {
    let id = UUID()
    let foodId: String
    let foodName: String
    let mealType: HealthMealType
    let quantity: Double
    let notes: String

    init(foodId: String, foodName: String, mealType: HealthMealType, quantity: Double, notes: String) {
        self.foodId = foodId
        self.foodName = foodName
        self.mealType = mealType
        self.quantity = quantity
        self.notes = notes
    }

    init(from item: HealthMealTemplateItem) {
        self.foodId = item.FoodId
        self.foodName = item.FoodName
        self.mealType = item.MealType
        self.quantity = item.Quantity
        self.notes = item.EntryNotes ?? ""
    }
}

private struct TemplateItemSheet: View {
    @Environment(\.dismiss) private var dismiss
    let foods: [HealthFood]
    let item: TemplateItemDraft?
    let onSave: (TemplateItemDraft) -> Void

    @State private var selectedFoodId: String?
    @State private var mealType: HealthMealType
    @State private var quantity: String
    @State private var notes: String

    init(foods: [HealthFood], item: TemplateItemDraft?, onSave: @escaping (TemplateItemDraft) -> Void) {
        self.foods = foods
        self.item = item
        self.onSave = onSave
        _selectedFoodId = State(initialValue: item?.foodId)
        _mealType = State(initialValue: item?.mealType ?? .Lunch)
        _quantity = State(initialValue: item.map { HealthFormatters.formatNumber($0.quantity, decimals: 1) } ?? "1")
        _notes = State(initialValue: item?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Food") {
                    Picker("Food", selection: $selectedFoodId) {
                        ForEach(foods) { food in
                            Text(food.FoodName).tag(Optional(food.FoodId))
                        }
                    }
                }
                Section("Meal type") {
                    Picker("Meal", selection: $mealType) {
                        ForEach(HealthMealType.allCases, id: \.self) { meal in
                            Text(meal.label).tag(meal)
                        }
                    }
                }
                Section("Quantity") {
                    TextField("Quantity", text: $quantity)
                        .keyboardType(.decimalPad)
                }
                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle("Meal item")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveItem()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }

    private var isValid: Bool {
        guard let _ = selectedFoodId else { return false }
        guard let value = Double(quantity), value > 0 else { return false }
        return true
    }

    private func saveItem() {
        guard let foodId = selectedFoodId,
              let food = foods.first(where: { $0.FoodId == foodId }),
              let qty = Double(quantity), qty > 0 else {
            return
        }
        onSave(TemplateItemDraft(foodId: foodId, foodName: food.FoodName, mealType: mealType, quantity: qty, notes: notes))
        dismiss()
    }
}

private struct FoodLookupSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSelect: (FoodDraft) -> Void

    @State private var mode: LookupMode = .text
    @State private var query = ""
    @State private var barcode = ""
    @State private var lookupStatus: LoadState = .idle
    @State private var lookupError = ""
    @State private var results: [HealthFoodLookupResponse] = []
    @State private var scanResult: HealthImageScanResponse?
    @State private var scanImageItem: PhotosPickerItem?
    @State private var scanImageBase64: String?

    var body: some View {
        NavigationStack {
            List {
                Section("Lookup mode") {
                    Picker("Mode", selection: $mode) {
                        Text("Text").tag(LookupMode.text)
                        Text("Barcode").tag(LookupMode.barcode)
                        Text("Photo scan").tag(LookupMode.scan)
                        Text("Multi source").tag(LookupMode.multi)
                    }
                    .pickerStyle(.segmented)
                }

                if mode == .text {
                    Section("Search") {
                        TextField("Search food", text: $query)
                        Button(lookupStatus == .loading ? "Searching..." : "Search") {
                            Task { await searchText() }
                        }
                        .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || lookupStatus == .loading)
                    }
                }

                if mode == .barcode {
                    Section("Barcode") {
                        TextField("Barcode", text: $barcode)
                        Button(lookupStatus == .loading ? "Searching..." : "Lookup") {
                            Task { await searchBarcode() }
                        }
                        .disabled(barcode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || lookupStatus == .loading)
                    }
                }

                if mode == .scan {
                    Section("Photo") {
                        PhotosPicker(selection: $scanImageItem, matching: .images) {
                            Text("Choose photo")
                        }
                        Button(lookupStatus == .loading ? "Scanning..." : "Scan photo") {
                            Task { await scanPhoto() }
                        }
                        .disabled(scanImageBase64 == nil || lookupStatus == .loading)
                    }
                }

                if mode == .multi {
                    Section("Search") {
                        TextField("Search food", text: $query)
                        Button(lookupStatus == .loading ? "Searching..." : "Search") {
                            Task { await searchMulti() }
                        }
                        .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || lookupStatus == .loading)
                    }
                }

                if !lookupError.isEmpty {
                    Section {
                        HealthErrorBanner(message: lookupError)
                    }
                }

                if mode == .scan, let scanResult {
                    Section("Scan result") {
                        Button("Use \(scanResult.FoodName)") {
                            onSelect(draftFromScan(scanResult, imageBase64: scanImageBase64))
                            dismiss()
                        }
                    }
                }

                if !results.isEmpty {
                    Section("Results") {
                        ForEach(results) { result in
                            Button("\(result.FoodName) | \(result.CaloriesPerServing) kcal") {
                                onSelect(draftFromLookup(result))
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle("Food lookup")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task(id: scanImageItem) {
                await loadScanImage()
            }
        }
    }

    private func searchText() async {
        lookupStatus = .loading
        lookupError = ""
        do {
            let response = try await HealthApi.lookupFoodTextOptions(HealthFoodLookupTextRequest(Query: query))
            results = response.Results
            lookupStatus = .ready
        } catch {
            lookupStatus = .error
            lookupError = (error as? ApiError)?.message ?? "Lookup failed."
        }
    }

    private func searchBarcode() async {
        lookupStatus = .loading
        lookupError = ""
        do {
            let response = try await HealthApi.lookupFoodBarcode(HealthFoodLookupBarcodeRequest(Barcode: barcode))
            results = response.Result.map { [$0] } ?? []
            lookupStatus = .ready
        } catch {
            lookupStatus = .error
            lookupError = (error as? ApiError)?.message ?? "Lookup failed."
        }
    }

    private func searchMulti() async {
        lookupStatus = .loading
        lookupError = ""
        do {
            let response = try await HealthApi.multiSourceSearch(HealthMultiSourceSearchRequest(Query: query))
            results = response.Openfoodfacts.map { info in
                HealthFoodLookupResponse(
                    FoodName: info.FoodName,
                    ServingQuantity: 1,
                    ServingUnit: info.ServingDescription,
                    CaloriesPerServing: info.CaloriesPerServing ?? 0,
                    ProteinPerServing: info.ProteinPerServing ?? 0,
                    FibrePerServing: info.FiberPerServing,
                    CarbsPerServing: info.CarbohydratesPerServing,
                    FatPerServing: info.FatPerServing,
                    SaturatedFatPerServing: info.SaturatedFatPerServing,
                    SugarPerServing: info.SugarPerServing,
                    SodiumPerServing: info.SodiumPerServing,
                    Source: "openfoodfacts",
                    Confidence: ""
                )
            }
            lookupStatus = .ready
        } catch {
            lookupStatus = .error
            lookupError = (error as? ApiError)?.message ?? "Multi source search failed."
        }
    }

    private func scanPhoto() async {
        guard let scanImageBase64 else { return }
        lookupStatus = .loading
        lookupError = ""
        do {
            scanResult = try await HealthApi.scanFoodImage(HealthImageScanRequest(ImageBase64: scanImageBase64, Mode: .meal, Note: nil))
            lookupStatus = .ready
        } catch {
            lookupStatus = .error
            lookupError = (error as? ApiError)?.message ?? "Scan failed."
        }
    }

    private func loadScanImage() async {
        guard let scanImageItem else { return }
        do {
            if let data = try await scanImageItem.loadTransferable(type: Data.self) {
                scanImageBase64 = data.base64EncodedString()
            }
        } catch {
            scanImageBase64 = nil
        }
    }

    private func draftFromLookup(_ result: HealthFoodLookupResponse) -> FoodDraft {
        FoodDraft(
            FoodName: result.FoodName,
            ServingQuantity: result.ServingQuantity,
            ServingUnit: result.ServingUnit,
            CaloriesPerServing: Double(result.CaloriesPerServing),
            ProteinPerServing: result.ProteinPerServing,
            FibrePerServing: result.FibrePerServing,
            CarbsPerServing: result.CarbsPerServing,
            FatPerServing: result.FatPerServing,
            SaturatedFatPerServing: result.SaturatedFatPerServing,
            SugarPerServing: result.SugarPerServing,
            SodiumPerServing: result.SodiumPerServing,
            DataSource: result.Source,
            CountryCode: "AU",
            IsFavourite: false,
            ImageBase64: nil
        )
    }

    private func draftFromScan(_ result: HealthImageScanResponse, imageBase64: String?) -> FoodDraft {
        FoodDraft(
            FoodName: result.FoodName,
            ServingQuantity: result.ServingQuantity,
            ServingUnit: result.ServingUnit,
            CaloriesPerServing: Double(result.CaloriesPerServing),
            ProteinPerServing: result.ProteinPerServing,
            FibrePerServing: result.FibrePerServing,
            CarbsPerServing: result.CarbsPerServing,
            FatPerServing: result.FatPerServing,
            SaturatedFatPerServing: result.SaturatedFatPerServing,
            SugarPerServing: result.SugarPerServing,
            SodiumPerServing: result.SodiumPerServing,
            DataSource: "ai",
            CountryCode: "AU",
            IsFavourite: false,
            ImageBase64: imageBase64
        )
    }
}

private enum LookupMode {
    case text
    case barcode
    case scan
    case multi
}
