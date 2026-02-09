import SwiftUI

struct ResetPasswordView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var identifier = ""
    @State private var resetToken = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""

    @State private var requestMessage = ""
    @State private var requestError = ""
    @State private var isRequesting = false

    @State private var resetMessage = ""
    @State private var resetError = ""
    @State private var isResetting = false

    @State private var showPassword = false

    private let authService = AuthService()

    var body: some View {
        Form {
            Section {
                Text("Request a password reset and set a new password using the emailed token.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Request reset") {
                TextField("Username or email", text: $identifier)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.username)

                Button(isRequesting ? "Sending..." : "Send reset email") {
                    Task { await sendReset() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canRequest)

                if !requestMessage.isEmpty {
                    Text(requestMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !requestError.isEmpty {
                    Text(requestError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            Section("Apply reset") {
                TextField("Reset token", text: $resetToken)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                if showPassword {
                    TextField("New password", text: $newPassword)
                        .textContentType(.newPassword)
                } else {
                    SecureField("New password", text: $newPassword)
                        .textContentType(.newPassword)
                }

                if showPassword {
                    TextField("Confirm password", text: $confirmPassword)
                        .textContentType(.newPassword)
                } else {
                    SecureField("Confirm password", text: $confirmPassword)
                        .textContentType(.newPassword)
                }

                Toggle("Show password", isOn: $showPassword)

                Button(isResetting ? "Resetting..." : "Reset password") {
                    Task { await resetPassword() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canReset)

                if !resetMessage.isEmpty {
                    Text(resetMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !resetError.isEmpty {
                    Text(resetError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button("Back to sign in") {
                    dismiss()
                }
                .buttonStyle(.bordered)
            }
        }
        .navigationTitle("Reset password")
    }

    private var canRequest: Bool {
        let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && !isRequesting
    }

    private var canReset: Bool {
        let tokenOk = !resetToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let passwordOk = !newPassword.isEmpty && newPassword == confirmPassword
        return tokenOk && passwordOk && !isResetting
    }

    private func sendReset() async {
        requestMessage = ""
        requestError = ""
        let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isRequesting = true
        do {
            try await authService.requestPasswordReset(identifier: trimmed)
            requestMessage = "If the account exists, a reset email has been sent."
        } catch {
            requestError = (error as? ApiError)?.message ?? "Failed to send reset email."
        }
        isRequesting = false
    }

    private func resetPassword() async {
        resetMessage = ""
        resetError = ""
        guard canReset else { return }
        isResetting = true
        do {
            try await authService.resetPassword(token: resetToken, newPassword: newPassword)
            resetMessage = "Password reset successful. You can sign in with your new password."
        } catch {
            resetError = (error as? ApiError)?.message ?? "Failed to reset password."
        }
        isResetting = false
    }
}
