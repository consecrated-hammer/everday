import SwiftUI

struct SettingsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        let listView = List {
            Section("Preferences") {
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
}
