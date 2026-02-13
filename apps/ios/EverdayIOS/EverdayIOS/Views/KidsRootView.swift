import SwiftUI
import UIKit
import UserNotifications

struct KidsRootView: View {
    @State private var selection: KidsTab = .home

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                KidsHomeView()
            }
            .tag(KidsTab.home)
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                KidsHistoryView()
            }
            .tag(KidsTab.history)
            .tabItem {
                Label("History", systemImage: "clock.arrow.circlepath")
            }
        }
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(Color(.systemBackground), for: .tabBar)
    }
}

private enum KidsTab {
    case home
    case history
}

struct KidsNotificationBellIcon: View {
    let unreadCount: Int

    private var hasUnread: Bool {
        unreadCount > 0
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(hasUnread ? Color.red.opacity(0.2) : Color(.systemGray5))
                .frame(width: 28, height: 28)
            Image(systemName: hasUnread ? "bell.badge.fill" : "bell.fill")
                .foregroundStyle(hasUnread ? .red : .secondary)
        }
    }
}

struct KidsReminderSettingsView: View {
    @Environment(\.openURL) private var openURL

    @State private var loadState: LoadState = .idle
    @State private var errorMessage = ""
    @State private var reminderTimeZone = "Australia/Adelaide"
    @State private var systemNotificationsEnabled = true

    @State private var dailyJobsEnabled = true
    @State private var habitsEnabled = true
    @State private var dailyJobsTime = KidsReminderSettingsView.defaultReminderDate
    @State private var habitsTime = KidsReminderSettingsView.defaultReminderDate

    @State private var expandedPicker: ReminderType?
    @State private var showNotificationsDisabledAlert = false
    @State private var pendingSaveTask: Task<Void, Never>?
    @State private var saveRevision = 0
    @State private var lastPersistedSnapshot: ReminderSnapshot?

    private static var defaultReminderDate: Date {
        BuildTimeDate("19:00") ?? Date()
    }

    private static let apiTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static let displayTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()

    private static func BuildTimeDate(_ value: String) -> Date? {
        Self.apiTimeFormatter.date(from: value)
    }

    private static func BuildTimeString(_ value: Date) -> String {
        Self.apiTimeFormatter.string(from: value)
    }

    var body: some View {
        List {
            Section {
                Toggle(
                    "Daily jobs reminders",
                    isOn: Binding(
                        get: { dailyJobsEnabled },
                        set: { value in
                            dailyJobsEnabled = value
                            if !value, expandedPicker == .dailyJobs {
                                expandedPicker = nil
                            }
                            Task { @MainActor in
                                await handleReminderToggleChanged(reminder: .dailyJobs, value: value)
                            }
                        }
                    )
                )

                reminderTimeRow(
                    enabled: dailyJobsEnabled,
                    time: dailyJobsTime
                ) {
                    toggleTimePicker(for: .dailyJobs)
                }
                .accessibilityLabel("Daily jobs reminder time")

                if expandedPicker == .dailyJobs, dailyJobsEnabled {
                    DatePicker(
                        "Daily jobs reminder time",
                        selection: Binding(
                            get: { dailyJobsTime },
                            set: { value in
                                dailyJobsTime = value
                                schedulePersist(immediate: false)
                            }
                        ),
                        displayedComponents: .hourAndMinute
                    )
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                }

                Toggle(
                    "Habits reminders",
                    isOn: Binding(
                        get: { habitsEnabled },
                        set: { value in
                            habitsEnabled = value
                            if !value, expandedPicker == .habits {
                                expandedPicker = nil
                            }
                            Task { @MainActor in
                                await handleReminderToggleChanged(reminder: .habits, value: value)
                            }
                        }
                    )
                )

                reminderTimeRow(
                    enabled: habitsEnabled,
                    time: habitsTime
                ) {
                    toggleTimePicker(for: .habits)
                }
                .accessibilityLabel("Habits reminder time")

                if expandedPicker == .habits, habitsEnabled {
                    DatePicker(
                        "Habits reminder time",
                        selection: Binding(
                            get: { habitsTime },
                            set: { value in
                                habitsTime = value
                                schedulePersist(immediate: false)
                            }
                        ),
                        displayedComponents: .hourAndMinute
                    )
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                }
            } header: {
                Text("Notifications")
            } footer: {
                NotificationsFooterText
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
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.large)
        .alert("Notifications are disabled for this app.", isPresented: $showNotificationsDisabledAlert) {
            Button("Open Settings") {
                openSystemSettings()
            }
            Button("Cancel", role: .cancel) {}
        }
        .task {
            if loadState == .idle {
                await loadSettings()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { @MainActor in
                systemNotificationsEnabled = await querySystemNotificationsEnabled()
            }
        }
        .onDisappear {
            pendingSaveTask?.cancel()
        }
    }

    private var NotificationsFooterText: Text {
        var lines: [String] = []
        if !systemNotificationsEnabled {
            lines.append("Notifications are turned off in iOS Settings.")
        }
        lines.append("Timezone: \(reminderTimeZone)")
        return Text(lines.joined(separator: "\n"))
    }

    @ViewBuilder
    private func reminderTimeRow(enabled: Bool, time: Date, onTap: @escaping () -> Void) -> some View {
        if enabled {
            Button(action: onTap) {
                HStack {
                    Text("Time")
                    Spacer()
                    Text(Self.displayTimeFormatter.string(from: time))
                        .foregroundStyle(.secondary)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
        } else {
            HStack {
                Text("Time")
                Spacer()
                Text(Self.displayTimeFormatter.string(from: time))
            }
            .foregroundStyle(.secondary)
        }
    }

    private func toggleTimePicker(for reminder: ReminderType) {
        expandedPicker = expandedPicker == reminder ? nil : reminder
    }

    private func loadSettings() async {
        loadState = .loading
        errorMessage = ""
        do {
            let settings = try await KidsApi.fetchReminderSettings()
            let notificationsEnabled = await querySystemNotificationsEnabled()
            dailyJobsEnabled = settings.DailyJobsRemindersEnabled
            habitsEnabled = settings.HabitsRemindersEnabled
            dailyJobsTime = Self.BuildTimeDate(settings.DailyJobsReminderTime) ?? Self.defaultReminderDate
            habitsTime = Self.BuildTimeDate(settings.HabitsReminderTime) ?? Self.defaultReminderDate
            reminderTimeZone = settings.ReminderTimeZone
            systemNotificationsEnabled = notificationsEnabled
            lastPersistedSnapshot = BuildSnapshot()
            loadState = .ready
        } catch {
            loadState = .error
            errorMessage = BuildApiErrorMessage(error, fallback: "Failed to load reminder settings.")
        }
    }

    private func handleReminderToggleChanged(reminder: ReminderType, value: Bool) async {
        guard loadState != .loading else { return }
        if value {
            let permissionGranted = await ensureNotificationPermission()
            if !permissionGranted {
                setReminderEnabled(reminder, enabled: false)
                if expandedPicker == reminder {
                    expandedPicker = nil
                }
                schedulePersist(immediate: true)
                showNotificationsDisabledAlert = true
                return
            }
        }
        schedulePersist(immediate: true)
    }

    private func setReminderEnabled(_ reminder: ReminderType, enabled: Bool) {
        switch reminder {
        case .dailyJobs:
            dailyJobsEnabled = enabled
        case .habits:
            habitsEnabled = enabled
        }
    }

    private func schedulePersist(immediate: Bool) {
        guard loadState != .loading else { return }
        let snapshot = BuildSnapshot()
        saveRevision += 1
        let revision = saveRevision
        pendingSaveTask?.cancel()
        pendingSaveTask = Task {
            if !immediate {
                try? await Task.sleep(nanoseconds: 350_000_000)
            }
            await persistSettings(snapshot: snapshot, revision: revision)
        }
    }

    private func persistSettings(snapshot: ReminderSnapshot, revision: Int) async {
        guard !Task.isCancelled else { return }
        do {
            let payload = KidsReminderSettingsUpdate(
                DailyJobsRemindersEnabled: snapshot.dailyJobsEnabled,
                DailyJobsReminderTime: Self.BuildTimeString(snapshot.dailyJobsTime),
                HabitsRemindersEnabled: snapshot.habitsEnabled,
                HabitsReminderTime: Self.BuildTimeString(snapshot.habitsTime)
            )
            let updated = try await KidsApi.updateReminderSettings(payload)
            guard !Task.isCancelled else { return }
            guard revision == saveRevision else { return }
            dailyJobsEnabled = updated.DailyJobsRemindersEnabled
            habitsEnabled = updated.HabitsRemindersEnabled
            dailyJobsTime = Self.BuildTimeDate(updated.DailyJobsReminderTime) ?? Self.defaultReminderDate
            habitsTime = Self.BuildTimeDate(updated.HabitsReminderTime) ?? Self.defaultReminderDate
            reminderTimeZone = updated.ReminderTimeZone
            lastPersistedSnapshot = BuildSnapshot()
            systemNotificationsEnabled = await querySystemNotificationsEnabled()
            errorMessage = ""
            loadState = .ready
        } catch is CancellationError {
            return
        } catch {
            guard revision == saveRevision else { return }
            if let persisted = lastPersistedSnapshot {
                ApplySnapshot(persisted)
            }
            loadState = .error
            errorMessage = BuildApiErrorMessage(error, fallback: "Failed to save reminder settings.")
        }
    }

    private func BuildApiErrorMessage(_ error: Error, fallback: String) -> String {
        let raw = (error as? ApiError)?.message.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if raw.caseInsensitiveCompare("Method Not Allowed") == .orderedSame {
            return "This environment does not support kids reminder updates. Switch to DEV in System settings."
        }
        if raw.isEmpty {
            return fallback
        }
        return raw
    }

    private func BuildSnapshot() -> ReminderSnapshot {
        ReminderSnapshot(
            dailyJobsEnabled: dailyJobsEnabled,
            dailyJobsTime: dailyJobsTime,
            habitsEnabled: habitsEnabled,
            habitsTime: habitsTime
        )
    }

    private func ApplySnapshot(_ snapshot: ReminderSnapshot) {
        dailyJobsEnabled = snapshot.dailyJobsEnabled
        dailyJobsTime = snapshot.dailyJobsTime
        habitsEnabled = snapshot.habitsEnabled
        habitsTime = snapshot.habitsTime
    }

    private func ensureNotificationPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            systemNotificationsEnabled = true
            return true
        case .notDetermined:
            do {
                let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                systemNotificationsEnabled = granted
                return granted
            } catch {
                systemNotificationsEnabled = false
                return false
            }
        case .denied:
            systemNotificationsEnabled = false
            return false
        @unknown default:
            systemNotificationsEnabled = false
            return false
        }
    }

    private func querySystemNotificationsEnabled() async -> Bool {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            return true
        case .denied:
            return false
        @unknown default:
            return false
        }
    }

    private func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        openURL(url)
    }
}

private enum ReminderType {
    case dailyJobs
    case habits
}

private struct ReminderSnapshot {
    let dailyJobsEnabled: Bool
    let dailyJobsTime: Date
    let habitsEnabled: Bool
    let habitsTime: Date
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
