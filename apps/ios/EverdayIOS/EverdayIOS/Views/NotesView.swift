import SwiftUI

struct NotesView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject private var authStore: AuthStore

    @State private var scope: NotesScope = .personal
    @State private var notes: [NoteResponse] = []
    @State private var shareUsers: [NoteShareUser] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var searchTerm = ""
    @State private var sortBy: NotesSort = .updated
    @State private var showArchived = false

    @State private var showForm = false
    @State private var editingNote: NoteResponse?
    @State private var deleteTarget: NoteResponse?
    @State private var showDeleteConfirm = false

    var body: some View {
        let scroll = ScrollView {
            contentView
        }
        .refreshable {
            await loadNotes()
        }

        let base = scroll
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
            .toolbar {
                if horizontalSizeClass == .regular {
                    ToolbarItem(placement: .principal) {
                        ConstrainedTitleView(title: "Notes")
                    }
                }
            }

        let sheets = base
            .sheet(isPresented: $showForm) {
                NoteFormSheet(
                    initialState: NoteFormState(note: editingNote, scope: scope),
                    shareUsers: filteredShareUsers,
                    onSave: { form in
                        try await saveNote(form)
                    },
                    onDelete: editingNote == nil ? nil : {
                        if let target = editingNote {
                            await deleteNote(target)
                        }
                    }
                )
            }
            .alert("Delete note", isPresented: $showDeleteConfirm) {
                Button("Delete", role: .destructive) {
                    if let target = deleteTarget {
                        Task { await deleteNote(target) }
                    }
                }
                Button("Cancel", role: .cancel) { deleteTarget = nil }
            } message: {
                Text("This will permanently remove the note.")
            }

        let tasks = sheets
            .task {
                if status == .idle {
                    await loadNotes()
                    await loadShareUsers()
                }
            }
            .onChange(of: scope) { _, _ in
                Task { await loadNotes() }
            }
            .onChange(of: showArchived) { _, _ in
                Task { await loadNotes() }
            }

        return AnyView(tasks)
    }

    private var contentView: AnyView {
        AnyView(contentBody)
    }

    @ViewBuilder
    private var contentBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            headerSection
            filterSection
            statusSection
            notesSection
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Notes")
                        .font(.title2.bold())
                    Text("Capture personal, family, and shared notes.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("New note") {
                    openNewForm()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Scope", selection: $scope) {
                ForEach(NotesScope.allCases) { scope in
                    Text(scope.label).tag(scope)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search notes", text: $searchTerm)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(.secondarySystemBackground))
                )

                Menu {
                    Picker("Sort", selection: $sortBy) {
                        ForEach(NotesSort.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                } label: {
                    Label("Sort", systemImage: "arrow.up.arrow.down")
                        .labelStyle(.iconOnly)
                        .frame(width: 36, height: 36)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(.secondarySystemBackground))
                        )
                }
            }

            Toggle("Show archived", isOn: $showArchived)
        }
    }

    @ViewBuilder
    private var statusSection: some View {
        if status == .loading {
            ProgressView("Loading notes...")
                .frame(maxWidth: .infinity, alignment: .center)
        }
        if !errorMessage.isEmpty {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private var notesSection: some View {
        if status != .loading {
            if filteredNotes.isEmpty {
                Text("No notes match this view.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 16) {
                    if !pinnedNotes.isEmpty {
                        NotesSectionView(
                            title: "Pinned",
                            notes: pinnedNotes,
                            onEdit: { openEditForm($0) },
                            onTogglePin: { note in Task { await togglePin(note) } },
                            onArchive: { note in Task { await toggleArchive(note) } },
                            onDelete: { confirmDelete($0) }
                        )
                    }
                    if !regularNotes.isEmpty {
                        NotesSectionView(
                            title: "Notes",
                            notes: regularNotes,
                            onEdit: { openEditForm($0) },
                            onTogglePin: { note in Task { await togglePin(note) } },
                            onArchive: { note in Task { await toggleArchive(note) } },
                            onDelete: { confirmDelete($0) }
                        )
                    }
                }
            }
        }
    }

    private var filteredNotes: [NoteResponse] {
        let query = searchTerm.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let base = notes.filter { note in
            if query.isEmpty {
                return true
            }
            let title = note.Title.lowercased()
            let content = NotesFormatters.extractPlainText(note.Content).lowercased()
            let items = note.Items.map { $0.Text }.joined(separator: " ").lowercased()
            return title.contains(query) || content.contains(query) || items.contains(query)
        }
        return sortNotes(base)
    }

    private func sortNotes(_ notes: [NoteResponse]) -> [NoteResponse] {
        switch sortBy {
        case .title:
            return notes.sorted { $0.Title.localizedCaseInsensitiveCompare($1.Title) == .orderedAscending }
        case .created:
            return notes.sorted {
                (NotesFormatters.parseDateTime($0.CreatedAt) ?? Date.distantPast) >
                (NotesFormatters.parseDateTime($1.CreatedAt) ?? Date.distantPast)
            }
        case .updated:
            return notes.sorted {
                (NotesFormatters.parseDateTime($0.UpdatedAt) ?? Date.distantPast) >
                (NotesFormatters.parseDateTime($1.UpdatedAt) ?? Date.distantPast)
            }
        }
    }

    private var pinnedNotes: [NoteResponse] {
        filteredNotes.filter { $0.IsPinned }
    }

    private var regularNotes: [NoteResponse] {
        filteredNotes.filter { !$0.IsPinned }
    }

    private var filteredShareUsers: [NoteShareUser] {
        guard let username = authStore.tokens?.username else {
            return shareUsers
        }
        return shareUsers.filter { $0.Username.lowercased() != username.lowercased() }
    }

    private func loadNotes() async {
        status = .loading
        errorMessage = ""
        do {
            notes = try await NotesApi.fetchNotes(scope: scope, archived: showArchived)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load notes."
        }
    }

    private func loadShareUsers() async {
        do {
            shareUsers = try await NotesApi.fetchShareUsers()
        } catch {
            shareUsers = []
        }
    }

    private func openNewForm() {
        editingNote = nil
        showForm = true
    }

    private func openEditForm(_ note: NoteResponse) {
        editingNote = note
        showForm = true
    }

    private func confirmDelete(_ note: NoteResponse) {
        deleteTarget = note
        showDeleteConfirm = true
    }

    private func saveNote(_ form: NoteFormState) async throws {
        let trimmedTitle = form.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedTitle.isEmpty {
            throw ApiError(message: "Title is required.")
        }

        if form.scope == .shared && form.shareUserIds.isEmpty {
            throw ApiError(message: "Choose who to share this note with.")
        }

        let cleanTags = form.tags
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !$0.hasPrefix("everday:") }
        let uniqueTags = Array(Set(cleanTags)).sorted()

        let existingSystemLabels = editingNote?.Labels.filter { $0.hasPrefix("everday:") } ?? []
        var labels = NotesFormatters.applyScope(existingSystemLabels, scope: form.scope)
        labels.append(contentsOf: uniqueTags)

        let filteredItems = form.items.compactMap { item -> NoteChecklistItemState? in
            let trimmed = item.text.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return nil }
            return NoteChecklistItemState(existingId: item.existingId, text: trimmed, isChecked: item.isChecked)
        }

        let items = filteredItems.enumerated().map { index, item in
            NoteItemUpdate(
                Id: item.existingId,
                Text: item.text,
                Checked: item.isChecked,
                OrderIndex: index
            )
        }

        if let editingNote {
            let payload = NoteUpdate(
                Title: trimmedTitle,
                Content: form.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.content,
                Labels: labels,
                IsPinned: form.isPinned,
                Items: items,
                SharedUserIds: form.scope == .shared ? form.shareUserIds : []
            )
            _ = try await NotesApi.updateNote(noteId: editingNote.Id, payload: payload)
        } else {
            let createItems = items.map { NoteItemCreate(Text: $0.Text, Checked: $0.Checked, OrderIndex: $0.OrderIndex) }
            let payload = NoteCreate(
                Title: trimmedTitle,
                Content: form.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.content,
                Labels: labels,
                IsPinned: form.isPinned,
                Items: createItems,
                SharedUserIds: form.scope == .shared ? form.shareUserIds : []
            )
            _ = try await NotesApi.createNote(payload)
        }
        await loadNotes()
    }

    private func deleteNote(_ note: NoteResponse) async {
        deleteTarget = nil
        do {
            try await NotesApi.deleteNote(noteId: note.Id)
            if editingNote?.Id == note.Id {
                editingNote = nil
                showForm = false
            }
            await loadNotes()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete note."
        }
    }

    private func togglePin(_ note: NoteResponse) async {
        do {
            _ = try await NotesApi.togglePin(noteId: note.Id)
            await loadNotes()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to update pin."
        }
    }

    private func toggleArchive(_ note: NoteResponse) async {
        do {
            if note.ArchivedAt == nil {
                _ = try await NotesApi.archive(noteId: note.Id)
            } else {
                _ = try await NotesApi.unarchive(noteId: note.Id)
            }
            await loadNotes()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to update archive state."
        }
    }
}

private struct NotesSectionView: View {
    let title: String
    let notes: [NoteResponse]
    let onEdit: (NoteResponse) -> Void
    let onTogglePin: (NoteResponse) -> Void
    let onArchive: (NoteResponse) -> Void
    let onDelete: (NoteResponse) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
            VStack(spacing: 12) {
                ForEach(notes) { note in
                    NoteCardView(
                        note: note,
                        onEdit: { onEdit(note) },
                        onTogglePin: { onTogglePin(note) },
                        onArchive: { onArchive(note) },
                        onDelete: { onDelete(note) }
                    )
                }
            }
        }
    }
}

private struct NoteCardView: View {
    let note: NoteResponse
    let onEdit: () -> Void
    let onTogglePin: () -> Void
    let onArchive: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(note.Title)
                        .font(.headline)
                    Text(metaLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Menu {
                    Button("Edit") { onEdit() }
                    Button(note.IsPinned ? "Unpin" : "Pin") { onTogglePin() }
                    Button(note.ArchivedAt == nil ? "Archive" : "Unarchive") { onArchive() }
                    Button("Delete", role: .destructive) { onDelete() }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                }
            }

            if !excerpt.isEmpty {
                Text(excerpt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if !tags.isEmpty {
                TagsWrapView(tags: tags)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
        .onTapGesture {
            onEdit()
        }
    }

    private var metaLine: String {
        let updated = NotesFormatters.formatDateTime(note.UpdatedAt)
        let scope = NotesFormatters.scope(from: note.Labels).label
        return "Updated \(updated) | \(scope)"
    }

    private var excerpt: String {
        let content = NotesFormatters.extractPlainText(note.Content)
        if !content.isEmpty {
            return String(content.prefix(140))
        }
        if !note.Items.isEmpty {
            let items = note.Items.map { "\($0.Checked ? "[x]" : "[ ]") \($0.Text)" }
            let joined = items.joined(separator: ", ")
            return String(joined.prefix(140))
        }
        return "Empty note"
    }

    private var tags: [String] {
        let scope = NotesFormatters.scope(from: note.Labels)
        let userTags = NotesFormatters.userTags(from: note.Labels)
        var chips: [String] = []
        if scope == .family {
            chips.append("Family")
        } else if scope == .shared {
            chips.append("Shared")
        }
        chips.append(contentsOf: userTags)
        return chips
    }
}

private struct TagsWrapView: View {
    let tags: [String]

    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 80), spacing: 8)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color(.tertiarySystemFill))
                    )
            }
        }
    }
}

private struct NoteFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initialState: NoteFormState
    let shareUsers: [NoteShareUser]
    let onSave: (NoteFormState) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var form: NoteFormState
    @State private var tagInput = ""
    @State private var newItemText = ""
    @State private var isSaving = false
    @State private var errorMessage = ""

    init(
        initialState: NoteFormState,
        shareUsers: [NoteShareUser],
        onSave: @escaping (NoteFormState) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.initialState = initialState
        self.shareUsers = shareUsers
        self.onSave = onSave
        self.onDelete = onDelete
        _form = State(initialValue: initialState)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $form.title)
                    TextEditor(text: $form.content)
                        .frame(minHeight: 140)
                    Toggle("Pin note", isOn: $form.isPinned)
                }

                Section("Checklist") {
                    if form.items.isEmpty {
                        Text("No checklist items yet.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach($form.items) { $item in
                            HStack(alignment: .center, spacing: 8) {
                                Button {
                                    item.isChecked.toggle()
                                } label: {
                                    Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(item.isChecked ? Color.accentColor : .secondary)
                                }
                                .buttonStyle(.plain)

                                TextField("Checklist item", text: $item.text)

                                Button(role: .destructive) {
                                    removeItem(item)
                                } label: {
                                    Image(systemName: "trash")
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    HStack {
                        TextField("New item", text: $newItemText)
                        Button("Add") { addItem() }
                            .disabled(newItemText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }

                Section("Tags") {
                    HStack {
                        TextField("Add tag", text: $tagInput)
                        Button("Add") { addTag() }
                            .disabled(tagInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    if !form.tags.isEmpty {
                        let columns = [GridItem(.adaptive(minimum: 80), spacing: 8)]
                        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                            ForEach(form.tags, id: \.self) { tag in
                                Button {
                                    removeTag(tag)
                                } label: {
                                    HStack(spacing: 6) {
                                        Text(tag)
                                        Image(systemName: "xmark")
                                            .font(.caption2.weight(.semibold))
                                    }
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(
                                        Capsule(style: .continuous)
                                            .fill(Color(.tertiarySystemFill))
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                Section("Scope") {
                    Picker("Scope", selection: $form.scope) {
                        ForEach(NotesScope.allCases) { scope in
                            Text(scope.label).tag(scope)
                        }
                    }
                    .pickerStyle(.segmented)

                    if form.scope == .shared {
                        if shareUsers.isEmpty {
                            Text("No other users available.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(shareUsers) { user in
                                ShareUserRow(
                                    user: user,
                                    isSelected: form.shareUserIds.contains(user.Id),
                                    onToggle: { toggleShareUser(user.Id) }
                                )
                            }
                        }
                    }

                    if form.scope == .family {
                        Text("Family notes are visible to parents.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
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
                        Button("Delete note", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initialState.isEditing ? "Edit note" : "New note")
            .onChange(of: form.scope) { _, newValue in
                if newValue != .shared {
                    form.shareUserIds = []
                }
            }
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

    private func addTag() {
        let trimmed = tagInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasPrefix("everday:") else { return }
        if !form.tags.contains(trimmed) {
            form.tags.append(trimmed)
        }
        tagInput = ""
    }

    private func removeTag(_ tag: String) {
        form.tags.removeAll { $0 == tag }
    }

    private func addItem() {
        let trimmed = newItemText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        form.items.append(NoteChecklistItemState(existingId: nil, text: trimmed, isChecked: false))
        newItemText = ""
    }

    private func removeItem(_ item: NoteChecklistItemState) {
        form.items.removeAll { $0.id == item.id }
    }

    private func toggleShareUser(_ userId: Int) {
        if form.shareUserIds.contains(userId) {
            form.shareUserIds.removeAll { $0 == userId }
        } else {
            form.shareUserIds.append(userId)
        }
    }

    private var isDirty: Bool {
        form != initialState
    }

    private var isValid: Bool {
        if form.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return false
        }
        if form.scope == .shared {
            return !form.shareUserIds.isEmpty
        }
        return true
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = form.scope == .shared
                ? "Choose who to share this note with."
                : "Title is required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save note."
        }
        isSaving = false
    }
}

private struct ShareUserRow: View {
    let user: NoteShareUser
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack {
                Text(user.displayName)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }
}

private struct NoteChecklistItemState: Identifiable, Equatable {
    let id: UUID
    var existingId: Int?
    var text: String
    var isChecked: Bool

    init(existingId: Int?, text: String, isChecked: Bool) {
        self.id = UUID()
        self.existingId = existingId
        self.text = text
        self.isChecked = isChecked
    }

    static func == (lhs: NoteChecklistItemState, rhs: NoteChecklistItemState) -> Bool {
        lhs.existingId == rhs.existingId &&
        lhs.text == rhs.text &&
        lhs.isChecked == rhs.isChecked
    }
}

private struct NoteFormState: Equatable {
    var title: String
    var content: String
    var tags: [String]
    var isPinned: Bool
    var items: [NoteChecklistItemState]
    var scope: NotesScope
    var shareUserIds: [Int]
    var isEditing: Bool

    init(note: NoteResponse?, scope: NotesScope) {
        if let note {
            title = note.Title
            content = note.Content ?? ""
            tags = NotesFormatters.userTags(from: note.Labels)
            isPinned = note.IsPinned
            items = note.Items.map { NoteChecklistItemState(existingId: $0.Id, text: $0.Text, isChecked: $0.Checked) }
            self.scope = NotesFormatters.scope(from: note.Labels)
            shareUserIds = note.Tags
            isEditing = true
        } else {
            title = ""
            content = ""
            tags = []
            isPinned = false
            items = []
            self.scope = scope
            shareUserIds = []
            isEditing = false
        }
    }

    static func == (lhs: NoteFormState, rhs: NoteFormState) -> Bool {
        lhs.title == rhs.title &&
        lhs.content == rhs.content &&
        lhs.tags == rhs.tags &&
        lhs.isPinned == rhs.isPinned &&
        lhs.items == rhs.items &&
        lhs.scope == rhs.scope &&
        lhs.shareUserIds == rhs.shareUserIds
    }
}

private enum NotesSort: String, CaseIterable, Identifiable {
    case updated
    case created
    case title

    var id: String { rawValue }

    var label: String {
        switch self {
        case .updated:
            return "Recently updated"
        case .created:
            return "Created"
        case .title:
            return "Title"
        }
    }
}

private enum LoadState {
    case idle
    case loading
    case saving
    case ready
    case error
}
