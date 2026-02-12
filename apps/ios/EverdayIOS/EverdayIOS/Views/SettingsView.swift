import SwiftUI

struct SettingsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        let listView = List {
            NavigationLink {
                SettingsAppearanceView()
            } label: {
                Label("Appearance", systemImage: "paintpalette")
            }

            NavigationLink {
                AccountView()
            } label: {
                Label("Account", systemImage: "person.crop.circle")
            }

            if !isKid {
                NavigationLink {
                    HealthSettingsView()
                } label: {
                    Label("Health settings", systemImage: "heart.text.square")
                }
            }

            if !isKid {
                NavigationLink {
                    SettingsTasksView()
                } label: {
                    Label("Task settings", systemImage: "checklist")
                }
            }

            if isKid {
                NavigationLink {
                    NotificationsView()
                } label: {
                    Label("Notification inbox", systemImage: "bell")
                }

                NavigationLink {
                    KidsReminderSettingsView()
                } label: {
                    Label("Reminder settings", systemImage: "bell.badge")
                }
            }

            if isParent {
                NavigationLink {
                    SettingsIntegrationsView()
                } label: {
                    Label("Integrations", systemImage: "bolt.horizontal")
                }

                NavigationLink {
                    SettingsUsersView()
                } label: {
                    Label("User access", systemImage: "person.3")
                }
            }

            NavigationLink {
                SystemSettingsView()
            } label: {
                Label("System settings", systemImage: "gearshape")
            }
        }

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
