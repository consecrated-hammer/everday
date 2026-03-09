import SwiftUI

struct SettingsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        let listView = List {
            Section("Preferences") {
                NavigationLink("Global time zone") {
                    GlobalTimeZoneSettingsView()
                }

                if isKid {
                    NavigationLink("Reminder settings") {
                        KidsReminderSettingsView()
                    }
                    NavigationLink("Notifications") {
                        NotificationsView()
                    }
                } else {
                    NavigationLink("Health settings") {
                        HealthSettingsView()
                    }
                    NavigationLink("Task settings") {
                        SettingsTasksView()
                    }
                }

                NavigationLink("Appearance") {
                    SettingsAppearanceView()
                }
            }

            Section("Account") {
                NavigationLink("Account") {
                    AccountView()
                }

                if isParent {
                    NavigationLink("User access") {
                        SettingsUsersView()
                    }
                }
            }

            Section("Support") {
                if isParent {
                    NavigationLink("Integrations") {
                        SettingsIntegrationsView()
                    }
                }

                NavigationLink("Diagnostics") {
                    SystemSettingsView()
                }
            }

            Section("Legal") {
                if let privacyUrl {
                    Link("Privacy Policy", destination: privacyUrl)
                } else {
                    Text("Privacy Policy unavailable")
                        .foregroundStyle(.secondary)
                }

                if let termsUrl {
                    Link("Terms of Use", destination: termsUrl)
                } else {
                    Text("Terms of Use unavailable")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)

        Group {
            if horizontalSizeClass == .regular {
                listView
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
            } else {
                listView
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Settings")
                }
            }
        }
    }

    private var isKid: Bool {
        authStore.tokens?.role == "Kid"
    }

    private var isParent: Bool {
        authStore.tokens?.role == "Parent"
    }

    private var privacyUrl: URL? {
        buildLegalUrl(path: "kids-app/privacy")
    }

    private var termsUrl: URL? {
        buildLegalUrl(path: "kids-app/terms")
    }

    private func buildLegalUrl(path: String) -> URL? {
        let raw = EnvironmentStore.resolvedEnvironment().baseUrl
        let withScheme = raw.hasPrefix("http") ? raw : "https://\(raw)"
        guard let base = URL(string: withScheme) else { return nil }
        return base.appendingPathComponent(path)
    }
}

private struct GlobalTimeZoneSettingsView: View {
    @State private var reminderTimeZone = "Australia/Adelaide"
    @State private var lastSavedTimeZone = "Australia/Adelaide"
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var errorMessage = ""
    @State private var saveMessage = ""

    var body: some View {
        List {
            if isLoading {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("Loading...")
                        Spacer()
                    }
                }
            }

            Section {
                NavigationLink {
                    GlobalTimeZonePickerView(selection: $reminderTimeZone)
                } label: {
                    HStack {
                        Text("Time zone")
                        Spacer()
                        if isSaving {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Text(reminderTimeZone)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            } footer: {
                Text("This time zone applies to reminders across Health, Tasks, and Kids.")
            }

            if !saveMessage.isEmpty {
                Section {
                    Text(saveMessage)
                        .font(.footnote)
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
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Global time zone")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if isLoading {
                await load()
            }
        }
        .onChange(of: reminderTimeZone) { oldValue, newValue in
            handleTimeZoneChange(oldValue: oldValue, newValue: newValue)
        }
    }

    private func load() async {
        errorMessage = ""
        saveMessage = ""
        do {
            let settings = try await SettingsApi.fetchTaskSettings()
            let normalized = normalizeReminderTimeZone(settings.OverdueReminderTimeZone)
            reminderTimeZone = normalized
            lastSavedTimeZone = normalized
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to load task settings."
        }
        isLoading = false
    }

    private func handleTimeZoneChange(oldValue: String, newValue: String) {
        let normalized = normalizeReminderTimeZone(newValue)
        if normalized != newValue {
            reminderTimeZone = normalized
            return
        }
        if isLoading || normalized == lastSavedTimeZone {
            return
        }
        Task { await persistTimeZone(normalized) }
    }

    private func persistTimeZone(_ value: String) async {
        isSaving = true
        defer { isSaving = false }
        saveMessage = ""
        errorMessage = ""
        do {
            let updated = try await SettingsApi.updateTaskSettings(
                TaskSettingsUpdateRequest(
                    OverdueReminderTime: nil,
                    OverdueReminderTimeZone: value,
                    OverdueRemindersEnabled: nil
                )
            )
            let normalized = normalizeReminderTimeZone(updated.OverdueReminderTimeZone)
            reminderTimeZone = normalized
            lastSavedTimeZone = normalized
            saveMessage = "Global time zone updated."
        } catch {
            reminderTimeZone = lastSavedTimeZone
            errorMessage = (error as? ApiError)?.message ?? "Failed to update global time zone."
        }
    }

    private func normalizeReminderTimeZone(_ value: String?) -> String {
        let cleaned = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if TimeZone(identifier: cleaned) != nil {
            return cleaned
        }
        return "Australia/Adelaide"
    }
}

private struct GlobalTimeZonePickerView: View {
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
