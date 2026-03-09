import SwiftUI

struct SettingsTasksView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject private var authStore: AuthStore

    @State private var settings: TaskSettings?
    @State private var formState = TaskSettingsFormState.default
    @State private var originalState = TaskSettingsFormState.default
    @State private var history: [TaskOverdueRun] = []

    @State private var loadState: LoadState = .idle
    @State private var errorMessage = ""
    @State private var saveMessage = ""
    @State private var isSaving = false
    @State private var isRunning = false

    var body: some View {
        let formView = Form {
            if loadState == .loading {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("Loading...")
                        Spacer()
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

            Section {
                Toggle("Enable overdue reminders", isOn: $formState.overdueRemindersEnabled)
                DatePicker("Reminder time", selection: $formState.reminderTime, displayedComponents: .hourAndMinute)
                    .disabled(!formState.overdueRemindersEnabled)
                NavigationLink {
                    ReminderTimeZonePickerView(selection: $formState.reminderTimeZone)
                } label: {
                    HStack {
                        Text("Global time zone")
                        Spacer()
                        Text(formState.reminderTimeZone)
                            .foregroundStyle(.secondary)
                    }
                }
                if let lastNotified = settings?.OverdueLastNotifiedDate {
                    HStack {
                        Text("Last notified")
                        Spacer()
                        Text(formatDateValue(lastNotified))
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Overdue reminders")
            } footer: {
                Text("This time zone applies to reminders across Health, Tasks, and Kids.")
            }

            Section {
                Button {
                    Task { await saveSettings() }
                } label: {
                    if isSaving {
                        Label("Saving...", systemImage: "arrow.triangle.2.circlepath")
                    } else {
                        Label("Save settings", systemImage: "checkmark.circle")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSave)
            }

            Section("Tools") {
                Button {
                    Task { await runOverdueNotifications() }
                } label: {
                    if isRunning {
                        Label("Running...", systemImage: "clock.arrow.circlepath")
                    } else {
                        Label("Run overdue reminders", systemImage: "bell.badge")
                    }
                }
                .disabled(!isParent || isRunning)

                if !saveMessage.isEmpty {
                    Text(saveMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !isParent {
                    Text("Only parent accounts can run overdue reminders.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("History") {
                if history.isEmpty {
                    Text("No runs recorded yet.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(history) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(NotificationsFormatters.formatDateTime(entry.RanAt))
                                .font(.subheadline)
                            Text(entry.Result)
                                .font(.footnote)
                                .foregroundStyle(entry.Result == "Failed" ? .red : .secondary)
                            if entry.Result == "Failed" {
                                Text(entry.ErrorMessage ?? "Run failed.")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            } else {
                                let sent = entry.NotificationsSent ?? 0
                                Text("Reminders sent: \(sent)")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }

        Group {
            if horizontalSizeClass == .regular {
                formView
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
            } else {
                formView
            }
        }
        .navigationTitle("Task settings")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Task settings")
                }
            }
        }
        .task {
            if loadState == .idle {
                await load()
            }
        }
    }

    private var isParent: Bool {
        authStore.tokens?.role == "Parent"
    }

    private var canSave: Bool {
        formState != originalState && !isSaving
    }

    private func load() async {
        loadState = .loading
        errorMessage = ""
        saveMessage = ""
        do {
            async let settingsResponse = SettingsApi.fetchTaskSettings()
            async let historyResponse = SettingsApi.fetchTaskOverdueHistory()
            let (settingsValue, historyValue) = try await (settingsResponse, historyResponse)
            settings = settingsValue
            history = historyValue
            let newState = TaskSettingsFormState.from(settings: settingsValue)
            formState = newState
            originalState = newState
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to load task settings."
        }
        loadState = .loaded
    }

    private func saveSettings() async {
        guard canSave else { return }
        isSaving = true
        saveMessage = ""
        do {
            let request = TaskSettingsUpdateRequest(
                OverdueReminderTime: TaskSettingsFormState.timeString(
                    from: formState.reminderTime,
                    timeZoneIdentifier: formState.reminderTimeZone
                ),
                OverdueReminderTimeZone: formState.reminderTimeZone,
                OverdueRemindersEnabled: formState.overdueRemindersEnabled
            )
            let updated = try await SettingsApi.updateTaskSettings(request)
            settings = updated
            let newState = TaskSettingsFormState.from(settings: updated)
            formState = newState
            originalState = newState
            saveMessage = "Settings saved."
        } catch {
            saveMessage = (error as? ApiError)?.message ?? "Failed to save settings."
        }
        isSaving = false
    }

    private func runOverdueNotifications() async {
        guard isParent else { return }
        isRunning = true
        saveMessage = ""
        do {
            let response = try await SettingsApi.runTaskNotifications()
            saveMessage = "Sent \(response.OverdueSent) overdue reminders."
            history = (try? await SettingsApi.fetchTaskOverdueHistory()) ?? history
        } catch {
            saveMessage = (error as? ApiError)?.message ?? "Failed to run overdue reminders."
        }
        isRunning = false
    }

    private func formatDateValue(_ value: String) -> String {
        if LifeAdminFormatters.parseDate(value) != nil {
            return LifeAdminFormatters.displayDate(value)
        }
        return NotificationsFormatters.formatDateTime(value)
    }
}

private struct TaskSettingsFormState: Equatable {
    private static let defaultReminderTimeZone = "Australia/Adelaide"

    var overdueRemindersEnabled: Bool
    var reminderTime: Date
    var reminderTimeZone: String

    static var `default`: TaskSettingsFormState {
        let reminderTimeZone = defaultReminderTimeZone
        return TaskSettingsFormState(
            overdueRemindersEnabled: true,
            reminderTime: timeFromString("08:00", timeZoneIdentifier: reminderTimeZone),
            reminderTimeZone: reminderTimeZone
        )
    }

    static func from(settings: TaskSettings) -> TaskSettingsFormState {
        let timeValue = settings.OverdueReminderTime ?? "08:00"
        let reminderTimeZone = normalizeReminderTimeZone(settings.OverdueReminderTimeZone)
        return TaskSettingsFormState(
            overdueRemindersEnabled: settings.OverdueRemindersEnabled ?? true,
            reminderTime: timeFromString(timeValue, timeZoneIdentifier: reminderTimeZone),
            reminderTimeZone: reminderTimeZone
        )
    }

    private static func timeFromString(_ value: String, timeZoneIdentifier: String) -> Date {
        let timeZone = resolveTimeZone(timeZoneIdentifier)
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        let parts = value.split(separator: ":")
        let hour = parts.count > 0 ? Int(parts[0]) ?? 8 : 8
        let minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        var components = calendar.dateComponents([.year, .month, .day], from: Date())
        components.hour = hour
        components.minute = minute
        return calendar.date(from: components) ?? Date()
    }

    static func timeString(from date: Date, timeZoneIdentifier: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = resolveTimeZone(timeZoneIdentifier)
        return formatter.string(from: date)
    }

    private static func normalizeReminderTimeZone(_ value: String?) -> String {
        let cleaned = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if TimeZone(identifier: cleaned) != nil {
            return cleaned
        }
        return defaultReminderTimeZone
    }

    private static func resolveTimeZone(_ identifier: String) -> TimeZone {
        TimeZone(identifier: identifier)
            ?? TimeZone(identifier: defaultReminderTimeZone)
            ?? TimeZone.current
    }
}

private enum LoadState {
    case idle
    case loading
    case loaded
}

private struct ReminderTimeZonePickerView: View {
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private static let suggestedIds = [
        "Australia/Adelaide",
        "Australia/Sydney",
        "UTC"
    ]

    private var suggestedTimeZones: [String] {
        Self.suggestedIds.filter { TimeZone(identifier: $0) != nil }
    }

    private var allTimeZones: [String] {
        TimeZone.knownTimeZoneIdentifiers.sorted()
    }

    private var filteredTimeZones: [String] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return allTimeZones }
        let needle = trimmed.lowercased()
        return allTimeZones.filter { $0.lowercased().contains(needle) }
    }

    var body: some View {
        List {
            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Section("Suggested") {
                    ForEach(suggestedTimeZones, id: \.self) { identifier in
                        timeZoneRow(identifier)
                    }
                }
            }
            Section("All time zones") {
                ForEach(filteredTimeZones, id: \.self) { identifier in
                    timeZoneRow(identifier)
                }
            }
        }
        .navigationTitle("Time zone")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Search time zones")
    }

    @ViewBuilder
    private func timeZoneRow(_ identifier: String) -> some View {
        Button {
            selection = identifier
            dismiss()
        } label: {
            HStack {
                Text(identifier)
                    .foregroundStyle(.primary)
                Spacer()
                if selection == identifier {
                    Image(systemName: "checkmark")
                        .foregroundStyle(.blue)
                }
            }
        }
    }
}
