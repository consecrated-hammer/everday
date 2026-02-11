import SwiftUI

struct BudgetIncomeView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var streams: [IncomeStream] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var showForm = false
    @State private var editingStream: IncomeStream?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                mainContent

                if status == .loading {
                    BudgetEmptyState(message: "Loading income streams...")
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
            IncomeStreamFormSheet(
                initialState: IncomeFormState(stream: editingStream),
                onSave: { form in
                    try await save(form)
                },
                onDelete: editingStream == nil ? nil : {
                    if let stream = editingStream {
                        await delete(stream)
                    }
                }
            )
        }
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Income")
                    .font(.title2.bold())
                Text("Track shared income sources and schedules.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Add") {
                editingStream = nil
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
                    summarySection
                }
                .frame(maxWidth: 420, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 16) {
                    streamsSection
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            summarySection
            streamsSection
        }
    }

    private var summarySection: some View {
        let totals = BudgetFormatters.buildTotals(incomeStreams: streams, expenses: [])
        return BudgetSectionCard {
            BudgetSectionHeader(title: "Income snapshot", subtitle: "Net and gross totals.")
            let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
            LazyVGrid(columns: columns, spacing: 12) {
                BudgetMetricTile(title: "Net per fortnight", value: BudgetFormatters.formatCurrency(totals.Income.PerFortnight), detail: nil)
                BudgetMetricTile(title: "Net per month", value: BudgetFormatters.formatCurrency(totals.Income.PerMonth), detail: nil)
                BudgetMetricTile(title: "Gross per fortnight", value: BudgetFormatters.formatCurrency(totalGrossPerFortnight), detail: nil)
                BudgetMetricTile(title: "Gross per month", value: BudgetFormatters.formatCurrency(totalGrossPerMonth), detail: nil)
            }
        }
    }

    private var streamsSection: some View {
        BudgetSectionCard {
            BudgetSectionHeader(title: "Income streams", subtitle: "Tap a stream to edit.")
            if streams.isEmpty {
                BudgetEmptyState(message: "No income streams yet.")
            } else {
                VStack(spacing: 12) {
                    ForEach(streams) { stream in
                        IncomeStreamCard(
                            stream: stream,
                            onEdit: {
                                editingStream = stream
                                showForm = true
                            },
                            onDelete: {
                                Task { await delete(stream) }
                            }
                        )
                    }
                }
            }
        }
    }

    private var totalGrossPerFortnight: Double {
        streams.reduce(0) { $0 + ($1.GrossPerFortnight ?? 0) }
    }

    private var totalGrossPerMonth: Double {
        streams.reduce(0) { $0 + ($1.GrossPerMonth ?? 0) }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            streams = try await BudgetApi.fetchIncomeStreams()
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load income streams."
        }
    }

    private func save(_ form: IncomeFormState) async throws {
        let trimmedLabel = form.label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedLabel.isEmpty else {
            throw ApiError(message: "Label is required.")
        }
        guard let netAmount = BudgetFormatters.parseAmount(form.netAmount), netAmount > 0 else {
            throw ApiError(message: "Net amount is required.")
        }
        guard let grossAmount = BudgetFormatters.parseAmount(form.grossAmount), grossAmount > 0 else {
            throw ApiError(message: "Gross amount is required.")
        }
        let payload = IncomeStreamCreate(
            Label: trimmedLabel,
            NetAmount: netAmount,
            GrossAmount: grossAmount,
            FirstPayDate: BudgetFormatters.formatDate(form.firstPayDate),
            Frequency: form.frequency,
            EndDate: form.hasEndDate ? BudgetFormatters.formatDate(form.endDate) : nil,
            Notes: form.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.notes
        )

        if let editingStream {
            _ = try await BudgetApi.updateIncomeStream(
                id: editingStream.Id,
                payload: IncomeStreamUpdate(
                    Label: payload.Label,
                    NetAmount: payload.NetAmount,
                    GrossAmount: payload.GrossAmount,
                    FirstPayDate: payload.FirstPayDate,
                    Frequency: payload.Frequency,
                    EndDate: payload.EndDate,
                    Notes: payload.Notes
                )
            )
        } else {
            _ = try await BudgetApi.createIncomeStream(payload)
        }
        await load()
    }

    private func delete(_ stream: IncomeStream) async {
        do {
            try await BudgetApi.deleteIncomeStream(id: stream.Id)
            await load()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete income stream."
        }
    }
}

private struct IncomeStreamCard: View {
    let stream: IncomeStream
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(stream.Label)
                        .font(.headline)
                    Text(stream.Frequency)
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
                BudgetMetricTile(title: "Net", value: BudgetFormatters.formatCurrency(stream.NetAmount), detail: nil)
                BudgetMetricTile(title: "Gross", value: BudgetFormatters.formatCurrency(stream.GrossAmount), detail: nil)
            }

            HStack(spacing: 12) {
                Text("Next pay: \(BudgetFormatters.displayDate(stream.NextPayDate))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let endDate = stream.EndDate, !endDate.isEmpty {
                    Text("Ends: \(BudgetFormatters.displayDate(endDate))")
                        .font(.caption)
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

private struct IncomeFormState: Equatable {
    var label: String
    var netAmount: String
    var grossAmount: String
    var firstPayDate: Date
    var frequency: String
    var hasEndDate: Bool
    var endDate: Date
    var notes: String
    var isEditing: Bool

    init(stream: IncomeStream?) {
        if let stream {
            label = stream.Label
            netAmount = String(stream.NetAmount)
            grossAmount = String(stream.GrossAmount)
            firstPayDate = BudgetFormatters.parseDate(stream.FirstPayDate) ?? Date()
            frequency = stream.Frequency
            if let end = stream.EndDate, let parsed = BudgetFormatters.parseDate(end) {
                hasEndDate = true
                endDate = parsed
            } else {
                hasEndDate = false
                endDate = Date()
            }
            notes = stream.Notes ?? ""
            isEditing = true
        } else {
            label = ""
            netAmount = ""
            grossAmount = ""
            firstPayDate = Date()
            frequency = "Monthly"
            hasEndDate = false
            endDate = Date()
            notes = ""
            isEditing = false
        }
    }
}

private struct IncomeStreamFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initialState: IncomeFormState
    let onSave: (IncomeFormState) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var form: IncomeFormState
    @State private var isSaving = false
    @State private var errorMessage = ""

    private let frequencyOptions = [
        "Weekly",
        "Fortnightly",
        "Monthly",
        "Quarterly",
        "Annually"
    ]

    init(
        initialState: IncomeFormState,
        onSave: @escaping (IncomeFormState) async throws -> Void,
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
                Section("Details") {
                    TextField("Label", text: $form.label)
                    TextField("Net amount", text: $form.netAmount)
                        .keyboardType(.decimalPad)
                    TextField("Gross amount", text: $form.grossAmount)
                        .keyboardType(.decimalPad)
                }

                Section("Schedule") {
                    DatePicker("First pay date", selection: $form.firstPayDate, displayedComponents: [.date])
                    Picker("Frequency", selection: $form.frequency) {
                        ForEach(frequencyOptions, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    Toggle("Has end date", isOn: $form.hasEndDate)
                    if form.hasEndDate {
                        DatePicker("End date", selection: $form.endDate, displayedComponents: [.date])
                    }
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
                        Button("Delete income stream", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(form.isEditing ? "Edit income" : "New income")
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
        let netOk = BudgetFormatters.parseAmount(form.netAmount) != nil
        let grossOk = BudgetFormatters.parseAmount(form.grossAmount) != nil
        return labelOk && netOk && grossOk
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = "Label, net amount, and gross amount are required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save income stream."
        }
        isSaving = false
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case saving
    case error
}
