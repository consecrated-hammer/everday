import SwiftUI

struct SystemSettingsView: View {
    @EnvironmentObject var environmentStore: EnvironmentStore
    @EnvironmentObject var authStore: AuthStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var pendingEnvironment: AppEnvironment?
    @State private var showEnvironmentAlert = false

    var body: some View {
        let listView = List {
            Section("Environment") {
                Picker("Environment", selection: Binding(
                    get: { environmentStore.current },
                    set: { newValue in
                        pendingEnvironment = newValue
                        showEnvironmentAlert = true
                    }
                )) {
                    ForEach(AppEnvironment.allCases) { env in
                        Text(env.displayName).tag(env)
                    }
                }
                .pickerStyle(.segmented)
                Text("Switching environment will sign you out.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
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
        .navigationTitle("System")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "System")
                }
            }
        }
        .alert("Switch environment?", isPresented: $showEnvironmentAlert) {
            Button("Switch", role: .destructive) {
                if let pendingEnvironment {
                    environmentStore.set(pendingEnvironment)
                    authStore.logout()
                }
                pendingEnvironment = nil
            }
            Button("Cancel", role: .cancel) {
                pendingEnvironment = nil
            }
        } message: {
            Text("Switching between DEV and PROD requires signing in again.")
        }
    }
}
