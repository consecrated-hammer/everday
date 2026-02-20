import SwiftUI

struct CreateAccountView: View {
    @EnvironmentObject var environmentStore: EnvironmentStore
    @State private var username = ""
    @State private var password = ""
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var discordHandle = ""
    @State private var isSubmitting = false
    @State private var noticeMessage = ""
    @State private var errorMessage = ""

    private let authService = AuthService()

    private var canSubmit: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !password.isEmpty &&
        !isSubmitting
    }

    private var createAccountWebUrl: URL? {
        URL(string: "\(environmentStore.current.baseUrl)/create-account")
    }

    var body: some View {
        Form {
            Section {
                Text("Everday iOS is a companion app to the Everday web app for the Paul Family household.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text("A parent with an existing account must approve your request before you can sign in.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Create account request") {
                TextField("Username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.username)

                SecureField("Password", text: $password)
                    .textContentType(.newPassword)

                TextField("First name", text: $firstName)
                    .textContentType(.givenName)

                TextField("Last name", text: $lastName)
                    .textContentType(.familyName)

                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)

                TextField("Discord handle", text: $discordHandle)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Button(isSubmitting ? "Submitting..." : "Submit request") {
                    Task { await submit() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit)
            }

            if !noticeMessage.isEmpty {
                Section {
                    Text(noticeMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if !errorMessage.isEmpty {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            Section("Web account page") {
                if let url = createAccountWebUrl {
                    Link(
                        "Open \(environmentStore.current.displayName) create account page",
                        destination: url
                    )
                        .font(.footnote)
                }
            }
        }
        .navigationTitle("Create account")
    }

    private func submit() async {
        noticeMessage = ""
        errorMessage = ""

        let trimmedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedUsername.isEmpty, !password.isEmpty else {
            errorMessage = "Username and password are required."
            return
        }

        isSubmitting = true
        do {
            let response = try await authService.register(
                request: RegisterRequestPayload(
                    username: trimmedUsername,
                    password: password,
                    firstName: firstName.nilIfBlank,
                    lastName: lastName.nilIfBlank,
                    email: email.nilIfBlank,
                    discordHandle: discordHandle.nilIfBlank
                )
            )
            noticeMessage = response.message
            password = ""
        } catch {
            let apiMessage = (error as? ApiError)?.message ?? ""
            if apiMessage.caseInsensitiveCompare("Method Not Allowed") == .orderedSame {
                errorMessage = "This server does not support account requests yet. " +
                    "Switch to DEV or deploy /api/auth/register."
            } else {
                errorMessage = apiMessage.isEmpty ? "Failed to submit account request." : apiMessage
            }
        }
        isSubmitting = false
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
