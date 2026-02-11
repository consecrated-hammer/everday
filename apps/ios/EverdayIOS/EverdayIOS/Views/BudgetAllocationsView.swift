import SwiftUI

struct BudgetAllocationsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var incomeStreams: [IncomeStream] = []
    @State private var expenses: [Expense] = []
    @State private var accounts: [AllocationAccount] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    @State private var showForm = false
    @State private var editingAccount: AllocationAccount?
    @State private var deleteTarget: AllocationAccount?
    @State private var showDeleteConfirm = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                mainContent

                if status == .loading {
                    BudgetEmptyState(message: "Loading allocation data...")
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
                await load()
            }
        }
        .sheet(isPresented: $showForm) {
            AllocationAccountFormSheet(
                initialState: AllocationAccountFormState(account: editingAccount),
                onSave: { form in
                    try await save(form)
                },
                onDelete: editingAccount == nil ? nil : {
                    if let account = editingAccount {
                        await delete(account)
                    }
                }
            )
        }
        .alert("Delete allocation", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                if let target = deleteTarget {
                    Task { await delete(target) }
                }
            }
            Button("Cancel", role: .cancel) { deleteTarget = nil }
        } message: {
            Text("This will permanently remove the allocation account.")
        }
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Allocations")
                    .font(.title2.bold())
                Text("Plan how income is split across accounts.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Add") {
                editingAccount = nil
                showForm = true
            }
            .buttonStyle(.borderedProminent)
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 16) {
                    totalsSection
                    allocationSection
                }
                .frame(maxWidth: 420, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 16) {
                    accountsSection
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            totalsSection
            allocationSection
            accountsSection
        }
    }

    private var totalsSection: some View {
        let totals = BudgetFormatters.buildTotals(incomeStreams: incomeStreams, expenses: expenses)
        return BudgetSectionCard {
            BudgetSectionHeader(title: "Income vs expenses", subtitle: "Net totals per period.")
            let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
            LazyVGrid(columns: columns, spacing: 12) {
                BudgetMetricTile(title: "Income per fortnight", value: BudgetFormatters.formatCurrency(totals.Income.PerFortnight), detail: nil)
                BudgetMetricTile(title: "Expenses per fortnight", value: BudgetFormatters.formatCurrency(totals.Expenses.PerFortnight), detail: nil)
                BudgetMetricTile(title: "Income per month", value: BudgetFormatters.formatCurrency(totals.Income.PerMonth), detail: nil)
                BudgetMetricTile(title: "Leftover per month", value: BudgetFormatters.formatCurrency(totals.Difference.PerMonth), detail: nil)
            }
        }
    }

    private var allocationSection: some View {
        let totals = BudgetFormatters.buildTotals(incomeStreams: incomeStreams, expenses: expenses)
        let summary = BudgetFormatters.buildAllocationSummary(totals: totals, accounts: accounts)
        return BudgetSectionCard {
            BudgetSectionHeader(title: "Allocation summary", subtitle: "Manual allocations plus daily expenses.")

            BudgetAllocationProgressRow(
                title: "Total allocated",
                value: summary.TotalAllocated,
                overage: summary.Overage
            )

            let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
            LazyVGrid(columns: columns, spacing: 12) {
                BudgetMetricTile(title: "Target expenses", value: BudgetFormatters.formatPercent(summary.TargetExpenseAllocation), detail: nil)
                BudgetMetricTile(title: "Leftover", value: BudgetFormatters.formatPercent(summary.Leftover), detail: nil)
                BudgetMetricTile(title: "Overage", value: BudgetFormatters.formatPercent(summary.Overage), detail: nil)
                BudgetMetricTile(title: "Rounded total", value: BudgetFormatters.formatCurrency(summary.TotalRounded), detail: nil)
            }
        }
    }

    private var accountsSection: some View {
        let incomePerFortnight = BudgetFormatters.buildTotals(incomeStreams: incomeStreams, expenses: expenses).Income.PerFortnight
        return BudgetSectionCard {
            BudgetSectionHeader(title: "Allocation accounts", subtitle: "Tap an account to edit.")
            if accounts.isEmpty {
                BudgetEmptyState(message: "No allocation accounts yet.")
            } else {
                VStack(spacing: 12) {
                    ForEach(accounts) { account in
                        AllocationAccountCard(
                            account: account,
                            incomePerFortnight: incomePerFortnight,
                            onEdit: {
                                editingAccount = account
                                showForm = true
                            },
                            onDelete: {
                                deleteTarget = account
                                showDeleteConfirm = true
                            }
                        )
                    }
                }
            }
        }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let incomeTask = BudgetApi.fetchIncomeStreams()
            async let expenseTask = BudgetApi.fetchExpenses()
            async let accountTask = BudgetApi.fetchAllocationAccounts()
            let (incomeResult, expenseResult, accountResult) = try await (incomeTask, expenseTask, accountTask)
            incomeStreams = incomeResult
            expenses = expenseResult
            accounts = accountResult
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load allocations."
        }
    }

    private func save(_ form: AllocationAccountFormState) async throws {
        let trimmed = form.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw ApiError(message: "Account name is required.") }
        guard let percent = BudgetFormatters.parseAmount(form.percent) else { throw ApiError(message: "Percent is required.") }
        if let editingAccount {
            _ = try await BudgetApi.updateAllocationAccount(
                id: editingAccount.Id,
                payload: AllocationAccountUpdate(Name: trimmed, Percent: percent, Enabled: form.enabled)
            )
        } else {
            _ = try await BudgetApi.createAllocationAccount(
                AllocationAccountCreate(Name: trimmed, Percent: percent, Enabled: form.enabled)
            )
        }
        await load()
    }

    private func delete(_ account: AllocationAccount) async {
        deleteTarget = nil
        do {
            try await BudgetApi.deleteAllocationAccount(id: account.Id)
            await load()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete allocation account."
        }
    }
}

private struct BudgetAllocationProgressRow: View {
    let title: String
    let value: Double
    let overage: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(BudgetFormatters.formatPercent(value))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ProgressView(value: min(value, 1), total: 1)
            if overage > 0 {
                Text("Over by \(BudgetFormatters.formatPercent(overage))")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }
}

private struct AllocationAccountCard: View {
    let account: AllocationAccount
    let incomePerFortnight: Double
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(account.Name)
                        .font(.headline)
                    Text(account.Enabled ? "Enabled" : "Disabled")
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
                BudgetMetricTile(title: "Percent", value: BudgetFormatters.formatPercent(account.Percent / 100), detail: nil)
                BudgetMetricTile(title: "Per fortnight", value: perFortnightLabel, detail: nil)
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

    private var perFortnightLabel: String {
        let amount = incomePerFortnight * (account.Percent / 100)
        return BudgetFormatters.formatCurrency(amount)
    }
}

private struct AllocationAccountFormState: Equatable {
    var name: String
    var percent: String
    var enabled: Bool
    var isEditing: Bool

    init(account: AllocationAccount?) {
        if let account {
            name = account.Name
            percent = String(account.Percent)
            enabled = account.Enabled
            isEditing = true
        } else {
            name = ""
            percent = "0"
            enabled = true
            isEditing = false
        }
    }
}

private struct AllocationAccountFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initialState: AllocationAccountFormState
    let onSave: (AllocationAccountFormState) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var form: AllocationAccountFormState
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(
        initialState: AllocationAccountFormState,
        onSave: @escaping (AllocationAccountFormState) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.initialState = initialState
        self.onSave = onSave
        self.onDelete = onDelete
        _form = State(initialValue: initialState)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Allocation") {
                    TextField("Name", text: $form.name)
                    TextField("Percent", text: $form.percent)
                        .keyboardType(.decimalPad)
                    Toggle("Enabled", isOn: $form.enabled)
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
                        Button("Delete allocation", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(form.isEditing ? "Edit allocation" : "New allocation")
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
        let nameOk = !form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let percentOk = BudgetFormatters.parseAmount(form.percent) != nil
        return nameOk && percentOk
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = "Name and percent are required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save allocation."
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
