import SwiftUI

struct ShoppingView: View {
    @State private var items: [ShoppingItem] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var showForm = false

    private let householdId = ShoppingConfig.householdId()

    var body: some View {
        ShoppingContent(
            items: $items,
            status: $status,
            errorMessage: $errorMessage,
            showForm: $showForm,
            onSave: saveItem,
            onDelete: deleteItem,
            onLoad: load
        )
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            items = try await ShoppingApi.fetchItems(householdId: householdId)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load shopping list."
        }
    }

    private func saveItem(_ text: String) async throws {
        status = .saving
        errorMessage = ""
        _ = try await ShoppingApi.createItem(
            ShoppingItemCreate(HouseholdId: householdId, Item: text)
        )
        items = try await ShoppingApi.fetchItems(householdId: householdId)
        status = .ready
    }

    private func deleteItem(_ item: ShoppingItem) async {
        do {
            status = .saving
            errorMessage = ""
            try await ShoppingApi.deleteItem(itemId: item.Id, householdId: householdId)
            items = try await ShoppingApi.fetchItems(householdId: householdId)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete item."
        }
    }
}

private struct ShoppingContent: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var completingIds: Set<Int> = []

    @Binding var items: [ShoppingItem]
    @Binding var status: LoadState
    @Binding var errorMessage: String
    @Binding var showForm: Bool

    let onSave: (String) async throws -> Void
    let onDelete: (ShoppingItem) async -> Void
    let onLoad: () async -> Void

    var body: some View {
        listContainer
            .modifier(
                ShoppingChromeModifier(
                    items: $items,
                    status: $status,
                    errorMessage: $errorMessage,
                    showForm: $showForm,
                    onSave: onSave,
                    onLoad: onLoad
                )
            )
    }

    private var listContainer: some View {
        Group {
            if horizontalSizeClass == .regular {
                listView
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
            } else {
                listView
            }
        }
    }

    private var listView: some View {
        List {
            headerSection
            itemsSection
            errorSection
        }
        .listStyle(.insetGrouped)
    }

    private var headerSection: some View {
        Section {
            Button {
                showForm = true
            } label: {
                Label("Add item", systemImage: "plus.circle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .buttonStyle(.borderedProminent)

            Text(
                """
                Zebra helper examples:
                "Alexa, ask zebra helper to add milk"
                "Alexa, ask zebra helper to remove milk"
                "Alexa, ask zebra helper to clear the list"
                """
            )
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var itemsSection: some View {
        Section {
            if status == .loading {
                ProgressView("Loading shopping list...")
            } else if items.isEmpty {
                Text("No items yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(items) { item in
                    shoppingRow(item)
                }
            }
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if !errorMessage.isEmpty {
            Section {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    @ViewBuilder
    private func shoppingRow(_ item: ShoppingItem) -> some View {
        let isCompleting = completingIds.contains(item.Id)
        HStack(spacing: 12) {
            Button {
                Task { await completeItem(item) }
            } label: {
                Image(systemName: isCompleting ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isCompleting ? .green : .secondary)
                    .scaleEffect(isCompleting ? 1.06 : 1.0)
                    .animation(.spring(response: 0.25, dampingFraction: 0.8), value: isCompleting)
            }
            .buttonStyle(.plain)
            .disabled(isCompleting)

            ShoppingRowContent(item: item, isCompleting: isCompleting)
        }
    }

    private func completeItem(_ item: ShoppingItem) async {
        guard !completingIds.contains(item.Id) else { return }
        withAnimation(.easeOut(duration: 0.16)) {
            _ = completingIds.insert(item.Id)
        }
        try? await Task.sleep(nanoseconds: 320_000_000)
        await onDelete(item)
        withAnimation(.easeOut(duration: 0.2)) {
            _ = completingIds.remove(item.Id)
        }
    }
}

private struct ShoppingChromeModifier: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @Binding var items: [ShoppingItem]
    @Binding var status: LoadState
    @Binding var errorMessage: String
    @Binding var showForm: Bool

    let onSave: (String) async throws -> Void
    let onLoad: () async -> Void

    func body(content: Content) -> some View {
        content
            .navigationTitle("Shopping")
            .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
            .toolbar { toolbarContent }
            .sheet(isPresented: $showForm) { editSheet }
            .task {
                if status == .idle {
                    await onLoad()
                }
            }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if horizontalSizeClass == .regular {
            ToolbarItem(placement: .principal) {
                ConstrainedTitleView(title: "Shopping")
            }
        }
    }

    private var editSheet: some View {
        ShoppingItemForm(
            item: nil,
            onSave: { text in
                try await onSave(text)
            }
        )
    }
}

private struct ShoppingRowContent: View {
    let item: ShoppingItem
    var isCompleting: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.Item)
                .font(.headline)
                .strikethrough(isCompleting, color: .secondary)
            HStack(spacing: 8) {
                Text(item.AddedByName ?? "-")
                Text("|")
                Text(ShoppingFormatters.formatDateTime(item.CreatedAt))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
        .opacity(isCompleting ? 0.55 : 1.0)
        .animation(.easeOut(duration: 0.16), value: isCompleting)
    }
}

private struct ShoppingItemForm: View {
    @Environment(\.dismiss) private var dismiss
    let item: ShoppingItem?
    let onSave: (String) async throws -> Void

    @State private var itemText: String
    @State private var isSaving = false
    @State private var errorMessage = ""

    init(item: ShoppingItem?, onSave: @escaping (String) async throws -> Void) {
        self.item = item
        self.onSave = onSave
        _itemText = State(initialValue: item?.Item ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    TextField("Shopping item", text: $itemText)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(item == nil ? "Add item" : "Edit item")
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
        itemText.trimmingCharacters(in: .whitespacesAndNewlines) != (item?.Item ?? "")
    }

    private var isValid: Bool {
        !itemText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        isSaving = true
        errorMessage = ""
        do {
            try await onSave(itemText.trimmingCharacters(in: .whitespacesAndNewlines))
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save item."
        }
        isSaving = false
    }
}

private enum LoadState {
    case idle
    case loading
    case saving
    case ready
    case error
}
