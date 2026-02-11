import SwiftUI

struct BudgetExpensesView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var expenses: [Expense] = []
    @State private var accounts: [ExpenseAccount] = []
    @State private var types: [ExpenseType] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var searchTerm = ""
    @State private var filter: ExpenseFilter = .enabled

    @State private var showForm = false
    @State private var editingExpense: Expense?
    @State private var deleteTarget: Expense?
    @State private var showDeleteConfirm = false

    @State private var showMetaManager = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                mainContent

                if status == .loading {
                    BudgetEmptyState(message: "Loading expenses...")
                }
                if !errorMessage.isEmpty {
                    BudgetErrorBanner(message: errorMessage)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 24)
            .frame(maxWidth: horizontalSizeClass == .regular ? 1100 : 860)
            .frame(maxWidth: .infinity)
        }
        .task {
            if status == .idle {
                await loadAll()
            }
        }
        .sheet(isPresented: $showForm) {
            ExpenseFormSheet(
                initialState: ExpenseFormState(expense: editingExpense),
                accounts: accounts,
                types: types,
                onSave: { form in
                    try await saveExpense(form)
                },
                onDelete: editingExpense == nil ? nil : {
                    if let expense = editingExpense {
                        await deleteExpense(expense)
                    }
                }
            )
        }
        .sheet(isPresented: $showMetaManager) {
            ExpenseMetaManagerSheet(
                accounts: accounts,
                types: types,
                onReload: { await loadMeta() },
                onSaveAccount: { form in
                    try await saveAccount(form)
                },
                onDeleteAccount: { account in
                    await deleteAccount(account)
                },
                onSaveType: { form in
                    try await saveType(form)
                },
                onDeleteType: { entry in
                    await deleteType(entry)
                }
            )
        }
        .alert("Delete expense", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                if let target = deleteTarget {
                    Task { await deleteExpense(target) }
                }
            }
            Button("Cancel", role: .cancel) { deleteTarget = nil }
        } message: {
            Text("This will permanently remove the expense.")
        }
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Expenses")
                    .font(.title2.bold())
                Text("Track recurring bills and spending.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                Button("Manage") { showMetaManager = true }
                    .buttonStyle(.bordered)
                Button("Add") {
                    editingExpense = nil
                    showForm = true
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 16) {
                    summarySection
                    filterSection
                }
                .frame(maxWidth: 420, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 16) {
                    expensesSection
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            summarySection
            filterSection
            expensesSection
        }
    }

    private var summarySection: some View {
        let totals = BudgetFormatters.buildTotals(incomeStreams: [], expenses: expenses)
        return BudgetSectionCard {
            BudgetSectionHeader(title: "Expense totals", subtitle: "Enabled expenses only.")
            let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
            LazyVGrid(columns: columns, spacing: 12) {
                BudgetMetricTile(title: "Per fortnight", value: BudgetFormatters.formatCurrency(totals.Expenses.PerFortnight), detail: nil)
                BudgetMetricTile(title: "Per month", value: BudgetFormatters.formatCurrency(totals.Expenses.PerMonth), detail: nil)
                BudgetMetricTile(title: "Per year", value: BudgetFormatters.formatCurrency(totals.Expenses.PerYear), detail: nil)
                BudgetMetricTile(title: "Per week", value: BudgetFormatters.formatCurrency(totals.Expenses.PerWeek), detail: nil)
            }
        }
    }

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Filter", selection: $filter) {
                ForEach(ExpenseFilter.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search expenses", text: $searchTerm)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
        }
    }

    private var expensesSection: some View {
        BudgetSectionCard {
            BudgetSectionHeader(title: "Expense list", subtitle: "Tap an expense to edit.")
            if filteredExpenses.isEmpty {
                BudgetEmptyState(message: "No expenses match this view.")
            } else {
                VStack(spacing: 12) {
                    ForEach(filteredExpenses) { expense in
                        ExpenseCard(
                            expense: expense,
                            onEdit: {
                                editingExpense = expense
                                showForm = true
                            },
                            onDelete: {
                                deleteTarget = expense
                                showDeleteConfirm = true
                            }
                        )
                    }
                }
            }
        }
    }

    private var filteredExpenses: [Expense] {
        let query = searchTerm.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return expenses.filter { expense in
            if filter == .enabled && !expense.Enabled {
                return false
            }
            if filter == .disabled && expense.Enabled {
                return false
            }
            if query.isEmpty {
                return true
            }
            let haystack = [expense.Label, expense.Account ?? "", expense.ExpenseType ?? "", expense.Notes ?? ""]
                .joined(separator: " ")
                .lowercased()
            return haystack.contains(query)
        }
    }

    private func loadAll() async {
        status = .loading
        errorMessage = ""
        do {
            expenses = try await BudgetApi.fetchExpenses()
            status = .ready
            await loadMeta()
        } catch {
            status = .error
            errorMessage = describeError(error, fallback: "Failed to load expenses.")
        }
    }

    private func loadMeta() async {
        do {
            async let accountsTask = BudgetApi.fetchExpenseAccounts()
            async let typesTask = BudgetApi.fetchExpenseTypes()
            let (accountsResult, typesResult) = try await (accountsTask, typesTask)
            accounts = accountsResult
            types = typesResult
        } catch {
            errorMessage = describeError(error, fallback: "Failed to load expense settings.")
        }
    }

    private func saveExpense(_ form: ExpenseFormState) async throws {
        let trimmedLabel = form.label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedLabel.isEmpty else { throw ApiError(message: "Label is required.") }
        guard let amount = BudgetFormatters.parseAmount(form.amount), amount > 0 else {
            throw ApiError(message: "Amount is required.")
        }
        let frequency = form.frequency.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !frequency.isEmpty else { throw ApiError(message: "Frequency is required.") }

        let nextDue = form.hasNextDueDate ? BudgetFormatters.formatDate(form.nextDueDate) : nil
        let month = nextDue != nil ? Calendar.current.component(.month, from: form.nextDueDate) : nil
        let dayOfMonth = nextDue != nil ? Calendar.current.component(.day, from: form.nextDueDate) : nil

        let payload = ExpenseCreate(
            Label: trimmedLabel,
            Amount: amount,
            Frequency: frequency,
            Account: form.account.isEmpty ? nil : form.account,
            ExpenseType: form.expenseType.isEmpty ? nil : form.expenseType,
            NextDueDate: nextDue,
            Cadence: form.cadence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.cadence,
            Interval: form.interval,
            Month: month,
            DayOfMonth: dayOfMonth,
            Enabled: form.enabled,
            Notes: form.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.notes
        )

        if let editingExpense {
            _ = try await BudgetApi.updateExpense(
                id: editingExpense.Id,
                payload: ExpenseUpdate(
                    Label: payload.Label,
                    Amount: payload.Amount,
                    Frequency: payload.Frequency,
                    Account: payload.Account,
                    ExpenseType: payload.ExpenseType,
                    NextDueDate: payload.NextDueDate,
                    Cadence: payload.Cadence,
                    Interval: payload.Interval,
                    Month: payload.Month,
                    DayOfMonth: payload.DayOfMonth,
                    Enabled: payload.Enabled,
                    Notes: payload.Notes
                )
            )
        } else {
            _ = try await BudgetApi.createExpense(payload)
        }
        await loadAll()
    }

    private func deleteExpense(_ expense: Expense) async {
        deleteTarget = nil
        do {
            try await BudgetApi.deleteExpense(id: expense.Id)
            await loadAll()
        } catch {
            errorMessage = describeError(error, fallback: "Failed to delete expense.")
        }
    }

    private func saveAccount(_ form: ExpenseAccountFormState) async throws {
        let trimmed = form.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw ApiError(message: "Account name is required.") }
        if let editing = form.editingAccount {
            _ = try await BudgetApi.updateExpenseAccount(
                id: editing.Id,
                payload: ExpenseAccountUpdate(Name: trimmed, Enabled: form.enabled)
            )
        } else {
            _ = try await BudgetApi.createExpenseAccount(
                ExpenseAccountCreate(Name: trimmed, Enabled: form.enabled)
            )
        }
        await loadMeta()
    }

    private func deleteAccount(_ account: ExpenseAccount) async {
        do {
            try await BudgetApi.deleteExpenseAccount(id: account.Id)
            await loadMeta()
        } catch {
            errorMessage = describeError(error, fallback: "Failed to delete account.")
        }
    }

    private func saveType(_ form: ExpenseTypeFormState) async throws {
        let trimmed = form.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw ApiError(message: "Type name is required.") }
        if let editing = form.editingType {
            _ = try await BudgetApi.updateExpenseType(
                id: editing.Id,
                payload: ExpenseTypeUpdate(Name: trimmed, Enabled: form.enabled)
            )
        } else {
            _ = try await BudgetApi.createExpenseType(
                ExpenseTypeCreate(Name: trimmed, Enabled: form.enabled)
            )
        }
        await loadMeta()
    }

    private func deleteType(_ entry: ExpenseType) async {
        do {
            try await BudgetApi.deleteExpenseType(id: entry.Id)
            await loadMeta()
        } catch {
            errorMessage = describeError(error, fallback: "Failed to delete type.")
        }
    }

    private func describeError(_ error: Error, fallback: String) -> String {
        if let apiError = error as? ApiError {
            return apiError.message
        }
        if error is DecodingError {
            return "Failed to decode the response. Check that the API is returning the expected schema."
        }
        return fallback
    }
}

private struct ExpenseCard: View {
    let expense: Expense
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(expense.Label)
                        .font(.headline)
                    Text(expense.Frequency)
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

            HStack(spacing: 12) {
                BudgetMetricTile(title: "Amount", value: BudgetFormatters.formatCurrency(expense.Amount), detail: nil)
                BudgetMetricTile(title: "Per fortnight", value: BudgetFormatters.formatCurrency(expense.PerFortnight), detail: nil)
            }

            HStack(spacing: 12) {
                if let account = expense.Account, !account.isEmpty {
                    Text("Account: \(account)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let type = expense.ExpenseType, !type.isEmpty {
                    Text("Type: \(type)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 12) {
                if let nextDue = expense.NextDueDate {
                    Text("Next due: \(BudgetFormatters.displayDate(nextDue))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !expense.Enabled {
                    Text("Disabled")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
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
}

private struct ExpenseFormState: Equatable {
    var label: String
    var amount: String
    var frequency: String
    var account: String
    var expenseType: String
    var hasNextDueDate: Bool
    var nextDueDate: Date
    var cadence: String
    var interval: Int?
    var enabled: Bool
    var notes: String
    var isEditing: Bool

    init(expense: Expense?) {
        if let expense {
            label = expense.Label
            amount = String(expense.Amount)
            frequency = expense.Frequency
            account = expense.Account ?? ""
            expenseType = expense.ExpenseType ?? ""
            if let next = expense.NextDueDate, let parsed = BudgetFormatters.parseDate(next) {
                hasNextDueDate = true
                nextDueDate = parsed
            } else {
                hasNextDueDate = false
                nextDueDate = Date()
            }
            cadence = expense.Cadence ?? ""
            interval = expense.Interval
            enabled = expense.Enabled
            notes = expense.Notes ?? ""
            isEditing = true
        } else {
            label = ""
            amount = ""
            frequency = "Monthly"
            account = ""
            expenseType = ""
            hasNextDueDate = false
            nextDueDate = Date()
            cadence = ""
            interval = nil
            enabled = true
            notes = ""
            isEditing = false
        }
    }
}

private struct ExpenseFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initialState: ExpenseFormState
    let accounts: [ExpenseAccount]
    let types: [ExpenseType]
    let onSave: (ExpenseFormState) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var form: ExpenseFormState
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(
        initialState: ExpenseFormState,
        accounts: [ExpenseAccount],
        types: [ExpenseType],
        onSave: @escaping (ExpenseFormState) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.initialState = initialState
        self.accounts = accounts
        self.types = types
        self.onSave = onSave
        self.onDelete = onDelete
        _form = State(initialValue: initialState)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Label", text: $form.label)
                    TextField("Amount", text: $form.amount)
                        .keyboardType(.decimalPad)
                    TextField("Frequency", text: $form.frequency)
                    Toggle("Enabled", isOn: $form.enabled)
                }

                Section("Classification") {
                    Picker("Account", selection: $form.account) {
                        Text("None").tag("")
                        ForEach(accounts) { account in
                            Text(account.Name).tag(account.Name)
                        }
                    }
                    Picker("Type", selection: $form.expenseType) {
                        Text("None").tag("")
                        ForEach(types) { entry in
                            Text(entry.Name).tag(entry.Name)
                        }
                    }
                }

                Section("Schedule") {
                    Toggle("Has next due date", isOn: $form.hasNextDueDate)
                    if form.hasNextDueDate {
                        DatePicker("Next due date", selection: $form.nextDueDate, displayedComponents: [.date])
                    }
                    TextField("Cadence", text: $form.cadence)
                    TextField("Interval", value: $form.interval, format: .number)
                        .keyboardType(.numberPad)
                }

                Section("Notes") {
                    TextEditor(text: $form.notes)
                        .frame(minHeight: 80)
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
                        Button("Delete expense", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(form.isEditing ? "Edit expense" : "New expense")
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
        form != initialState
    }

    private var isValid: Bool {
        let labelOk = !form.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let amountOk = BudgetFormatters.parseAmount(form.amount) != nil
        let frequencyOk = !form.frequency.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return labelOk && amountOk && frequencyOk
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = "Label, amount, and frequency are required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save expense."
        }
        isSaving = false
    }
}

private struct ExpenseMetaManagerSheet: View {
    @Environment(\.dismiss) private var dismiss

    let accounts: [ExpenseAccount]
    let types: [ExpenseType]
    let onReload: () async -> Void
    let onSaveAccount: (ExpenseAccountFormState) async throws -> Void
    let onDeleteAccount: (ExpenseAccount) async -> Void
    let onSaveType: (ExpenseTypeFormState) async throws -> Void
    let onDeleteType: (ExpenseType) async -> Void

    @State private var selection: ExpenseMetaTab = .accounts
    @State private var editingAccount: ExpenseAccount?
    @State private var editingType: ExpenseType?
    @State private var showAccountForm = false
    @State private var showTypeForm = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Picker("Section", selection: $selection) {
                    ForEach(ExpenseMetaTab.allCases) { tab in
                        Text(tab.label).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)

                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if selection == .accounts {
                            metaSection(title: "Accounts", items: accounts) { account in
                                editingAccount = account
                                showAccountForm = true
                            } onDelete: { account in
                                Task { await onDeleteAccount(account) }
                            }
                        } else {
                            metaSection(title: "Types", items: types) { entry in
                                editingType = entry
                                showTypeForm = true
                            } onDelete: { entry in
                                Task { await onDeleteType(entry) }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Expense settings")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        if selection == .accounts {
                            editingAccount = nil
                            showAccountForm = true
                        } else {
                            editingType = nil
                            showTypeForm = true
                        }
                    }
                }
            }
            .sheet(isPresented: $showAccountForm) {
                ExpenseAccountFormSheet(
                    initialState: ExpenseAccountFormState(account: editingAccount),
                    onSave: { form in
                        try await onSaveAccount(form)
                        await onReload()
                    }
                )
            }
            .sheet(isPresented: $showTypeForm) {
                ExpenseTypeFormSheet(
                    initialState: ExpenseTypeFormState(entry: editingType),
                    onSave: { form in
                        try await onSaveType(form)
                        await onReload()
                    }
                )
            }
        }
    }

    private func metaSection<T: Identifiable>(
        title: String,
        items: [T],
        onEdit: @escaping (T) -> Void,
        onDelete: @escaping (T) -> Void
    ) -> some View where T: ExpenseMetaDisplayable {
        BudgetSectionCard {
            BudgetSectionHeader(title: title, subtitle: nil)
            if items.isEmpty {
                BudgetEmptyState(message: "No entries yet.")
            } else {
                VStack(spacing: 12) {
                    ForEach(items) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.displayName)
                                    .font(.subheadline.weight(.semibold))
                                Text(item.enabled ? "Enabled" : "Disabled")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Edit") { onEdit(item) }
                                .buttonStyle(.bordered)
                            Button("Delete") { onDelete(item) }
                                .buttonStyle(.bordered)
                                .tint(.red)
                        }
                    }
                }
            }
        }
    }
}

private protocol ExpenseMetaDisplayable {
    var displayName: String { get }
    var enabled: Bool { get }
}

extension ExpenseAccount: ExpenseMetaDisplayable {
    var displayName: String { Name }
    var enabled: Bool { Enabled }
}

extension ExpenseType: ExpenseMetaDisplayable {
    var displayName: String { Name }
    var enabled: Bool { Enabled }
}

private struct ExpenseAccountFormState: Equatable {
    var name: String
    var enabled: Bool
    var editingAccount: ExpenseAccount?

    init(account: ExpenseAccount?) {
        editingAccount = account
        name = account?.Name ?? ""
        enabled = account?.Enabled ?? true
    }

    static func == (lhs: ExpenseAccountFormState, rhs: ExpenseAccountFormState) -> Bool {
        lhs.name == rhs.name &&
            lhs.enabled == rhs.enabled &&
            lhs.editingAccount?.Id == rhs.editingAccount?.Id
    }
}

private struct ExpenseTypeFormState: Equatable {
    var name: String
    var enabled: Bool
    var editingType: ExpenseType?

    init(entry: ExpenseType?) {
        editingType = entry
        name = entry?.Name ?? ""
        enabled = entry?.Enabled ?? true
    }

    static func == (lhs: ExpenseTypeFormState, rhs: ExpenseTypeFormState) -> Bool {
        lhs.name == rhs.name &&
            lhs.enabled == rhs.enabled &&
            lhs.editingType?.Id == rhs.editingType?.Id
    }
}

private struct ExpenseAccountFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initialState: ExpenseAccountFormState
    let onSave: (ExpenseAccountFormState) async throws -> Void

    @State private var form: ExpenseAccountFormState
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(
        initialState: ExpenseAccountFormState,
        onSave: @escaping (ExpenseAccountFormState) async throws -> Void
    ) {
        self.initialState = initialState
        self.onSave = onSave
        _form = State(initialValue: initialState)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    TextField("Name", text: $form.name)
                    Toggle("Enabled", isOn: $form.enabled)
                }
                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(form.editingAccount == nil ? "New account" : "Edit account")
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
        form != initialState
    }

    private var isValid: Bool {
        !form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = "Account name is required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save account."
        }
        isSaving = false
    }
}

private struct ExpenseTypeFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initialState: ExpenseTypeFormState
    let onSave: (ExpenseTypeFormState) async throws -> Void

    @State private var form: ExpenseTypeFormState
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(
        initialState: ExpenseTypeFormState,
        onSave: @escaping (ExpenseTypeFormState) async throws -> Void
    ) {
        self.initialState = initialState
        self.onSave = onSave
        _form = State(initialValue: initialState)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Type") {
                    TextField("Name", text: $form.name)
                    Toggle("Enabled", isOn: $form.enabled)
                }
                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(form.editingType == nil ? "New type" : "Edit type")
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
        form != initialState
    }

    private var isValid: Bool {
        !form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = "Type name is required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save type."
        }
        isSaving = false
    }
}

private enum ExpenseFilter: String, CaseIterable, Identifiable {
    case enabled
    case disabled
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .enabled:
            return "Enabled"
        case .disabled:
            return "Disabled"
        case .all:
            return "All"
        }
    }
}

private enum ExpenseMetaTab: String, CaseIterable, Identifiable {
    case accounts
    case types

    var id: String { rawValue }

    var label: String {
        switch self {
        case .accounts:
            return "Accounts"
        case .types:
            return "Types"
        }
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
