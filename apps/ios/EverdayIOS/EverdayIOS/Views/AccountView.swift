import SwiftUI

struct AccountView: View {
    @EnvironmentObject var authStore: AuthStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showDeleteConfirm = false
    @State private var deleteAccountError: String?
    @State private var isDeletingAccount = false

    var body: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    AvatarCircleView(email: authStore.tokens?.email, displayName: authStore.displayName, size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(authStore.displayName)
                            .font(.headline)
                        Text(authStore.tokens?.email ?? "")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 6)
            }

            Section("Account") {
                HStack {
                    Text("Role")
                    Spacer()
                    Text(authStore.tokens?.role ?? "Parent")
                        .foregroundStyle(.secondary)
                }

                Button(role: .destructive) {
                    Task { await authStore.logout() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .disabled(isDeletingAccount)

                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    if isDeletingAccount {
                        Label("Deleting account...", systemImage: "hourglass")
                    } else {
                        Label("Delete account", systemImage: "trash")
                    }
                }
                .disabled(isDeletingAccount)
            }
        }
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .alert("Delete account permanently?", isPresented: $showDeleteConfirm) {
            Button("Delete account", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently delete your account and all associated data. This cannot be undone. Shared history for other users may show Deleted user.")
        }
        .alert("Delete account failed", isPresented: Binding(
            get: { deleteAccountError != nil },
            set: { if !$0 { deleteAccountError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deleteAccountError ?? "Unable to delete account.")
        }
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Account")
                }
            }
        }
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private func deleteAccount() async {
        guard !isDeletingAccount else { return }
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        do {
            try await authStore.deleteAccount()
        } catch {
            deleteAccountError = (error as? ApiError)?.message ?? "Unable to delete account."
        }
    }
}
