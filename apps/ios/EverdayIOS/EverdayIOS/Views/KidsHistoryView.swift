import SwiftUI

struct KidsHistoryView: View {
    @EnvironmentObject var pushCoordinator: PushNotificationCoordinator
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var entries: [KidsChoreEntry] = []
    @State private var ledgerEntries: [KidsLedgerEntry] = []
    @State private var chores: [KidsChore] = []
    @State private var activeFilter: KidsHistoryFilter = .all
    @State private var expandedEntryIds: Set<String> = []
    @State private var expandedDates: Set<String> = []
    @State private var showLogSheet = false
    @State private var logChoreIds: Set<Int> = []
    @State private var logDate: Date = Date()
    @State private var logNotes = ""
    @State private var logError = ""
    @State private var logSaving = false
    @State private var showNotes = false
    @State private var toast = ""
    @State private var todayKey = ""
    @State private var allowedStartKey = ""
    @State private var maxPastKey = ""
    @State private var dailySummaryByDate: [String: KidsDailySummary] = [:]
    @State private var loadedSummaryDates: Set<String> = []

    var body: some View {
        ScrollView {
            contentView
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                NavigationLink {
                    NotificationsView()
                } label: {
                    KidsNotificationBellIcon(unreadCount: pushCoordinator.unreadCount)
                }
                .accessibilityLabel("Notifications")

                NavigationLink {
                    SettingsView()
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Settings")
            }

            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "History")
                }
            }
        }
        .overlay(alignment: .top) {
            toastView
        }
        .animation(.easeInOut, value: toast)
        .sheet(isPresented: $showLogSheet) {
            logSheetView
        }
        .task {
            if status == .idle {
                await load()
            }
        }
    }

    @ViewBuilder
    private var contentView: some View {
        VStack(alignment: .leading, spacing: 16) {
            filterRow

            Button {
                onOpenLogSheet()
            } label: {
                Text("Log past day")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canLogPast)

            if status == .loading {
                ProgressView("Loading history...")
                    .frame(maxWidth: .infinity, alignment: .center)
            }

            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            if status != .loading && errorMessage.isEmpty && groupedEntries.isEmpty {
                Text("No history entries yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            historyGroupsView
        }
        .padding(20)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var historyGroupsView: some View {
        ForEach(groupedEntries, id: \.DateKey) { group in
            VStack(alignment: .leading, spacing: 8) {
                Button {
                    toggleGroup(group.DateKey)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.Label)
                                .font(.headline)
                            if let summary = dailySummaryByDate[group.DateKey] {
                                Text(summary.label)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Image(systemName: expandedDates.contains(group.DateKey) ? "chevron.up" : "chevron.down")
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(group.headerToneColor)
                    )
                }
                .buttonStyle(.plain)

                if expandedDates.contains(group.DateKey) {
                    ForEach(group.Items, id: \.Key) { item in
                        KidsHistoryRow(
                            item: item,
                            isExpanded: expandedEntryIds.contains(item.Key),
                            onToggle: { toggleEntry(item.Key) }
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var toastView: some View {
        if !toast.isEmpty {
            Text(toast)
                .font(.footnote.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(.ultraThinMaterial)
                )
                .padding(.top, 12)
                .transition(.opacity)
        }
    }

    private var logSheetView: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if isBackdated {
                        Text("Needs parent approval")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(Capsule())
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    DatePicker("Date", selection: $logDate, in: allowedDateRange, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 12) {
                        if showNotes {
                            TextEditor(text: $logNotes)
                                .frame(minHeight: 44)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(Color(.separator))
                                )
                        } else {
                            Button("Add a note") {
                                showNotes = true
                            }
                            .buttonStyle(.bordered)
                        }

                        Button(logSaving ? "Saving..." : "Save") {
                            Task { await submitLog() }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(logChoreIds.isEmpty || logSaving)
                    }

                    if !logError.isEmpty {
                        Text(logError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    logChoreSectionsView
                }
                .padding(20)
            }
            .navigationTitle("Log a chore")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showLogSheet = false
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("History")
                        }
                    }
                }
            }
            .onChange(of: logDate) { _, _ in
                logChoreIds = []
                logError = ""
            }
        }
    }

    private var logChoreSectionsView: some View {
        VStack(alignment: .leading, spacing: 16) {
            logChoreSection(
                title: "\(KidsEmoji.headerEmoji("DailyJobs")) Daily jobs",
                chores: logDailyJobs
            )
            Divider()
            logChoreSection(
                title: "\(KidsEmoji.headerEmoji("Habits")) Habits",
                chores: logHabitJobs
            )
            Divider()
            logChoreSection(
                title: "\(KidsEmoji.headerEmoji("BonusTasks")) Bonus tasks",
                chores: logBonusJobs,
                showAmounts: true
            )
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private func logChoreSection(title: String, chores: [KidsChore], showAmounts: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)

            if chores.isEmpty {
                Text("No chores assigned yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(chores, id: \.Id) { chore in
                    let entry = logEntryByChoreId[chore.Id]
                    KidsLogTaskRow(
                        chore: chore,
                        entry: entry,
                        isSelected: logChoreIds.contains(chore.Id),
                        showAmount: showAmounts,
                        onSelect: {
                            guard entry == nil else { return }
                            if logChoreIds.contains(chore.Id) {
                                logChoreIds.remove(chore.Id)
                            } else {
                                logChoreIds.insert(chore.Id)
                            }
                        }
                    )
                }
            }
        }
    }

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(KidsHistoryFilter.allCases, id: \.self) { filter in
                    Button {
                        activeFilter = filter
                    } label: {
                        Text(filter.label)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                Capsule().fill(activeFilter == filter ? Color.accentColor : Color(.secondarySystemBackground))
                            )
                            .foregroundStyle(activeFilter == filter ? Color.white : Color.primary)
                    }
                }
            }
        }
    }

    private var canLogPast: Bool {
        maxPastDate > Date.distantPast
    }

    private var allowedDateRange: ClosedRange<Date> {
        let maxDate = maxPastDate
        return Date.distantPast...maxDate
    }

    private var isBackdated: Bool {
        guard let today = KidsFormatters.parseDate(todayKey) else { return false }
        return logDate < Calendar.current.startOfDay(for: today)
    }

    private var maxPastDate: Date {
        let fallbackToday = KidsFormatters.parseDate(todayKey) ?? Date()
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: fallbackToday) ?? fallbackToday
        if let allowedEnd = KidsFormatters.parseDate(maxPastKey) {
            return min(allowedEnd, yesterday)
        }
        return yesterday
    }

    private var logEntryByChoreId: [Int: KidsChoreEntry] {
        let dateKey = KidsFormatters.dateKey(from: logDate)
        let dayEntries = entries.filter { $0.EntryDate == dateKey }
        return Dictionary(uniqueKeysWithValues: dayEntries.map { ($0.ChoreId, $0) })
    }

    private var logDailyJobs: [KidsChore] {
        chores.filter { $0.ChoreType == "Daily" && $0.IsActive }
    }

    private var logHabitJobs: [KidsChore] {
        chores.filter { $0.ChoreType == "Habit" && $0.IsActive }
    }

    private var logBonusJobs: [KidsChore] {
        chores.filter { $0.ChoreType == "Bonus" && $0.IsActive }
    }

    private var groupedEntries: [KidsHistoryGroup] {
        let items = filteredEntries
        let sorted = items.sorted { a, b in
            let aDate = KidsFormatters.parseDate(a.EntryDate)?.timeIntervalSince1970 ?? 0
            let bDate = KidsFormatters.parseDate(b.EntryDate)?.timeIntervalSince1970 ?? 0
            if aDate != bDate { return aDate > bDate }
            let aTime = KidsFormatters.parseDateTime(a.CreatedAt)?.timeIntervalSince1970 ?? 0
            let bTime = KidsFormatters.parseDateTime(b.CreatedAt)?.timeIntervalSince1970 ?? 0
            return aTime > bTime
        }
        var groups: [KidsHistoryGroup] = []
        for item in sorted {
            let key = item.EntryDate
            if let index = groups.firstIndex(where: { $0.DateKey == key }) {
                groups[index].Items.append(item)
            } else {
                let label = KidsFormatters.formatDate(key)
                groups.append(KidsHistoryGroup(DateKey: key, Label: label, Items: [item], Summary: dailySummaryByDate[key]))
            }
        }
        return groups
    }

    private var filteredEntries: [KidsHistoryItem] {
        let items = historyItems
        return items.filter { item in
            switch activeFilter {
            case .all:
                return true
            case .money:
                return item.Kind == .ledger
            case .pending:
                return item.Status == "Pending"
            case .daily:
                return item.Kind == .chore && item.ChoreType == "Daily"
            case .habit:
                return item.Kind == .chore && item.ChoreType == "Habit"
            case .bonus:
                return item.Kind == .chore && item.ChoreType == "Bonus"
            }
        }
    }

    private var historyItems: [KidsHistoryItem] {
        let choreItems = entries.map { entry in
            KidsHistoryItem(
                Kind: .chore,
                Key: "chore-\(entry.Id)",
                Id: entry.Id,
                EntryDate: entry.EntryDate,
                CreatedAt: entry.CreatedAt,
                Title: entry.ChoreLabel,
                ChoreType: entry.ChoreType,
                Status: entry.Status,
                Notes: entry.Notes,
                Amount: entry.Amount,
                EntryType: nil,
                ChoreId: entry.ChoreId
            )
        }
        let ledgerItems = ledgerEntries.filter { MoneyEntryTypes.contains($0.EntryType) }.map { entry in
            KidsHistoryItem(
                Kind: .ledger,
                Key: "ledger-\(entry.Id)",
                Id: entry.Id,
                EntryDate: entry.EntryDate,
                CreatedAt: entry.CreatedAt,
                Title: entry.Narrative?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                    ? entry.Narrative ?? ""
                    : moneyTypeLabel(entry.EntryType),
                ChoreType: nil,
                Status: nil,
                Notes: entry.Notes,
                Amount: entry.Amount,
                EntryType: entry.EntryType,
                ChoreId: nil
            )
        }
        return choreItems + ledgerItems
    }

    private func toggleEntry(_ key: String) {
        if expandedEntryIds.contains(key) {
            expandedEntryIds.remove(key)
        } else {
            expandedEntryIds.insert(key)
        }
    }

    private func toggleGroup(_ key: String) {
        if expandedDates.contains(key) {
            expandedDates.remove(key)
        } else {
            expandedDates.insert(key)
        }
    }

    private func onOpenLogSheet() {
        guard canLogPast else { return }
        logChoreIds = []
        logNotes = ""
        logError = ""
        showNotes = false
        logDate = maxPastDate
        showLogSheet = true
    }

    @MainActor
    private func submitLog() async {
        guard !logChoreIds.isEmpty else {
            logError = "Pick at least one chore."
            return
        }
        let entryDate = KidsFormatters.dateKey(from: logDate)
        guard !todayKey.isEmpty, entryDate < todayKey else {
            logError = "Pick a past date."
            return
        }
        logSaving = true
        logError = ""
        var savedCount = 0
        var failures: [String] = []
        let existing = logEntryByChoreId
        for choreId in logChoreIds.sorted() {
            if existing[choreId] != nil {
                continue
            }
            do {
                let payload = KidsChoreEntryCreate(
                    ChoreId: choreId,
                    EntryDate: entryDate,
                    Notes: logNotes.isEmpty ? nil : logNotes
                )
                _ = try await KidsApi.createChoreEntry(payload)
                savedCount += 1
            } catch {
                failures.append((error as? ApiError)?.message ?? "Unable to save chore entry.")
            }
        }

        if savedCount > 0 {
            toast = savedCount == 1 ? "Sent for approval" : "Sent \(savedCount) chores for approval"
            await load()
            logChoreIds = []
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 2_600_000_000)
                toast = ""
            }
        }

        if failures.isEmpty {
            showLogSheet = false
        } else {
            logError = failures.first ?? "Unable to save chore entry."
        }
        logSaving = false
    }

    @MainActor
    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let entryList = KidsApi.fetchChoreEntries(limit: 50, includeDeleted: false)
            async let ledgerData = KidsApi.fetchLedger(limit: 100)
            async let overviewData = KidsApi.fetchOverview()
            let (entryResponse, ledgerResponse, overviewResponse) = try await (entryList, ledgerData, overviewData)
            entries = entryResponse
            ledgerEntries = ledgerResponse.Entries
            chores = overviewResponse.Chores
            todayKey = overviewResponse.Today
            allowedStartKey = overviewResponse.AllowedStartDate
            if !overviewResponse.AllowedEndDate.isEmpty {
                maxPastKey = overviewResponse.AllowedEndDate
            } else if let todayDate = KidsFormatters.parseDate(overviewResponse.Today),
                      let maxPast = Calendar.current.date(byAdding: .day, value: -1, to: todayDate) {
                maxPastKey = KidsFormatters.dateKey(from: maxPast)
            } else if !overviewResponse.Today.isEmpty {
                maxPastKey = overviewResponse.Today
            } else {
                maxPastKey = KidsFormatters.dateKey(from: Date())
            }
            status = .ready
            await loadSummariesIfNeeded()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load history."
        }
    }

    @MainActor
    private func loadSummariesIfNeeded() async {
        let uniqueDates = Set(entries.map { $0.EntryDate }).subtracting(loadedSummaryDates)
        guard !uniqueDates.isEmpty else { return }
        for dateKey in uniqueDates {
            loadedSummaryDates.insert(dateKey)
            do {
                let overview = try await KidsApi.fetchOverview(selectedDate: dateKey)
                let dailyChoreIds = Set(overview.Chores.filter { $0.ChoreType == "Daily" }.map { $0.Id })
                let total = dailyChoreIds.count
                let done = overview.Entries.filter { $0.Status == "Approved" && dailyChoreIds.contains($0.ChoreId) }.count
                dailySummaryByDate[dateKey] = KidsDailySummary(done: done, total: total)
            } catch {
                continue
            }
        }
    }

    private func moneyTypeLabel(_ value: String?) -> String {
        switch value {
        case "Deposit":
            return "Deposit"
        case "Withdrawal":
            return "Withdrawal"
        case "StartingBalance":
            return "Balance adjustment"
        default:
            return "Money"
        }
    }
}

private struct KidsHistoryRow: View {
    let item: KidsHistoryItem
    let isExpanded: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: onToggle) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(emoji) \(item.Title)")
                            .font(.subheadline.weight(.semibold))
                        if let amountLabel {
                            Text(amountLabel)
                                .font(.caption)
                                .foregroundStyle(item.Amount < 0 ? .red : .green)
                        }
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(.secondarySystemBackground))
                )
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    detailRow(label: "Notes", value: item.Notes?.isEmpty == false ? item.Notes! : "None")
                    detailRow(label: "Logged", value: KidsFormatters.formatDateTime(item.CreatedAt))
                    detailRow(label: "Type", value: item.typeLabel)
                    if item.Kind == .chore {
                        detailRow(label: "Status", value: item.statusLabel)
                    }
                }
                .font(.caption)
                .padding(.leading, 8)
            }
        }
    }

    private var emoji: String {
        if item.Kind == .ledger {
            return KidsEmoji.headerEmoji("AvailableNow")
        }
        return KidsEmoji.choreEmoji(type: item.ChoreType)
    }

    private var amountLabel: String? {
        guard abs(item.Amount) > 0 else { return nil }
        return KidsFormatters.formatCurrency(item.Amount)
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
        }
    }
}

private struct KidsHistoryGroup {
    let DateKey: String
    let Label: String
    var Items: [KidsHistoryItem]
    let Summary: KidsDailySummary?

    var headerToneColor: Color {
        if let summary = Summary, summary.total > 0 {
            if summary.done == summary.total {
                return Color.green.opacity(0.15)
            }
            if summary.done < summary.total {
                return Color.orange.opacity(0.15)
            }
        }
        return Color(.secondarySystemBackground)
    }
}

private struct KidsHistoryItem {
    let Kind: KidsHistoryKind
    let Key: String
    let Id: Int
    let EntryDate: String
    let CreatedAt: String
    let Title: String
    let ChoreType: String?
    let Status: String?
    let Notes: String?
    let Amount: Double
    let EntryType: String?
    let ChoreId: Int?

    var statusLabel: String {
        switch Status {
        case "Pending":
            return "Pending approval"
        case "Rejected":
            return "Rejected"
        case "Approved":
            return "Approved"
        default:
            return "-"
        }
    }

    var typeLabel: String {
        if Kind == .ledger {
            return EntryType ?? "Money"
        }
        switch ChoreType {
        case "Daily":
            return "Daily job"
        case "Habit":
            return "Habit"
        case "Bonus":
            return "Bonus task"
        default:
            return "Task"
        }
    }
}

private struct KidsDailySummary {
    let done: Int
    let total: Int

    var label: String {
        if total == 0 {
            return "No daily jobs"
        }
        return "\(done)/\(total) daily jobs done"
    }
}

private enum KidsHistoryKind {
    case chore
    case ledger
}

private enum KidsHistoryFilter: CaseIterable {
    case all
    case daily
    case habit
    case bonus
    case money
    case pending

    var label: String {
        switch self {
        case .all: return "All"
        case .daily: return "Daily jobs"
        case .habit: return "Habits"
        case .bonus: return "Bonus tasks"
        case .money: return "Money"
        case .pending: return "Pending approval"
        }
    }
}

private let MoneyEntryTypes: Set<String> = ["Deposit", "Withdrawal", "StartingBalance"]

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}

private struct KidsLogTaskRow: View {
    let chore: KidsChore
    let entry: KidsChoreEntry?
    let isSelected: Bool
    let showAmount: Bool
    let onSelect: () -> Void
    @State private var doneEmoji = ""

    private var isDone: Bool {
        let status = entry?.Status ?? ""
        return status == "Approved" || status == "Pending"
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: (isDone || isSelected) ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle((isDone || isSelected) ? Color.accentColor : Color.secondary)
                    .symbolEffect(.bounce, value: isDone || isSelected)
                Text(chore.Label + amountSuffix)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(isDone ? "Done \(doneEmoji)" : (isSelected ? "Ready" : "To do"))
                    .font((isDone || isSelected) ? .caption.weight(.semibold) : .caption)
                    .foregroundStyle((isDone || isSelected) ? Color.accentColor : Color.secondary)
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isSelected ? Color.accentColor.opacity(0.12) : Color(.secondarySystemBackground))
            )
        }
        .buttonStyle(.plain)
        .disabled(entry != nil)
        .onAppear {
            if isDone && doneEmoji.isEmpty {
                doneEmoji = KidsEmoji.randomDoneEmoji()
            }
        }
        .onChange(of: isDone) { _, newValue in
            if newValue {
                if doneEmoji.isEmpty {
                    doneEmoji = KidsEmoji.randomDoneEmoji()
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
