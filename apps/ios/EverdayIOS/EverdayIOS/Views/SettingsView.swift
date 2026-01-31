import SwiftUI

struct SettingsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        let listView = List {
            Section("Health") {
                NavigationLink {
                    HealthSettingsView()
                } label: {
                    Label("Health settings", systemImage: "heart.text.square")
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
}
