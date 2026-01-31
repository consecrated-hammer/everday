import SwiftUI

@main
struct EverdayIOSApp: App {
    @StateObject private var authStore = AuthStore()
    @StateObject private var environmentStore = EnvironmentStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authStore)
                .environmentObject(environmentStore)
        }
    }
}
