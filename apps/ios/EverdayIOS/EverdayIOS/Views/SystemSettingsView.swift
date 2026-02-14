import SwiftUI

struct SystemSettingsView: View {
    @EnvironmentObject var environmentStore: EnvironmentStore
    @EnvironmentObject var authStore: AuthStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var pendingEnvironment: AppEnvironment?
    @State private var showEnvironmentAlert = false
    @State private var apiStatus: SystemStatusState = .idle
    @State private var dbStatus: SystemStatusState = .idle
    @State private var lastChecked: Date?
    @State private var statusMessage = ""
    @State private var isRefreshing = false

    var body: some View {
        let listView = List {
            Section {
                settingsRow(
                    title: "API",
                    value: statusLabel(for: apiStatus),
                    valueColor: statusColor(for: apiStatus)
                )
                settingsRow(
                    title: "Database",
                    value: statusLabel(for: dbStatus),
                    valueColor: statusColor(for: dbStatus)
                )

                Button {
                    Task { await refreshStatus() }
                } label: {
                    Text(isRefreshing ? "Refreshing..." : "Refresh")
                }
                .disabled(isRefreshing)

                if !statusMessage.isEmpty {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            } header: {
                Text("Status")
            } footer: {
                statusFooterText
            }

            Section {
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
            } header: {
                Text("Environment")
            } footer: {
                Text("Switching environment will sign you out.")
            }

            Section {
                settingsRow(title: "Version", value: appVersion)
                settingsRow(title: "Build", value: buildNumber)
                settingsRow(title: "Environment", value: environmentStore.current.displayName)
            } header: {
                Text("Build")
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
        .navigationTitle("Diagnostics")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Diagnostics")
                }
            }
        }
        .task {
            if apiStatus == .idle && dbStatus == .idle {
                await refreshStatus()
            }
        }
        .alert("Switch environment?", isPresented: $showEnvironmentAlert) {
            Button("Switch", role: .destructive) {
                if let pendingEnvironment {
                    let targetEnvironment = pendingEnvironment
                    Task {
                        await authStore.logout()
                        environmentStore.set(targetEnvironment)
                    }
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

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "dev"
    }

    private var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "dev"
    }

    private func refreshStatus() async {
        isRefreshing = true
        statusMessage = ""
        apiStatus = .checking
        dbStatus = .checking
        do {
            async let apiResponse: SystemStatusResponse = ApiClient.shared.request(path: "health", requiresAuth: false)
            async let dbResponse: SystemStatusResponse = ApiClient.shared.request(path: "health/db", requiresAuth: false)
            let (api, db) = try await (apiResponse, dbResponse)
            apiStatus = api.status.lowercased() == "ok" ? .ok : .error
            dbStatus = db.status.lowercased() == "ok" ? .ok : .error
            if api.status.lowercased() != "ok", let detail = api.detail, !detail.isEmpty {
                statusMessage = detail
            }
            if db.status.lowercased() != "ok", let detail = db.detail, !detail.isEmpty {
                statusMessage = detail
            }
        } catch {
            apiStatus = .error
            dbStatus = .error
            statusMessage = (error as? ApiError)?.message ?? "Failed to check system status."
        }
        lastChecked = Date()
        isRefreshing = false
    }

    private var statusFooterText: Text {
        if let lastChecked {
            return Text("Last checked \(formatTimestamp(lastChecked))")
        }
        return Text("Status has not been checked yet.")
    }

    private func settingsRow(title: String, value: String, valueColor: Color = .secondary) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(valueColor)
        }
    }

    private func statusLabel(for status: SystemStatusState) -> String {
        switch status {
        case .ok:
            return "Ready"
        case .error:
            return "Offline"
        case .checking:
            return "Checking"
        case .idle:
            return "Unknown"
        }
    }

    private func statusColor(for status: SystemStatusState) -> Color {
        switch status {
        case .ok:
            return .green
        case .error:
            return .red
        case .checking:
            return .orange
        case .idle:
            return .secondary
        }
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private enum SystemStatusState {
    case idle
    case checking
    case ok
    case error
}
