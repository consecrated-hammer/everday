import SwiftUI
import UIKit

struct SettingsIntegrationsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var authStore: AuthStore

    @State private var gmailStatus: GmailIntegrationStatus?
    @State private var googleStatus: GoogleIntegrationStatus?
    @State private var healthSettings: HealthUserSettings?

    @State private var gmailState: LoadState = .idle
    @State private var googleState: LoadState = .idle
    @State private var healthState: LoadState = .idle

    @State private var gmailError = ""
    @State private var googleError = ""
    @State private var healthError = ""

    @State private var gmailAuthState: LoadState = .idle
    @State private var googleAuthState: LoadState = .idle
    @State private var haeKeyState: LoadState = .idle

    @State private var haeKey: String?
    @State private var haeCopied = false

    var body: some View {
        let formView = Form {
            Section("Google Tasks") {
                statusRow(title: "Status", value: statusLabel(connected: googleStatus?.Connected, needsReauth: googleStatus?.NeedsReauth))
                statusRow(title: "Account", value: googleStatus?.ConnectedBy?.displayName ?? "Not connected")
                statusRow(title: "Calendar ID", value: googleStatus?.CalendarId ?? "Not set")
                statusRow(title: "Task list", value: googleStatus?.TaskListId ?? "Not set")
                statusRow(title: "Last checked", value: formatDateValue(googleStatus?.ValidatedAt))

                if let error = googleStatus?.ValidationError, !error.isEmpty {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !googleError.isEmpty {
                    Text(googleError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                HStack {
                    Button {
                        Task { await startGoogleAuth() }
                    } label: {
                        if googleAuthState == .loading {
                            Text("Opening Google...")
                        } else {
                            Text(actionLabel(status: googleStatus))
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isParent || googleAuthState == .loading)

                    Button {
                        Task { await loadGoogleStatus(validate: true) }
                    } label: {
                        if googleState == .loading {
                            Text("Checking...")
                        } else {
                            Text("Check connection")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(googleState == .loading)
                }

                if !isParent {
                    Text("Only parent accounts can manage this integration.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Gmail Intake") {
                statusRow(title: "Status", value: statusLabel(connected: gmailStatus?.Connected, needsReauth: gmailStatus?.NeedsReauth))
                statusRow(title: "Account", value: gmailStatus?.AccountEmail ?? "Not connected")
                statusRow(title: "Connected by", value: gmailStatus?.ConnectedBy?.displayName ?? "Not set")
                statusRow(title: "Last checked", value: formatDateValue(gmailStatus?.ValidatedAt))

                if let error = gmailStatus?.ValidationError, !error.isEmpty {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !gmailError.isEmpty {
                    Text(gmailError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                HStack {
                    Button {
                        Task { await startGmailAuth() }
                    } label: {
                        if gmailAuthState == .loading {
                            Text("Opening Gmail...")
                        } else {
                            Text(actionLabel(status: gmailStatus))
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isParent || gmailAuthState == .loading)

                    Button {
                        Task { await loadGmailStatus(validate: true) }
                    } label: {
                        if gmailState == .loading {
                            Text("Checking...")
                        } else {
                            Text("Check connection")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(gmailState == .loading)
                }

                if !isParent {
                    Text("Only parent accounts can manage this integration.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Health Auto Export") {
                statusRow(title: "Status", value: (healthSettings?.HaeApiKeyConfigured ?? false) ? "Connected" : "Disabled")
                statusRow(title: "Key ending", value: healthSettings?.HaeApiKeyLast4.map { "•••• \($0)" } ?? "Not set")
                statusRow(title: "Last updated", value: formatDateValue(healthSettings?.HaeApiKeyCreatedAt))

                if !healthError.isEmpty {
                    Text(healthError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                HStack {
                    Button {
                        Task { await rotateHaeKey() }
                    } label: {
                        if haeKeyState == .loading {
                            Text("Generating...")
                        } else {
                            Text((healthSettings?.HaeApiKeyConfigured ?? false) ? "Rotate key" : "Generate key")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(haeKeyState == .loading)

                    Button {
                        Task { await loadHealthSettings() }
                    } label: {
                        if healthState == .loading {
                            Text("Refreshing...")
                        } else {
                            Text("Refresh status")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(healthState == .loading)
                }

                if let haeKey {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("New API key")
                            .font(.subheadline)
                        Text(haeKey)
                            .font(.footnote)
                            .textSelection(.enabled)
                        Button {
                            UIPasteboard.general.string = haeKey
                            haeCopied = true
                        } label: {
                            Text(haeCopied ? "Key copied" : "Copy key")
                        }
                        .buttonStyle(.bordered)

                        Text("Copy this key now. It will not be shown again.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Text("Use header name X-API-Key in Health Auto Export.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                }
            }
        }

        Group {
            if horizontalSizeClass == .regular {
                formView
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
            } else {
                formView
            }
        }
        .navigationTitle("Integrations")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Integrations")
                }
            }
        }
        .task {
            if gmailState == .idle && googleState == .idle && healthState == .idle {
                await loadAll()
            }
        }
    }

    private var isParent: Bool {
        authStore.tokens?.role == "Parent"
    }

    private func loadAll() async {
        await loadGmailStatus(validate: false)
        await loadGoogleStatus(validate: false)
        await loadHealthSettings()
    }

    private func loadGmailStatus(validate: Bool) async {
        gmailState = .loading
        gmailError = ""
        do {
            gmailStatus = try await SettingsApi.fetchGmailStatus(validate: validate)
        } catch {
            gmailError = (error as? ApiError)?.message ?? "Failed to load Gmail status."
        }
        gmailState = .loaded
    }

    private func loadGoogleStatus(validate: Bool) async {
        googleState = .loading
        googleError = ""
        do {
            googleStatus = try await SettingsApi.fetchGoogleStatus(validate: validate)
        } catch {
            googleError = (error as? ApiError)?.message ?? "Failed to load Google status."
        }
        googleState = .loaded
    }

    private func loadHealthSettings() async {
        healthState = .loading
        healthError = ""
        do {
            healthSettings = try await HealthApi.fetchSettings()
        } catch {
            healthError = (error as? ApiError)?.message ?? "Failed to load health integration settings."
        }
        healthState = .loaded
    }

    private func startGmailAuth() async {
        guard isParent else { return }
        gmailAuthState = .loading
        gmailError = ""
        do {
            let response = try await SettingsApi.fetchGmailAuthUrl()
            if let url = URL(string: response.Url) {
                openURL(url)
            } else {
                gmailError = "Invalid Gmail URL returned by the server."
            }
        } catch {
            gmailError = (error as? ApiError)?.message ?? "Failed to start Gmail auth."
        }
        gmailAuthState = .loaded
    }

    private func startGoogleAuth() async {
        guard isParent else { return }
        googleAuthState = .loading
        googleError = ""
        do {
            let response = try await SettingsApi.fetchGoogleAuthUrl()
            if let url = URL(string: response.Url) {
                openURL(url)
            } else {
                googleError = "Invalid Google URL returned by the server."
            }
        } catch {
            googleError = (error as? ApiError)?.message ?? "Failed to start Google auth."
        }
        googleAuthState = .loaded
    }

    private func rotateHaeKey() async {
        haeKeyState = .loading
        haeCopied = false
        healthError = ""
        do {
            let response = try await HealthApi.rotateHaeApiKey()
            haeKey = response.ApiKey
            await loadHealthSettings()
        } catch {
            healthError = (error as? ApiError)?.message ?? "Failed to rotate Health Auto Export key."
        }
        haeKeyState = .loaded
    }

    private func statusRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }

    private func formatDateValue(_ value: String?) -> String {
        NotificationsFormatters.formatDateTime(value)
    }

    private func statusLabel(connected: Bool?, needsReauth: Bool?) -> String {
        guard let connected, connected else { return "Not connected" }
        if needsReauth == true { return "Needs reauth" }
        return "Connected"
    }

    private func actionLabel(status: GmailIntegrationStatus?) -> String {
        guard let status else { return "Connect" }
        if !status.Connected { return "Connect" }
        if status.NeedsReauth { return "Reconnect" }
        return "Reconnect"
    }

    private func actionLabel(status: GoogleIntegrationStatus?) -> String {
        guard let status else { return "Connect" }
        if !status.Connected { return "Connect" }
        if status.NeedsReauth { return "Reconnect" }
        return "Reconnect"
    }
}

private enum LoadState {
    case idle
    case loading
    case loaded
}
