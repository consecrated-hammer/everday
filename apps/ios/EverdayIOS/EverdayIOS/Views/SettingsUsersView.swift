import SwiftUI

struct SettingsUsersView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var users: [SettingsUser] = []
    @State private var loadState: LoadState = .idle
    @State private var errorMessage = ""
    @State private var searchText = ""
    @State private var showCreateSheet = false

    var body: some View {
        let listView = List {
            if loadState == .loading {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("Loading...")
                        Spacer()
                    }
                }
            }
            if !errorMessage.isEmpty {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            Section("Users") {
                if filteredUsers.isEmpty {
                    Text("No users available.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(filteredUsers) { user in
                        NavigationLink {
                            SettingsUserDetailView(user: user) { updated in
                                updateUser(updated)
                            }
                        } label: {
                            SettingsUserRow(user: user)
                        }
                    }
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search users")
        .refreshable {
            await loadUsers()
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
        .navigationTitle("Users")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Users")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add user")
            }
        }
        .task {
            if loadState == .idle {
                await loadUsers()
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            SettingsCreateUserSheet { created in
                users.append(created)
                users.sort { $0.Username.localizedCaseInsensitiveCompare($1.Username) == .orderedAscending }
            }
        }
    }

    private var filteredUsers: [SettingsUser] {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return users }
        return users.filter {
            $0.Username.localizedCaseInsensitiveContains(term)
            || $0.displayName.localizedCaseInsensitiveContains(term)
            || ($0.Email ?? "").localizedCaseInsensitiveContains(term)
        }
    }

    private func loadUsers() async {
        loadState = .loading
        errorMessage = ""
        do {
            let response = try await SettingsApi.fetchUsers()
            users = response.sorted { $0.Username.localizedCaseInsensitiveCompare($1.Username) == .orderedAscending }
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to load users."
        }
        loadState = .loaded
    }

    private func updateUser(_ updated: SettingsUser) {
        if let index = users.firstIndex(where: { $0.Id == updated.Id }) {
            users[index] = updated
        }
    }
}

private struct SettingsUserRow: View {
    let user: SettingsUser

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(user.displayName)
                .font(.headline)
            Text(user.Username)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Text(user.Role)
                if user.RequirePasswordChange {
                    Text("Password reset required")
                        .foregroundStyle(.secondary)
                }
            }
            .font(.caption)
        }
        .padding(.vertical, 4)
    }
}

private struct SettingsUserDetailView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let onUpdate: (SettingsUser) -> Void

    @State private var user: SettingsUser
    @State private var profileState: SettingsUserProfileState
    @State private var role: String

    @State private var saveError = ""
    @State private var isSaving = false

    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var resetError = ""
    @State private var resetNotice = ""
    @State private var isResetting = false

    init(user: SettingsUser, onUpdate: @escaping (SettingsUser) -> Void) {
        self.onUpdate = onUpdate
        _user = State(initialValue: user)
        _profileState = State(initialValue: SettingsUserProfileState.from(user: user))
        _role = State(initialValue: user.Role)
    }

    var body: some View {
        let formView = Form {
            if !saveError.isEmpty {
                Section {
                    Text(saveError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            Section("Profile") {
                TextField("First name", text: $profileState.firstName)
                TextField("Last name", text: $profileState.lastName)
                TextField("Email", text: $profileState.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                TextField("Discord handle", text: $profileState.discord)
            }

            Section("Role") {
                Picker("Role", selection: $role) {
                    Text("Parent").tag("Parent")
                    Text("Kid").tag("Kid")
                }
                .pickerStyle(.segmented)

                if user.RequirePasswordChange {
                    Text("Password change required on next login.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                Button {
                    Task { await saveChanges() }
                } label: {
                    if isSaving {
                        Label("Saving...", systemImage: "arrow.triangle.2.circlepath")
                    } else {
                        Label("Save changes", systemImage: "checkmark.circle")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSave)
            }

            Section("Password reset") {
                SecureField("New password", text: $password)
                SecureField("Confirm password", text: $passwordConfirm)

                Button {
                    Task { await resetPassword() }
                } label: {
                    if isResetting {
                        Label("Resetting...", systemImage: "arrow.triangle.2.circlepath")
                    } else {
                        Label("Reset password", systemImage: "key")
                    }
                }
                .buttonStyle(.bordered)
                .disabled(!canResetPassword)

                if !resetNotice.isEmpty {
                    Text(resetNotice)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if !resetError.isEmpty {
                    Text(resetError)
                        .font(.footnote)
                        .foregroundStyle(.red)
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
        .navigationTitle(user.displayName)
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: user.displayName)
                }
            }
        }
    }

    private var canSave: Bool {
        let isDirty = profileState.isDirty(comparedTo: user) || role != user.Role
        return isDirty && profileState.emailIsValid && !isSaving
    }

    private var canResetPassword: Bool {
        !password.isEmpty && password == passwordConfirm && !isResetting
    }

    private func saveChanges() async {
        guard canSave else { return }
        isSaving = true
        saveError = ""
        var updated = user
        do {
            if profileState.isDirty(comparedTo: user) {
                let request = SettingsUserProfileUpdateRequest(
                    FirstName: profileState.firstName.trimmedOrNil,
                    LastName: profileState.lastName.trimmedOrNil,
                    Email: profileState.email.trimmedOrNil,
                    DiscordHandle: profileState.discord.trimmedOrNil
                )
                updated = try await SettingsApi.updateUserProfile(userId: user.Id, request: request)
            }
            if role != updated.Role {
                updated = try await SettingsApi.updateUserRole(userId: user.Id, role: role)
            }
            applyUser(updated)
            saveError = ""
        } catch {
            saveError = (error as? ApiError)?.message ?? "Failed to save user."
        }
        isSaving = false
    }

    private func resetPassword() async {
        guard canResetPassword else { return }
        isResetting = true
        resetError = ""
        resetNotice = ""
        do {
            let updated = try await SettingsApi.updateUserPassword(userId: user.Id, newPassword: password)
            applyUser(updated)
            password = ""
            passwordConfirm = ""
            resetNotice = "Password reset and user will be prompted to change it."
        } catch {
            resetError = (error as? ApiError)?.message ?? "Failed to reset password."
        }
        isResetting = false
    }

    private func applyUser(_ updated: SettingsUser) {
        user = updated
        profileState = SettingsUserProfileState.from(user: updated)
        role = updated.Role
        onUpdate(updated)
    }
}

private struct SettingsUserProfileState: Equatable {
    var firstName: String
    var lastName: String
    var email: String
    var discord: String

    static func from(user: SettingsUser) -> SettingsUserProfileState {
        SettingsUserProfileState(
            firstName: user.FirstName ?? "",
            lastName: user.LastName ?? "",
            email: user.Email ?? "",
            discord: user.DiscordHandle ?? ""
        )
    }

    func isDirty(comparedTo user: SettingsUser) -> Bool {
        firstName.trimmed != (user.FirstName ?? "")
            || lastName.trimmed != (user.LastName ?? "")
            || email.trimmed != (user.Email ?? "")
            || discord.trimmed != (user.DiscordHandle ?? "")
    }

    var emailIsValid: Bool {
        let trimmed = email.trimmed
        if trimmed.isEmpty { return true }
        return trimmed.contains("@")
    }
}

private struct SettingsCreateUserSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onCreate: (SettingsUser) -> Void

    @State private var username = ""
    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var role = "Kid"
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var discord = ""
    @State private var requirePasswordChange = true

    @State private var errorMessage = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                Section("Required") {
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                    SecureField("Confirm password", text: $passwordConfirm)
                    Picker("Role", selection: $role) {
                        Text("Parent").tag("Parent")
                        Text("Kid").tag("Kid")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Profile") {
                    TextField("First name", text: $firstName)
                    TextField("Last name", text: $lastName)
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    TextField("Discord handle", text: $discord)
                }

                Section("Security") {
                    Toggle("Require password change", isOn: $requirePasswordChange)
                    Text("The user will be prompted to change their password at first login.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button {
                        Task { await createUser() }
                    } label: {
                        if isSaving {
                            Label("Creating...", systemImage: "arrow.triangle.2.circlepath")
                        } else {
                            Label("Create user", systemImage: "person.badge.plus")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canCreate)
                }
            }
            .navigationTitle("New user")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var canCreate: Bool {
        let isDirty = !username.trimmed.isEmpty || !password.isEmpty || !firstName.trimmed.isEmpty || !lastName.trimmed.isEmpty
        let valid = !username.trimmed.isEmpty && !password.isEmpty && password == passwordConfirm
        return isDirty && valid && !isSaving
    }

    private func createUser() async {
        guard canCreate else { return }
        isSaving = true
        errorMessage = ""
        do {
            let request = SettingsUserCreateRequest(
                Username: username.trimmed,
                Password: password,
                Role: role,
                FirstName: firstName.trimmedOrNil,
                LastName: lastName.trimmedOrNil,
                Email: email.trimmedOrNil,
                DiscordHandle: discord.trimmedOrNil,
                RequirePasswordChange: requirePasswordChange
            )
            let created = try await SettingsApi.createUser(request)
            onCreate(created)
            dismiss()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Failed to create user."
        }
        isSaving = false
    }
}

private enum LoadState {
    case idle
    case loading
    case loaded
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var trimmedOrNil: String? {
        let value = trimmed
        return value.isEmpty ? nil : value
    }
}
