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
