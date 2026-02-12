import SwiftUI

struct RootView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var pushCoordinator: PushNotificationCoordinator
    @Environment(\.openURL) private var openURL
    @State private var selection: AppTab = .dashboard
    @State private var dashboardPath = NavigationPath()
    @State private var settingsPath = NavigationPath()
    @State private var dashboardResetToken = UUID()
    @State private var settingsResetToken = UUID()
    @AppStorage("everday.appearance.theme") private var appearanceTheme = "system"

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                if authStore.tokens?.role == "Kid" {
                    KidsRootView()
                } else {
                    VStack(spacing: 0) {
                        TabView(selection: $selection) {
                            NavigationStack(path: $dashboardPath) {
                                DashboardView()
                                    .navigationDestination(for: DashboardRoute.self) { route in
                                        route.destination
                                    }
                            }
                            .toolbar {
                                ToolbarItemGroup(placement: .topBarTrailing) {
                                    Button {
                                        navigateToNotifications()
                                    } label: {
                                        NotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
                                    }
                                    .accessibilityLabel("Notifications")

                                    NavigationLink {
                                        SettingsView()
                                    } label: {
                                        Image(systemName: "gearshape")
                                    }
                                    .accessibilityLabel("Settings")
                                }
                            }
                            .id(dashboardResetToken)
                            .tag(AppTab.dashboard)
                            .toolbar(.hidden, for: .tabBar)

                            NavigationStack(path: $settingsPath) {
                                SettingsView()
                            }
                            .toolbar {
                                ToolbarItem(placement: .topBarTrailing) {
                                    Button {
                                        selection = .dashboard
                                        navigateToNotifications()
                                    } label: {
                                        NotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
                                    }
                                    .accessibilityLabel("Notifications")
                                }
                            }
                            .id(settingsResetToken)
                            .tag(AppTab.settings)
                            .toolbar(.hidden, for: .tabBar)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

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
        .preferredColorScheme(resolvedColorScheme)
        .onReceive(pushCoordinator.$pendingLinkUrl) { rawLink in
            guard let rawLink, authStore.isAuthenticated else { return }
            handlePendingLink(rawLink)
            pushCoordinator.consumePendingLink()
        }
    }

    private var resolvedColorScheme: ColorScheme? {
        switch appearanceTheme {
        case "light":
            return .light
        case "dark":
            return .dark
        default:
            return nil
        }
    }

    private func handlePendingLink(_ rawLink: String) {
        switch ResolveDeepLink(rawLink) {
        case .dashboard(let route):
            selection = .dashboard
            dashboardPath = NavigationPath()
            dashboardResetToken = UUID()
            if let route {
                dashboardPath.append(route)
            }
        case .settings:
            selection = .settings
            settingsPath = NavigationPath()
            settingsResetToken = UUID()
        case .external(let url):
            openURL(url)
        }
    }

    private func navigateToNotifications() {
        dashboardPath = NavigationPath()
        dashboardResetToken = UUID()
        dashboardPath.append(DashboardRoute.notifications)
    }

    private func ResolveDeepLink(_ rawLink: String) -> ResolvedDeepLink {
        let trimmed = rawLink.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return .dashboard(.notifications)
        }

        if let parsed = URL(string: trimmed), let scheme = parsed.scheme?.lowercased() {
            if scheme == "http" || scheme == "https" {
                if IsInternalHost(parsed) {
                    return ResolvePath(parsed.path)
                }
                return .external(parsed)
            }
            return .external(parsed)
        }

        let normalized = trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)"
        return ResolvePath(normalized)
    }

    private func IsInternalHost(_ url: URL) -> Bool {
        guard let incomingHost = url.host?.lowercased() else { return false }
        let baseRaw = EnvironmentStore.resolvedEnvironment().baseUrl
        let withScheme = baseRaw.hasPrefix("http") ? baseRaw : "https://\(baseRaw)"
        guard let baseHost = URL(string: withScheme)?.host?.lowercased() else { return false }
        return incomingHost == baseHost
    }

    private func ResolvePath(_ path: String) -> ResolvedDeepLink {
        let normalized = path.lowercased()
        if normalized == "/" {
            return .dashboard(nil)
        }
        if normalized.hasPrefix("/settings") {
            return .settings
        }
        if normalized.hasPrefix("/health") {
            return .dashboard(.health)
        }
        if normalized.hasPrefix("/budget") {
            return .dashboard(.budget)
        }
        if normalized.hasPrefix("/life-admin") {
            return .dashboard(.lifeAdmin)
        }
        if normalized.hasPrefix("/kids-admin") {
            return .dashboard(.kidsAdmin)
        }
        if normalized.hasPrefix("/kids") {
            return .dashboard(.kids)
        }
        if normalized.hasPrefix("/shopping") {
            return .dashboard(.shopping)
        }
        if normalized.hasPrefix("/tasks") {
            return .dashboard(.tasks)
        }
        if normalized.hasPrefix("/notes") {
            return .dashboard(.notes)
        }
        if normalized.hasPrefix("/notifications") {
            return .dashboard(.notifications)
        }
        return .dashboard(.notifications)
    }
}

private enum AppTab: Hashable {
    case dashboard
    case settings
}

private enum ResolvedDeepLink {
    case dashboard(DashboardRoute?)
    case settings
    case external(URL)
}

private enum DashboardRoute: Hashable {
    case health
    case budget
    case lifeAdmin
    case kidsAdmin
    case kids
    case shopping
    case tasks
    case notes
    case notifications

    @ViewBuilder
    var destination: some View {
        switch self {
        case .health:
            HealthRootView()
        case .budget:
            BudgetRootView()
        case .lifeAdmin:
            LifeAdminRootView()
        case .kidsAdmin:
            KidsAdminView()
        case .kids:
            KidsRootView()
        case .shopping:
            ShoppingView()
        case .tasks:
            TasksView()
        case .notes:
            NotesView()
        case .notifications:
            NotificationsView()
        }
    }
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

private struct NotificationBellIcon: View {
    let unreadCount: Int

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(systemName: "bell")
            if unreadCount > 0 {
                Text(BadgeText(unreadCount))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Color.red)
                    .clipShape(Capsule())
                    .offset(x: 10, y: -8)
                    .accessibilityLabel("\(unreadCount) unread notifications")
            }
        }
    }

    private func BadgeText(_ count: Int) -> String {
        if count > 99 {
            return "99+"
        }
        return "\(count)"
    }
}
