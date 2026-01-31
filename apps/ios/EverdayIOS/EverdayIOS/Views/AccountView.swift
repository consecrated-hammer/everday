import SwiftUI

struct AccountView: View {
    @EnvironmentObject var authStore: AuthStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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
                    authStore.logout()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
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
}
