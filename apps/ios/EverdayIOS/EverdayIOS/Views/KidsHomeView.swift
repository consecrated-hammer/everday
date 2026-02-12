import SwiftUI
#if canImport(SwiftUICharts)
import SwiftUICharts
#endif

struct KidsHomeView: View {
    @EnvironmentObject var authStore: AuthStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var overview: KidsOverviewResponse?
    @State private var ledgerEntries: [KidsLedgerEntry] = []
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var busyChoreId: Int?
    @State private var showCelebrate = false
    @State private var celebrateEmojis = "🎉✨"
    @State private var celebrateScale: CGFloat = 0.2
    @State private var celebrateOpacity: Double = 0
    private let celebrationPool = [
        "🎊", "🎉", "🥳", "✨", "🌟", "💥", "🪅", "🎈", "🧨", "🙌",
        "🤩", "😄", "🎁", "🏆", "🥇", "👏", "🤗", "😎", "💫", "⭐️",
        "🔥", "🌈", "🦄", "🐉", "🐻", "🍭", "🍬", "🍕"
    ]

    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(greetingText)
                        .font(.largeTitle.bold())
                }
                balanceCard
                choresCard
                projectionCard

                if status == .loading {
                    Text("Loading chores...")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
                .padding(20)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
            }

            if showCelebrate {
                celebrateOverlay
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                NavigationLink {
                    NotificationsView()
                } label: {
                    Image(systemName: "bell")
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
        .task {
            if status == .idle {
                await load()
            }
        }
    }

    private var greetingText: String {
        let firstName = authStore.tokens?.firstName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if firstName.isEmpty {
            return "\(KidsEmoji.headerEmoji("Greeting")) Hey there!"
        }
        return "\(KidsEmoji.headerEmoji("Greeting")) Hey \(firstName)!"
    }

    private var balanceCard: some View {
        let totals = kidsTotals
        let earnedSpent = monthLedgerTotals
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(KidsEmoji.headerEmoji("AvailableNow")) Available now")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("This month")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .top) {
                Text(KidsFormatters.formatCurrency(totals.CurrentTotal))
                    .font(.largeTitle.bold())
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("In +\(KidsFormatters.formatCurrencyRounded(earnedSpent.earned))")
                        .font(.caption)
                        .foregroundStyle(.green)
                    Text("Out -\(KidsFormatters.formatCurrencyRounded(abs(earnedSpent.spent)))")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.ultraThinMaterial)
        )
    }

    private var choresCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            choresSection(title: "\(KidsEmoji.headerEmoji("DailyJobs")) Daily jobs", chores: dailyJobs, showStatus: !dayProtected)
            Divider()
            choresSection(title: "\(KidsEmoji.headerEmoji("Habits")) Habits", chores: habitJobs, showStatus: !habitsDone)
            Divider()
            choresSection(title: "\(KidsEmoji.headerEmoji("BonusTasks")) Bonus tasks", chores: bonusJobs, showStatus: false, showAmounts: true)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
        .onChange(of: dailyAllDone) {
            if dailyAllDone {
                triggerCelebrate()
            } else {
                showCelebrate = false
            }
        }
    }

    private func choresSection(title: String, chores: [KidsChore], showStatus: Bool, showAmounts: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline)
                if showStatus {
                    Text("To do")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(Capsule())
                }
                Spacer()
            }

            if chores.isEmpty {
                Text("No chores assigned yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(chores, id: \.Id) { chore in
                    let entry = entryByChoreId[chore.Id]
                    KidsTaskRow(
                        chore: chore,
                        entry: entry,
                        isBusy: busyChoreId == chore.Id,
                        showAmount: showAmounts,
                        emojiPool: celebrationPool,
                        onToggle: { onToggleChore(chore) }
                    )
                }
            }
        }
    }

    private var projectionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(KidsEmoji.headerEmoji("ThisMonth")) This month")
                .font(.headline)
            if kidsTotals.Series.isEmpty {
                Text("No projection data yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                projectionChart
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    @ViewBuilder
    private var projectionChart: some View {
        #if canImport(SwiftUICharts)
        let chartData = lineChartData
        LineChart(chartData: chartData)
            .pointMarkers(chartData: chartData)
            .touchOverlay(
                chartData: chartData,
                specifier: "%.0f",
                formatter: KidsFormatters.currencyFormatter,
                unit: .none
            )
            .floatingInfoBox(chartData: chartData)
            .xAxisLabels(chartData: chartData)
            .frame(height: 180)
            .overlay {
                GeometryReader { geo in
                    if chartData.isGreaterThanTwo() {
                        ZStack(alignment: .topLeading) {
                            ForEach(chartValueLabels) { label in
                                chartValueLabelView(label)
                                    .position(chartLabelPosition(
                                        label,
                                        chartSize: geo.size,
                                        dataCount: chartSeries.count,
                                        minValue: chartData.minValue,
                                        range: chartData.range
                                    ))
                            }
                        }
                    }
                }
            }
        #else
        VStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.secondarySystemBackground))
                .frame(height: 120)
                .overlay(
                    Text("Chart loading...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                )
            Text("Chart data unavailable.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        #endif
    }

    private var chartSeries: [KidsTotalsSeriesPoint] {
        kidsTotals.Series.filter { $0.ActualAmount != nil || $0.ProjectedAmount != nil }
    }

    private var kidsTotals: KidsTotalsResult {
        guard let overview else {
            return KidsTotalsResult(CurrentTotal: 0, ProjectedTotal: 0, Series: [])
        }
        return KidsTotals.build(
            todayKey: overview.Today,
            monthStartKey: overview.MonthStart,
            monthEndKey: overview.MonthEnd,
            monthlyAllowance: overview.MonthlyAllowance,
            dailySlice: overview.DailySlice,
            projectionPoints: overview.Projection,
            ledgerEntries: ledgerEntries,
            isCurrentMonth: true
        )
    }

    private var monthLedgerTotals: (earned: Double, spent: Double) {
        guard let overview else { return (0, 0) }
        guard let start = KidsFormatters.parseDate(overview.MonthStart),
              let end = KidsFormatters.parseDate(overview.Today) else {
            return (0, 0)
        }
        let startTime = start.timeIntervalSince1970
        let endTime = end.timeIntervalSince1970
        return ledgerEntries.reduce(into: (earned: 0.0, spent: 0.0)) { result, entry in
            guard let date = KidsFormatters.parseDate(entry.EntryDate) else { return }
            let time = date.timeIntervalSince1970
            guard time >= startTime && time <= endTime else { return }
            if entry.Amount >= 0 {
                result.earned += entry.Amount
            } else {
                result.spent += entry.Amount
            }
        }
    }

    private var dayProtected: Bool {
        overview?.DayProtected ?? false
    }

    private
    var entryByChoreId: [Int: KidsChoreEntry] {
        guard let entries = overview?.Entries else { return [:] }
        return Dictionary(uniqueKeysWithValues: entries.map { ($0.ChoreId, $0) })
    }

    private var dailyJobs: [KidsChore] {
        overview?.Chores.filter { $0.ChoreType == "Daily" && $0.IsActive } ?? []
    }

    private var habitJobs: [KidsChore] {
        overview?.Chores.filter { $0.ChoreType == "Habit" && $0.IsActive } ?? []
    }

    private var bonusJobs: [KidsChore] {
        overview?.Chores.filter { $0.ChoreType == "Bonus" && $0.IsActive } ?? []
    }

    private var dailyAllDone: Bool {
        guard !dailyJobs.isEmpty else { return false }
        return dailyJobs.allSatisfy { chore in
            let status = entryByChoreId[chore.Id]?.Status ?? ""
            return status == "Approved" || status == "Pending"
        }
    }

    private var habitsDone: Bool {
        guard !habitJobs.isEmpty else { return true }
        return habitJobs.allSatisfy { chore in
            entryByChoreId[chore.Id]?.Status == "Approved"
        }
    }

    private func randomCelebrateEmojis() -> String {
        celebrationPool.shuffled().prefix(3).joined()
    }

    private func axisLabels(for series: [KidsTotalsSeriesPoint]) -> [String] {
        guard !series.isEmpty else { return [] }
        let targetCount = 5
        let step = max(1, Int(round(Double(series.count - 1) / Double(targetCount - 1))))
        return series.enumerated().map { index, point in
            if index == 0 || index == series.count - 1 || index % step == 0 {
                return axisLabel(for: point.DateKey, includeMonth: index == 0)
            }
            return ""
        }
    }

    private func axisLabel(for dateKey: String, includeMonth: Bool) -> String {
        guard let date = KidsFormatters.parseDate(dateKey) else { return "" }
        if includeMonth {
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
        return date.formatted(.dateTime.day())
    }

    private func triggerCelebrate() {
        celebrateEmojis = randomCelebrateEmojis()
        showCelebrate = true
        celebrateScale = 0.2
        celebrateOpacity = 0
        withAnimation(.spring(response: 0.5, dampingFraction: 0.55)) {
            celebrateScale = 1.6
            celebrateOpacity = 1
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(1600)) {
            withAnimation(.easeOut(duration: 0.4)) {
                celebrateOpacity = 0
                celebrateScale = 0.8
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(500)) {
                showCelebrate = false
            }
        }
    }

    private var celebrateOverlay: some View {
        Text(celebrateEmojis)
            .font(.system(size: 80))
            .scaleEffect(celebrateScale)
            .opacity(celebrateOpacity)
            .shadow(color: Color.black.opacity(0.12), radius: 16, x: 0, y: 10)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.black.opacity(0.05))
            .ignoresSafeArea()
    }

    #if canImport(SwiftUICharts)
    private var lineChartData: LineChartData {
        let series = chartSeries
        let dataPoints = series.compactMap { point -> LineChartDataPoint? in
            guard let value = point.ActualAmount ?? point.ProjectedAmount else { return nil }
            return LineChartDataPoint(
                value: value,
                description: chartPointDescription(for: point, series: series),
                date: KidsFormatters.parseDate(point.DateKey)
            )
        }
        let lineStyle = LineStyle(
            lineColour: ColourStyle(colour: .orange),
            strokeStyle: Stroke(lineWidth: 2)
        )
        let pointStyle = PointStyle(
            pointSize: 6,
            borderColour: .orange,
            fillColour: .orange,
            lineWidth: 2
        )
        let dataSet = LineDataSet(
            dataPoints: dataPoints,
            legendTitle: "Balance",
            pointStyle: pointStyle,
            style: lineStyle
        )
        var style = LineChartStyle(
            infoBoxPlacement: .floating,
            xAxisLabelColour: .secondary,
            xAxisLabelsFrom: .chartData(rotation: .degrees(0)),
            yAxisLabelColour: .secondary,
            yAxisNumberOfLabels: 4,
            globalAnimation: .easeOut(duration: 0.6)
        )
        style.infoBoxValueFont = .caption.weight(.semibold)
        style.infoBoxDescriptionFont = .caption2
        style.infoBoxBackgroundColour = Color(.systemBackground)
        let labels = axisLabels(for: series)
        return LineChartData(
            dataSets: dataSet,
            metadata: ChartMetadata(),
            xAxisLabels: labels,
            chartStyle: style,
            noDataText: Text("No projection data yet.")
        )
    }

    private func chartPointDescription(for point: KidsTotalsSeriesPoint, series: [KidsTotalsSeriesPoint]) -> String {
        let todayKey = overview?.Today ?? ""
        let firstKey = series.first?.DateKey ?? ""
        let lastKey = series.last?.DateKey ?? ""
        if point.DateKey == firstKey && firstKey != todayKey {
            return "Starting balance"
        }
        if point.DateKey == todayKey {
            return "Available now"
        }
        if point.DateKey == lastKey && lastKey != todayKey {
            return "Projected end"
        }
        return KidsFormatters.formatDate(point.DateKey)
    }

    private var chartValueLabels: [ChartValueLabel] {
        let series = chartSeries
        guard !series.isEmpty else { return [] }
        let todayKey = overview?.Today ?? ""
        let firstKey = series.first?.DateKey ?? ""
        let lastKey = series.last?.DateKey ?? ""
        var labels: [ChartValueLabel] = []

        if let first = series.first,
           let value = first.ActualAmount ?? first.ProjectedAmount,
           firstKey != todayKey
        {
            labels.append(ChartValueLabel(
                index: 0,
                value: value,
                title: "Start"
            ))
        }

        if let todayIndex = series.firstIndex(where: { $0.DateKey == todayKey }),
           let point = series[safe: todayIndex],
           let value = point.ActualAmount ?? point.ProjectedAmount
        {
            labels.append(ChartValueLabel(
                index: todayIndex,
                value: value,
                title: "Now"
            ))
        }

        if let last = series.last,
           let value = last.ProjectedAmount ?? last.ActualAmount,
           lastKey != todayKey
        {
            labels.append(ChartValueLabel(
                index: max(series.count - 1, 0),
                value: value,
                title: "Projected"
            ))
        }

        return labels
    }

    private func chartLabelPosition(
        _ label: ChartValueLabel,
        chartSize: CGSize,
        dataCount: Int,
        minValue: Double,
        range: Double
    ) -> CGPoint {
        guard dataCount > 1 else { return CGPoint(x: chartSize.width / 2, y: chartSize.height / 2) }
        let safeRange = range == 0 ? 1 : range
        let xSection = chartSize.width / CGFloat(dataCount - 1)
        let ySection = chartSize.height / CGFloat(safeRange)
        let xBase = CGFloat(label.index) * xSection
        let yBase = (CGFloat(label.value - minValue) * -ySection) + chartSize.height
        let xOffset: CGFloat
        if label.index == 0 {
            xOffset = 28
        } else if label.index == dataCount - 1 {
            xOffset = -28
        } else {
            xOffset = 0
        }
        let y = max(12, yBase - 28)
        return CGPoint(x: xBase + xOffset, y: y)
    }

    private func chartValueLabelView(_ label: ChartValueLabel) -> some View {
        VStack(spacing: 2) {
            Text(KidsFormatters.formatCurrencyRounded(label.value))
                .font(.caption2.weight(.semibold))
            Text(label.title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
        )
    }
    #endif

    @MainActor
    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let overviewData = KidsApi.fetchOverview()
            async let ledgerData = KidsApi.fetchLedger(limit: 200)
            let (overviewResponse, ledgerResponse) = try await (overviewData, ledgerData)
            overview = overviewResponse
            ledgerEntries = ledgerResponse.Entries
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load chores."
        }
    }

    @MainActor
    private func onToggleChore(_ chore: KidsChore) {
        guard let today = overview?.Today else { return }
        busyChoreId = chore.Id
        errorMessage = ""
        Task {
            do {
                if let entry = entryByChoreId[chore.Id] {
                    try await KidsApi.deleteChoreEntry(entryId: entry.Id)
                } else {
                    let payload = KidsChoreEntryCreate(ChoreId: chore.Id, EntryDate: today, Notes: nil)
                    _ = try await KidsApi.createChoreEntry(payload)
                }
                await load()
            } catch {
                await MainActor.run {
                    errorMessage = (error as? ApiError)?.message ?? "Unable to update chore."
                }
            }
            await MainActor.run {
                busyChoreId = nil
            }
        }
    }
}

private struct KidsTaskRow: View {
    let chore: KidsChore
    let entry: KidsChoreEntry?
    let isBusy: Bool
    let showAmount: Bool
    let emojiPool: [String]
    let onToggle: () -> Void
    @State private var doneEmoji = ""

    private var status: String {
        entry?.Status ?? ""
    }

    private var isActive: Bool {
        status == "Approved" || status == "Pending"
    }

    private var statusLabel: String? {
        if status == "Pending" {
            return "Pending approval"
        }
        if status == "Rejected" {
            return "Rejected"
        }
        return nil
    }

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 12) {
                Image(systemName: isActive ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isActive ? Color.accentColor : Color.secondary)
                    .symbolEffect(.bounce, value: isActive)
                VStack(alignment: .leading, spacing: 4) {
                    Text(chore.Label + amountSuffix)
                        .font(.subheadline.weight(.semibold))
                    if let statusLabel {
                        Text(statusLabel)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text(isActive ? "Done \(doneEmoji)" : "To do")
                    .font(isActive ? .caption.weight(.semibold) : .caption)
                    .foregroundStyle(isActive ? Color.accentColor : Color.secondary)
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
        .accessibilityLabel("\(chore.Label) \(isActive ? "done" : "to do")")
        .onAppear {
            if isActive && doneEmoji.isEmpty {
                doneEmoji = emojiPool.randomElement() ?? "✨"
            }
        }
        .onChange(of: isActive) { _, newValue in
            if newValue {
                if doneEmoji.isEmpty {
                    doneEmoji = emojiPool.randomElement() ?? "✨"
                }
            } else {
                doneEmoji = ""
            }
        }
    }

    private var amountSuffix: String {
        guard showAmount, chore.Amount > 0 else { return "" }
        return " (\(KidsFormatters.formatCurrency(chore.Amount)))"
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}

#if canImport(SwiftUICharts)
private struct ChartValueLabel: Identifiable {
    let id = UUID()
    let index: Int
    let value: Double
    let title: String
}
#endif

private extension Array {
    subscript(safe index: Int) -> Element? {
        guard indices.contains(index) else { return nil }
        return self[index]
    }
}
