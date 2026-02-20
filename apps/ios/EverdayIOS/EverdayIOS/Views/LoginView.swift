import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var environmentStore: EnvironmentStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var username = ""
    @State private var password = ""
    @State private var errorMessage = ""
    @State private var isLoading = false
    @State private var isPasswordVisible = false
    @FocusState private var focusedField: Field?

    private enum Field {
        case username
        case password
    }

    private var canSubmit: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !password.isEmpty && !isLoading
    }

    private var logoMaxWidth: CGFloat {
        if horizontalSizeClass == .regular {
            return 360
        }
        return min(UIScreen.main.bounds.width * 0.78, 320)
    }

    private var createAccountWebUrl: URL? {
        URL(string: "\(environmentStore.current.baseUrl)/create-account")
    }

    var body: some View {
        NavigationStack {
            let content = VStack(spacing: 20) {
                VStack(spacing: 10) {
                    Image("EverdayFull")
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: logoMaxWidth)
                        .padding(.top, 8)
                        .accessibilityLabel("Everday")

                    VStack(spacing: 6) {
                        Text("Everday")
                            .font(.largeTitle.bold())
                        Text("Sign in to continue")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("Paul Family companion app")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.username)
                        .submitLabel(.next)
                        .focused($focusedField, equals: .username)
                        .onSubmit {
                            focusedField = .password
                        }
                        .textFieldStyle(.roundedBorder)

                    ZStack(alignment: .trailing) {
                        if isPasswordVisible {
                            TextField("Password", text: $password)
                                .textContentType(.password)
                                .submitLabel(.go)
                                .focused($focusedField, equals: .password)
                                .onSubmit {
                                    onSubmit()
                                }
                                .textFieldStyle(.roundedBorder)
                                .padding(.trailing, 36)
                        } else {
                            SecureField("Password", text: $password)
                                .textContentType(.password)
                                .submitLabel(.go)
                                .focused($focusedField, equals: .password)
                                .onSubmit {
                                    onSubmit()
                                }
                                .textFieldStyle(.roundedBorder)
                                .padding(.trailing, 36)
                        }
                        Button {
                            isPasswordVisible.toggle()
                        } label: {
                            Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                        .padding(.trailing, 8)
                        .accessibilityLabel(isPasswordVisible ? "Hide password" : "Show password")
                    }
                }

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityLabel("Error")
                }

                Button(action: onSubmit) {
                    HStack {
                        if isLoading {
                            ProgressView()
                        }
                        Text(isLoading ? "Signing in" : "Sign in")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit)

                NavigationLink {
                    CreateAccountView()
                } label: {
                    Text("Create account")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                NavigationLink {
                    ResetPasswordView()
                } label: {
                    Text("Forgot password?")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                if let webCreateAccountUrl = createAccountWebUrl {
                    Link(destination: webCreateAccountUrl) {
                        Text("Need web setup? Open \(environmentStore.current.displayName) create account")
                            .font(.footnote)
                    }
                    .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding(24)
            .navigationTitle("")
            .navigationBarHidden(true)
            .safeAreaInset(edge: .bottom) {
                FooterEnvironmentView {
                    clearCredentialsForEnvironmentChange()
                }
            }

            ZStack {
                LoginBackgroundView()
                Group {
                    if horizontalSizeClass == .regular {
                        content
                            .frame(maxWidth: 520)
                            .frame(maxWidth: .infinity)
                    } else {
                        content
                    }
                }
            }
        }
    }

    private func onSubmit() {
        guard canSubmit else { return }
        errorMessage = ""
        isLoading = true

        Task {
            do {
                try await authStore.login(username: username, password: password)
            } catch {
                errorMessage = errorMessageFor(error)
            }
            isLoading = false
        }
    }

    private func errorMessageFor(_ error: Error) -> String {
        if let apiError = error as? ApiError {
            return apiError.message
        }
        return "Login failed"
    }

    private func clearCredentialsForEnvironmentChange() {
        username = ""
        password = ""
        errorMessage = ""
        isPasswordVisible = false
        focusedField = nil
    }
}

private struct FooterEnvironmentView: View {
    @EnvironmentObject var environmentStore: EnvironmentStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showDetails = false
    let onEnvironmentChanged: () -> Void

    var body: some View {
        Button {
            showDetails = true
        } label: {
            Label("Environment info", systemImage: "info.circle")
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity)
        .padding(.bottom, 8)
        .accessibilityLabel(accessibilityText)
        .popover(isPresented: popoverBinding) {
            EnvironmentInfoSheet(onEnvironmentChanged: onEnvironmentChanged)
        }
        .sheet(isPresented: sheetBinding) {
            EnvironmentInfoSheet(onEnvironmentChanged: onEnvironmentChanged)
        }
    }

    private var popoverBinding: Binding<Bool> {
        Binding(
            get: { showDetails && horizontalSizeClass == .regular },
            set: { showDetails = $0 }
        )
    }

    private var sheetBinding: Binding<Bool> {
        Binding(
            get: { showDetails && horizontalSizeClass != .regular },
            set: { showDetails = $0 }
        )
    }

    private var accessibilityText: String {
        "Environment \(environmentStore.current.displayName). API base URL \(environmentStore.current.baseUrl)"
    }
}

private struct EnvironmentInfoSheet: View {
    @EnvironmentObject var environmentStore: EnvironmentStore
    @Environment(\.dismiss) private var dismiss
    @State private var pendingEnvironment: AppEnvironment?
    @State private var showSwitchAlert = false
    let onEnvironmentChanged: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Current environment") {
                    Text(environmentStore.current.displayName)
                        .font(.headline)
                    if let url = URL(string: environmentStore.current.baseUrl) {
                        HStack(spacing: 4) {
                            Text("URL:")
                                .foregroundStyle(.primary)
                            Link(environmentStore.current.baseUrl, destination: url)
                        }
                        .font(.subheadline)
                    } else {
                        Text("URL: \(environmentStore.current.baseUrl)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Switch environment") {
                    environmentOptionButton(
                        title: "PROD",
                        subtitle: "Recommended for normal use",
                        target: .prod
                    )
                    environmentOptionButton(
                        title: "DEV",
                        subtitle: "Advanced option for testing",
                        target: .dev,
                        deEmphasized: true
                    )
                    Text("Changing environment clears typed login details.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Info")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("Switch environment?", isPresented: $showSwitchAlert) {
                Button("Switch", role: .destructive) {
                    guard let target = pendingEnvironment else { return }
                    environmentStore.set(target)
                    onEnvironmentChanged()
                    pendingEnvironment = nil
                }
                Button("Cancel", role: .cancel) {
                    pendingEnvironment = nil
                }
            } message: {
                Text("Switch to \(pendingEnvironment?.displayName ?? "")? You will need to re-enter login details.")
            }
        }
    }

    @ViewBuilder
    private func environmentOptionButton(
        title: String,
        subtitle: String,
        target: AppEnvironment,
        deEmphasized: Bool = false
    ) -> some View {
        Button {
            guard target != environmentStore.current else { return }
            pendingEnvironment = target
            showSwitchAlert = true
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(deEmphasized ? .secondary : .primary)
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if target == environmentStore.current {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct LoginBackgroundView: View {
    var body: some View {
        LinearGradient(
            colors: [
                Color(.systemTeal).opacity(0.22),
                Color(.systemMint).opacity(0.16),
                Color(.systemBackground)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }
}
