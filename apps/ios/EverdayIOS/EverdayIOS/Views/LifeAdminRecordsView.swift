import SwiftUI

struct LifeAdminRecordsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var categories: [LifeCategory] = []
    @State private var fields: [LifeField] = []
    @State private var records: [LifeRecord] = []
    @State private var dropdownOptions: [Int: [LifeDropdownOption]] = [:]
    @State private var people: [LifePerson] = []
    @State private var recordLookup: [Int: [LifeRecordLookup]] = [:]
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var selectedCategoryId: Int?
    @State private var searchTerm = ""

    @State private var showForm = false
    @State private var editingRecord: LifeRecord?
    @State private var showDeleteConfirm = false
    @State private var deleteTarget: LifeRecord?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                mainContent

                if status == .loading {
                    LifeAdminEmptyState(message: "Loading records...")
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
        .sheet(isPresented: $showForm) {
            RecordFormSheet(
                categoryId: selectedCategoryId,
                fields: fields,
                dropdownOptions: dropdownOptions,
                people: people,
                recordLookup: recordLookup,
                initialRecord: editingRecord,
                onSave: { payload in
                    try await saveRecord(payload)
                },
                onDelete: editingRecord == nil ? nil : {
                    if let record = editingRecord {
                        await deleteRecord(record)
                    }
                }
            )
        }
        .alert("Delete record", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                if let target = deleteTarget {
                    Task { await deleteRecord(target) }
                }
            }
            Button("Cancel", role: .cancel) { deleteTarget = nil }
        } message: {
            Text("This will permanently remove the record.")
        }
        .onChange(of: selectedCategoryId) { _, newValue in
            guard let newValue else { return }
            Task { await loadCategoryData(categoryId: newValue) }
        }
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Records")
                    .font(.title2.bold())
                Text("Track structured life admin data by category.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Add") {
                editingRecord = nil
                showForm = true
            }
            .buttonStyle(.borderedProminent)
            .disabled(selectedCategoryId == nil)
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 16) {
                    categorySection
                    searchSection
                }
                .frame(maxWidth: 360, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 16) {
                    recordSection
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            categorySection
            searchSection
            recordSection
        }
    }

    private var categorySection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Categories", subtitle: "Choose a category to view records.")
            if categories.isEmpty {
                LifeAdminEmptyState(message: "No categories yet.")
            } else {
                Picker("Category", selection: $selectedCategoryId) {
                    ForEach(categories) { category in
                        Text(category.Name).tag(Optional(category.Id))
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    private var searchSection: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Search records", text: $searchTerm)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var recordSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Records", subtitle: "Tap a record to edit.")
            if filteredRecords.isEmpty {
                LifeAdminEmptyState(message: "No records match this view.")
            } else {
                VStack(spacing: 12) {
                    ForEach(filteredRecords) { record in
                        RecordCard(
                            record: record,
                            fields: fields,
                            dropdownOptions: dropdownOptions,
                            people: people,
                            recordLookup: recordLookup,
                            onEdit: {
                                editingRecord = record
                                showForm = true
                            },
                            onDelete: {
                                deleteTarget = record
                                showDeleteConfirm = true
                            }
                        )
                    }
                }
            }
        }
    }

    private var filteredRecords: [LifeRecord] {
        let query = searchTerm.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if query.isEmpty { return records }
        return records.filter { record in
            if let title = record.Title, title.lowercased().contains(query) {
                return true
            }
            for field in fields {
                let text = displayValue(for: field, in: record)
                if text.lowercased().contains(query) {
                    return true
                }
            }
            return false
        }
    }

    private func displayValue(for field: LifeField, in record: LifeRecord) -> String {
        let value = record.Data[field.Key]
        return LifeAdminRecordFormatter.displayValue(
            field: field,
            value: value,
            dropdownOptions: dropdownOptions[field.DropdownId ?? -1] ?? [],
            people: people,
            recordLookup: recordLookup[field.LinkedCategoryId ?? -1] ?? []
        )
    }

    private func loadInitial() async {
        status = .loading
        errorMessage = ""
        do {
            let loadedCategories = try await LifeAdminApi.fetchCategories()
            categories = loadedCategories
            selectedCategoryId = loadedCategories.first?.Id
            if let categoryId = selectedCategoryId {
                await loadCategoryData(categoryId: categoryId)
            } else {
                status = .ready
            }
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load categories."
        }
    }

    private func loadCategoryData(categoryId: Int) async {
        status = .loading
        errorMessage = ""
        do {
            async let fieldsTask = LifeAdminApi.fetchFields(categoryId: categoryId)
            async let recordsTask = LifeAdminApi.fetchRecords(categoryId: categoryId)
            async let peopleTask = LifeAdminApi.fetchPeople()
            let (fieldResult, recordResult, peopleResult) = try await (fieldsTask, recordsTask, peopleTask)
            fields = fieldResult.sorted { $0.SortOrder < $1.SortOrder }
            records = recordResult
            people = peopleResult
            dropdownOptions = try await loadDropdownOptions(for: fields)
            recordLookup = try await loadRecordLookup(for: fields)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load records."
        }
    }

    private func loadDropdownOptions(for fields: [LifeField]) async throws -> [Int: [LifeDropdownOption]] {
        let dropdownIds = Set(fields.compactMap { $0.DropdownId })
        var result: [Int: [LifeDropdownOption]] = [:]
        for dropdownId in dropdownIds {
            result[dropdownId] = try await LifeAdminApi.fetchDropdownOptions(dropdownId: dropdownId)
        }
        return result
    }

    private func loadRecordLookup(for fields: [LifeField]) async throws -> [Int: [LifeRecordLookup]] {
        let linkedIds = Set(fields.compactMap { $0.LinkedCategoryId })
        var result: [Int: [LifeRecordLookup]] = [:]
        for linkedId in linkedIds {
            result[linkedId] = try await LifeAdminApi.fetchRecordLookup(categoryId: linkedId)
        }
        return result
    }

    private func saveRecord(_ payload: LifeRecordCreate) async throws {
        guard let categoryId = selectedCategoryId else { return }
        if let editingRecord {
            _ = try await LifeAdminApi.updateRecord(id: editingRecord.Id, payload: LifeRecordUpdate(Title: payload.Title, Data: payload.Data))
        } else {
            _ = try await LifeAdminApi.createRecord(categoryId: categoryId, payload: payload)
        }
        await loadCategoryData(categoryId: categoryId)
    }

    private func deleteRecord(_ record: LifeRecord) async {
        do {
            try await LifeAdminApi.deleteRecord(id: record.Id)
            if let categoryId = selectedCategoryId {
                await loadCategoryData(categoryId: categoryId)
            }
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete record."
        }
    }
}

private struct RecordCard: View {
    let record: LifeRecord
    let fields: [LifeField]
    let dropdownOptions: [Int: [LifeDropdownOption]]
    let people: [LifePerson]
    let recordLookup: [Int: [LifeRecordLookup]]
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.Title ?? "Record \(record.Id)")
                        .font(.headline)
                    Text("Updated \(LifeAdminFormatters.displayDateTime(record.UpdatedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Menu {
                    Button("Edit") { onEdit() }
                    Button("Delete", role: .destructive) { onDelete() }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(displayRows.prefix(3), id: \.label) { row in
                    HStack {
                        Text(row.label)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(row.value)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
        .onTapGesture {
            onEdit()
        }
    }

    private var displayRows: [(label: String, value: String)] {
        var rows: [(String, String)] = []
        for field in fields {
            guard let value = record.Data[field.Key] else { continue }
            let displayValue = LifeAdminRecordFormatter.displayValue(
                field: field,
                value: value,
                dropdownOptions: dropdownOptions[field.DropdownId ?? -1] ?? [],
                people: people,
                recordLookup: recordLookup[field.LinkedCategoryId ?? -1] ?? []
            )
            if !displayValue.isEmpty {
                rows.append((field.Name, displayValue))
            }
        }
        return rows
    }
}

private enum LifeAdminRecordFormatter {
    static func displayValue(
        field: LifeField,
        value: JSONValue?,
        dropdownOptions: [LifeDropdownOption],
        people: [LifePerson],
        recordLookup: [LifeRecordLookup]
    ) -> String {
        guard let value else { return "" }
        switch field.FieldType {
        case "Text", "LongText":
            return value.stringValue ?? ""
        case "Number":
            return LifeAdminFormatters.formatNumber(value.numberValue)
        case "Currency":
            return LifeAdminFormatters.formatCurrency(value.numberValue)
        case "Date":
            return LifeAdminFormatters.displayDate(value.stringValue)
        case "DateRange":
            guard let obj = value.objectValue else { return "" }
            let start = LifeAdminFormatters.displayDate(obj["StartDate"]?.stringValue)
            let end = LifeAdminFormatters.displayDate(obj["EndDate"]?.stringValue)
            if end == "-" {
                return start
            }
            if start == "-" {
                return end
            }
            return "\(start) to \(end)"
        case "Dropdown":
            return resolveLookupValue(value, options: dropdownOptions.map { ($0.Id, $0.Label) })
        case "Person":
            return resolveLookupValue(value, options: people.map { ($0.Id, $0.Name) })
        case "RecordLink":
            return resolveLookupValue(value, options: recordLookup.map { ($0.Id, $0.Title) })
        case "Boolean":
            if let boolValue = value.boolValue {
                return boolValue ? "Yes" : "No"
            }
            return ""
        default:
            return value.stringValue ?? ""
        }
    }

    private static func resolveLookupValue(_ value: JSONValue, options: [(Int, String)]) -> String {
        let map = Dictionary(uniqueKeysWithValues: options)
        if let array = value.arrayValue {
            let labels = array.compactMap { entry -> String? in
                if let number = entry.numberValue {
                    return map[Int(number)] ?? String(Int(number))
                }
                if let text = entry.stringValue {
                    return map[Int(text) ?? -1] ?? text
                }
                return nil
            }
            return labels.joined(separator: ", ")
        }
        if let number = value.numberValue {
            return map[Int(number)] ?? String(Int(number))
        }
        if let text = value.stringValue {
            if let number = Int(text) {
                return map[number] ?? text
            }
            return text
        }
        return ""
    }
}

private struct RecordFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let categoryId: Int?
    let fields: [LifeField]
    let dropdownOptions: [Int: [LifeDropdownOption]]
    let people: [LifePerson]
    let recordLookup: [Int: [LifeRecordLookup]]
    let initialRecord: LifeRecord?
    let onSave: (LifeRecordCreate) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var form: RecordFormState
    @State private var errorMessage = ""
    @State private var isSaving = false
    @State private var activeMultiSelect: MultiSelectContext?

    init(
        categoryId: Int?,
        fields: [LifeField],
        dropdownOptions: [Int: [LifeDropdownOption]],
        people: [LifePerson],
        recordLookup: [Int: [LifeRecordLookup]],
        initialRecord: LifeRecord?,
        onSave: @escaping (LifeRecordCreate) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.categoryId = categoryId
        self.fields = fields
        self.dropdownOptions = dropdownOptions
        self.people = people
        self.recordLookup = recordLookup
        self.initialRecord = initialRecord
        self.onSave = onSave
        self.onDelete = onDelete
        _form = State(initialValue: RecordFormState(record: initialRecord, fields: fields))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Summary") {
                    TextField("Title (optional)", text: $form.title)
                }

                ForEach(fields.sorted { $0.SortOrder < $1.SortOrder }) { field in
                    Section(field.Name) {
                        fieldInput(for: field)
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
                        Button("Delete record", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initialRecord == nil ? "New record" : "Edit record")
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
            .sheet(item: $activeMultiSelect) { context in
                MultiSelectSheet(title: context.title, options: context.options, selection: context.selection)
            }
        }
    }

    @ViewBuilder
    private func fieldInput(for field: LifeField) -> some View {
        switch field.FieldType {
        case "Text":
            TextField(field.Name, text: binding(for: field, in: $form.textValues))
        case "LongText":
            TextEditor(text: binding(for: field, in: $form.textValues))
                .frame(minHeight: 80)
        case "Number", "Currency":
            TextField(field.Name, text: binding(for: field, in: $form.numberValues))
                .keyboardType(.decimalPad)
        case "Date":
            DateFieldView(
                title: field.Name,
                state: binding(for: field, in: $form.dateValues),
                isRequired: field.IsRequired
            )
        case "DateRange":
            DateRangeFieldView(
                title: field.Name,
                state: binding(for: field, in: $form.dateRangeValues),
                isRequired: field.IsRequired
            )
        case "Dropdown":
            let options = dropdownOptions[field.DropdownId ?? -1]?.map {
                LifeSelectOption(id: $0.Id, label: $0.Label)
            } ?? []
            selectionInput(for: field, options: options)
        case "Person":
            selectionInput(for: field, options: people.map { LifeSelectOption(id: $0.Id, label: $0.Name) })
        case "RecordLink":
            selectionInput(for: field, options: recordLookup[field.LinkedCategoryId ?? -1]?.map { LifeSelectOption(id: $0.Id, label: $0.Title) } ?? [])
        case "Boolean":
            Toggle("Enabled", isOn: binding(for: field, in: $form.boolValues))
        default:
            Text("Unsupported field type")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private func selectionInput(for field: LifeField, options: [LifeSelectOption]) -> some View {
        if field.IsMulti {
            let selected = form.multiSelections[field.Key] ?? []
            let count = selected.count
            return AnyView(
                Button(action: {
                    activeMultiSelect = MultiSelectContext(
                        title: field.Name,
                        options: options,
                        selection: bindingMultiSelection(for: field)
                    )
                }) {
                    HStack {
                        Text(count == 0 ? "Select" : "Selected: \(count)")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(.secondary)
                    }
                }
            )
        }
        return AnyView(
            Picker(field.Name, selection: bindingSingleSelection(for: field)) {
                Text("None").tag(Int?.none)
                ForEach(options) { option in
                    Text(option.label).tag(Optional(option.id))
                }
            }
        )
    }

    private var isDirty: Bool {
        form != RecordFormState(record: initialRecord, fields: fields)
    }

    private var isValid: Bool {
        for field in fields where field.IsRequired {
            switch field.FieldType {
            case "Text", "LongText":
                let value = form.textValues[field.Key]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if value.isEmpty { return false }
            case "Number", "Currency":
                let value = form.numberValues[field.Key]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if Double(value.replacingOccurrences(of: ",", with: "")) == nil { return false }
            case "Date":
                if form.dateValues[field.Key]?.hasValue != true { return false }
            case "DateRange":
                if form.dateRangeValues[field.Key]?.hasStart != true { return false }
            case "Dropdown", "Person", "RecordLink":
                if field.IsMulti {
                    if (form.multiSelections[field.Key] ?? []).isEmpty { return false }
                } else {
                    if form.singleSelections[field.Key] == nil { return false }
                }
            case "Boolean":
                break
            default:
                break
            }
        }
        return true
    }

    private func save() async {
        errorMessage = ""
        guard categoryId != nil else {
            errorMessage = "Select a category before saving."
            return
        }
        isSaving = true
        do {
            let payload = try form.toPayload()
            try await onSave(payload)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save record."
        }
        isSaving = false
    }

    private func binding(for field: LifeField, in dictionary: Binding<[String: String]>) -> Binding<String> {
        Binding(
            get: { dictionary.wrappedValue[field.Key] ?? "" },
            set: { dictionary.wrappedValue[field.Key] = $0 }
        )
    }

    private func binding(for field: LifeField, in dictionary: Binding<[String: Bool]>) -> Binding<Bool> {
        Binding(
            get: { dictionary.wrappedValue[field.Key] ?? false },
            set: { dictionary.wrappedValue[field.Key] = $0 }
        )
    }

    private func binding(for field: LifeField, in dictionary: Binding<[String: DateFieldState]>) -> Binding<DateFieldState> {
        Binding(
            get: { dictionary.wrappedValue[field.Key] ?? DateFieldState() },
            set: { dictionary.wrappedValue[field.Key] = $0 }
        )
    }

    private func binding(for field: LifeField, in dictionary: Binding<[String: DateRangeFieldState]>) -> Binding<DateRangeFieldState> {
        Binding(
            get: { dictionary.wrappedValue[field.Key] ?? DateRangeFieldState() },
            set: { dictionary.wrappedValue[field.Key] = $0 }
        )
    }

    private func bindingSingleSelection(for field: LifeField) -> Binding<Int?> {
        Binding(
            get: { form.singleSelections[field.Key] ?? nil },
            set: { form.singleSelections[field.Key] = $0 }
        )
    }

    private func bindingMultiSelection(for field: LifeField) -> Binding<Set<Int>> {
        Binding(
            get: { form.multiSelections[field.Key] ?? [] },
            set: { form.multiSelections[field.Key] = $0 }
        )
    }
}

private struct LifeSelectOption: Identifiable {
    let id: Int
    let label: String
}

private struct MultiSelectContext: Identifiable {
    let id = UUID()
    let title: String
    let options: [LifeSelectOption]
    let selection: Binding<Set<Int>>
}

private struct MultiSelectSheet: View {
    let title: String
    let options: [LifeSelectOption]
    let selection: Binding<Set<Int>>

    var body: some View {
        NavigationStack {
            List {
                ForEach(options) { option in
                    MultipleSelectionRow(
                        title: option.label,
                        isSelected: selection.wrappedValue.contains(option.id)
                    ) {
                        if selection.wrappedValue.contains(option.id) {
                            selection.wrappedValue.remove(option.id)
                        } else {
                            selection.wrappedValue.insert(option.id)
                        }
                    }
                }
            }
            .navigationTitle(title)
        }
    }
}

private struct MultipleSelectionRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(.accentColor)
                }
            }
        }
    }
}

private struct DateFieldState: Equatable {
    var hasValue: Bool = false
    var date: Date = Date()
}

private struct DateRangeFieldState: Equatable {
    var hasStart: Bool = false
    var start: Date = Date()
    var hasEnd: Bool = false
    var end: Date = Date()
}

private struct DateFieldView: View {
    let title: String
    @Binding var state: DateFieldState
    let isRequired: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Set date", isOn: $state.hasValue)
                .disabled(isRequired)
            if state.hasValue || isRequired {
                DatePicker(title, selection: $state.date, displayedComponents: [.date])
            }
        }
        .onAppear {
            if isRequired { state.hasValue = true }
        }
    }
}

private struct DateRangeFieldView: View {
    let title: String
    @Binding var state: DateRangeFieldState
    let isRequired: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Set start date", isOn: $state.hasStart)
                .disabled(isRequired)
            if state.hasStart || isRequired {
                DatePicker("Start", selection: $state.start, displayedComponents: [.date])
            }
            Toggle("Set end date", isOn: $state.hasEnd)
            if state.hasEnd {
                DatePicker("End", selection: $state.end, displayedComponents: [.date])
            }
        }
        .onAppear {
            if isRequired { state.hasStart = true }
        }
    }
}

private struct RecordFormState: Equatable {
    var title: String
    var textValues: [String: String]
    var numberValues: [String: String]
    var dateValues: [String: DateFieldState]
    var dateRangeValues: [String: DateRangeFieldState]
    var boolValues: [String: Bool]
    var singleSelections: [String: Int?]
    var multiSelections: [String: Set<Int>]

    init(record: LifeRecord?, fields: [LifeField]) {
        title = record?.Title ?? ""
        textValues = [:]
        numberValues = [:]
        dateValues = [:]
        dateRangeValues = [:]
        boolValues = [:]
        singleSelections = [:]
        multiSelections = [:]

        for field in fields {
            let value = record?.Data[field.Key]
            switch field.FieldType {
            case "Text", "LongText":
                textValues[field.Key] = value?.stringValue ?? ""
            case "Number", "Currency":
                if let number = value?.numberValue {
                    numberValues[field.Key] = String(number)
                } else {
                    numberValues[field.Key] = ""
                }
            case "Date":
                var state = DateFieldState()
                if let dateString = value?.stringValue,
                   let parsed = LifeAdminFormatters.parseDate(dateString) {
                    state.hasValue = true
                    state.date = parsed
                }
                dateValues[field.Key] = state
            case "DateRange":
                var state = DateRangeFieldState()
                if let obj = value?.objectValue {
                    if let startString = obj["StartDate"]?.stringValue,
                       let parsed = LifeAdminFormatters.parseDate(startString) {
                        state.hasStart = true
                        state.start = parsed
                    }
                    if let endString = obj["EndDate"]?.stringValue,
                       let parsedEnd = LifeAdminFormatters.parseDate(endString) {
                        state.hasEnd = true
                        state.end = parsedEnd
                    }
                }
                dateRangeValues[field.Key] = state
            case "Dropdown", "Person", "RecordLink":
                if field.IsMulti {
                    if let array = value?.arrayValue {
                        let ids = array.compactMap { entry -> Int? in
                            if let number = entry.numberValue { return Int(number) }
                            if let text = entry.stringValue { return Int(text) }
                            return nil
                        }
                        multiSelections[field.Key] = Set(ids)
                    } else {
                        multiSelections[field.Key] = []
                    }
                } else {
                    if let number = value?.numberValue {
                        singleSelections[field.Key] = Int(number)
                    } else if let text = value?.stringValue, let parsed = Int(text) {
                        singleSelections[field.Key] = parsed
                    } else {
                        singleSelections[field.Key] = nil
                    }
                }
            case "Boolean":
                boolValues[field.Key] = value?.boolValue ?? false
            default:
                break
            }
        }
    }

    func toPayload() throws -> LifeRecordCreate {
        var data: [String: JSONValue] = [:]
        for (key, value) in textValues where !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            data[key] = .string(value.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        for (key, value) in numberValues {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            let normalized = trimmed.replacingOccurrences(of: ",", with: "")
            if let number = Double(normalized) {
                data[key] = .number(number)
            }
        }
        for (key, state) in dateValues {
            if state.hasValue {
                data[key] = .string(LifeAdminFormatters.formatDate(state.date))
            }
        }
        for (key, state) in dateRangeValues {
            if state.hasStart {
                let start = LifeAdminFormatters.formatDate(state.start)
                let end = state.hasEnd ? LifeAdminFormatters.formatDate(state.end) : nil
                var obj: [String: JSONValue] = ["StartDate": .string(start)]
                if let end {
                    obj["EndDate"] = .string(end)
                } else {
                    obj["EndDate"] = .null
                }
                data[key] = .object(obj)
            }
        }
        for (key, value) in boolValues {
            data[key] = .bool(value)
        }
        for (key, selection) in singleSelections {
            if let selection {
                data[key] = .number(Double(selection))
            }
        }
        for (key, selection) in multiSelections where !selection.isEmpty {
            let values = selection.map { JSONValue.number(Double($0)) }
            data[key] = .array(values)
        }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let safeTitle = trimmedTitle.isEmpty ? nil : trimmedTitle
        return LifeRecordCreate(Title: safeTitle, Data: data)
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
