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

            Section("System status") {
                HStack {
                    statusPill(title: "API", status: apiStatus)
                    statusPill(title: "Database", status: dbStatus)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let lastChecked {
                    Text("Last checked \(formatTimestamp(lastChecked))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Status has not been checked yet.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !statusMessage.isEmpty {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await refreshStatus() }
                } label: {
                    if isRefreshing {
                        Label("Refreshing...", systemImage: "arrow.triangle.2.circlepath")
                    } else {
                        Label("Refresh status", systemImage: "arrow.triangle.2.circlepath")
                    }
                }
                .disabled(isRefreshing)
            }

            Section("Build information") {
                settingsRow(title: "Version", value: appVersion)
                settingsRow(title: "Build", value: buildNumber)
                settingsRow(title: "Environment", value: environmentStore.current.displayName)
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

    private func statusPill(title: String, status: SystemStatusState) -> some View {
        let label: String
        let color: Color
        switch status {
        case .ok:
            label = "Ready"
            color = .green
        case .error:
            label = "Offline"
            color = .red
        case .checking:
            label = "Checking"
            color = .orange
        case .idle:
            label = "Unknown"
            color = .secondary
        }

        return HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text("\(title) \(label)")
                .font(.footnote)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(Capsule())
    }

    private func settingsRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
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
