import SwiftUI

struct HealthHistoryView: View {
    @State private var range: HistoryRange = .last7
    @State private var offset = 0
    @State private var days: [HistoryDayData] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HealthSectionCard {
                    HealthSectionHeader(title: "History", subtitle: "Review previous days.")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(HistoryRange.allCases, id: \.self) { option in
                                HealthChip(title: option.label, isSelected: range == option) {
                                    range = option
                                    offset = 0
                                    Task { await loadDays(reset: true) }
                                }
                            }
                        }
                    }
                }

                if status == .loading && days.isEmpty {
                    HealthEmptyState(message: "Loading history...")
                }

                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }

                ForEach(summaries) { summary in
                    NavigationLink {
                        HealthHistoryDayView(dateKey: summary.dateKey)
                    } label: {
                        HistoryCard(summary: summary)
                    }
                    .buttonStyle(.plain)
                }

                if range == .all {
                    Button("Load more") {
                        Task { await loadMore() }
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(20)
            .frame(maxWidth: 860)
            .frame(maxWidth: .infinity)
        }
        .task {
            if status == .idle {
                await loadDays(reset: true)
            }
        }
    }

    private var summaries: [HistoryDaySummary] {
        days.map { day in
            let entries = day.response?.Entries ?? []
            let totalCalories = day.response?.Summary.TotalCalories ?? entries.reduce(0) {
                $0 + (entryCalories($1))
            }
            let preview = entries.prefix(2).map { $0.TemplateName ?? $0.FoodName }
            return HistoryDaySummary(
                dateKey: day.dateKey,
                entryCount: entries.count,
                totalCalories: totalCalories,
                previewItems: Array(preview)
            )
        }
    }

    private func loadDays(reset: Bool) async {
        status = .loading
        errorMessage = ""
        let daysToLoad = range.days ?? pageSize
        let nextOffset = reset ? 0 : offset
        let dates = buildDateRange(offsetDays: nextOffset, count: daysToLoad)
        var results: [HistoryDayData] = []
        for date in dates {
            do {
                let response = try await HealthApi.fetchDailyLog(date: date)
                results.append(HistoryDayData(dateKey: date, response: response))
            } catch {
                results.append(HistoryDayData(dateKey: date, response: nil))
            }
        }
        if reset {
            days = results
        } else {
            days.append(contentsOf: results)
        }
        status = .ready
    }

    private func loadMore() async {
        let count = range.days ?? pageSize
        offset += count
        await loadDays(reset: false)
    }

    private func buildDateRange(offsetDays: Int, count: Int) -> [String] {
        var dates: [String] = []
        let calendar = Calendar.current
        for index in 0..<count {
            if let date = calendar.date(byAdding: .day, value: -(offsetDays + index), to: Date()) {
                dates.append(HealthFormatters.dateKey(from: date))
            }
        }
        return dates
    }

    private func entryCalories(_ entry: HealthMealEntryWithFood) -> Double {
        entry.CaloriesPerServing * entry.Quantity
    }
}

private enum HistoryRange: CaseIterable {
    case last7
    case last30
    case last90
    case all

    var label: String {
        switch self {
        case .last7: return "7d"
        case .last30: return "30d"
        case .last90: return "90d"
        case .all: return "All"
        }
    }

    var days: Int? {
        switch self {
        case .last7: return 7
        case .last30: return 30
        case .last90: return 90
        case .all: return nil
        }
    }
}

private struct HistoryDayData {
    let dateKey: String
    let response: HealthDailyLogResponse?
}

private struct HistoryDaySummary: Identifiable {
    let id = UUID()
    let dateKey: String
    let entryCount: Int
    let totalCalories: Double
    let previewItems: [String]
}

private struct HistoryCard: View {
    let summary: HistoryDaySummary

    var body: some View {
        HealthSectionCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(HealthFormatters.formatShortDate(summary.dateKey))
                        .font(.headline)
                    if summary.entryCount == 0 {
                        Text("No entries")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("\(summary.entryCount) entries")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if !summary.previewItems.isEmpty {
                            Text(summary.previewItems.joined(separator: " | "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer()
                Text("\(Int(summary.totalCalories.rounded())) kcal")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
            }
        }
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}

private let pageSize = 14
