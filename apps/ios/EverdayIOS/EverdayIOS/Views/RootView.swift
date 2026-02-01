import SwiftUI

struct RootView: View {
    @EnvironmentObject var authStore: AuthStore
    @State private var selection: AppTab = .dashboard
    @State private var dashboardPath = NavigationPath()
    @State private var settingsPath = NavigationPath()
    @State private var dashboardResetToken = UUID()
    @State private var settingsResetToken = UUID()

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                if authStore.tokens?.role == "Kid" {
                    KidsRootView()
                } else {
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

                        NavigationStack(path: $settingsPath) {
                            SettingsView()
                        }
                        .id(settingsResetToken)
                        .tag(AppTab.settings)
                        .toolbar(.hidden, for: .tabBar)
                    }
                    .safeAreaInset(edge: .bottom) {
                        CustomTabBar(
                            selection: $selection,
                            onSelectDashboard: {
                                selection = .dashboard
                                dashboardPath = NavigationPath()
                                dashboardResetToken = UUID()
                            },
                            onSelectSettings: {
                                selection = .settings
                                settingsPath = NavigationPath()
                                settingsResetToken = UUID()
                            }
                        )
                    }
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
    case settings
}

private struct CustomTabBar: View {
    @Binding var selection: AppTab
    let onSelectDashboard: () -> Void
    let onSelectSettings: () -> Void

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

                TabBarButton(
                    title: "Settings",
                    systemImage: "gearshape",
                    isSelected: selection == .settings,
                    action: onSelectSettings
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
