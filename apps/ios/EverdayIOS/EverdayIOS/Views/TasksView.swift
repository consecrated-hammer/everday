import SwiftUI

struct TasksView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject private var authStore: AuthStore

    @State private var lists: [TaskList] = []
    @State private var tasks: [TaskItem] = []
    @State private var users: [SettingsUser] = []
    @State private var selectedListKey = ""
    @State private var filter: TasksFilter = .open
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    @State private var showForm = false
    @State private var editingTask: TaskItem?
    @State private var formState = TaskFormState(listKey: "")
    @State private var isSaving = false

    @State private var deleteTarget: TaskItem?
    @State private var showDeleteConfirm = false

    private let listStorageKey = "everday.tasks.selectedListKey"

    var body: some View {
        let scroll = ScrollView {
            contentView
        }
        .refreshable {
            await loadTasks(refresh: true)
        }

        let base = scroll
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
            .toolbar {
                if horizontalSizeClass == .regular {
                    ToolbarItem(placement: .principal) {
                        ConstrainedTitleView(title: "Tasks")
                    }
                }
            }

        let sheets = base
            .sheet(isPresented: $showForm) {
                TaskFormSheet(
                    title: editingTask == nil ? "New task" : "Edit task",
                    initialState: formState,
                    listName: selectedList?.Name ?? "Tasks",
                    assignees: assigneeOptions,
                    isEditingShared: editingTask != nil && formState.listKey == "shared",
                    onSave: { state in
                        try await saveTask(state)
                    },
                    onDelete: editingTask == nil ? nil : {
                        if let target = editingTask {
                            await deleteTask(target)
                        }
                    }
                )
            }
            .alert("Delete task", isPresented: $showDeleteConfirm) {
                Button("Delete", role: .destructive) {
                    if let target = deleteTarget {
                        Task { await deleteTask(target) }
                    }
                }
                Button("Cancel", role: .cancel) {
                    deleteTarget = nil
                }
            } message: {
                Text("This will permanently remove the task.")
            }

        let tasks = sheets
            .task {
                if status == .idle {
                    await loadLists()
                    await loadUsers()
                }
            }
            .onChange(of: selectedListKey) { _, newValue in
                guard !newValue.isEmpty else { return }
                UserDefaults.standard.set(newValue, forKey: listStorageKey)
                Task { await loadTasks(refresh: false) }
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
            listSection
            filterSection
            statusSection
            tasksSection
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Tasks")
                .font(.title2.bold())
            Text("Keep on top of personal and family tasks.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var listSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(selectedList?.Name ?? "Tasks")
                        .font(.headline)
                    Text(taskCountLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                ViewThatFits {
                    HStack(spacing: 8) {
                        refreshButton
                        newTaskButton
                    }
                    VStack(alignment: .trailing, spacing: 8) {
                        refreshButton
                        newTaskButton
                    }
                }
            }

            Picker("List", selection: $selectedListKey) {
                ForEach(lists) { list in
                    Text(list.Name).tag(list.Key)
                }
            }
            .pickerStyle(.menu)
        }
    }

    private var filterSection: some View {
        Picker("Filter", selection: $filter) {
            ForEach(TasksFilter.allCases) { option in
                Text(option.label).tag(option)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private var statusSection: some View {
        if status == .loading {
            ProgressView("Loading tasks...")
                .frame(maxWidth: .infinity, alignment: .center)
        }
        if !errorMessage.isEmpty {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private var tasksSection: some View {
        if status != .loading {
            if visibleTasks.isEmpty {
                Text("No tasks to show right now.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 12) {
                    ForEach(visibleTasks) { task in
                        TaskRowView(
                            task: task,
                            isBusy: isBusy,
                            onToggleComplete: { Task { await toggleComplete(task) } },
                            onEdit: { openEditForm(task) },
                            onDelete: {
                                deleteTarget = task
                                showDeleteConfirm = true
                            }
                        )
                    }
                }
            }
        }
    }

    private var refreshButton: some View {
        Button(isBusy ? "Refreshing..." : "Refresh") {
            Task { await loadTasks(refresh: true) }
        }
        .buttonStyle(.bordered)
        .disabled(isBusy || selectedListKey.isEmpty)
    }

    private var newTaskButton: some View {
        Button("New task") {
            openNewForm()
        }
        .buttonStyle(.borderedProminent)
        .disabled(selectedListKey.isEmpty)
    }

    private var selectedList: TaskList? {
        lists.first { $0.Key == selectedListKey } ?? lists.first
    }

    private var selectedListKeyValue: String {
        selectedList?.Key ?? ""
    }

    private var isBusy: Bool {
        status == .loading || status == .saving || isSaving
    }

    private var visibleTasks: [TaskItem] {
        switch filter {
        case .completed:
            return tasks.filter { $0.IsCompleted }
        case .overdue:
            return tasks.filter { !$0.IsCompleted && TasksFormatters.isOverdue($0.DueDate) }
        case .all:
            return tasks
        case .open:
            return tasks.filter { !$0.IsCompleted }
        }
    }

    private var taskCountLabel: String {
        let count = visibleTasks.count
        if count == 0 {
            return "No tasks"
        }
        return "\(count) task\(count == 1 ? "" : "s")"
    }

    private var currentUserId: Int? {
        guard let username = authStore.tokens?.username else { return nil }
        return users.first { $0.Username == username }?.Id
    }

    private var assigneeOptions: [AssigneeOption] {
        let currentId = currentUserId
        return users
            .filter { currentId == nil || $0.Id != currentId }
            .map { AssigneeOption(id: $0.Id, label: $0.displayName) }
    }

    private func loadLists() async {
        status = .loading
        errorMessage = ""
        do {
            let response = try await TasksApi.fetchLists()
            lists = response.Lists
            if lists.isEmpty {
                selectedListKey = ""
                status = .ready
                return
            }
            let stored = UserDefaults.standard.string(forKey: listStorageKey) ?? ""
            let nextKey = lists.first(where: { $0.Key == stored })?.Key ?? lists.first?.Key ?? ""
            selectedListKey = nextKey
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load task lists."
        }
    }

    private func loadUsers() async {
        do {
            users = try await SettingsApi.fetchUsers()
        } catch {
            users = []
        }
    }

    private func loadTasks(refresh: Bool) async {
        guard !selectedListKeyValue.isEmpty else {
            tasks = []
            return
        }
        status = .loading
        errorMessage = ""
        do {
            let response = try await TasksApi.fetchTasks(listKey: selectedListKeyValue, refresh: refresh)
            tasks = response.Tasks
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load tasks."
        }
    }

    private func openNewForm() {
        editingTask = nil
        formState = TaskFormState(listKey: selectedListKeyValue)
        showForm = true
    }

    private func openEditForm(_ task: TaskItem) {
        editingTask = task
        formState = TaskFormState(task: task)
        showForm = true
    }

    private func saveTask(_ form: TaskFormState) async throws {
        isSaving = true
        defer { isSaving = false }

        let trimmedTitle = form.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedTitle.isEmpty {
            throw ApiError(message: "Title is required.")
        }
        let trimmedNotes = form.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let notesValue = trimmedNotes.isEmpty ? nil : trimmedNotes
        let dueDateValue = form.hasDueDate ? TasksFormatters.formatDateKey(form.dueDate) : nil

        if let editingTask {
            let payload = TaskUpdate(
                Title: trimmedTitle,
                Notes: notesValue,
                DueDate: dueDateValue,
                IsCompleted: nil,
                ListKey: editingTask.ListKey
            )
            _ = try await TasksApi.updateTask(taskId: editingTask.Id, payload: payload)
        } else {
            if form.listKey == "shared", form.assignedToUserId == nil {
                throw ApiError(message: "Choose who this task is shared with.")
            }
            let payload = TaskCreate(
                Title: trimmedTitle,
                Notes: notesValue,
                DueDate: dueDateValue,
                ListKey: form.listKey,
                AssignedToUserId: form.listKey == "shared" ? form.assignedToUserId : nil
            )
            _ = try await TasksApi.createTask(payload)
        }
        await loadTasks(refresh: true)
    }

    private func toggleComplete(_ task: TaskItem) async {
        do {
            let payload = TaskUpdate(
                Title: nil,
                Notes: nil,
                DueDate: nil,
                IsCompleted: !task.IsCompleted,
                ListKey: task.ListKey
            )
            _ = try await TasksApi.updateTask(taskId: task.Id, payload: payload)
            await loadTasks(refresh: true)
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to update task."
        }
    }

    private func deleteTask(_ task: TaskItem) async {
        deleteTarget = nil
        do {
            try await TasksApi.deleteTask(taskId: task.Id, listKey: task.ListKey)
            await loadTasks(refresh: true)
            if editingTask?.Id == task.Id {
                editingTask = nil
                showForm = false
            }
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to delete task."
        }
    }
}

private struct TaskRowView: View {
    let task: TaskItem
    let isBusy: Bool
    let onToggleComplete: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                Button(action: onToggleComplete) {
                    Image(systemName: task.IsCompleted ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(task.IsCompleted ? Color.accentColor : .secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(task.IsCompleted ? "Mark incomplete" : "Mark complete")
                .disabled(isBusy)

                VStack(alignment: .leading, spacing: 4) {
                    Text(task.Title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .strikethrough(task.IsCompleted)
                    if let notes = task.Notes, !notes.isEmpty {
                        Text(notes)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if !metaLabel.isEmpty {
                        Text(metaLabel)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 8)

                Menu {
                    Button("Edit") { onEdit() }
                    Button("Delete", role: .destructive) { onDelete() }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                }
                .accessibilityLabel("Task actions")
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var metaLabel: String {
        var parts: [String] = []
        let dueLabel = TasksFormatters.formatDueDate(task.DueDate)
        if !dueLabel.isEmpty {
            parts.append(dueLabel)
        }
        if task.ListKey == "shared", let assigned = task.AssignedToName, !assigned.isEmpty {
            parts.append("Shared with \(assigned)")
        }
        return parts.joined(separator: " | ")
    }
}

private struct TaskFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let title: String
    let initialState: TaskFormState
    let listName: String
    let assignees: [AssigneeOption]
    let isEditingShared: Bool
    let onSave: (TaskFormState) async throws -> Void
    let onDelete: (() async -> Void)?

    @State private var form: TaskFormState
    @State private var errorMessage = ""
    @State private var isSaving = false

    init(
        title: String,
        initialState: TaskFormState,
        listName: String,
        assignees: [AssigneeOption],
        isEditingShared: Bool,
        onSave: @escaping (TaskFormState) async throws -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.title = title
        self.initialState = initialState
        self.listName = listName
        self.assignees = assignees
        self.isEditingShared = isEditingShared
        self.onSave = onSave
        self.onDelete = onDelete
        _form = State(initialValue: initialState)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Title", text: $form.title)
                    TextEditor(text: $form.notes)
                        .frame(minHeight: 80)
                }

                Section("Schedule") {
                    Toggle("Set due date", isOn: $form.hasDueDate)
                    if form.hasDueDate {
                        DatePicker("Due date", selection: $form.dueDate, displayedComponents: [.date])
                    }
                }

                Section("Assignment") {
                    if form.listKey == "shared" {
                        Picker("Assign to", selection: assigneeBinding) {
                            Text("Select a person").tag(0)
                            ForEach(assignees) { option in
                                Text(option.label).tag(option.id)
                            }
                        }
                        .disabled(isEditingShared)

                        if isEditingShared {
                            Text("To change who this task is shared with, create a new shared task.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else if assignees.isEmpty {
                            Text("No other users are available yet.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Text("Shared tasks are assigned from the shared list.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    HStack {
                        Text("List")
                        Spacer()
                        Text(listName)
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
                        Button("Delete task", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle(title)
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

    private var assigneeBinding: Binding<Int> {
        Binding(
            get: { form.assignedToUserId ?? 0 },
            set: { form.assignedToUserId = $0 == 0 ? nil : $0 }
        )
    }

    private var isDirty: Bool {
        form != initialState
    }

    private var isValid: Bool {
        if form.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return false
        }
        if form.listKey == "shared" {
            return form.assignedToUserId != nil
        }
        return true
    }

    private func save() async {
        errorMessage = ""
        guard isValid else {
            errorMessage = form.listKey == "shared"
                ? "Choose who this task is shared with."
                : "Title is required."
            return
        }
        isSaving = true
        do {
            try await onSave(form)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to save task."
        }
        isSaving = false
    }
}

private struct AssigneeOption: Identifiable {
    let id: Int
    let label: String
}

private struct TaskFormState: Equatable {
    var title: String
    var notes: String
    var hasDueDate: Bool
    var dueDate: Date
    var assignedToUserId: Int?
    var listKey: String

    init(listKey: String) {
        self.title = ""
        self.notes = ""
        self.hasDueDate = false
        self.dueDate = Date()
        self.assignedToUserId = nil
        self.listKey = listKey
    }

    init(task: TaskItem) {
        self.title = task.Title
        self.notes = task.Notes ?? ""
        if let parsed = TasksFormatters.parseDateKey(task.DueDate) {
            self.hasDueDate = true
            self.dueDate = parsed
        } else {
            self.hasDueDate = false
            self.dueDate = Date()
        }
        self.assignedToUserId = task.AssignedToUserId
        self.listKey = task.ListKey
    }
}

private enum TasksFilter: String, CaseIterable, Identifiable {
    case open
    case overdue
    case completed
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .open:
            return "Open"
        case .overdue:
            return "Overdue"
        case .completed:
            return "Completed"
        case .all:
            return "All"
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
