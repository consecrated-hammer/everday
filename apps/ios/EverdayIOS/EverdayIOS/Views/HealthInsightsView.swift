import SwiftUI

struct HealthInsightsView: View {
    @State private var summary: HealthWeeklySummary?
    @State private var suggestions: [HealthSuggestion] = []
    @State private var status: LoadState = .idle
    @State private var suggestionsStatus: LoadState = .idle
    @State private var errorMessage = ""
    @State private var lastSuggestedAt: Date?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                summaryCard
                suggestionsCard

                if status == .loading {
                    HealthEmptyState(message: "Loading insights...")
                }
                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .frame(maxWidth: 860)
            .frame(maxWidth: .infinity)
        }
        .task {
            if status == .idle {
                await load()
            }
        }
    }

    private var summaryCard: some View {
        HealthSectionCard {
            HealthSectionHeader(title: "Weekly snapshot", subtitle: "Averages from the last 7 days.")
            if let summary {
                let avgCalories = averageValue(summary, key: "TotalCalories", decimals: 0)
                let avgProtein = averageValue(summary, key: "TotalProtein", decimals: 1)
                let avgSteps = averageValue(summary, key: "TotalSteps", decimals: 0)
                let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
                LazyVGrid(columns: columns, spacing: 12) {
                    HealthMetricTile(title: "Average calories", value: HealthFormatters.formatNumber(avgCalories, decimals: 0), detail: "kcal")
                    HealthMetricTile(title: "Average protein", value: HealthFormatters.formatNumber(avgProtein, decimals: 1), detail: "g")
                    HealthMetricTile(title: "Average steps", value: HealthFormatters.formatNumber(avgSteps, decimals: 0), detail: "steps")
                }
            } else {
                HealthEmptyState(message: "No summary data yet.")
            }
        }
    }

    private var suggestionsCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "AI suggestions",
                subtitle: "Suggestions use today's log and the last 7 days.",
                trailing: AnyView(
                    Button(suggestionsStatus == .loading ? "Refreshing..." : "Refresh") {
                        Task { await loadSuggestions(force: true) }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(suggestionsStatus == .loading)
                )
            )

            if let lastSuggestedAt {
                Text("Last suggested at \(HealthFormatters.timeFormatter.string(from: lastSuggestedAt)).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Not suggested yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if suggestionsStatus == .loading {
                HealthEmptyState(message: "Fetching suggestions...")
            } else if suggestions.isEmpty {
                HealthEmptyState(message: "No suggestions yet. Log more meals or steps to get guidance.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(suggestions) { suggestion in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(suggestion.Title)
                                .font(.subheadline.weight(.semibold))
                            Text(suggestion.Detail)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var todayKey: String {
        HealthFormatters.dateKey(from: Date())
    }

    private func averageValue(_ summary: HealthWeeklySummary, key: String, decimals: Int) -> Double {
        let total = summary.Totals[key] ?? 0
        let value = total / 7.0
        let factor = pow(10.0, Double(decimals))
        return (value * factor).rounded() / factor
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            summary = try await HealthApi.fetchWeeklySummary(startDate: weekStartKey())
            await loadSuggestions(force: false)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load insights."
        }
    }

    private func loadSuggestions(force: Bool) async {
        if suggestionsStatus == .loading { return }
        suggestionsStatus = .loading
        do {
            let response = try await HealthApi.fetchAiSuggestions(logDate: todayKey)
            suggestions = response.Suggestions
            lastSuggestedAt = Date()
            suggestionsStatus = .ready
        } catch {
            if suggestions.isEmpty {
                suggestionsStatus = .error
            } else {
                suggestionsStatus = .ready
            }
        }
    }

    private func weekStartKey() -> String {
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .day, value: -6, to: Date()) ?? Date()
        return HealthFormatters.dateKey(from: start)
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
