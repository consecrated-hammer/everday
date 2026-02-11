import SwiftUI

struct SettingsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        let listView = List {
            Section("Appearance") {
                NavigationLink {
                    SettingsAppearanceView()
                } label: {
                    Label("Appearance", systemImage: "paintpalette")
                }
            }

            Section("Account") {
                NavigationLink {
                    AccountView()
                } label: {
                    Label("Account", systemImage: "person.crop.circle")
                }
            }

            if !isKid {
                Section("Health") {
                    NavigationLink {
                        HealthSettingsView()
                    } label: {
                        Label("Health settings", systemImage: "heart.text.square")
                    }
                }
            }

            if !isKid {
                Section("Tasks") {
                    NavigationLink {
                        SettingsTasksView()
                    } label: {
                        Label("Task settings", systemImage: "checklist")
                    }
                }
            }

            if isParent {
                Section("Integrations") {
                    NavigationLink {
                        SettingsIntegrationsView()
                    } label: {
                        Label("Integrations", systemImage: "bolt.horizontal")
                    }
                }

                Section("Users") {
                    NavigationLink {
                        SettingsUsersView()
                    } label: {
                        Label("User access", systemImage: "person.3")
                    }
                }
            }
            Section("System") {
                NavigationLink {
                    SystemSettingsView()
                } label: {
                    Label("System settings", systemImage: "gearshape")
                }
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
