import SwiftUI

struct RootView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var pushCoordinator: PushNotificationCoordinator
    @Environment(\.openURL) private var openURL

    @State private var selection: ParentTab = .dashboard
    @State private var dashboardPath = NavigationPath()
    @State private var healthPath = NavigationPath()
    @State private var shoppingPath = NavigationPath()
    @State private var kidsAdminPath = NavigationPath()
    @State private var morePath = NavigationPath()
    @State private var healthQuickLogMealRequestNonce = 0
    @State private var healthQuickLogStepsRequestNonce = 0
    @State private var healthQuickLogWeightRequestNonce = 0
    @State private var healthOpenLogRequestNonce = 0
    @State private var healthOpenFoodsRequestNonce = 0

    @AppStorage("everday.appearance.theme") private var appearanceTheme = "system"

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                if authStore.tokens?.role == "Kid" {
                    KidsRootView()
                } else {
                    parentTabView
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

    private var parentTabView: some View {
        TabView(selection: $selection) {
            NavigationStack(path: $dashboardPath) {
                DashboardView(
                    visibleModules: visibleDashboardModules,
                    onSelectModule: handleDashboardModuleSelection,
                    onQuickAction: handleDashboardQuickAction
                )
                    .navigationDestination(for: ParentRoute.self) { route in
                        route.destination
                    }
                    .toolbar { parentToolbar }
            }
            .tabItem {
                Label("Dashboard", systemImage: "square.grid.2x2")
            }
            .tag(ParentTab.dashboard)

            NavigationStack(path: $healthPath) {
                HealthRootView(
                    quickLogMealRequestNonce: healthQuickLogMealRequestNonce,
                    quickLogStepsRequestNonce: healthQuickLogStepsRequestNonce,
                    quickLogWeightRequestNonce: healthQuickLogWeightRequestNonce,
                    openHealthLogRequestNonce: healthOpenLogRequestNonce,
                    openHealthFoodsRequestNonce: healthOpenFoodsRequestNonce
                )
                    .navigationDestination(for: ParentRoute.self) { route in
                        route.destination
                    }
                    .toolbar { parentToolbar }
            }
            .tabItem {
                Label("Health", systemImage: "heart.text.square")
            }
            .tag(ParentTab.health)

            NavigationStack(path: $shoppingPath) {
                ShoppingView()
                    .navigationDestination(for: ParentRoute.self) { route in
                        route.destination
                    }
                    .toolbar { parentToolbar }
            }
            .tabItem {
                Label("Shopping", systemImage: "cart")
            }
            .tag(ParentTab.shopping)

            NavigationStack(path: $kidsAdminPath) {
                KidsAdminView()
                    .navigationDestination(for: ParentRoute.self) { route in
                        route.destination
                    }
                    .toolbar { parentToolbar }
            }
            .tabItem {
                Label("Kids admin", systemImage: "person.2")
            }
            .tag(ParentTab.kidsAdmin)

            NavigationStack(path: $morePath) {
                MoreView(
                    unreadCount: pushCoordinator.unreadCount,
                    showWipModules: shouldShowWipModules
                )
                    .navigationDestination(for: ParentRoute.self) { route in
                        route.destination
                    }
                    .toolbar { parentToolbar }
            }
            .tabItem {
                Label("More", systemImage: "ellipsis.circle")
            }
            .badge(pushCoordinator.unreadCount)
            .tag(ParentTab.more)
        }
    }

    @ToolbarContentBuilder
    private var parentToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                navigateToNotifications()
            } label: {
                NotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Notifications")

            Button {
                navigateToSettings()
            } label: {
                Image(systemName: "gearshape")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Settings")
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

    private var shouldShowWipModules: Bool {
        authStore.currentUserId == 1
    }

    private var visibleDashboardModules: [DashboardModule] {
        shouldShowWipModules ? DashboardModule.defaultOrder : DashboardModule.coreOrder
    }

    private func handlePendingLink(_ rawLink: String) {
        switch resolveDeepLink(rawLink) {
        case .selectTab(let tab):
            selection = tab
            resetPath(for: tab)
        case .push(let tab, let route):
            selection = tab
            resetPath(for: tab)
            appendRoute(route, to: tab)
        case .external(let url):
            openURL(url)
        }
    }

    private func navigateToNotifications() {
        appendRoute(.notifications)
    }

    private func navigateToSettings() {
        appendRoute(.settings)
    }

    private func triggerQuickLogMealShortcut() {
        selection = .health
        resetPath(for: .health)
        healthQuickLogMealRequestNonce += 1
    }

    private func triggerQuickLogStepsShortcut() {
        selection = .health
        resetPath(for: .health)
        healthQuickLogStepsRequestNonce += 1
    }

    private func triggerQuickLogWeightShortcut() {
        selection = .health
        resetPath(for: .health)
        healthQuickLogWeightRequestNonce += 1
    }

    private func triggerOpenHealthLogShortcut() {
        selection = .health
        resetPath(for: .health)
        healthOpenLogRequestNonce += 1
    }

    private func triggerOpenHealthFoodsShortcut() {
        selection = .health
        resetPath(for: .health)
        healthOpenFoodsRequestNonce += 1
    }

    private func handleDashboardQuickAction(_ action: DashboardQuickAction) {
        switch action {
        case .logMeal:
            triggerQuickLogMealShortcut()
        case .logSteps:
            triggerQuickLogStepsShortcut()
        case .logWeight:
            triggerQuickLogWeightShortcut()
        case .openMealLog:
            triggerOpenHealthLogShortcut()
        case .openFoods:
            triggerOpenHealthFoodsShortcut()
        }
    }

    private func handleDashboardModuleSelection(_ module: DashboardModule) {
        switch module {
        case .health:
            // Opening Health from the main module list should always land on Health,
            // not replay a previous quick-log request.
            healthQuickLogMealRequestNonce = 0
            healthQuickLogStepsRequestNonce = 0
            healthQuickLogWeightRequestNonce = 0
            selection = .health
            resetPath(for: .health)
        case .shopping:
            selection = .shopping
            resetPath(for: .shopping)
        case .kidsAdmin:
            selection = .kidsAdmin
            resetPath(for: .kidsAdmin)
        case .tasks:
            selection = .more
            resetPath(for: .more)
            appendRoute(.tasks, to: .more)
        case .budget:
            selection = .more
            resetPath(for: .more)
            appendRoute(.budget, to: .more)
        case .lifeAdmin:
            selection = .more
            resetPath(for: .more)
            appendRoute(.lifeAdmin, to: .more)
        case .notes:
            selection = .more
            resetPath(for: .more)
            appendRoute(.notes, to: .more)
        }
    }

    private func appendRoute(_ route: ParentRoute, to explicitTab: ParentTab? = nil) {
        let targetTab = explicitTab ?? selection
        switch targetTab {
        case .dashboard:
            dashboardPath.append(route)
        case .health:
            healthPath.append(route)
        case .shopping:
            shoppingPath.append(route)
        case .kidsAdmin:
            kidsAdminPath.append(route)
        case .more:
            morePath.append(route)
        }
    }

    private func resetPath(for tab: ParentTab) {
        switch tab {
        case .dashboard:
            dashboardPath = NavigationPath()
        case .health:
            healthPath = NavigationPath()
        case .shopping:
            shoppingPath = NavigationPath()
        case .kidsAdmin:
            kidsAdminPath = NavigationPath()
        case .more:
            morePath = NavigationPath()
        }
    }

    private func resolveDeepLink(_ rawLink: String) -> ResolvedDeepLink {
        let trimmed = rawLink.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return .push(.dashboard, .notifications)
        }

        if let parsed = URL(string: trimmed), let scheme = parsed.scheme?.lowercased() {
            if scheme == "http" || scheme == "https" {
                if isInternalHost(parsed) {
                    return resolvePath(parsed.path)
                }
                return .external(parsed)
            }
            return .external(parsed)
        }

        let normalized = trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)"
        return resolvePath(normalized)
    }

    private func isInternalHost(_ url: URL) -> Bool {
        guard let incomingHost = url.host?.lowercased() else { return false }
        let baseRaw = EnvironmentStore.resolvedEnvironment().baseUrl
        let withScheme = baseRaw.hasPrefix("http") ? baseRaw : "https://\(baseRaw)"
        guard let baseHost = URL(string: withScheme)?.host?.lowercased() else { return false }
        return incomingHost == baseHost
    }

    private func resolvePath(_ path: String) -> ResolvedDeepLink {
        let normalized = path.lowercased()
        if normalized == "/" {
            return .selectTab(.dashboard)
        }
        if normalized.hasPrefix("/health") {
            return .selectTab(.health)
        }
        if normalized.hasPrefix("/shopping") {
            return .selectTab(.shopping)
        }
        if normalized.hasPrefix("/kids-admin") || normalized.hasPrefix("/kids") {
            return .selectTab(.kidsAdmin)
        }
        if normalized.hasPrefix("/budget") {
            return .push(.more, .budget)
        }
        if normalized.hasPrefix("/life-admin") {
            return .push(.more, .lifeAdmin)
        }
        if normalized.hasPrefix("/tasks") {
            return .push(.more, .tasks)
        }
        if normalized.hasPrefix("/notes") {
            return .push(.more, .notes)
        }
        if normalized.hasPrefix("/settings") {
            return .push(.more, .settings)
        }
        if normalized.hasPrefix("/notifications") {
            return .push(.dashboard, .notifications)
        }
        return .push(.dashboard, .notifications)
    }
}

private enum ParentTab: Hashable {
    case dashboard
    case health
    case shopping
    case kidsAdmin
    case more
}

private enum ResolvedDeepLink {
    case selectTab(ParentTab)
    case push(ParentTab, ParentRoute)
    case external(URL)
}

private enum ParentRoute: Hashable {
    case budget
    case lifeAdmin
    case tasks
    case notes
    case notifications
    case settings

    @ViewBuilder
    var destination: some View {
        switch self {
        case .budget:
            BudgetRootView()
        case .lifeAdmin:
            LifeAdminRootView()
        case .tasks:
            TasksView()
        case .notes:
            NotesView()
        case .notifications:
            NotificationsView()
        case .settings:
            SettingsView()
        }
    }
}

private struct MoreView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let unreadCount: Int
    let showWipModules: Bool

    var body: some View {
        List {
            Section {
                if showWipModules {
                    NavigationLink("Budget", value: ParentRoute.budget)
                    NavigationLink("Life admin", value: ParentRoute.lifeAdmin)
                    NavigationLink("Tasks", value: ParentRoute.tasks)
                    NavigationLink("Notes", value: ParentRoute.notes)
                }
                NavigationLink(value: ParentRoute.notifications) {
                    HStack {
                        Text("Notifications")
                        Spacer()
                        if unreadCount > 0 {
                            UnreadBadge(text: unreadCount > 99 ? "99+" : "\(unreadCount)")
                        }
                    }
                }
                NavigationLink("Settings", value: ParentRoute.settings)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("More")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "More")
                }
            }
        }
    }
}

private struct NotificationBellIcon: View {
    let unreadCount: Int

    var body: some View {
        ZStack {
            Image(systemName: "bell")
                .frame(width: 24, height: 24)
        }
        .overlay(alignment: .topTrailing) {
            if unreadCount > 0 {
                UnreadBadge(text: BadgeText(unreadCount))
                    .offset(x: 5, y: -1)
                    .accessibilityLabel("\(unreadCount) unread notifications")
            }
        }
        .frame(width: 40, height: 32, alignment: .center)
        .contentShape(Rectangle())
    }

    private func BadgeText(_ count: Int) -> String {
        if count > 99 {
            return "99+"
        }
        return "\(count)"
    }
}

private struct UnreadBadge: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .padding(.horizontal, 5)
            .frame(minWidth: 20, minHeight: 18)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(Color(red: 0.86, green: 0.10, blue: 0.16))
            )
            .fixedSize(horizontal: true, vertical: true)
            .blendMode(.normal)
    }
}
