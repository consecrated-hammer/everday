import SwiftUI

struct HealthRootView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selection: HealthTab = .today

    var body: some View {
        VStack(spacing: 12) {
            Picker("Health section", selection: $selection) {
                ForEach(HealthTab.allCases) { tab in
                    Text(tab.label).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 12)

            Group {
                switch selection {
                case .today:
                    HealthTodayView()
                case .log:
                    HealthLogView()
                case .foods:
                    HealthFoodsView()
                case .insights:
                    HealthInsightsView()
                case .history:
                    HealthHistoryView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Health")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Health")
                }
            }
        }
    }
}

private enum HealthTab: String, CaseIterable, Identifiable {
    case today
    case log
    case foods
    case insights
    case history

    var id: String { rawValue }

    var label: String {
        switch self {
        case .today: return "Today"
        case .log: return "Log"
        case .foods: return "Foods"
        case .insights: return "Insights"
        case .history: return "History"
        }
    }
}
