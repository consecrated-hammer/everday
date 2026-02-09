import SwiftUI
import UniformTypeIdentifiers

struct LifeAdminLibraryView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var folders: [LifeDocumentFolder] = []
    @State private var tags: [LifeDocumentTag] = []
    @State private var documents: [LifeDocument] = []
    @State private var categories: [LifeCategory] = []
    @State private var recordLookup: [Int: [LifeRecordLookup]] = [:]
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var searchTerm = ""
    @State private var activeFolderId: Int? = nil
    @State private var filter: LibraryFilter = .all

    @State private var showUploadSheet = false
    @State private var showFileImporter = false
    @State private var pendingUploadUrl: URL?
    @State private var showFolderForm = false
    @State private var editingFolder: LifeDocumentFolder?

    @State private var selectedDocument: LifeDocument?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                mainContent

                if status == .loading {
                    LifeAdminEmptyState(message: "Loading documents...")
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
        .sheet(isPresented: $showUploadSheet) {
            UploadDocumentSheet(
                folders: folders,
                pendingUrl: pendingUploadUrl,
                onSelectFile: { showFileImporter = true },
                onUpload: { request in
                    try await uploadDocument(request)
                }
            )
        }
        .sheet(isPresented: $showFolderForm) {
            DocumentFolderFormSheet(
                initial: editingFolder,
                onSave: { payload in
                    try await saveFolder(payload)
                },
                onDelete: editingFolder == nil ? nil : {
                    if let folder = editingFolder {
                        await deleteFolder(folder)
                    }
                }
            )
        }
        .sheet(item: $selectedDocument) { document in
            DocumentDetailSheet(
                document: document,
                folders: folders,
                categories: categories,
                recordLookup: recordLookup,
                onReload: { await loadDocuments() },
                onUpdate: { payload in
                    try await updateDocument(documentId: document.Id, payload: payload)
                },
                onAddTags: { tagNames in
                    try await addTags(documentId: document.Id, tagNames: tagNames)
                },
                onRemoveTag: { tagId in
                    try await removeTag(documentId: document.Id, tagId: tagId)
                },
                onCreateLink: { payload in
                    try await createLink(documentId: document.Id, payload: payload)
                },
                onDeleteLink: { linkId in
                    try await deleteLink(documentId: document.Id, linkId: linkId)
                },
                onCreateReminder: { payload in
                    try await createReminder(payload)
                },
                onUpdateReminder: { reminderId, status in
                    try await updateReminder(reminderId: reminderId, status: status)
                },
                onDeleteReminder: { reminderId in
                    try await deleteReminder(reminderId: reminderId)
                },
                onApplyAi: {
                    try await applyAi(documentId: document.Id)
                }
            )
        }
        .fileImporter(
            isPresented: $showFileImporter,
            allowedContentTypes: [.pdf, .image, .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                pendingUploadUrl = urls.first
            case .failure:
                errorMessage = "Failed to open file."
            }
        }
        .onChange(of: searchTerm) { _, _ in
            Task { await loadDocuments() }
        }
        .onChange(of: activeFolderId) { _, _ in
            Task { await loadDocuments() }
        }
        .onChange(of: filter) { _, _ in
            Task { await loadDocuments() }
        }
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Library")
                    .font(.title2.bold())
                Text("Organize documents, tags, and reminders.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                Button("Upload") { showUploadSheet = true }
                    .buttonStyle(.borderedProminent)
                Button("Folders") {
                    editingFolder = nil
                    showFolderForm = true
                }
                .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 16) {
                    folderSection
                    filterSection
                }
                .frame(maxWidth: 380, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 16) {
                    documentsSection
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            folderSection
            filterSection
            documentsSection
        }
    }

    private var folderSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Folders", subtitle: "Filter documents by folder.")
            Picker("Folder", selection: $activeFolderId) {
                Text("All folders").tag(Int?.none)
                ForEach(folders) { folder in
                    Text(folder.Name).tag(Optional(folder.Id))
                }
            }
            .pickerStyle(.menu)

            if !folders.isEmpty {
                VStack(spacing: 8) {
                    ForEach(folders) { folder in
                        HStack {
                            Text(folder.Name)
                                .font(.subheadline)
                            Spacer()
                            Button("Edit") {
                                editingFolder = folder
                                showFolderForm = true
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Filter", selection: $filter) {
                ForEach(LibraryFilter.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search documents", text: $searchTerm)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
        }
    }

    private var documentsSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Documents", subtitle: "Tap a document to see details.")
            if documents.isEmpty {
                LifeAdminEmptyState(message: "No documents yet.")
            } else {
                VStack(spacing: 12) {
                    ForEach(documents) { doc in
                        DocumentCard(document: doc)
                            .onTapGesture {
                                selectedDocument = doc
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
            async let foldersTask = LifeAdminApi.fetchDocumentFolders()
            async let tagsTask = LifeAdminApi.fetchDocumentTags()
            async let categoriesTask = LifeAdminApi.fetchCategories(includeInactive: true)
            let (folderResult, tagResult, categoryResult) = try await (foldersTask, tagsTask, categoriesTask)
            folders = folderResult
            tags = tagResult
            categories = categoryResult
            recordLookup = try await loadRecordLookups(categories: categoryResult)
            await loadDocuments()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load library."
        }
    }

    private func loadDocuments() async {
        status = .loading
        errorMessage = ""
        do {
            let docs = try await LifeAdminApi.fetchDocuments(
                search: searchTerm,
                folderId: activeFolderId,
                tagIds: nil,
                linkedOnly: filter == .linked,
                remindersOnly: filter == .reminders,
                recordId: nil
            )
            documents = docs
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load documents."
        }
    }

    private func loadRecordLookups(categories: [LifeCategory]) async throws -> [Int: [LifeRecordLookup]] {
        var result: [Int: [LifeRecordLookup]] = [:]
        for category in categories {
            result[category.Id] = try await LifeAdminApi.fetchRecordLookup(categoryId: category.Id)
        }
        return result
    }

    private func uploadDocument(_ request: UploadDocumentRequest) async throws {
        guard let fileUrl = request.fileUrl else {
            errorMessage = "Select a file before uploading."
            return
        }
        _ = try await LifeAdminApi.uploadDocument(
            fileUrl: fileUrl,
            title: request.title,
            folderId: request.folderId,
            tagNames: request.tagNames
        )
        pendingUploadUrl = nil
        showUploadSheet = false
        await loadDocuments()
    }

    private func saveFolder(_ payload: LifeDocumentFolderCreate) async throws {
        if let editingFolder {
            _ = try await LifeAdminApi.updateDocumentFolder(id: editingFolder.Id, payload: LifeDocumentFolderUpdate(Name: payload.Name, SortOrder: payload.SortOrder))
        } else {
            _ = try await LifeAdminApi.createDocumentFolder(payload)
        }
        folders = try await LifeAdminApi.fetchDocumentFolders()
        showFolderForm = false
    }

    private func deleteFolder(_ folder: LifeDocumentFolder) async {
        do {
            try await LifeAdminApi.deleteDocumentFolder(id: folder.Id)
            folders = try await LifeAdminApi.fetchDocumentFolders()
            showFolderForm = false
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete folder."
        }
    }

    private func updateDocument(documentId: Int, payload: LifeDocumentUpdate) async throws {
        _ = try await LifeAdminApi.updateDocument(id: documentId, payload: payload)
        await loadDocuments()
    }

    private func addTags(documentId: Int, tagNames: [String]) async throws {
        _ = try await LifeAdminApi.addDocumentTags(id: documentId, tagNames: tagNames)
        await loadDocuments()
    }

    private func removeTag(documentId: Int, tagId: Int) async throws {
        try await LifeAdminApi.removeDocumentTag(documentId: documentId, tagId: tagId)
        await loadDocuments()
    }

    private func createLink(documentId: Int, payload: LifeDocumentLinkCreate) async throws {
        _ = try await LifeAdminApi.createDocumentLink(documentId: documentId, payload: payload)
        await loadDocuments()
    }

    private func deleteLink(documentId: Int, linkId: Int) async throws {
        try await LifeAdminApi.deleteDocumentLink(documentId: documentId, linkId: linkId)
        await loadDocuments()
    }

    private func createReminder(_ payload: LifeReminderCreate) async throws {
        _ = try await LifeAdminApi.createReminder(payload)
        await loadDocuments()
    }

    private func updateReminder(reminderId: Int, status: String) async throws {
        _ = try await LifeAdminApi.updateReminder(id: reminderId, payload: LifeReminderUpdate(Status: status))
        await loadDocuments()
    }

    private func deleteReminder(reminderId: Int) async throws {
        try await LifeAdminApi.deleteReminder(id: reminderId)
        await loadDocuments()
    }

    private func applyAi(documentId: Int) async throws {
        _ = try await LifeAdminApi.applyAiSuggestion(documentId: documentId)
        await loadDocuments()
    }
}

private enum LibraryFilter: String, CaseIterable, Identifiable {
    case all
    case linked
    case reminders

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all:
            return "All"
        case .linked:
            return "Linked"
        case .reminders:
            return "Reminders"
        }
    }
}

private struct DocumentCard: View {
    let document: LifeDocument

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(document.Title ?? document.OriginalFileName ?? "Document \(document.Id)")
                        .font(.headline)
                    Text(document.FolderName ?? "No folder")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(LifeAdminFormatters.displayDateTime(document.UpdatedAt))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if document.ReminderCount > 0 {
                        Text("Reminders: \(document.ReminderCount)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !document.Tags.isEmpty {
                HStack(spacing: 6) {
                    ForEach(document.Tags.prefix(3)) { tag in
                        LifeAdminTagChip(text: tag.Name)
                    }
                    if document.Tags.count > 3 {
                        LifeAdminTagChip(text: "+\(document.Tags.count - 3)")
                    }
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

private struct UploadDocumentRequest {
    var fileUrl: URL?
    var title: String
    var folderId: Int?
    var tagText: String

    var tagNames: [String] {
        tagText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }
}

private struct UploadDocumentSheet: View {
    @Environment(\.dismiss) private var dismiss

    let folders: [LifeDocumentFolder]
    let pendingUrl: URL?
    let onSelectFile: () -> Void
    let onUpload: (UploadDocumentRequest) async throws -> Void

    @State private var form = UploadDocumentRequest(fileUrl: nil, title: "", folderId: nil, tagText: "")
    @State private var errorMessage = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("File") {
                    Button(pendingUrl == nil ? "Select file" : "Change file") {
                        onSelectFile()
                    }
                    if let pendingUrl {
                        Text(pendingUrl.lastPathComponent)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Details") {
                    TextField("Title", text: $form.title)
                    Picker("Folder", selection: $form.folderId) {
                        Text("No folder").tag(Int?.none)
                        ForEach(folders) { folder in
                            Text(folder.Name).tag(Optional(folder.Id))
                        }
                    }
                    TextField("Tags (comma separated)", text: $form.tagText)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Upload")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Uploading..." : "Upload") {
                        Task { await save() }
                    }
                    .disabled(!isDirty || !isValid || isSaving)
                }
            }
            .onChange(of: pendingUrl) { _, newValue in
                form.fileUrl = newValue
            }
        }
    }

    private var isDirty: Bool {
        if form.fileUrl != nil { return true }
        if !form.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        if form.folderId != nil { return true }
        if !form.tagText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        return false
    }

    private var isValid: Bool {
        form.fileUrl != nil
    }

    private func save() async {
        errorMessage = ""
        guard form.fileUrl != nil else {
            errorMessage = "Select a file first."
            return
        }
        isSaving = true
        do {
            try await onUpload(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to upload document."
        }
        isSaving = false
    }
}

private struct DocumentFolderFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: LifeDocumentFolder?
    let onSave: (LifeDocumentFolderCreate) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var name: String
    @State private var sortOrder: String
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(
        initial: LifeDocumentFolder?,
        onSave: @escaping (LifeDocumentFolderCreate) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.initial = initial
        self.onSave = onSave
        self.onDelete = onDelete
        _name = State(initialValue: initial?.Name ?? "")
        _sortOrder = State(initialValue: String(initial?.SortOrder ?? 0))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Folder") {
                    TextField("Name", text: $name)
                    TextField("Sort order", text: $sortOrder)
                        .keyboardType(.numberPad)
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
                        Button("Delete folder", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initial == nil ? "New folder" : "Edit folder")
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
        let initialSort = String(initial?.SortOrder ?? 0)
        return name != initialName || sortOrder != initialSort
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
        do {
            try await onSave(LifeDocumentFolderCreate(Name: trimmed, SortOrder: order))
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save folder."
        }
        isSaving = false
    }
}

private struct DocumentDetailSheet: View {
    @Environment(\.dismiss) private var dismiss

    let document: LifeDocument
    let folders: [LifeDocumentFolder]
    let categories: [LifeCategory]
    let recordLookup: [Int: [LifeRecordLookup]]
    let onReload: () async -> Void
    let onUpdate: (LifeDocumentUpdate) async throws -> Void
    let onAddTags: ([String]) async throws -> Void
    let onRemoveTag: (Int) async throws -> Void
    let onCreateLink: (LifeDocumentLinkCreate) async throws -> Void
    let onDeleteLink: (Int) async throws -> Void
    let onCreateReminder: (LifeReminderCreate) async throws -> Void
    let onUpdateReminder: (Int, String) async throws -> Void
    let onDeleteReminder: (Int) async throws -> Void
    let onApplyAi: () async throws -> Void

    @State private var detail: LifeDocumentDetail?
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    @State private var title: String = ""
    @State private var folderId: Int?
    @State private var newTagText = ""
    @State private var newReminderTitle = ""
    @State private var newReminderDate = Date()
    @State private var newReminderRepeat = ""
    @State private var selectedLinkCategoryId: Int?
    @State private var selectedLinkRecordId: Int?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerSection
                    metadataSection
                    tagSection
                    linkSection
                    reminderSection
                    aiSection
                    auditSection

                    if status == .loading {
                        LifeAdminEmptyState(message: "Loading document...")
                    }
                    if !errorMessage.isEmpty {
                        LifeAdminErrorBanner(message: errorMessage)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 24)
                .frame(maxWidth: 960)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Document")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task {
                if status == .idle {
                    await loadDetail()
                }
            }
        }
    }

    private var headerSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Document", subtitle: "Update title and folder.")
            TextField("Title", text: $title)
            Picker("Folder", selection: $folderId) {
                Text("No folder").tag(Int?.none)
                ForEach(folders) { folder in
                    Text(folder.Name).tag(Optional(folder.Id))
                }
            }
            Button("Save changes") {
                Task { await saveHeader() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!isHeaderDirty)
        }
    }

    private var metadataSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Metadata", subtitle: nil)
            HStack {
                Text("Updated")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(LifeAdminFormatters.displayDateTime(detail?.UpdatedAt ?? document.UpdatedAt))
                    .font(.caption)
            }
            HStack {
                Text("File size")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(LifeAdminFormatters.formatFileSize(detail?.FileSizeBytes ?? document.FileSizeBytes))
                    .font(.caption)
            }
            if let fileUrl = detail?.FileUrl ?? document.FileUrl,
               let absolute = buildFileUrl(path: fileUrl) {
                Link("Open file", destination: absolute)
            }
        }
    }

    private var tagSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Tags", subtitle: "Add or remove tags.")
            if let tags = detail?.Tags, !tags.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(tags) { tag in
                        HStack {
                            LifeAdminTagChip(text: tag.Name)
                            Spacer()
                            Button("Remove") {
                                Task { await removeTag(tag.Id) }
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            } else {
                LifeAdminEmptyState(message: "No tags yet.")
            }

            HStack {
                TextField("Add tags", text: $newTagText)
                Button("Add") {
                    Task { await addTags() }
                }
                .buttonStyle(.bordered)
                .disabled(newTagText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var linkSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Links", subtitle: "Connect documents to records.")
            if let links = detail?.Links, !links.isEmpty {
                VStack(spacing: 8) {
                    ForEach(links) { link in
                        HStack {
                            Text("Record \(link.LinkedEntityId)")
                                .font(.caption)
                            Spacer()
                            Button("Remove") {
                                Task { await deleteLink(link.Id) }
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            } else {
                LifeAdminEmptyState(message: "No links yet.")
            }

            Picker("Category", selection: $selectedLinkCategoryId) {
                Text("Select category").tag(Int?.none)
                ForEach(categories) { category in
                    Text(category.Name).tag(Optional(category.Id))
                }
            }

            Picker("Record", selection: $selectedLinkRecordId) {
                Text("Select record").tag(Int?.none)
                ForEach(availableLinkRecords) { record in
                    Text(record.Title).tag(Optional(record.Id))
                }
            }

            Button("Add link") {
                Task { await addLink() }
            }
            .buttonStyle(.bordered)
            .disabled(selectedLinkRecordId == nil)
        }
    }

    private var reminderSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Reminders", subtitle: "Track renewals and follow ups.")
            if let reminders = detail?.Reminders, !reminders.isEmpty {
                VStack(spacing: 8) {
                    ForEach(reminders) { reminder in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(reminder.Title)
                                    .font(.subheadline.weight(.semibold))
                                Text(LifeAdminFormatters.displayDateTime(reminder.DueAt))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button(reminder.Status == "Completed" ? "Reopen" : "Complete") {
                                Task { await toggleReminder(reminder) }
                            }
                            .buttonStyle(.bordered)
                            Button("Delete") {
                                Task { await deleteReminder(reminder.Id) }
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                        }
                    }
                }
            } else {
                LifeAdminEmptyState(message: "No reminders yet.")
            }

            TextField("Reminder title", text: $newReminderTitle)
            DatePicker("Due date", selection: $newReminderDate, displayedComponents: [.date, .hourAndMinute])
            TextField("Repeat rule", text: $newReminderRepeat)
            Button("Add reminder") {
                Task { await addReminder() }
            }
            .buttonStyle(.bordered)
            .disabled(newReminderTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private var aiSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "AI suggestions", subtitle: "Apply AI metadata when available.")
            if let suggestion = detail?.AiSuggestion {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Status: \(suggestion.Status)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let folder = suggestion.SuggestedFolderName {
                        Text("Suggested folder: \(folder)")
                            .font(.caption)
                    }
                    if !suggestion.SuggestedTags.isEmpty {
                        Text("Suggested tags: \(suggestion.SuggestedTags.joined(separator: ", "))")
                            .font(.caption)
                    }
                }
                Button("Apply suggestions") {
                    Task { await applyAi() }
                }
                .buttonStyle(.bordered)
            } else {
                LifeAdminEmptyState(message: "No AI suggestions yet.")
            }
        }
    }

    private var auditSection: some View {
        LifeAdminSectionCard {
            LifeAdminSectionHeader(title: "Activity", subtitle: "Recent changes.")
            if let audits = detail?.Audits, !audits.isEmpty {
                VStack(spacing: 8) {
                    ForEach(audits.prefix(6)) { audit in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(audit.Action)
                                .font(.caption.weight(.semibold))
                            if let summary = audit.Summary {
                                Text(summary)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Text(LifeAdminFormatters.displayDateTime(audit.CreatedAt))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            } else {
                LifeAdminEmptyState(message: "No activity yet.")
            }
        }
    }

    private var availableLinkRecords: [LifeRecordLookup] {
        guard let selectedLinkCategoryId else { return [] }
        return recordLookup[selectedLinkCategoryId] ?? []
    }

    private var isHeaderDirty: Bool {
        let initialTitle = detail?.Title ?? document.Title ?? ""
        let initialFolder = detail?.FolderId ?? document.FolderId
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedTitle = trimmedTitle.isEmpty ? "" : trimmedTitle
        return normalizedTitle != initialTitle || folderId != initialFolder
    }

    private func loadDetail() async {
        status = .loading
        errorMessage = ""
        do {
            let loaded = try await LifeAdminApi.fetchDocumentDetail(id: document.Id)
            detail = loaded
            title = loaded.Title ?? ""
            folderId = loaded.FolderId
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load document."
        }
    }

    private func saveHeader() async {
        errorMessage = ""
        do {
            try await onUpdate(LifeDocumentUpdate(Title: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : title, FolderId: folderId))
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to update document."
        }
    }

    private func addTags() async {
        errorMessage = ""
        let names = newTagText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !names.isEmpty else { return }
        do {
            try await onAddTags(names)
            newTagText = ""
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to add tags."
        }
    }

    private func removeTag(_ tagId: Int) async {
        errorMessage = ""
        do {
            try await onRemoveTag(tagId)
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to remove tag."
        }
    }

    private func addLink() async {
        errorMessage = ""
        guard let recordId = selectedLinkRecordId else { return }
        do {
            try await onCreateLink(LifeDocumentLinkCreate(LinkedEntityType: "life_admin_record", LinkedEntityId: recordId))
            selectedLinkRecordId = nil
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to add link."
        }
    }

    private func deleteLink(_ linkId: Int) async {
        errorMessage = ""
        do {
            try await onDeleteLink(linkId)
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete link."
        }
    }

    private func addReminder() async {
        errorMessage = ""
        let trimmed = newReminderTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            let payload = LifeReminderCreate(
                SourceType: "life_admin_document",
                SourceId: document.Id,
                Title: trimmed,
                DueAt: LifeAdminFormatters.formatDateTime(newReminderDate),
                RepeatRule: newReminderRepeat.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : newReminderRepeat,
                AssigneeUserId: nil
            )
            try await onCreateReminder(payload)
            newReminderTitle = ""
            newReminderRepeat = ""
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to add reminder."
        }
    }

    private func toggleReminder(_ reminder: LifeReminder) async {
        let nextStatus = reminder.Status == "Completed" ? "Open" : "Completed"
        do {
            try await onUpdateReminder(reminder.Id, nextStatus)
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to update reminder."
        }
    }

    private func deleteReminder(_ reminderId: Int) async {
        do {
            try await onDeleteReminder(reminderId)
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete reminder."
        }
    }

    private func applyAi() async {
        do {
            try await onApplyAi()
            await onReload()
            await loadDetail()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to apply AI suggestions."
        }
    }

    private func buildFileUrl(path: String) -> URL? {
        let env = EnvironmentStore.resolvedEnvironment()
        let raw = env.baseUrl
        let withScheme = raw.hasPrefix("http") ? raw : "https://\(raw)"
        guard let base = URL(string: withScheme) else { return nil }
        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return base.appendingPathComponent(trimmed)
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
