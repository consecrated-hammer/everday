import SwiftUI

struct ShoppingView: View {
    @State private var items: [ShoppingItem] = []
    @State private var selectedIds: Set<Int> = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var searchTerm = ""
    @State private var showForm = false
    @State private var editingItem: ShoppingItem?
    @State private var deleteTarget: ShoppingItem?
    @State private var showDeleteConfirm = false
    @State private var showRemoveSelectedConfirm = false

    private let householdId = ShoppingConfig.householdId()

    var body: some View {
        ShoppingContent(
            items: $items,
            selectedIds: $selectedIds,
            status: $status,
            errorMessage: $errorMessage,
            searchTerm: $searchTerm,
            showForm: $showForm,
            editingItem: $editingItem,
            deleteTarget: $deleteTarget,
            showDeleteConfirm: $showDeleteConfirm,
            showRemoveSelectedConfirm: $showRemoveSelectedConfirm,
            onSave: saveItem,
            onDelete: deleteItem,
            onRemoveSelected: removeSelected,
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
        if let editingItem {
            _ = try await ShoppingApi.updateItem(
                itemId: editingItem.Id,
                householdId: householdId,
                request: ShoppingItemUpdate(Item: text)
            )
        } else {
            _ = try await ShoppingApi.createItem(
                ShoppingItemCreate(HouseholdId: householdId, Item: text)
            )
        }
        items = try await ShoppingApi.fetchItems(householdId: householdId)
        status = .ready
    }

    private func deleteItem(_ item: ShoppingItem) async {
        deleteTarget = nil
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

    private func removeSelected() async {
        guard !selectedIds.isEmpty else { return }
        do {
            status = .saving
            errorMessage = ""
            for itemId in selectedIds {
                try await ShoppingApi.deleteItem(itemId: itemId, householdId: householdId)
            }
            selectedIds.removeAll()
            items = try await ShoppingApi.fetchItems(householdId: householdId)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to remove selected items."
        }
    }
}

private struct ShoppingContent: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.editMode) private var editMode

    @Binding var items: [ShoppingItem]
    @Binding var selectedIds: Set<Int>
    @Binding var status: LoadState
    @Binding var errorMessage: String
    @Binding var searchTerm: String
    @Binding var showForm: Bool
    @Binding var editingItem: ShoppingItem?
    @Binding var deleteTarget: ShoppingItem?
    @Binding var showDeleteConfirm: Bool
    @Binding var showRemoveSelectedConfirm: Bool

    let onSave: (String) async throws -> Void
    let onDelete: (ShoppingItem) async -> Void
    let onRemoveSelected: () async -> Void
    let onLoad: () async -> Void

    var body: some View {
        listContainer
            .modifier(
                ShoppingChromeModifier(
                    items: $items,
                    selectedIds: $selectedIds,
                    status: $status,
                    errorMessage: $errorMessage,
                    showForm: $showForm,
                    editingItem: $editingItem,
                    deleteTarget: $deleteTarget,
                    showDeleteConfirm: $showDeleteConfirm,
                    showRemoveSelectedConfirm: $showRemoveSelectedConfirm,
                    onSave: onSave,
                    onDelete: onDelete,
                    onRemoveSelected: onRemoveSelected,
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
        List(selection: $selectedIds) {
            headerSection
            itemsSection
            errorSection
        }
        .listStyle(.insetGrouped)
        .searchable(text: $searchTerm)
    }

    private var headerSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("Shopping list")
                    .font(.title2.bold())
                Text("Track shared groceries and household items.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))

            Text("Zebra helper examples:")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            Text("\"Alexa, ask zebra helper to add milk\"\n\"Alexa, ask zebra helper to remove milk\"\n\"Alexa, ask zebra helper to clear the list\"")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var itemsSection: some View {
        Section {
            if status == .loading {
                ProgressView("Loading shopping list...")
            } else if filteredItems.isEmpty {
                Text(items.isEmpty ? "No items yet." : "No results.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(filteredItems) { item in
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

    private var filteredItems: [ShoppingItem] {
        let query = searchTerm.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if query.isEmpty { return items }
        return items.filter { item in
            item.Item.lowercased().contains(query) ||
            (item.AddedByName ?? "-").lowercased().contains(query)
        }
    }

    private var hasSelectedItems: Bool {
        !selectedIds.isEmpty
    }

    @ViewBuilder
    private func shoppingRow(_ item: ShoppingItem) -> some View {
        if isEditing {
            ShoppingRowContent(item: item)
        } else {
            Button {
                editingItem = item
                showForm = true
            } label: {
                ShoppingRowContent(item: item)
            }
            .buttonStyle(.plain)
            .swipeActions {
                Button(role: .destructive) {
                    deleteTarget = item
                    showDeleteConfirm = true
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }

    private var isEditing: Bool {
        editMode?.wrappedValue.isEditing == true
    }
}

private struct ShoppingChromeModifier: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @Binding var items: [ShoppingItem]
    @Binding var selectedIds: Set<Int>
    @Binding var status: LoadState
    @Binding var errorMessage: String
    @Binding var showForm: Bool
    @Binding var editingItem: ShoppingItem?
    @Binding var deleteTarget: ShoppingItem?
    @Binding var showDeleteConfirm: Bool
    @Binding var showRemoveSelectedConfirm: Bool

    let onSave: (String) async throws -> Void
    let onDelete: (ShoppingItem) async -> Void
    let onRemoveSelected: () async -> Void
    let onLoad: () async -> Void

    func body(content: Content) -> some View {
        content
            .navigationTitle("Shopping")
            .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
            .toolbar { toolbarContent }
            .sheet(isPresented: $showForm) { editSheet }
            .alert("Delete item", isPresented: $showDeleteConfirm) { deleteAlertButtons } message: {
                Text("This will remove the item from the list.")
            }
            .alert("Remove selected", isPresented: $showRemoveSelectedConfirm) { removeSelectedAlertButtons } message: {
                Text("Remove the selected items from the list?")
            }
            .onChange(of: items.map { $0.Id }) { _, _ in
                let available = Set(items.map { $0.Id })
                selectedIds = selectedIds.filter { available.contains($0) }
            }
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
        ToolbarItem(placement: .topBarLeading) {
            EditButton()
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button("Add") {
                editingItem = nil
                showForm = true
            }
        }
        if hasSelectedItems {
            ToolbarItem(placement: .bottomBar) {
                Button("Remove selected") {
                    showRemoveSelectedConfirm = true
                }
                .foregroundStyle(.red)
            }
        }
    }

    private var editSheet: some View {
        ShoppingItemForm(
            item: editingItem,
            onSave: { text in
                try await onSave(text)
            }
        )
    }

    private var deleteAlertButtons: some View {
        Group {
            Button("Delete", role: .destructive) {
                if let target = deleteTarget {
                    Task { await onDelete(target) }
                }
            }
            Button("Cancel", role: .cancel) {
                deleteTarget = nil
            }
        }
    }

    private var removeSelectedAlertButtons: some View {
        Group {
            Button("Remove", role: .destructive) {
                Task { await onRemoveSelected() }
            }
            Button("Cancel", role: .cancel) { }
        }
    }

    private var hasSelectedItems: Bool {
        !selectedIds.isEmpty
    }
}

private struct ShoppingRowContent: View {
    let item: ShoppingItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.Item)
                .font(.headline)
            HStack(spacing: 8) {
                Text(item.AddedByName ?? "-")
                Text("|")
                Text(ShoppingFormatters.formatDateTime(item.CreatedAt))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
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
