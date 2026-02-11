import SwiftUI

struct LifeAdminBuilderView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var categories: [LifeCategory] = []
    @State private var fields: [LifeField] = []
    @State private var dropdowns: [LifeDropdown] = []
    @State private var dropdownOptions: [LifeDropdownOption] = []
    @State private var people: [LifePerson] = []
    @State private var users: [SettingsUser] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    @State private var selectedCategoryId: Int?
    @State private var selectedDropdownId: Int?
    @State private var tab: BuilderTab = .schema

    @State private var showCategoryForm = false
    @State private var showFieldForm = false
    @State private var showDropdownForm = false
    @State private var showOptionForm = false
    @State private var showPersonForm = false

    @State private var editingCategory: LifeCategory?
    @State private var editingField: LifeField?
    @State private var editingDropdown: LifeDropdown?
    @State private var editingOption: LifeDropdownOption?
    @State private var editingPerson: LifePerson?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                tabSection
                tabContent

                if status == .loading {
                    LifeAdminEmptyState(message: "Loading builder data...")
                }
                if !errorMessage.isEmpty {
                    LifeAdminErrorBanner(message: errorMessage)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 24)
            .frame(maxWidth: horizontalSizeClass == .regular ? 1200 : 960)
            .frame(maxWidth: .infinity)
        }
        .task {
            if status == .idle {
                await loadInitial()
            }
        }
        .sheet(isPresented: $showCategoryForm) {
            CategoryFormSheet(
                initial: editingCategory,
                onSave: { payload in
                    try await saveCategory(payload)
                },
                onDelete: editingCategory == nil ? nil : {
                    if let category = editingCategory {
                        await deleteCategory(category)
                    }
                }
            )
        }
        .sheet(isPresented: $showFieldForm) {
            FieldFormSheet(
                initial: editingField,
                categories: categories,
                dropdowns: dropdowns,
                onSave: { payload in
                    try await saveField(payload)
                },
                onDelete: editingField == nil ? nil : {
                    if let field = editingField {
                        await deleteField(field)
                    }
                }
            )
        }
        .sheet(isPresented: $showDropdownForm) {
            DropdownFormSheet(
                initial: editingDropdown,
                onSave: { payload in
                    try await saveDropdown(payload)
                },
                onDelete: editingDropdown == nil ? nil : {
                    if let dropdown = editingDropdown {
                        await deleteDropdown(dropdown)
                    }
                }
            )
        }
        .sheet(isPresented: $showOptionForm) {
            DropdownOptionFormSheet(
                initial: editingOption,
                onSave: { payload in
                    try await saveOption(payload)
                }
            )
        }
        .sheet(isPresented: $showPersonForm) {
            PersonFormSheet(
                initial: editingPerson,
                users: users,
                onSave: { payload in
                    try await savePerson(payload)
                }
            )
        }
        .onChange(of: selectedCategoryId) { _, newValue in
            guard let newValue else { return }
            Task { await loadFields(categoryId: newValue) }
        }
        .onChange(of: selectedDropdownId) { _, newValue in
            guard let newValue else { return }
            Task { await loadOptions(dropdownId: newValue) }
        }
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Builder")
                    .font(.title2.bold())
                Text("Manage categories, fields, dropdowns, and people.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch tab {
        case .schema:
            if horizontalSizeClass == .regular {
                HStack(alignment: .top, spacing: 16) {
                    categorySection
                        .frame(maxWidth: 360, alignment: .topLeading)
                    fieldSection
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            } else {
                categorySection
                fieldSection
            }
        case .dropdowns:
            if horizontalSizeClass == .regular {
                HStack(alignment: .top, spacing: 16) {
                    dropdownSection
                        .frame(maxWidth: 360, alignment: .topLeading)
                    optionSection
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            } else {
                dropdownSection
                optionSection
            }
        case .people:
            peopleSection
        }
    }

    private var tabSection: some View {
        Picker("Builder section", selection: $tab) {
            ForEach(BuilderTab.allCases) { option in
                Text(option.label).tag(option)
            }
        }
        .pickerStyle(.segmented)
    }

    private var categorySection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(
                title: "Categories",
                subtitle: "Manage life admin categories.",
                trailing: AnyView(Button("Add") {
                    editingCategory = nil
                    showCategoryForm = true
                }.buttonStyle(.bordered))
            )

            if categories.isEmpty {
                LifeAdminEmptyState(message: "No categories yet.")
            } else {
                Picker("Category", selection: $selectedCategoryId) {
                    ForEach(categories) { category in
                        Text(category.Name).tag(Optional(category.Id))
                    }
                }
                .pickerStyle(.menu)

                VStack(spacing: 8) {
                    ForEach(categories) { category in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(category.Name)
                                    .font(.subheadline.weight(.semibold))
                                Text(category.IsActive ? "Active" : "Hidden")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Edit") {
                                editingCategory = category
                                showCategoryForm = true
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }

    private var fieldSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(
                title: "Fields",
                subtitle: "Fields for the selected category.",
                trailing: AnyView(Button("Add") {
                    editingField = nil
                    showFieldForm = true
                }.buttonStyle(.bordered))
            )

            if selectedCategoryId == nil {
                LifeAdminEmptyState(message: "Select a category to manage fields.")
            } else if fields.isEmpty {
                LifeAdminEmptyState(message: "No fields yet.")
            } else {
                VStack(spacing: 8) {
                    ForEach(fields) { field in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(field.Name)
                                    .font(.subheadline.weight(.semibold))
                                Text(field.FieldType)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Edit") {
                                editingField = field
                                showFieldForm = true
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }

    private var dropdownSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(
                title: "Dropdowns",
                subtitle: "Manage dropdown lists.",
                trailing: AnyView(Button("Add") {
                    editingDropdown = nil
                    showDropdownForm = true
                }.buttonStyle(.bordered))
            )

            if dropdowns.isEmpty {
                LifeAdminEmptyState(message: "No dropdowns yet.")
            } else {
                Picker("Dropdown", selection: $selectedDropdownId) {
                    ForEach(dropdowns) { dropdown in
                        Text(dropdown.Name).tag(Optional(dropdown.Id))
                    }
                }
                .pickerStyle(.menu)

                VStack(spacing: 8) {
                    ForEach(dropdowns) { dropdown in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(dropdown.Name)
                                    .font(.subheadline.weight(.semibold))
                                Text("In use: \(dropdown.InUseCount)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Edit") {
                                editingDropdown = dropdown
                                showDropdownForm = true
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }

    private var optionSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(
                title: "Options",
                subtitle: "Options for selected dropdown.",
                trailing: AnyView(Button("Add") {
                    editingOption = nil
                    showOptionForm = true
                }.buttonStyle(.bordered))
            )

            if selectedDropdownId == nil {
                LifeAdminEmptyState(message: "Select a dropdown to manage options.")
            } else if dropdownOptions.isEmpty {
                LifeAdminEmptyState(message: "No options yet.")
            } else {
                VStack(spacing: 8) {
                    ForEach(dropdownOptions) { option in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(option.Label)
                                    .font(.subheadline.weight(.semibold))
                                Text(option.IsActive ? "Active" : "Hidden")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Edit") {
                                editingOption = option
                                showOptionForm = true
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }

    private var peopleSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(
                title: "People",
                subtitle: "Manage people for record fields.",
                trailing: AnyView(Button("Add") {
                    editingPerson = nil
                    showPersonForm = true
                }.buttonStyle(.bordered))
            )

            if people.isEmpty {
                LifeAdminEmptyState(message: "No people yet.")
            } else {
                VStack(spacing: 8) {
                    ForEach(people) { person in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(person.Name)
                                    .font(.subheadline.weight(.semibold))
                                if let notes = person.Notes, !notes.isEmpty {
                                    Text(notes)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Button("Edit") {
                                editingPerson = person
                                showPersonForm = true
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }

    private func loadInitial() async {
        status = .loading
        errorMessage = ""
        do {
            async let categoryTask = LifeAdminApi.fetchCategories(includeInactive: true)
            async let dropdownTask = LifeAdminApi.fetchDropdowns()
            async let peopleTask = LifeAdminApi.fetchPeople()
            async let usersTask = SettingsApi.fetchUsers()
            let (categoryResult, dropdownResult, peopleResult, usersResult) = try await (categoryTask, dropdownTask, peopleTask, usersTask)
            categories = categoryResult
            dropdowns = dropdownResult
            people = peopleResult
            users = usersResult
            selectedCategoryId = categories.first?.Id
            selectedDropdownId = dropdowns.first?.Id
            if let categoryId = selectedCategoryId {
                await loadFields(categoryId: categoryId)
            }
            if let dropdownId = selectedDropdownId {
                await loadOptions(dropdownId: dropdownId)
            }
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load builder data."
        }
    }

    private func loadFields(categoryId: Int) async {
        do {
            fields = try await LifeAdminApi.fetchFields(categoryId: categoryId)
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to load fields."
        }
    }

    private func loadOptions(dropdownId: Int) async {
        do {
            dropdownOptions = try await LifeAdminApi.fetchDropdownOptions(dropdownId: dropdownId)
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to load dropdown options."
        }
    }

    private func saveCategory(_ payload: LifeCategoryCreate) async throws {
        if let editingCategory {
            _ = try await LifeAdminApi.updateCategory(id: editingCategory.Id, payload: LifeCategoryUpdate(Name: payload.Name, Description: payload.Description, SortOrder: payload.SortOrder, IsActive: payload.IsActive))
        } else {
            _ = try await LifeAdminApi.createCategory(payload)
        }
        categories = try await LifeAdminApi.fetchCategories(includeInactive: true)
        showCategoryForm = false
    }

    private func deleteCategory(_ category: LifeCategory) async {
        do {
            try await LifeAdminApi.deleteCategory(id: category.Id)
            categories = try await LifeAdminApi.fetchCategories(includeInactive: true)
            showCategoryForm = false
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete category."
        }
    }

    private func saveField(_ payload: LifeFieldCreate) async throws {
        guard let categoryId = selectedCategoryId else { return }
        if let editingField {
            _ = try await LifeAdminApi.updateField(id: editingField.Id, payload: LifeFieldUpdate(
                Name: payload.Name,
                Key: payload.Key,
                FieldType: payload.FieldType,
                IsRequired: payload.IsRequired,
                IsMulti: payload.IsMulti,
                SortOrder: payload.SortOrder,
                DropdownId: payload.DropdownId,
                LinkedCategoryId: payload.LinkedCategoryId,
                Config: payload.Config
            ))
        } else {
            _ = try await LifeAdminApi.createField(categoryId: categoryId, payload: payload)
        }
        await loadFields(categoryId: categoryId)
        showFieldForm = false
    }

    private func deleteField(_ field: LifeField) async {
        do {
            try await LifeAdminApi.deleteField(id: field.Id)
            if let categoryId = selectedCategoryId {
                await loadFields(categoryId: categoryId)
            }
            showFieldForm = false
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete field."
        }
    }

    private func saveDropdown(_ payload: LifeDropdownCreate) async throws {
        if let editingDropdown {
            _ = try await LifeAdminApi.updateDropdown(id: editingDropdown.Id, payload: LifeDropdownUpdate(Name: payload.Name, Description: payload.Description))
        } else {
            _ = try await LifeAdminApi.createDropdown(payload)
        }
        dropdowns = try await LifeAdminApi.fetchDropdowns()
        showDropdownForm = false
    }

    private func deleteDropdown(_ dropdown: LifeDropdown) async {
        do {
            try await LifeAdminApi.deleteDropdown(id: dropdown.Id)
            dropdowns = try await LifeAdminApi.fetchDropdowns()
            showDropdownForm = false
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete dropdown."
        }
    }

    private func saveOption(_ payload: LifeDropdownOptionCreate) async throws {
        guard let dropdownId = selectedDropdownId else { return }
        if let editingOption {
            _ = try await LifeAdminApi.updateDropdownOption(id: editingOption.Id, payload: LifeDropdownOptionUpdate(
                Label: payload.Label,
                Value: payload.Value,
                SortOrder: payload.SortOrder,
                IsActive: payload.IsActive
            ))
        } else {
            _ = try await LifeAdminApi.createDropdownOption(dropdownId: dropdownId, payload: payload)
        }
        await loadOptions(dropdownId: dropdownId)
        showOptionForm = false
    }

    private func savePerson(_ payload: LifePersonCreate) async throws {
        if let editingPerson {
            _ = try await LifeAdminApi.updatePerson(id: editingPerson.Id, payload: LifePersonUpdate(Name: payload.Name, UserId: payload.UserId, Notes: payload.Notes))
        } else {
            _ = try await LifeAdminApi.createPerson(payload)
        }
        people = try await LifeAdminApi.fetchPeople()
        showPersonForm = false
    }
}

private enum BuilderTab: String, CaseIterable, Identifiable {
    case schema
    case dropdowns
    case people

    var id: String { rawValue }

    var label: String {
        switch self {
        case .schema:
            return "Schema"
        case .dropdowns:
            return "Dropdowns"
        case .people:
            return "People"
        }
    }
}

private struct CategoryFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: LifeCategory?
    let onSave: (LifeCategoryCreate) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var name: String
    @State private var description: String
    @State private var sortOrder: String
    @State private var isActive: Bool
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(initial: LifeCategory?, onSave: @escaping (LifeCategoryCreate) async throws -> Void, onDelete: (() async -> Void)?) {
        self.initial = initial
        self.onSave = onSave
        self.onDelete = onDelete
        _name = State(initialValue: initial?.Name ?? "")
        _description = State(initialValue: initial?.Description ?? "")
        _sortOrder = State(initialValue: String(initial?.SortOrder ?? 0))
        _isActive = State(initialValue: initial?.IsActive ?? true)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Category") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $description)
                    TextField("Sort order", text: $sortOrder)
                        .keyboardType(.numberPad)
                    Toggle("Active", isOn: $isActive)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                if let onDelete {
                    Section {
                        Button("Delete category", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initial == nil ? "New category" : "Edit category")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || isSaving)
                }
            }
        }
    }

    private var isDirty: Bool {
        let initialName = initial?.Name ?? ""
        let initialDescription = initial?.Description ?? ""
        let initialSort = String(initial?.SortOrder ?? 0)
        let initialActive = initial?.IsActive ?? true
        return name != initialName ||
            description != initialDescription ||
            sortOrder != initialSort ||
            isActive != initialActive
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        errorMessage = ""
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Name is required."
            return
        }
        isSaving = true
        let order = Int(sortOrder.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let payload = LifeCategoryCreate(
            Name: trimmed,
            Description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description,
            SortOrder: order,
            IsActive: isActive
        )
        do {
            try await onSave(payload)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save category."
        }
        isSaving = false
    }
}

private struct FieldFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: LifeField?
    let categories: [LifeCategory]
    let dropdowns: [LifeDropdown]
    let onSave: (LifeFieldCreate) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var name: String
    @State private var key: String
    @State private var fieldType: String
    @State private var isRequired: Bool
    @State private var isMulti: Bool
    @State private var sortOrder: String
    @State private var dropdownId: Int?
    @State private var linkedCategoryId: Int?
    @State private var errorMessage = ""
    @State private var isSaving = false

    private let fieldTypes = [
        "Text",
        "LongText",
        "Number",
        "Currency",
        "Date",
        "DateRange",
        "Dropdown",
        "Person",
        "RecordLink",
        "Boolean"
    ]

    init(
        initial: LifeField?,
        categories: [LifeCategory],
        dropdowns: [LifeDropdown],
        onSave: @escaping (LifeFieldCreate) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.initial = initial
        self.categories = categories
        self.dropdowns = dropdowns
        self.onSave = onSave
        self.onDelete = onDelete
        _name = State(initialValue: initial?.Name ?? "")
        _key = State(initialValue: initial?.Key ?? "")
        _fieldType = State(initialValue: initial?.FieldType ?? "Text")
        _isRequired = State(initialValue: initial?.IsRequired ?? false)
        _isMulti = State(initialValue: initial?.IsMulti ?? false)
        _sortOrder = State(initialValue: String(initial?.SortOrder ?? 0))
        _dropdownId = State(initialValue: initial?.DropdownId)
        _linkedCategoryId = State(initialValue: initial?.LinkedCategoryId)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Field") {
                    TextField("Name", text: $name)
                    TextField("Key", text: $key)
                    Picker("Type", selection: $fieldType) {
                        ForEach(fieldTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    Toggle("Required", isOn: $isRequired)
                    Toggle("Multiple values", isOn: $isMulti)
                    TextField("Sort order", text: $sortOrder)
                        .keyboardType(.numberPad)
                }

                if fieldType == "Dropdown" {
                    Section("Dropdown") {
                        Picker("Dropdown", selection: $dropdownId) {
                            Text("Select dropdown").tag(Int?.none)
                            ForEach(dropdowns) { dropdown in
                                Text(dropdown.Name).tag(Optional(dropdown.Id))
                            }
                        }
                    }
                }

                if fieldType == "RecordLink" {
                    Section("Linked category") {
                        Picker("Category", selection: $linkedCategoryId) {
                            Text("Select category").tag(Int?.none)
                            ForEach(categories) { category in
                                Text(category.Name).tag(Optional(category.Id))
                            }
                        }
                    }
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                if let onDelete {
                    Section {
                        Button("Delete field", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initial == nil ? "New field" : "Edit field")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || isSaving)
                }
            }
        }
    }

    private var isDirty: Bool {
        let initialName = initial?.Name ?? ""
        let initialKey = initial?.Key ?? ""
        let initialType = initial?.FieldType ?? "Text"
        let initialRequired = initial?.IsRequired ?? false
        let initialMulti = initial?.IsMulti ?? false
        let initialSort = String(initial?.SortOrder ?? 0)
        let initialDropdown = initial?.DropdownId
        let initialLinked = initial?.LinkedCategoryId
        return name != initialName ||
            key != initialKey ||
            fieldType != initialType ||
            isRequired != initialRequired ||
            isMulti != initialMulti ||
            sortOrder != initialSort ||
            dropdownId != initialDropdown ||
            linkedCategoryId != initialLinked
    }

    private var isValid: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return false }
        if fieldType == "Dropdown" && dropdownId == nil { return false }
        if fieldType == "RecordLink" && linkedCategoryId == nil { return false }
        return true
    }

    private func save() async {
        errorMessage = ""
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Name is required."
            return
        }
        isSaving = true
        let order = Int(sortOrder.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let payload = LifeFieldCreate(
            Name: trimmed,
            Key: key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : key,
            FieldType: fieldType,
            IsRequired: isRequired,
            IsMulti: isMulti,
            SortOrder: order,
            DropdownId: fieldType == "Dropdown" ? dropdownId : nil,
            LinkedCategoryId: fieldType == "RecordLink" ? linkedCategoryId : nil,
            Config: nil
        )
        do {
            try await onSave(payload)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save field."
        }
        isSaving = false
    }
}

private struct DropdownFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: LifeDropdown?
    let onSave: (LifeDropdownCreate) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var name: String
    @State private var description: String
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(initial: LifeDropdown?, onSave: @escaping (LifeDropdownCreate) async throws -> Void, onDelete: (() async -> Void)?) {
        self.initial = initial
        self.onSave = onSave
        self.onDelete = onDelete
        _name = State(initialValue: initial?.Name ?? "")
        _description = State(initialValue: initial?.Description ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Dropdown") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $description)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                if let onDelete {
                    Section {
                        Button("Delete dropdown", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initial == nil ? "New dropdown" : "Edit dropdown")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || isSaving)
                }
            }
        }
    }

    private var isDirty: Bool {
        let initialName = initial?.Name ?? ""
        let initialDescription = initial?.Description ?? ""
        return name != initialName || description != initialDescription
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        errorMessage = ""
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Name is required."
            return
        }
        isSaving = true
        let payload = LifeDropdownCreate(
            Name: trimmed,
            Description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description
        )
        do {
            try await onSave(payload)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save dropdown."
        }
        isSaving = false
    }
}

private struct DropdownOptionFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: LifeDropdownOption?
    let onSave: (LifeDropdownOptionCreate) async throws -> Void

    @State private var label: String
    @State private var value: String
    @State private var sortOrder: String
    @State private var isActive: Bool
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(initial: LifeDropdownOption?, onSave: @escaping (LifeDropdownOptionCreate) async throws -> Void) {
        self.initial = initial
        self.onSave = onSave
        _label = State(initialValue: initial?.Label ?? "")
        _value = State(initialValue: initial?.Value ?? "")
        _sortOrder = State(initialValue: String(initial?.SortOrder ?? 0))
        _isActive = State(initialValue: initial?.IsActive ?? true)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Option") {
                    TextField("Label", text: $label)
                    TextField("Value", text: $value)
                    TextField("Sort order", text: $sortOrder)
                        .keyboardType(.numberPad)
                    Toggle("Active", isOn: $isActive)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(initial == nil ? "New option" : "Edit option")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || isSaving)
                }
            }
        }
    }

    private var isDirty: Bool {
        let initialLabel = initial?.Label ?? ""
        let initialValue = initial?.Value ?? ""
        let initialSort = String(initial?.SortOrder ?? 0)
        let initialActive = initial?.IsActive ?? true
        return label != initialLabel ||
            value != initialValue ||
            sortOrder != initialSort ||
            isActive != initialActive
    }

    private var isValid: Bool {
        !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        errorMessage = ""
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Label is required."
            return
        }
        isSaving = true
        let order = Int(sortOrder.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let payload = LifeDropdownOptionCreate(
            Label: trimmed,
            Value: value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : value,
            SortOrder: order,
            IsActive: isActive
        )
        do {
            try await onSave(payload)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save option."
        }
        isSaving = false
    }
}

private struct PersonFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: LifePerson?
    let users: [SettingsUser]
    let onSave: (LifePersonCreate) async throws -> Void

    @State private var name: String
    @State private var notes: String
    @State private var userId: Int?
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(initial: LifePerson?, users: [SettingsUser], onSave: @escaping (LifePersonCreate) async throws -> Void) {
        self.initial = initial
        self.users = users
        self.onSave = onSave
        _name = State(initialValue: initial?.Name ?? "")
        _notes = State(initialValue: initial?.Notes ?? "")
        _userId = State(initialValue: initial?.UserId)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Person") {
                    TextField("Name", text: $name)
                    Picker("Linked user", selection: $userId) {
                        Text("None").tag(Int?.none)
                        ForEach(users) { user in
                            Text(user.displayName).tag(Optional(user.Id))
                        }
                    }
                    TextField("Notes", text: $notes)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(initial == nil ? "New person" : "Edit person")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || isSaving)
                }
            }
        }
    }

    private var isDirty: Bool {
        let initialName = initial?.Name ?? ""
        let initialNotes = initial?.Notes ?? ""
        let initialUserId = initial?.UserId
        return name != initialName || notes != initialNotes || userId != initialUserId
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        errorMessage = ""
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Name is required."
            return
        }
        isSaving = true
        let payload = LifePersonCreate(
            Name: trimmed,
            UserId: userId,
            Notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes
        )
        do {
            try await onSave(payload)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save person."
        }
        isSaving = false
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
