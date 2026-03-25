import SwiftUI

@MainActor
final class HealthSharedDataStore: ObservableObject {
    @Published private(set) var status: SharedHealthLoadState = .idle
    @Published private(set) var errorMessage = ""
    @Published private(set) var settings: HealthUserSettings?
    @Published private(set) var logResponse: HealthDailyLogResponse?
    @Published private(set) var weeklySummary: HealthWeeklySummary?
    @Published private(set) var stepsHistory: [HealthStepsHistoryEntry] = []
    @Published private(set) var weightHistory: [HealthWeightHistoryEntry] = []

    func loadIfNeeded() async {
        guard status == .idle else { return }
        await refresh()
    }

    func refresh() async {
        guard status != .loading else { return }

        status = .loading
        errorMessage = ""

        do {
            async let settingsResult = HealthApi.fetchSettings()
            async let logResult = HealthApi.fetchDailyLog(date: todayKey)
            async let summaryResult = HealthApi.fetchWeeklySummary(startDate: weekStartKey)
            async let stepsResult = HealthApi.fetchStepsHistory(startDate: weekStartKey, endDate: todayKey)
            async let weightResult = HealthApi.fetchWeightHistory(startDate: weekStartKey, endDate: todayKey)

            settings = try await settingsResult
            logResponse = try await logResult
            weeklySummary = try await summaryResult
            stepsHistory = try await stepsResult.Steps
            weightHistory = try await weightResult.Weights
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load health data."
        }
    }

    private var todayKey: String {
        HealthFormatters.dateKey(from: Date())
    }

    private var weekStartKey: String {
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .day, value: -6, to: Date()) ?? Date()
        return HealthFormatters.dateKey(from: start)
    }
}

struct HealthRootView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @ObservedObject var sharedData: HealthSharedDataStore
    @State private var selection: HealthTab = .today
    @State private var quickLogMealNonce = 0
    @State private var quickLogStepsNonce = 0
    @State private var quickLogWeightNonce = 0
    @State private var consumedQuickLogMealNonce = 0
    @State private var lastHandledExternalQuickLogMealNonce = 0
    @State private var lastHandledExternalQuickLogStepsNonce = 0
    @State private var lastHandledExternalQuickLogWeightNonce = 0
    @State private var lastHandledOpenLogNonce = 0
    @State private var lastHandledOpenFoodsNonce = 0

    let quickLogMealRequestNonce: Int
    let quickLogStepsRequestNonce: Int
    let quickLogWeightRequestNonce: Int
    let openHealthLogRequestNonce: Int
    let openHealthFoodsRequestNonce: Int

    init(
        sharedData: HealthSharedDataStore,
        quickLogMealRequestNonce: Int = 0,
        quickLogStepsRequestNonce: Int = 0,
        quickLogWeightRequestNonce: Int = 0,
        openHealthLogRequestNonce: Int = 0,
        openHealthFoodsRequestNonce: Int = 0
    ) {
        self.sharedData = sharedData
        self.quickLogMealRequestNonce = quickLogMealRequestNonce
        self.quickLogStepsRequestNonce = quickLogStepsRequestNonce
        self.quickLogWeightRequestNonce = quickLogWeightRequestNonce
        self.openHealthLogRequestNonce = openHealthLogRequestNonce
        self.openHealthFoodsRequestNonce = openHealthFoodsRequestNonce
    }

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
                    HealthTodayView(
                        sharedData: sharedData,
                        onQuickLogMeal: triggerQuickLogMeal,
                        quickLogStepsRequestNonce: quickLogStepsNonce,
                        quickLogWeightRequestNonce: quickLogWeightNonce
                    )
                case .log:
                    HealthLogView(
                        quickAddMealNonce: quickLogMealNonce,
                        consumedQuickAddMealNonce: consumedQuickLogMealNonce,
                        onConsumeQuickAddMealNonce: { nonce in
                            consumedQuickLogMealNonce = max(consumedQuickLogMealNonce, nonce)
                        }
                    )
                case .foods:
                    HealthFoodsView()
                case .insights:
                    HealthInsightsView(sharedData: sharedData)
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
        .onAppear {
            if sharedData.status != .idle, sharedData.status != .loading {
                Task { await sharedData.refresh() }
            }
            handleExternalQuickLogMealRequest(quickLogMealRequestNonce)
            handleExternalQuickLogStepsRequest(quickLogStepsRequestNonce)
            handleExternalQuickLogWeightRequest(quickLogWeightRequestNonce)
            handleOpenLogRequest(openHealthLogRequestNonce)
            handleOpenFoodsRequest(openHealthFoodsRequestNonce)
        }
        .onChange(of: quickLogMealRequestNonce) { _, newValue in
            handleExternalQuickLogMealRequest(newValue)
        }
        .onChange(of: quickLogStepsRequestNonce) { _, newValue in
            handleExternalQuickLogStepsRequest(newValue)
        }
        .onChange(of: quickLogWeightRequestNonce) { _, newValue in
            handleExternalQuickLogWeightRequest(newValue)
        }
        .onChange(of: openHealthLogRequestNonce) { _, newValue in
            handleOpenLogRequest(newValue)
        }
        .onChange(of: openHealthFoodsRequestNonce) { _, newValue in
            handleOpenFoodsRequest(newValue)
        }
    }

    private func triggerQuickLogMeal() {
        selection = .log
        quickLogMealNonce += 1
    }

    private func triggerQuickLogSteps() {
        selection = .today
        quickLogStepsNonce += 1
    }

    private func triggerQuickLogWeight() {
        selection = .today
        quickLogWeightNonce += 1
    }

    private func handleExternalQuickLogMealRequest(_ nonce: Int) {
        guard nonce > lastHandledExternalQuickLogMealNonce else { return }
        lastHandledExternalQuickLogMealNonce = nonce
        triggerQuickLogMeal()
    }

    private func handleExternalQuickLogStepsRequest(_ nonce: Int) {
        guard nonce > lastHandledExternalQuickLogStepsNonce else { return }
        lastHandledExternalQuickLogStepsNonce = nonce
        triggerQuickLogSteps()
    }

    private func handleExternalQuickLogWeightRequest(_ nonce: Int) {
        guard nonce > lastHandledExternalQuickLogWeightNonce else { return }
        lastHandledExternalQuickLogWeightNonce = nonce
        triggerQuickLogWeight()
    }

    private func handleOpenLogRequest(_ nonce: Int) {
        guard nonce > lastHandledOpenLogNonce else { return }
        lastHandledOpenLogNonce = nonce
        selection = .log
    }

    private func handleOpenFoodsRequest(_ nonce: Int) {
        guard nonce > lastHandledOpenFoodsNonce else { return }
        lastHandledOpenFoodsNonce = nonce
        selection = .foods
    }
}

enum SharedHealthLoadState {
    case idle
    case loading
    case ready
    case error
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
