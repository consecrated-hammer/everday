import SwiftUI

struct LoggedInView: View {
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Signed in")
                    .font(.title.bold())
                Text(authStore.displayName)
                    .font(.title2)
                    .foregroundStyle(.secondary)

                Button("Sign out") {
                    authStore.logout()
                }
                .buttonStyle(.bordered)

                Spacer()
            }
            .padding(24)
            .navigationTitle("Account")
        }
    }
}
