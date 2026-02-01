import SwiftUI

struct KidsRootView: View {
    @State private var selection: KidsTab = .home

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                KidsHomeView()
            }
            .tag(KidsTab.home)
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                KidsHistoryView()
            }
            .tag(KidsTab.history)
            .tabItem {
                Label("History", systemImage: "clock.arrow.circlepath")
            }
        }
    }
}

private enum KidsTab {
    case home
    case history
}
