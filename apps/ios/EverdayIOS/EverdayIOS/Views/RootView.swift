import SwiftUI

struct RootView: View {
    @EnvironmentObject var authStore: AuthStore
    @State private var selection: AppTab = .dashboard
    @State private var dashboardPath = NavigationPath()
    @State private var accountPath = NavigationPath()
    @State private var dashboardResetToken = UUID()
    @State private var accountResetToken = UUID()

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                TabView(selection: $selection) {
                    NavigationStack(path: $dashboardPath) {
                        DashboardView()
                            .toolbar {
                                ToolbarItem(placement: .topBarTrailing) {
                                    NavigationLink {
                                        SettingsView()
                                    } label: {
                                        Image(systemName: "gearshape")
                                    }
                                    .accessibilityLabel("Settings")
                                }
                            }
                    }
                    .id(dashboardResetToken)
                    .tag(AppTab.dashboard)
                    .toolbar(.hidden, for: .tabBar)

                    NavigationStack(path: $accountPath) {
                        AccountView()
                    }
                    .id(accountResetToken)
                    .tag(AppTab.account)
                    .toolbar(.hidden, for: .tabBar)
                }
                .safeAreaInset(edge: .bottom) {
                    CustomTabBar(
                        selection: $selection,
                        email: authStore.tokens?.email,
                        displayName: authStore.displayName,
                        onSelectDashboard: {
                            selection = .dashboard
                            dashboardPath = NavigationPath()
                            dashboardResetToken = UUID()
                        },
                        onSelectAccount: {
                            selection = .account
                            accountPath = NavigationPath()
                            accountResetToken = UUID()
                        }
                    )
                }
            } else {
                LoginView()
            }
        }
        .animation(.default, value: authStore.isAuthenticated)
    }
}

private enum AppTab: Hashable {
    case dashboard
    case account
}

private struct CustomTabBar: View {
    @Binding var selection: AppTab
    let email: String?
    let displayName: String
    let onSelectDashboard: () -> Void
    let onSelectAccount: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: 0) {
                TabBarButton(
                    title: "Dashboard",
                    systemImage: "house",
                    isSelected: selection == .dashboard,
                    action: onSelectDashboard
                )

                TabBarAvatarButton(
                    title: "Account",
                    email: email,
                    displayName: displayName,
                    isSelected: selection == .account,
                    action: onSelectAccount
                )
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(.ultraThinMaterial)
        }
    }
}

private struct TabBarButton: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .symbolEffect(.bounce, value: isSelected)
                Text(title)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(isSelected ? .primary : .secondary)
            .scaleEffect(isSelected ? 1.03 : 1.0)
            .animation(.snappy, value: isSelected)
        }
        .accessibilityLabel(title)
    }
}

private struct TabBarAvatarButton: View {
    let title: String
    let email: String?
    let displayName: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                AvatarCircleView(email: email, displayName: displayName, size: 24)
                    .overlay(
                        Circle()
                            .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
                    )
                    .scaleEffect(isSelected ? 1.05 : 1.0)
                Text(title)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(isSelected ? .primary : .secondary)
            .animation(.snappy, value: isSelected)
        }
        .accessibilityLabel(title)
    }
}
