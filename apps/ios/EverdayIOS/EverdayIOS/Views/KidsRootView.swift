import SwiftUI

struct KidsRootView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var pushCoordinator: PushNotificationCoordinator
    @State private var selection: KidsTab = .home

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                KidsHomeView()
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        KidsNotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
                    }
                    .accessibilityLabel("Notifications")
                }
            }
            .tag(KidsTab.home)
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                KidsHistoryView()
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        KidsNotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
                    }
                    .accessibilityLabel("Notifications")
                }
            }
            .tag(KidsTab.history)
            .tabItem {
                Label("History", systemImage: "clock.arrow.circlepath")
            }

            NavigationStack {
                KidsSettingsView()
                    .environmentObject(authStore)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        KidsNotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
                    }
                    .accessibilityLabel("Notifications")
                }
            }
            .tag(KidsTab.settings)
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
        }
    }
}

private enum KidsTab {
    case home
    case history
    case settings
}

private struct KidsNotificationBellIcon: View {
    let unreadCount: Int

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(systemName: "bell")
            if unreadCount > 0 {
                Text(unreadCount > 99 ? "99+" : "\(unreadCount)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Color.red)
                    .clipShape(Capsule())
                    .offset(x: 10, y: -8)
                    .accessibilityLabel("\(unreadCount) unread notifications")
            }
        }
    }
}

private struct KidsSettingsView: View {
    @EnvironmentObject var authStore: AuthStore

    @State private var loadState: LoadState = .idle
    @State private var errorMessage = ""
    @State private var successMessage = ""
    @State private var reminderTimeZone = "Australia/Adelaide"

    @State private var dailyJobsEnabled = true
    @State private var habitsEnabled = true
    @State private var dailyJobsTime = KidsSettingsView.defaultReminderDate
    @State private var habitsTime = KidsSettingsView.defaultReminderDate

    @State private var initialSignature = ""

    private static var defaultReminderDate: Date {
        BuildTimeDate("19:00") ?? Date()
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static func BuildTimeDate(_ value: String) -> Date? {
        Self.timeFormatter.date(from: value)
    }

    private static func BuildTimeString(_ value: Date) -> String {
        Self.timeFormatter.string(from: value)
    }

    var body: some View {
        List {
            Section("Notifications") {
                Toggle("Daily jobs reminders", isOn: $dailyJobsEnabled)
                DatePicker(
                    "Daily jobs reminder time",
                    selection: $dailyJobsTime,
                    displayedComponents: .hourAndMinute
                )
                .disabled(!dailyJobsEnabled)

                Toggle("Habits reminders", isOn: $habitsEnabled)
                DatePicker(
                    "Habits reminder time",
                    selection: $habitsTime,
                    displayedComponents: .hourAndMinute
                )
                .disabled(!habitsEnabled)

                Text("Reminders send iOS notifications and update your app icon badge.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Text("Timezone: \(reminderTimeZone)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section {
                Button(loadState == .saving ? "Saving..." : "Save notification settings") {
                    Task { await saveSettings() }
                }
                .disabled(loadState == .saving || !isDirty)
            }

            if !errorMessage.isEmpty {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            if !successMessage.isEmpty {
                Section {
                    Text(successMessage)
                        .font(.footnote)
                        .foregroundStyle(.green)
                }
            }

            Section("Account") {
                Button(role: .destructive) {
                    Task { await authStore.logout() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle("Settings")
        .task {
            if loadState == .idle {
                await loadSettings()
            }
        }
    }

    private var isDirty: Bool {
        BuildSignature() != initialSignature
    }

    private func BuildSignature() -> String {
        [
            dailyJobsEnabled ? "1" : "0",
            Self.BuildTimeString(dailyJobsTime),
            habitsEnabled ? "1" : "0",
            Self.BuildTimeString(habitsTime),
        ].joined(separator: "|")
    }

    private func loadSettings() async {
        loadState = .loading
        errorMessage = ""
        successMessage = ""
        do {
            let settings = try await KidsApi.fetchReminderSettings()
            dailyJobsEnabled = settings.DailyJobsRemindersEnabled
            habitsEnabled = settings.HabitsRemindersEnabled
            dailyJobsTime = Self.BuildTimeDate(settings.DailyJobsReminderTime) ?? Self.defaultReminderDate
            habitsTime = Self.BuildTimeDate(settings.HabitsReminderTime) ?? Self.defaultReminderDate
            reminderTimeZone = settings.ReminderTimeZone
            initialSignature = BuildSignature()
            loadState = .ready
        } catch {
            loadState = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load reminder settings."
        }
    }

    private func saveSettings() async {
        guard isDirty else { return }
        loadState = .saving
        errorMessage = ""
        successMessage = ""
        do {
            let payload = KidsReminderSettingsUpdate(
                DailyJobsRemindersEnabled: dailyJobsEnabled,
                DailyJobsReminderTime: Self.BuildTimeString(dailyJobsTime),
                HabitsRemindersEnabled: habitsEnabled,
                HabitsReminderTime: Self.BuildTimeString(habitsTime)
            )
            let updated = try await KidsApi.updateReminderSettings(payload)
            dailyJobsEnabled = updated.DailyJobsRemindersEnabled
            habitsEnabled = updated.HabitsRemindersEnabled
            dailyJobsTime = Self.BuildTimeDate(updated.DailyJobsReminderTime) ?? Self.defaultReminderDate
            habitsTime = Self.BuildTimeDate(updated.HabitsReminderTime) ?? Self.defaultReminderDate
            reminderTimeZone = updated.ReminderTimeZone
            initialSignature = BuildSignature()
            successMessage = "Notification settings saved."
            loadState = .ready
        } catch {
            loadState = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to save reminder settings."
        }
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case saving
    case error
}
