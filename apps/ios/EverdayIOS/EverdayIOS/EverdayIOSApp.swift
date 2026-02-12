import SwiftUI
import UIKit
import UserNotifications

@main
struct EverdayIOSApp: App {
    @UIApplicationDelegateAdaptor(EverdayAppDelegate.self) var appDelegate
    @StateObject private var authStore = AuthStore()
    @StateObject private var environmentStore = EnvironmentStore()
    @StateObject private var pushCoordinator = PushNotificationCoordinator.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authStore)
                .environmentObject(environmentStore)
                .environmentObject(pushCoordinator)
        }
    }
}

final class EverdayAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        Task { @MainActor in
            PushNotificationCoordinator.shared.configure()
        }
        if let userInfo = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            Task { @MainActor in
                await PushNotificationCoordinator.shared.handleRemoteNotification(userInfo, userInitiated: true)
            }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            await PushNotificationCoordinator.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            await PushNotificationCoordinator.shared.handleRegisterFailure(error)
        }
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        Task { @MainActor in
            await PushNotificationCoordinator.shared.syncBadgeCountFromServer()
        }
    }
}

@MainActor
final class PushNotificationCoordinator: NSObject, ObservableObject {
    static let shared = PushNotificationCoordinator()

    @Published private(set) var pendingLinkUrl: String?
    @Published private(set) var unreadCount: Int = 0

    private let deviceTokenDefaultsKey = "everday.push.deviceToken"
    private var currentDeviceToken: String?
    private var lastRegisteredFingerprint = ""
    private var didConfigure = false

    private override init() {
        self.currentDeviceToken = UserDefaults.standard.string(forKey: deviceTokenDefaultsKey)
    }

    func configure() {
        guard !didConfigure else { return }
        didConfigure = true
        UNUserNotificationCenter.current().delegate = self
    }

    func handleAuthStateChanged(isAuthenticated: Bool) async {
        if !isAuthenticated {
            lastRegisteredFingerprint = ""
            pendingLinkUrl = nil
            unreadCount = 0
            return
        }
        await requestAuthorizationAndRegister()
        await registerCurrentDeviceIfNeeded(force: false)
        await syncBadgeCountFromServer()
    }

    func requestAuthorizationAndRegister() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .denied {
            return
        }

        var shouldRegister = settings.authorizationStatus == .authorized
        if settings.authorizationStatus == .notDetermined || settings.authorizationStatus == .provisional {
            do {
                shouldRegister = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            } catch {
                shouldRegister = false
            }
        }
        if shouldRegister {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func handleDeviceToken(_ tokenData: Data) async {
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        currentDeviceToken = token
        UserDefaults.standard.set(token, forKey: deviceTokenDefaultsKey)
        await registerCurrentDeviceIfNeeded(force: true)
    }

    func handleRegisterFailure(_ error: Error) async {
        print("Remote notification registration failed: \(error.localizedDescription)")
    }

    func unregisterCurrentDevice() async {
        guard let token = currentDeviceToken, !token.isEmpty else { return }
        guard ApiClient.shared.tokensProvider?() != nil else { return }
        do {
            _ = try await NotificationsApi.unregisterPushDevice(
                NotificationDeviceUnregisterRequest(
                    Platform: "ios",
                    DeviceToken: token,
                    DeviceId: deviceIdentifier
                )
            )
            lastRegisteredFingerprint = ""
        } catch {
            // Keep logout resilient when API is unreachable.
        }
    }

    func registerCurrentDeviceIfNeeded(force: Bool) async {
        guard let token = currentDeviceToken, !token.isEmpty else { return }
        guard let session = ApiClient.shared.tokensProvider?() else { return }

        let fingerprint = "\(session.username)|\(token)|\(pushEnvironmentLabel)"
        if !force, fingerprint == lastRegisteredFingerprint {
            return
        }

        do {
            _ = try await NotificationsApi.registerPushDevice(
                NotificationDeviceRegisterRequest(
                    Platform: "ios",
                    DeviceToken: token,
                    DeviceId: deviceIdentifier,
                    PushEnvironment: pushEnvironmentLabel,
                    AppVersion: appVersion,
                    BuildNumber: buildNumber
                )
            )
            lastRegisteredFingerprint = fingerprint
        } catch {
            // Registration retries on next auth sync, token refresh, or app foreground.
        }
    }

    func syncBadgeCountFromServer() async {
        guard ApiClient.shared.tokensProvider?() != nil else { return }
        do {
            let response = try await NotificationsApi.fetchBadgeCount()
            await applyBadgeCount(response.UnreadCount)
        } catch {
            // Ignore badge sync failures.
        }
    }

    func applyBadgeCount(_ unreadCount: Int) async {
        let count = max(0, unreadCount)
        self.unreadCount = count
        if #available(iOS 16.0, *) {
            try? await UNUserNotificationCenter.current().setBadgeCount(count)
        } else {
            UIApplication.shared.applicationIconBadgeNumber = count
        }
    }

    func clearBadge() async {
        await applyBadgeCount(0)
    }

    func handleRemoteNotification(_ userInfo: [AnyHashable: Any], userInitiated: Bool) async {
        if let aps = userInfo["aps"] as? [String: Any],
           let badge = aps["badge"] as? Int {
            await applyBadgeCount(badge)
        } else {
            await syncBadgeCountFromServer()
        }
        if userInitiated {
            pendingLinkUrl = (userInfo["link_url"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
                ?? "/notifications"
        }
    }

    func queueNavigationLink(_ linkUrl: String?) {
        let trimmed = (linkUrl ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            pendingLinkUrl = "/notifications"
            return
        }
        pendingLinkUrl = trimmed
    }

    func consumePendingLink() {
        pendingLinkUrl = nil
    }

    private var pushEnvironmentLabel: String {
        let env = (Bundle.main.object(forInfoDictionaryKey: "API_ENVIRONMENT") as? String ?? "").uppercased()
        return env == "DEV" ? "development" : "production"
    }

    private var appVersion: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }

    private var buildNumber: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }

    private var deviceIdentifier: String? {
        UIDevice.current.identifierForVendor?.uuidString
    }
}

extension PushNotificationCoordinator: @preconcurrency UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        Task { @MainActor in
            await handleRemoteNotification(notification.request.content.userInfo, userInitiated: false)
            completionHandler([.banner, .sound, .badge])
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        Task { @MainActor in
            await handleRemoteNotification(response.notification.request.content.userInfo, userInitiated: true)
            completionHandler()
        }
    }
}
