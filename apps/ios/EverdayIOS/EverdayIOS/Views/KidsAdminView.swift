import SwiftUI

struct KidsAdminView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var kids: [KidsLinkedKid] = []
    @State private var chores: [KidsChore] = []
    @State private var activeKidId: Int?
    @State private var activeTab: KidsAdminTab = .month
    @State private var monthCursor: Date = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date())) ?? Date()
    @State private var calendarDisplayMode: KidsAdminCalendarDisplayMode = .chores

    @State private var monthSummary: KidsMonthSummaryResponse?
    @State private var monthOverview: KidsMonthOverviewResponse?
    @State private var pendingApprovals: [KidsApprovalOut] = []
    @State private var approvalsLoaded = false
    @State private var historyEntries: [KidsChoreEntry] = []
    @State private var ledgerEntries: [KidsLedgerEntry] = []

    @State private var approvalFilterType: ApprovalFilter = .all
    @State private var approvalRangeStart = ""
    @State private var approvalRangeEnd = ""
    @State private var approvalExpanded: Set<String> = []

    @State private var historyFilter: HistoryFilter = .all
    @State private var historyExpanded: Set<String> = []
    @State private var historyItemExpanded: Set<String> = []

    @State private var showAllowanceSheet = false
    @State private var allowanceAmount = ""
    @State private var allowanceStartDate = Date()

    @State private var showMoneySheet = false
    @State private var moneyForm = MoneyForm()
    @State private var moneyError = ""
    @State private var moneySaving = false

    @State private var showChoreManager = false
    @State private var showChoreForm = false
    @State private var choreForm = ChoreForm()
    @State private var editingChore: KidsChore?
    @State private var choreSearch = ""
    @State private var choreFilter: ChoreFilter = .all
    @State private var choreKidFilter: Int?

    @State private var showDaySheet = false
    @State private var selectedDay: String?
    @State private var dayDetail: KidsDayDetailResponse?

    @State private var showEntrySheet = false
    @State private var entryForm = EntryForm()
    @State private var entryDetail: KidsDayDetailResponse?

    var body: some View {
        let scroll = ScrollView {
            contentView
        }

        let base = scroll
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Kids portal")
            .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
            .toolbar {
                if horizontalSizeClass == .regular {
                    ToolbarItem(placement: .principal) {
                        ConstrainedTitleView(title: "Kids portal")
                    }
                }
            }

        let sheets = base
            .sheet(isPresented: $showAllowanceSheet) { allowanceSheet }
            .sheet(isPresented: $showMoneySheet) { moneySheet }
            .sheet(isPresented: $showChoreManager) { choreManagerSheet }
            .sheet(isPresented: $showChoreForm) { choreFormSheet }
            .sheet(isPresented: $showDaySheet) { dayDetailSheet }
            .sheet(isPresented: $showEntrySheet) { entrySheet }

        let tasks = sheets
            .task {
                if status == .idle {
                    await loadBaseData()
                }
            }
            .onChange(of: activeKidId) { _, _ in
                Task { await loadKidData() }
            }
            .onChange(of: monthCursor) { _, _ in
                Task {
                    await loadMonthData()
                    await loadHistory()
                }
            }
            .onChange(of: pendingApprovals.count) { _, _ in
                if !hasApprovals && activeTab == .approvals {
                    activeTab = .month
                }
            }

        return AnyView(tasks)
    }

    private var contentView: AnyView {
        AnyView(contentBody)
    }

    @ViewBuilder
    private var contentBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            headerSection
            tabPicker

            if status == .loading {
                ProgressView("Loading kids admin...")
                    .frame(maxWidth: .infinity, alignment: .center)
            }

            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            tabContent
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, bottomContentPadding)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private var tabContent: AnyView {
        AnyView(tabContentBody)
    }

    @ViewBuilder
    private var tabContentBody: some View {
        switch activeTab {
        case .month:
            monthTab
        case .approvals:
            approvalsTab
        case .history:
            historyTab
        case .chores:
            choresTab
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Approvals, month summary, and chore setup.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if !kids.isEmpty {
                kidPicker
            }
        }
    }

    private var kidPicker: some View {
        Group {
            if kids.count <= 4 {
                HStack(spacing: 8) {
                    ForEach(kids) { kid in
                        Button {
                            activeKidId = kid.KidUserId
                        } label: {
                            Text(kid.FirstName?.isEmpty == false ? kid.FirstName! : kid.Username)
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(
                                    Capsule()
                                        .fill(activeKidId == kid.KidUserId ? Color.accentColor.opacity(0.2) : Color(.secondarySystemBackground))
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                Picker("Select kid", selection: Binding(
                    get: { activeKidId ?? kids.first?.KidUserId ?? 0 },
                    set: { activeKidId = $0 }
                )) {
                    ForEach(kids) { kid in
                        Text(kid.FirstName?.isEmpty == false ? kid.FirstName! : kid.Username)
                            .tag(kid.KidUserId)
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    private var tabPicker: some View {
        let tabs = availableTabs
        return Picker("Kids admin tabs", selection: $activeTab) {
            ForEach(tabs, id: \.self) { tab in
                Text(tab.label).tag(tab)
            }
        }
        .pickerStyle(.segmented)
    }

    private var monthTab: AnyView {
        AnyView(monthTabBody)
    }

    @ViewBuilder
    private var monthTabBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            monthHeader
            currentTotalHeroCard
            monthSummaryCard
            calendarCard
        }
    }

    private var monthHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                HStack(spacing: 8) {
                    Button {
                        changeMonth(by: -1)
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .buttonStyle(.bordered)

                    Text(monthTitle)
                        .font(.headline)

                    Button {
                        changeMonth(by: 1)
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                    .buttonStyle(.bordered)
                    .disabled(isCurrentMonth)
                }

                Spacer()
            }

            HStack(spacing: 10) {
                Button("Edit allowance") {
                    Task { await openAllowanceSheet() }
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .controlSize(.small)
                .frame(height: 36)
                .tint(.secondary)
                .disabled(activeKidId == nil)

                Button("Log money") {
                    openMoneySheet()
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .controlSize(.small)
                .frame(height: 36)
                .tint(.secondary)
                .disabled(activeKidId == nil)
            }
        }
    }

    private var monthSummaryCard: some View {
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Month summary")
                    .font(.headline)
                Text(activeKidName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
                summaryMetric(label: "Base allowance", value: monthSummary.map { KidsFormatters.formatCurrency($0.MonthlyAllowance) } ?? "-")
                summaryMetric(label: "Missed days", value: monthSummary.map { "\($0.MissedDays) (\(KidsFormatters.formatCurrency($0.MissedDeduction)))" } ?? "-")
                summaryMetric(label: "Money in", value: monthSummary == nil ? "-" : KidsFormatters.formatCurrency(ledgerTotals.moneyIn))
                summaryMetric(label: "Money out", value: monthSummary == nil ? "-" : KidsFormatters.formatCurrency(ledgerTotals.moneyOut))
                summaryMetric(label: "Bonus approved", value: monthSummary.map { KidsFormatters.formatCurrency($0.ApprovedBonusTotal) } ?? "-")
                summaryMetric(label: "Bonus pending", value: monthSummary.map { KidsFormatters.formatCurrency($0.PendingBonusTotal) } ?? "-")
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var currentTotalHeroCard: some View {
        let totals = adminTotals
        let currentValue = monthSummary != nil ? KidsFormatters.formatCurrency(totals.current) : "-"
        let projectedValue = monthSummary != nil ? KidsFormatters.formatCurrency(totals.projected) : "-"
        return VStack(alignment: .leading, spacing: 10) {
            Text("Current total")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(currentValue)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(.primary)

            HStack {
                Text("Projected total")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(projectedValue)
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var calendarCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Calendar")
                    .font(.headline)
                Text("Tap a day to edit entries.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Picker("Calendar mode", selection: $calendarDisplayMode) {
                    ForEach(KidsAdminCalendarDisplayMode.allCases, id: \.self) { mode in
                        Text(mode.label).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.top, 4)
                if isCompactCalendar {
                    calendarLegend
                }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 8) {
                ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { label in
                    Text(label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }

                ForEach(calendarCells) { cell in
                    if cell.isEmpty {
                        Color.clear
                            .frame(height: 60)
                    } else {
                        Button {
                            openDay(cell.dateKey)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("\(cell.dayNumber)")
                                        .font(.caption.weight(.semibold))
                                    Spacer()
                                }

                                if isCompactCalendar {
                                    HStack(spacing: 6) {
                                        if calendarDisplayMode == .chores {
                                            if let icon = statusIcon(for: cell) {
                                                Image(systemName: icon)
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundStyle(cell.statusColor)
                                            }
                                        } else {
                                            if let moneyIcon = moneyIcon(for: cell) {
                                                Image(systemName: moneyIcon)
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundStyle(cell.moneyTotal < 0 ? .red : .green)
                                            }
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    if calendarDisplayMode == .chores, cell.pendingCount > 0 {
                                        Image(systemName: "exclamationmark.circle.fill")
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(.red)
                                            .accessibilityLabel("Pending approvals")
                                    }
                                } else {
                                    if calendarDisplayMode == .chores, !cell.statusText.isEmpty {
                                        Text(cell.statusText)
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(cell.statusColor)
                                    }

                                    if calendarDisplayMode == .chores, cell.pendingCount > 0 {
                                        Text("Pending approvals")
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(.red)
                                    }

                                    if calendarDisplayMode == .money, !cell.moneyLabel.isEmpty {
                                        Text(cell.moneyLabel)
                                            .font(.caption2)
                                            .foregroundStyle(cell.moneyTotal < 0 ? .red : .green)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: 60, alignment: .topLeading)
                            .padding(8)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color(.secondarySystemBackground))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(cell.isToday ? Color.accentColor.opacity(0.4) : Color.clear, lineWidth: 1)
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var calendarLegend: some View {
        VStack(alignment: .leading, spacing: 6) {
            if calendarDisplayMode == .chores {
                HStack(spacing: 8) {
                    calendarLegendItem(icon: "checkmark.circle.fill", label: "Done", color: .green)
                    calendarLegendItem(icon: "arrow.triangle.2.circlepath", label: "In progress", color: .orange)
                    calendarLegendItem(icon: "xmark.circle.fill", label: "Missed", color: .red)
                }
                HStack(spacing: 8) {
                    calendarLegendItem(icon: "exclamationmark.circle.fill", label: "Pending", color: .red)
                }
            } else {
                HStack(spacing: 8) {
                    calendarLegendItem(icon: "arrow.up.right.circle.fill", label: "Money in", color: .green)
                    calendarLegendItem(icon: "arrow.down.right.circle.fill", label: "Money out", color: .red)
                }
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.top, 4)
    }

    private func calendarLegendItem(icon: String, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(color)
            Text(label)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule(style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var isCompactCalendar: Bool {
        horizontalSizeClass == .compact
    }

    private func statusIcon(for cell: KidsAdminCalendarCell) -> String? {
        switch cell.statusText {
        case "Done":
            return "checkmark.circle.fill"
        case "Missed":
            return "xmark.circle.fill"
        case "WIP":
            return "arrow.triangle.2.circlepath"
        case "No chores available":
            return "info.circle.fill"
        default:
            return nil
        }
    }

    private func moneyIcon(for cell: KidsAdminCalendarCell) -> String? {
        guard cell.moneyTotal != 0 else { return nil }
        return cell.moneyTotal > 0 ? "arrow.up.right.circle.fill" : "arrow.down.right.circle.fill"
    }

    private var approvalsTab: AnyView {
        AnyView(approvalsTabBody)
    }

    @ViewBuilder
    private var approvalsTabBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Approvals")
                    .font(.headline)
                Text("Review backdated chores.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            approvalFilters

            if approvalsDates.isEmpty {
                Text("No pending approvals right now.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(approvalsDates, id: \.self) { dateKey in
                    approvalGroup(for: dateKey)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var approvalFilters: some View {
        VStack(spacing: 12) {
            Picker("Type", selection: $approvalFilterType) {
                ForEach(ApprovalFilter.allCases, id: \.self) { filter in
                    Text(filter.label).tag(filter)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 12) {
                dateFilterField(title: "Date from", value: $approvalRangeStart)
                dateFilterField(title: "Date to", value: $approvalRangeEnd)
            }
        }
    }

    private func approvalGroup(for dateKey: String) -> some View {
        let entries = approvalsByDate[dateKey] ?? []
        let isOpen = approvalExpanded.contains(dateKey)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button {
                    toggleApprovalGroup(dateKey)
                } label: {
                    HStack {
                        Text(dayLabel(from: dateKey))
                            .font(.subheadline.weight(.semibold))
                        Text("\(entries.count)")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(Capsule())
                        Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                Button("Approve all") {
                    Task { await approveDateGroup(dateKey) }
                }
                .buttonStyle(.bordered)
                .disabled(status == .loading)
            }

            if isOpen {
                ForEach(entries) { entry in
                    approvalRow(entry)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func approvalRow(_ entry: KidsApprovalOut) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.ChoreLabel)
                        .font(.subheadline.weight(.semibold))
                    Text("\(entry.KidName) • \(entry.EntryDate) • \(dateTimeLabel(from: entry.CreatedAt))\(entry.Amount > 0 ? " • \(KidsFormatters.formatCurrency(entry.Amount))" : "")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(entryTypeLabel(entry.ChoreType))
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(Capsule())
            }
            if let notes = entry.Notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 8) {
                Button("Reject") {
                    Task { await handleApproval(entryId: entry.Id, approve: false) }
                }
                .buttonStyle(.bordered)
                Button("Approve") {
                    Task { await handleApproval(entryId: entry.Id, approve: true) }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var historyTab: AnyView {
        AnyView(historyTabBody)
    }

    @ViewBuilder
    private var historyTabBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            historyHeader
            historyFilters

            if historyDates.isEmpty {
                Text("No history entries for this month.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(historyDates, id: \.self) { dateKey in
                    historyGroup(for: dateKey)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var historyHeader: some View {
        HStack {
            HStack(spacing: 8) {
                Button {
                    changeMonth(by: -1)
                } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.bordered)

                Text(monthTitle)
                    .font(.headline)

                Button {
                    changeMonth(by: 1)
                } label: {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.bordered)
                .disabled(isCurrentMonth)
            }
            Spacer()
        }
    }

    private var historyFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HistoryFilter.allCases, id: \.self) { filter in
                    Button {
                        historyFilter = filter
                    } label: {
                        Text(filter.label)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(historyFilter == filter ? Color.accentColor.opacity(0.2) : Color(.secondarySystemBackground))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func historyGroup(for dateKey: String) -> some View {
        let entries = historyByDate[dateKey] ?? []
        let isOpen = historyExpanded.contains(dateKey)
        let overview = overviewByDate[dateKey]
        let dailyTotal = overview?.DailyTotal ?? 0
        let dailyDone = overview?.DailyDone ?? 0
        let dailySummary = dailyTotal > 0 ? "\(dailyDone)/\(dailyTotal) daily jobs done" : "No daily jobs"
        let moneyTotal = dayMoneyTotalsByDate[dateKey] ?? 0
        let moneyLabel = signedCurrency(moneyTotal)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button {
                    toggleHistoryGroup(dateKey)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(dayLabel(from: dateKey))
                            .font(.subheadline.weight(.semibold))
                        Text("\(dailySummary)\(moneyLabel.isEmpty ? "" : " • \(moneyLabel)")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                Button("Add entry") {
                    openEntrySheet(dateKey: dateKey, entry: nil)
                }
                .buttonStyle(.bordered)
            }

            if isOpen {
                ForEach(entries, id: \.Key) { entry in
                    historyRow(entry)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func historyRow(_ entry: KidsAdminHistoryItem) -> some View {
        let isExpanded = historyItemExpanded.contains(entry.Key)
        return VStack(alignment: .leading, spacing: 6) {
            Button {
                toggleHistoryItem(entry.Key)
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.Title)
                            .font(.subheadline.weight(.semibold))
                        if !entry.isLedger {
                            Text(entryTypeLabel(entry.ChoreType))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    if entry.amountLabel.isEmpty == false {
                        Text(entry.amountLabel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(entry.Amount < 0 ? .red : .green)
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Notes: \(entry.Notes?.isEmpty == false ? entry.Notes! : "None")")
                        .font(.caption)
                    Text("Logged: \(dateTimeLabel(from: entry.CreatedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("Type: \(entry.isLedger ? moneyTypeLabel(entry.EntryType) : entryTypeLabel(entry.ChoreType))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !entry.isLedger {
                        Text("Status: \(entry.Status ?? "-")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            Button("Edit") {
                                openEntrySheet(dateKey: entry.EntryDate, entry: entry)
                            }
                            .buttonStyle(.bordered)
                            Button("Delete") {
                                Task { await deleteEntry(entry) }
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var choresTab: AnyView {
        AnyView(choresTabBody)
    }

    @ViewBuilder
    private var choresTabBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Chores")
                        .font(.headline)
                    Text("Daily jobs, habits, and bonus tasks.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Manage chores") {
                    showChoreManager = true
                }
                .buttonStyle(.borderedProminent)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
                summaryMetric(label: "Daily jobs", value: "\(choreCounts.daily)")
                summaryMetric(label: "Habits", value: "\(choreCounts.habit)")
                summaryMetric(label: "Bonus tasks", value: "\(choreCounts.bonus)")
                summaryMetric(label: "Disabled", value: "\(choreCounts.disabled)")
                summaryMetric(label: "Assigned to \(activeKidName)", value: "\(assignedToActiveCount)")
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
    }

    private var allowanceSheet: some View {
        NavigationStack {
            Form {
                Section("Monthly allowance") {
                    TextField("Amount", text: $allowanceAmount)
                        .keyboardType(.decimalPad)
                    DatePicker("Start date", selection: $allowanceStartDate, displayedComponents: .date)
                }
            }
            .navigationTitle("Allowance")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showAllowanceSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await saveAllowance() }
                    }
                }
            }
        }
    }

    private var moneySheet: some View {
        NavigationStack {
            Form {
                Section("Entry") {
                    Picker("Type", selection: $moneyForm.entryType) {
                        ForEach(MoneyEntryType.allCases, id: \.self) { type in
                            Text(type.label).tag(type)
                        }
                    }
                    DatePicker("Date", selection: $moneyForm.entryDate, displayedComponents: .date)
                    TextField("Amount", text: $moneyForm.amount)
                        .keyboardType(.decimalPad)
                    TextField("Narrative", text: $moneyForm.narrative)
                    TextField("Notes", text: $moneyForm.notes)
                }

                if !moneyError.isEmpty {
                    Text(moneyError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .navigationTitle("Log money")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showMoneySheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(moneySaving ? "Saving..." : "Save") {
                        Task { await saveMoney() }
                    }
                    .disabled(moneySaving)
                }
            }
            .onChange(of: moneyForm.entryType) { _, _ in
                moneyForm.updateNarrativeForType()
            }
        }
    }

    private var choreManagerSheet: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Filter", selection: $choreFilter) {
                        ForEach(ChoreFilter.allCases, id: \.self) { filter in
                            Text(filter.label).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)

                    Picker("Kid", selection: Binding(
                        get: { choreKidFilter ?? 0 },
                        set: { newValue in
                            choreKidFilter = newValue == 0 ? nil : newValue
                        }
                    )) {
                        Text("All kids").tag(0)
                        ForEach(kids) { kid in
                            Text(kid.FirstName?.isEmpty == false ? kid.FirstName! : kid.Username)
                                .tag(kid.KidUserId)
                        }
                    }
                }

                ForEach(visibleChoreGroups, id: \.title) { group in
                    Section(group.title) {
                        if group.chores.isEmpty {
                            Text("No chores in this section.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(group.chores, id: \.Id) { chore in
                                choreRow(chore)
                            }
                        }
                    }
                }
            }
            .searchable(text: $choreSearch, prompt: "Search chores")
            .navigationTitle("Manage chores")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { showChoreManager = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add chore") {
                        openChoreForm(chore: nil)
                    }
                }
            }
        }
    }

    private var choreFormSheet: some View {
        NavigationStack {
            Form {
                Section("Chore") {
                    TextField("Label", text: $choreForm.label)
                    Picker("Type", selection: $choreForm.type) {
                        ForEach(ChoreType.allCases, id: \.self) { type in
                            Text(type.label).tag(type)
                        }
                    }
                    if choreForm.type == .bonus {
                        TextField("Amount", text: $choreForm.amount)
                            .keyboardType(.decimalPad)
                    }
                    TextField("Sort order", text: $choreForm.sortOrder)
                        .keyboardType(.numberPad)
                    Toggle("Active", isOn: $choreForm.isActive)
                }

                Section("Schedule") {
                    DatePicker("Start date", selection: $choreForm.startDate, displayedComponents: .date)
                    Toggle("Set end date", isOn: $choreForm.useEndDate)
                    if choreForm.useEndDate {
                        DatePicker("End date", selection: $choreForm.endDate, displayedComponents: .date)
                    }
                }

                Section("Assign to kids") {
                    ForEach(kids) { kid in
                        Toggle(isOn: Binding(
                            get: { choreForm.kidIds.contains(kid.KidUserId) },
                            set: { isOn in
                                if isOn {
                                    choreForm.kidIds.insert(kid.KidUserId)
                                } else {
                                    choreForm.kidIds.remove(kid.KidUserId)
                                }
                            }
                        )) {
                            Text(kid.FirstName?.isEmpty == false ? kid.FirstName! : kid.Username)
                        }
                    }
                }
            }
            .navigationTitle(editingChore == nil ? "Add chore" : "Edit chore")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showChoreForm = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await saveChore() }
                    }
                }
            }
        }
    }

    private var dayDetailSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let selectedDay {
                        Text(dayLabel(from: selectedDay))
                            .font(.headline)
                    }

                    if let selectedDay {
                        let entries = dayLedgerEntries(for: selectedDay)
                        if !entries.isEmpty {
                            dayMoneySection(entries)
                        }
                    }

                    if let dayDetail {
                        dayChoreSection(title: "Daily jobs", chores: dayDetail.DailyJobs)
                        Divider()
                        dayChoreSection(title: "Habits", chores: dayDetail.Habits)
                        Divider()
                        dayChoreSection(title: "Bonus tasks", chores: dayDetail.BonusTasks, showAmounts: true)
                    }
                }
                .padding(20)
            }
            .navigationTitle("Day detail")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add entry") {
                        if let selectedDay {
                            openEntrySheet(dateKey: selectedDay, entry: nil)
                        }
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { showDaySheet = false }
                }
            }
            .task {
                await loadDayDetail()
            }
        }
    }

    private var entrySheet: some View {
        NavigationStack {
            Form {
                Section("Entry") {
                    DatePicker("Date", selection: $entryForm.entryDate, displayedComponents: .date)
                    Picker("Type", selection: $entryForm.type) {
                        ForEach(ChoreType.allCases, id: \.self) { type in
                            Text(type.label).tag(type)
                        }
                    }
                    Picker("Chore", selection: $entryForm.choreId) {
                        Text("Select chore").tag(0)
                        ForEach(availableChoresForEntry, id: \.Id) { chore in
                            Text(chore.Label).tag(chore.Id)
                        }
                    }
                    if entryForm.type == .bonus {
                        TextField("Amount", text: $entryForm.amount)
                            .keyboardType(.decimalPad)
                    }
                    TextField("Notes", text: $entryForm.notes)
                    Picker("Status", selection: $entryForm.status) {
                        Text("None").tag("")
                        Text("Approved").tag("Approved")
                        Text("Pending").tag("Pending")
                        Text("Rejected").tag("Rejected")
                    }
                }
            }
            .navigationTitle(entryForm.entryId == nil ? "Add entry" : "Edit entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showEntrySheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await saveEntry() }
                    }
                }
            }
            .task {
                await loadEntryDetailIfNeeded()
            }
        }
    }

    private func summaryMetric(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func dateFilterField(title: String, value: Binding<String>) -> some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            DatePicker(
                "",
                selection: Binding(
                    get: { KidsFormatters.parseDate(value.wrappedValue) ?? Date() },
                    set: { newValue in value.wrappedValue = KidsFormatters.dateKey(from: newValue) }
                ),
                displayedComponents: .date
            )
            .labelsHidden()
            Button("Clear") {
                value.wrappedValue = ""
            }
            .font(.caption)
        }
    }

    private func changeMonth(by delta: Int) {
        if let next = Calendar.current.date(byAdding: .month, value: delta, to: monthCursor) {
            monthCursor = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: next)) ?? next
        }
    }

    private func openDay(_ dateKey: String) {
        selectedDay = dateKey
        showDaySheet = true
    }

    private func openMoneySheet() {
        moneyForm = MoneyForm()
        moneyForm.updateNarrativeForType()
        moneyError = ""
        showMoneySheet = true
    }

    private func openAllowanceSheet() async {
        guard let activeKidId else { return }
        status = .loading
        errorMessage = ""
        do {
            let rule = try await KidsAdminApi.fetchPocketMoneyRule(kidId: activeKidId)
            if let rule {
                allowanceAmount = String(rule.Amount)
                allowanceStartDate = KidsFormatters.parseDate(rule.StartDate) ?? Date()
            } else {
                allowanceAmount = "40"
                allowanceStartDate = Date()
            }
            showAllowanceSheet = true
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to load allowance."
        }
        status = .ready
    }

    private func openChoreForm(chore: KidsChore?) {
        if let chore {
            editingChore = chore
            choreForm = ChoreForm(from: chore)
        } else {
            editingChore = nil
            choreForm = ChoreForm()
        }
        showChoreForm = true
    }

    private func openEntrySheet(dateKey: String, entry: KidsAdminHistoryItem?) {
        let date = KidsFormatters.parseDate(dateKey) ?? Date()
        if let entry {
            entryForm = EntryForm(from: entry, date: date)
        } else {
            entryForm = EntryForm(date: date)
        }
        showEntrySheet = true
    }

    private func toggleApprovalGroup(_ dateKey: String) {
        if approvalExpanded.contains(dateKey) {
            approvalExpanded.remove(dateKey)
        } else {
            approvalExpanded.insert(dateKey)
        }
    }

    private func toggleHistoryGroup(_ dateKey: String) {
        if historyExpanded.contains(dateKey) {
            historyExpanded.remove(dateKey)
        } else {
            historyExpanded.insert(dateKey)
        }
    }

    private func toggleHistoryItem(_ key: String) {
        if historyItemExpanded.contains(key) {
            historyItemExpanded.remove(key)
        } else {
            historyItemExpanded.insert(key)
        }
    }

    private func handleApproval(entryId: Int, approve: Bool) async {
        status = .loading
        do {
            if approve {
                _ = try await KidsAdminApi.approveChoreEntry(entryId: entryId)
            } else {
                _ = try await KidsAdminApi.rejectChoreEntry(entryId: entryId)
            }
            await loadApprovals()
            await loadMonthData()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to update approval."
        }
        status = .ready
    }

    private func approveDateGroup(_ dateKey: String) async {
        let entries = approvalsByDate[dateKey] ?? []
        guard !entries.isEmpty else { return }
        status = .loading
        do {
            try await withThrowingTaskGroup(of: Void.self) { group in
                for entry in entries {
                    group.addTask {
                        _ = try await KidsAdminApi.approveChoreEntry(entryId: entry.Id)
                    }
                }
                try await group.waitForAll()
            }
            await loadApprovals()
            await loadMonthData()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to approve items."
        }
        status = .ready
    }

    private func saveAllowance() async {
        guard let activeKidId else { return }
        let amount = Double(allowanceAmount) ?? 0
        if amount <= 0 {
            errorMessage = "Monthly allowance is required."
            return
        }
        status = .loading
        let payload = PocketMoneyRuleUpsert(
            Amount: amount,
            Frequency: "monthly",
            DayOfWeek: 0,
            DayOfMonth: 1,
            StartDate: KidsFormatters.dateKey(from: allowanceStartDate),
            IsActive: true
        )
        do {
            _ = try await KidsAdminApi.updatePocketMoneyRule(kidId: activeKidId, payload: payload)
            showAllowanceSheet = false
            await loadMonthData()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to save allowance."
        }
        status = .ready
    }

    private func saveMoney() async {
        guard let activeKidId else { return }
        let amount = Double(moneyForm.amount) ?? 0
        if amount <= 0 {
            moneyError = "Enter an amount."
            return
        }
        if moneyForm.narrative.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            moneyError = "Add a label."
            return
        }
        moneySaving = true
        moneyError = ""
        let payload = LedgerEntryCreate(
            Amount: amount,
            EntryDate: KidsFormatters.dateKey(from: moneyForm.entryDate),
            Narrative: moneyForm.narrative.trimmingCharacters(in: .whitespacesAndNewlines),
            Notes: moneyForm.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : moneyForm.notes
        )
        do {
            switch moneyForm.entryType {
            case .deposit:
                _ = try await KidsAdminApi.createKidDeposit(kidId: activeKidId, payload: payload)
            case .withdrawal:
                _ = try await KidsAdminApi.createKidWithdrawal(kidId: activeKidId, payload: payload)
            case .startingBalance:
                _ = try await KidsAdminApi.createKidStartingBalance(kidId: activeKidId, payload: payload)
            }
            showMoneySheet = false
            await loadMonthData()
            await loadHistory()
        } catch {
            moneyError = (error as? ApiError)?.message ?? "Unable to save entry."
        }
        moneySaving = false
    }

    private func saveChore() async {
        guard !choreForm.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Chore name is required."
            return
        }
        if choreForm.type == .bonus, (Double(choreForm.amount) ?? 0) <= 0 {
            errorMessage = "Bonus amount is required."
            return
        }
        status = .loading
        let payload = ParentChoreCreate(
            Label: choreForm.label.trimmingCharacters(in: .whitespacesAndNewlines),
            ChoreType: choreForm.type.rawValue,
            Amount: choreForm.type == .bonus ? Double(choreForm.amount) ?? 0 : 0,
            IsActive: choreForm.isActive,
            SortOrder: Int(choreForm.sortOrder) ?? 0,
            StartDate: KidsFormatters.dateKey(from: choreForm.startDate),
            EndDate: choreForm.useEndDate ? KidsFormatters.dateKey(from: choreForm.endDate) : nil
        )
        do {
            let saved: KidsChore
            if let editingChore {
                let update = ParentChoreUpdate(
                    Label: payload.Label,
                    ChoreType: payload.ChoreType,
                    Amount: payload.Amount,
                    IsActive: payload.IsActive,
                    SortOrder: payload.SortOrder,
                    StartDate: payload.StartDate,
                    EndDate: payload.EndDate
                )
                saved = try await KidsAdminApi.updateParentChore(choreId: editingChore.Id, payload: update)
            } else {
                saved = try await KidsAdminApi.createParentChore(payload: payload)
            }
            try await KidsAdminApi.setChoreAssignments(
                choreId: saved.Id,
                payload: ChoreAssignmentRequest(KidUserIds: Array(choreForm.kidIds))
            )
            showChoreForm = false
            await loadBaseData()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to save chore."
        }
        status = .ready
    }

    private func toggleChoreActive(_ chore: KidsChore) async {
        status = .loading
        let payload = ParentChoreUpdate(
            Label: nil,
            ChoreType: nil,
            Amount: nil,
            IsActive: !chore.IsActive,
            SortOrder: nil,
            StartDate: nil,
            EndDate: nil
        )
        do {
            _ = try await KidsAdminApi.updateParentChore(choreId: chore.Id, payload: payload)
            await loadBaseData()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to update chore."
        }
        status = .ready
    }

    private func deleteChore(_ chore: KidsChore) async {
        status = .loading
        do {
            try await KidsAdminApi.deleteParentChore(choreId: chore.Id)
            await loadBaseData()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to delete chore."
        }
        status = .ready
    }

    private func saveEntry() async {
        guard let activeKidId else { return }
        guard entryForm.choreId != 0 else {
            errorMessage = "Chore is required."
            return
        }
        status = .loading
        let payload = ParentChoreEntryCreate(
            ChoreId: entryForm.choreId,
            EntryDate: KidsFormatters.dateKey(from: entryForm.entryDate),
            Notes: entryForm.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : entryForm.notes,
            Amount: entryForm.type == .bonus ? Double(entryForm.amount) : nil
        )
        do {
            if let entryId = entryForm.entryId {
                let update = ParentChoreEntryUpdate(
                    EntryDate: payload.EntryDate,
                    Notes: payload.Notes,
                    Amount: payload.Amount,
                    Status: entryForm.status.isEmpty ? nil : entryForm.status
                )
                _ = try await KidsAdminApi.updateParentKidChoreEntry(
                    kidId: activeKidId,
                    entryId: entryId,
                    payload: update
                )
            } else {
                _ = try await KidsAdminApi.createParentKidChoreEntry(kidId: activeKidId, payload: payload)
            }
            showEntrySheet = false
            await refreshDayAndMonth(dateKey: payload.EntryDate)
            await loadHistory()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to save entry."
        }
        status = .ready
    }

    private func deleteEntry(_ entry: KidsAdminHistoryItem) async {
        guard let activeKidId else { return }
        status = .loading
        do {
            try await KidsAdminApi.deleteParentKidChoreEntry(kidId: activeKidId, entryId: entry.Id)
            await refreshDayAndMonth(dateKey: entry.EntryDate)
            await loadHistory()
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to delete entry."
        }
        status = .ready
    }

    private func loadDayDetail() async {
        guard let activeKidId, let selectedDay else { return }
        do {
            dayDetail = try await KidsAdminApi.fetchKidDayDetail(kidId: activeKidId, entryDate: selectedDay)
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to load day detail."
        }
    }

    private func loadEntryDetailIfNeeded() async {
        guard let activeKidId else { return }
        let dateKey = KidsFormatters.dateKey(from: entryForm.entryDate)
        do {
            entryDetail = try await KidsAdminApi.fetchKidDayDetail(kidId: activeKidId, entryDate: dateKey)
        } catch {
            entryDetail = nil
        }
    }

    private func refreshDayAndMonth(dateKey: String) async {
        if let activeKidId {
            dayDetail = try? await KidsAdminApi.fetchKidDayDetail(kidId: activeKidId, entryDate: dateKey)
        }
        await loadMonthData()
    }

    private func loadBaseData() async {
        status = .loading
        errorMessage = ""
        do {
            async let kidsList = KidsAdminApi.fetchLinkedKids()
            async let choreList = KidsAdminApi.fetchParentChores()
            let (kidsResult, choresResult) = try await (kidsList, choreList)
            kids = kidsResult
            chores = choresResult
            if activeKidId == nil {
                activeKidId = kids.first?.KidUserId
            }
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load kids admin data."
        }
    }

    private func loadKidData() async {
        guard activeKidId != nil else { return }
        await loadMonthData()
        await loadApprovals()
        await loadHistory()
    }

    private func loadMonthData() async {
        guard let activeKidId else { return }
        status = .loading
        errorMessage = ""
        do {
            async let summary = KidsAdminApi.fetchKidMonthSummary(kidId: activeKidId, month: monthParam)
            async let overview = KidsAdminApi.fetchKidMonthOverview(kidId: activeKidId, month: monthParam)
            async let ledger = KidsAdminApi.fetchKidLedger(kidId: activeKidId, limit: 500)
            let (summaryResponse, overviewResponse, ledgerResponse) = try await (summary, overview, ledger)
            monthSummary = summaryResponse
            monthOverview = overviewResponse
            ledgerEntries = ledgerResponse.Entries
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load month data."
        }
    }

    private func loadApprovals() async {
        guard let activeKidId else { return }
        do {
            let approvals = try await KidsAdminApi.fetchPendingApprovals(kidId: activeKidId, choreType: nil)
            pendingApprovals = approvals
            approvalsLoaded = true
        } catch {
            pendingApprovals = []
            approvalsLoaded = true
        }
    }

    private func loadHistory() async {
        guard let activeKidId else { return }
        do {
            async let choreEntries = KidsAdminApi.fetchKidChoreEntries(kidId: activeKidId, limit: 500, includeDeleted: false)
            async let ledger = KidsAdminApi.fetchKidLedger(kidId: activeKidId, limit: 500)
            let (entriesResult, ledgerResult) = try await (choreEntries, ledger)
            historyEntries = entriesResult
            ledgerEntries = ledgerResult.Entries
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to load history."
        }
    }

    private var activeKid: KidsLinkedKid? {
        kids.first { $0.KidUserId == activeKidId }
    }

    private var activeKidName: String {
        activeKid?.FirstName ?? activeKid?.Username ?? "Kid"
    }

    private var hasApprovals: Bool {
        approvalsLoaded && !pendingApprovals.isEmpty
    }

    private var availableTabs: [KidsAdminTab] {
        var tabs: [KidsAdminTab] = [.month, .history, .chores]
        if hasApprovals {
            tabs.append(.approvals)
        }
        return tabs
    }

    private var monthTitle: String {
        monthCursor.formatted(.dateTime.month(.abbreviated).year())
    }

    private var monthParam: String {
        let components = Calendar.current.dateComponents([.year, .month], from: monthCursor)
        let year = components.year ?? Calendar.current.component(.year, from: Date())
        let month = components.month ?? Calendar.current.component(.month, from: Date())
        return String(format: "%04d-%02d-01", year, month)
    }

    private var isCurrentMonth: Bool {
        let now = Date()
        let current = Calendar.current.dateComponents([.year, .month], from: now)
        let target = Calendar.current.dateComponents([.year, .month], from: monthCursor)
        return current.year == target.year && current.month == target.month
    }

    private var overviewByDate: [String: KidsMonthDayOut] {
        Dictionary(uniqueKeysWithValues: (monthOverview?.Days ?? []).map { ($0.Date, $0) })
    }

    private var ledgerTotalsByDate: [String: Double] {
        ledgerEntries.reduce(into: [:]) { result, entry in
            let amount = entry.Amount
            guard amount != 0 else { return }
            result[entry.EntryDate, default: 0] += amount
        }
    }

    private var dayMoneyTotalsByDate: [String: Double] {
        var totals: [String: Double] = [:]
        let dailySliceValue = monthSummary?.DailySlice ?? 0
        (monthOverview?.Days ?? []).forEach { day in
            let ledgerTotal = ledgerTotalsByDate[day.Date] ?? 0
            let isDone = day.DailyTotal == 0 || day.DailyDone >= day.DailyTotal
            let dailyContribution = isDone ? dailySliceValue : 0
            let bonusTotal = day.BonusApprovedTotal
            totals[day.Date] = ledgerTotal + dailyContribution + bonusTotal
        }
        ledgerTotalsByDate.keys.forEach { dateKey in
            if totals[dateKey] == nil {
                totals[dateKey] = ledgerTotalsByDate[dateKey] ?? 0
            }
        }
        return totals
    }

    private var calendarCells: [KidsAdminCalendarCell] {
        let year = Calendar.current.component(.year, from: monthCursor)
        let month = Calendar.current.component(.month, from: monthCursor)
        let start = Calendar.current.date(from: DateComponents(year: year, month: month, day: 1)) ?? monthCursor
        let daysInMonth = Calendar.current.range(of: .day, in: .month, for: start)?.count ?? 30
        let weekday = Calendar.current.component(.weekday, from: start)
        let startOffset = (weekday + 5) % 7
        var cells: [KidsAdminCalendarCell] = []
        for i in 0..<startOffset {
            cells.append(KidsAdminCalendarCell(key: "empty-\(i)"))
        }
        let todayKey = KidsFormatters.dateKey(from: Date())
        for day in 1...daysInMonth {
            let dateValue = Calendar.current.date(from: DateComponents(year: year, month: month, day: day)) ?? start
            let dateKey = KidsFormatters.dateKey(from: dateValue)
            let data = overviewByDate[dateKey]
            let dailyTotal = data?.DailyTotal ?? 0
            let dailyDone = data?.DailyDone ?? 0
            var statusText = ""
            var statusTone = CalendarStatus.none
            if dailyTotal > 0 {
                if dailyDone >= dailyTotal {
                    statusText = "Done"
                    statusTone = .done
                } else if dateKey == todayKey {
                    statusText = "WIP"
                    statusTone = .progress
                } else if dateKey < todayKey {
                    statusText = "Missed"
                    statusTone = .missed
                }
            } else if dateKey <= todayKey {
                statusText = "N/A"
                statusTone = dateKey == todayKey ? .progress : .missed
            }
            let moneyTotal = dayMoneyTotalsByDate[dateKey] ?? 0
            cells.append(
                KidsAdminCalendarCell(
                    key: dateKey,
                    isEmpty: false,
                    dateKey: dateKey,
                    dayNumber: day,
                    statusText: statusText,
                    statusTone: statusTone,
                    pendingCount: data?.PendingCount ?? 0,
                    moneyTotal: moneyTotal,
                    isToday: dateKey == todayKey
                )
            )
        }
        return cells
    }

    private var ledgerTotals: (moneyIn: Double, moneyOut: Double) {
        guard !ledgerEntries.isEmpty else { return (0, 0) }
        let monthStartKey = monthSummary?.MonthStart ?? KidsFormatters.dateKey(from: monthCursor)
        let monthEndKey = monthSummary?.MonthEnd ?? KidsFormatters.dateKey(from: monthCursor)
        let cutoffKey = isCurrentMonth ? KidsFormatters.dateKey(from: Date()) : monthEndKey
        guard let start = KidsFormatters.parseDate(monthStartKey),
              let end = KidsFormatters.parseDate(cutoffKey) else {
            return (0, 0)
        }
        let startTime = start.timeIntervalSince1970
        let endTime = end.timeIntervalSince1970
        return ledgerEntries.reduce(into: (moneyIn: 0.0, moneyOut: 0.0)) { result, entry in
            guard let date = KidsFormatters.parseDate(entry.EntryDate) else { return }
            let time = date.timeIntervalSince1970
            guard time >= startTime && time <= endTime else { return }
            if entry.Amount >= 0 {
                result.moneyIn += entry.Amount
            } else {
                result.moneyOut += abs(entry.Amount)
            }
        }
    }

    private var adminTotals: (current: Double, projected: Double) {
        let todayKey = KidsFormatters.dateKey(from: Date())
        let monthStartKey = monthSummary?.MonthStart ?? KidsFormatters.dateKey(from: monthCursor)
        let monthEndKey = monthSummary?.MonthEnd ?? KidsFormatters.dateKey(from: monthCursor)
        let dailySliceValue = monthSummary?.DailySlice ?? 0
        let monthlyAllowanceValue = monthSummary?.MonthlyAllowance ?? 0
        let cutoffKey = isCurrentMonth ? todayKey : monthEndKey
        let balanceAsOf = KidsTotalsBalance(entries: ledgerEntries)
        let balanceAtCutoff = balanceAsOf.balance(at: cutoffKey)
        let projectionAtCutoff = projectionAtCutoff(cutoffKey: cutoffKey, dailySlice: dailySliceValue)
        let currentTotal = balanceAtCutoff + projectionAtCutoff
        let daysInMonth = dayDiff(startKey: monthStartKey, endKey: monthEndKey) + 1
        let remainingDays = isCurrentMonth ? max(0, dayDiff(startKey: cutoffKey, endKey: monthEndKey)) : 0
        let allowanceRemainder = max(0, monthlyAllowanceValue - dailySliceValue * Double(daysInMonth))
        let projectedTotal = max(
            currentTotal + dailySliceValue * Double(remainingDays) + (remainingDays > 0 ? allowanceRemainder : 0),
            0
        )
        return (current: currentTotal, projected: projectedTotal)
    }

    private func projectionAtCutoff(cutoffKey: String, dailySlice: Double) -> Double {
        guard let days = monthOverview?.Days, !days.isEmpty else { return 0 }
        return days.reduce(0) { total, day in
            guard day.Date <= cutoffKey else { return total }
            let isDone = day.DailyTotal == 0 || day.DailyDone >= day.DailyTotal
            let slice = isDone ? dailySlice : 0
            return total + slice + day.BonusApprovedTotal
        }
    }

    private func dayDiff(startKey: String, endKey: String) -> Int {
        guard let start = KidsFormatters.parseDate(startKey),
              let end = KidsFormatters.parseDate(endKey) else {
            return 0
        }
        return Int(round(end.timeIntervalSince(start) / 86400))
    }

    private func dayLabel(from dateKey: String) -> String {
        guard let date = KidsFormatters.parseDate(dateKey) else { return dateKey }
        return date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
    }

    private func dateTimeLabel(from value: String) -> String {
        KidsFormatters.formatDateTime(value)
    }

    private func signedCurrency(_ value: Double) -> String {
        guard value != 0 else { return "" }
        let formatted = KidsFormatters.formatCurrency(abs(value))
        return value > 0 ? "+\(formatted)" : "-\(formatted)"
    }

    private func entryTypeLabel(_ value: String?) -> String {
        switch value {
        case "Daily":
            return "Daily jobs"
        case "Habit":
            return "Habits"
        case "Bonus":
            return "Bonus tasks"
        default:
            return value ?? "-"
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

    private func dayChoreSection(title: String, chores: [KidsChore], showAmounts: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            if chores.isEmpty {
                Text("No chores.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(chores, id: \.Id) { chore in
                    let entry = entryByChoreId[chore.Id]
                    Button {
                        Task { await toggleDayChore(chore, entry: entry) }
                    } label: {
                        HStack {
                            Image(systemName: entry?.Status == "Approved" ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(entry?.Status == "Approved" ? Color.accentColor : .secondary)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(chore.Label)
                                    .font(.subheadline.weight(.semibold))
                                if let status = entry?.Status, status != "Approved" {
                                    Text(status)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if showAmounts, chore.ChoreType == "Bonus" {
                                Text(KidsFormatters.formatCurrency(chore.Amount))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(10)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Color(.secondarySystemBackground))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func toggleDayChore(_ chore: KidsChore, entry: KidsChoreEntry?) async {
        guard let activeKidId, let selectedDay else { return }
        status = .loading
        do {
            if let entry {
                if entry.Status == "Approved" {
                    try await KidsAdminApi.deleteParentKidChoreEntry(kidId: activeKidId, entryId: entry.Id)
                } else {
                    let update = ParentChoreEntryUpdate(
                        EntryDate: nil,
                        Notes: nil,
                        Amount: nil,
                        Status: "Approved"
                    )
                    _ = try await KidsAdminApi.updateParentKidChoreEntry(
                        kidId: activeKidId,
                        entryId: entry.Id,
                        payload: update
                    )
                }
            } else {
                let payload = ParentChoreEntryCreate(
                    ChoreId: chore.Id,
                    EntryDate: selectedDay,
                    Notes: nil,
                    Amount: nil
                )
                _ = try await KidsAdminApi.createParentKidChoreEntry(kidId: activeKidId, payload: payload)
            }
            await refreshDayAndMonth(dateKey: selectedDay)
        } catch {
            errorMessage = (error as? ApiError)?.message ?? "Unable to update chore."
        }
        status = .ready
    }

    private func dayLedgerEntries(for dateKey: String) -> [KidsLedgerEntry] {
        ledgerEntries.filter { $0.EntryDate == dateKey }.sorted { $0.CreatedAt > $1.CreatedAt }
    }

    private func moneySummary(for entries: [KidsLedgerEntry]) -> (moneyIn: Double, moneyOut: Double) {
        entries.reduce(into: (moneyIn: 0.0, moneyOut: 0.0)) { result, entry in
            if entry.Amount >= 0 {
                result.moneyIn += entry.Amount
            } else {
                result.moneyOut += abs(entry.Amount)
            }
        }
    }

    private func moneySummaryCard(title: String, value: String, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tone)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func dayMoneySection(_ entries: [KidsLedgerEntry]) -> some View {
        let summary = moneySummary(for: entries)
        return VStack(alignment: .leading, spacing: 8) {
            Text("Money")
                .font(.headline)

            HStack(spacing: 12) {
                moneySummaryCard(title: "Money in", value: KidsFormatters.formatCurrency(summary.moneyIn), tone: .green)
                moneySummaryCard(title: "Money out", value: KidsFormatters.formatCurrency(summary.moneyOut), tone: .red)
            }

            ForEach(entries, id: \.Id) { entry in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.Narrative ?? "Money")
                            .font(.subheadline.weight(.semibold))
                        Text(dateTimeLabel(from: entry.CreatedAt))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(KidsFormatters.formatCurrency(entry.Amount))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(entry.Amount < 0 ? .red : .green)
                }
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color(.secondarySystemBackground))
                )
            }
        }
    }

    private var bottomContentPadding: CGFloat {
        horizontalSizeClass == .compact ? 120 : 24
    }

    private var entryByChoreId: [Int: KidsChoreEntry] {
        Dictionary(uniqueKeysWithValues: (dayDetail?.Entries ?? []).map { ($0.ChoreId, $0) })
    }

    private var availableChoresForEntry: [KidsChore] {
        let dateKey = KidsFormatters.dateKey(from: entryForm.entryDate)
        if let detail = entryDetail, detail.Date == dateKey {
            switch entryForm.type {
            case .daily:
                return detail.DailyJobs
            case .habit:
                return detail.Habits
            case .bonus:
                return detail.BonusTasks
            }
        }
        let active = choresForKid.filter { $0.IsActive }
        switch entryForm.type {
        case .daily:
            return active.filter { $0.ChoreType == "Daily" }
        case .habit:
            return active.filter { $0.ChoreType == "Habit" }
        case .bonus:
            return active.filter { $0.ChoreType == "Bonus" }
        }
    }

    private var choresForKid: [KidsChore] {
        guard let activeKidId else { return [] }
        return chores.filter { $0.AssignedKidIds?.contains(activeKidId) == true }
    }

    private var choreCounts: (daily: Int, habit: Int, bonus: Int, disabled: Int) {
        chores.reduce(into: (0, 0, 0, 0)) { result, chore in
            if chore.IsActive == false { result.3 += 1 }
            switch chore.ChoreType {
            case "Daily":
                result.0 += 1
            case "Habit":
                result.1 += 1
            case "Bonus":
                result.2 += 1
            default:
                break
            }
        }
    }

    private var assignedToActiveCount: Int {
        guard let activeKidId else { return 0 }
        return chores.filter { $0.AssignedKidIds?.contains(activeKidId) == true }.count
    }

    private var visibleChoreGroups: [KidsAdminChoreGroup] {
        let kidFilter = choreKidFilter
        let filtered = chores.filter { chore in
            if !choreSearch.isEmpty && !chore.Label.localizedCaseInsensitiveContains(choreSearch) {
                return false
            }
            if let kidFilter {
                return chore.AssignedKidIds?.contains(kidFilter) == true
            }
            return true
        }

        let daily = filtered.filter { $0.ChoreType == "Daily" && $0.IsActive }
        let habit = filtered.filter { $0.ChoreType == "Habit" && $0.IsActive }
        let bonus = filtered.filter { $0.ChoreType == "Bonus" && $0.IsActive }
        let disabled = filtered.filter { !$0.IsActive }

        switch choreFilter {
        case .daily:
            return [KidsAdminChoreGroup(title: "Daily jobs", chores: daily)]
        case .habit:
            return [KidsAdminChoreGroup(title: "Habits", chores: habit)]
        case .bonus:
            return [KidsAdminChoreGroup(title: "Bonus tasks", chores: bonus)]
        case .disabled:
            return [KidsAdminChoreGroup(title: "Disabled chores", chores: disabled)]
        case .all:
            return [
                KidsAdminChoreGroup(title: "Daily jobs", chores: daily),
                KidsAdminChoreGroup(title: "Habits", chores: habit),
                KidsAdminChoreGroup(title: "Bonus tasks", chores: bonus),
                KidsAdminChoreGroup(title: "Disabled chores", chores: disabled)
            ]
        }
    }

    private func choreRow(_ chore: KidsChore) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(chore.Label)
                    .font(.subheadline.weight(.semibold))
                Text(entryTypeLabel(chore.ChoreType))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(assigneesLabel(for: chore))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if chore.ChoreType == "Bonus" {
                Text(KidsFormatters.formatCurrency(chore.Amount))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Toggle("", isOn: Binding(
                get: { chore.IsActive },
                set: { _ in
                    Task { await toggleChoreActive(chore) }
                }
            ))
            .labelsHidden()
            Button {
                openChoreForm(chore: chore)
            } label: {
                Image(systemName: "pencil")
            }
            .buttonStyle(.bordered)
            Button {
                Task { await deleteChore(chore) }
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.bordered)
        }
    }

    private func assigneesLabel(for chore: KidsChore) -> String {
        let ids = chore.AssignedKidIds ?? []
        if ids.isEmpty { return "Unassigned" }
        let names = kids
            .filter { ids.contains($0.KidUserId) }
            .map { $0.FirstName?.isEmpty == false ? $0.FirstName! : $0.Username }
        return names.isEmpty ? "Unassigned" : names.joined(separator: ", ")
    }

    private var approvalsByDate: [String: [KidsApprovalOut]] {
        Dictionary(grouping: filteredApprovals, by: { $0.EntryDate })
    }

    private var approvalsDates: [String] {
        approvalsByDate.keys.sorted(by: >)
    }

    private var filteredApprovals: [KidsApprovalOut] {
        pendingApprovals.filter { entry in
            if approvalFilterType != .all, entry.ChoreType != approvalFilterType.rawValue {
                return false
            }
            if !approvalRangeStart.isEmpty, entry.EntryDate < approvalRangeStart {
                return false
            }
            if !approvalRangeEnd.isEmpty, entry.EntryDate > approvalRangeEnd {
                return false
            }
            return true
        }
    }

    private var historyItems: [KidsAdminHistoryItem] {
        let monthEntries = historyEntries.filter { entry in
            isEntryInMonth(entry.EntryDate)
        }
        let ledgerItems = ledgerEntries.filter { entry in
            isEntryInMonth(entry.EntryDate)
        }
        let choreItems = monthEntries.map { KidsAdminHistoryItem(entry: $0) }
        let moneyItems = ledgerItems.map { KidsAdminHistoryItem(ledger: $0) }
        return (choreItems + moneyItems).filter { item in
            switch historyFilter {
            case .all:
                return true
            case .money:
                return item.isLedger
            case .daily:
                return item.ChoreType == "Daily"
            case .habit:
                return item.ChoreType == "Habit"
            case .bonus:
                return item.ChoreType == "Bonus"
            case .pending:
                return item.Status == "Pending"
            case .approved:
                return item.Status == "Approved"
            case .rejected:
                return item.Status == "Rejected"
            }
        }.sorted { lhs, rhs in
            if lhs.EntryDate != rhs.EntryDate {
                return lhs.EntryDate > rhs.EntryDate
            }
            let order: [String: Int] = ["Daily": 0, "Habit": 1, "Bonus": 2, "Money": 3]
            let lhsType = lhs.isLedger ? "Money" : (lhs.ChoreType ?? "")
            let rhsType = rhs.isLedger ? "Money" : (rhs.ChoreType ?? "")
            if order[lhsType, default: 9] != order[rhsType, default: 9] {
                return order[lhsType, default: 9] < order[rhsType, default: 9]
            }
            return lhs.CreatedAt > rhs.CreatedAt
        }
    }

    private var historyByDate: [String: [KidsAdminHistoryItem]] {
        Dictionary(grouping: historyItems, by: { $0.EntryDate })
    }

    private var historyDates: [String] {
        historyByDate.keys.sorted(by: >)
    }

    private func isEntryInMonth(_ dateKey: String) -> Bool {
        guard let date = KidsFormatters.parseDate(dateKey) else { return false }
        let start = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: monthCursor)) ?? monthCursor
        let end = Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? start
        return date >= start && date <= end
    }
}

private enum KidsAdminTab: String, CaseIterable {
    case month
    case approvals
    case history
    case chores

    var label: String {
        switch self {
        case .month:
            return "Month"
        case .approvals:
            return "Approvals"
        case .history:
            return "History"
        case .chores:
            return "Chores"
        }
    }
}

private enum KidsAdminCalendarDisplayMode: String, CaseIterable {
    case chores
    case money

    var label: String {
        switch self {
        case .chores:
            return "Chores"
        case .money:
            return "Pocket money"
        }
    }
}

private enum ApprovalFilter: String, CaseIterable {
    case all
    case daily = "Daily"
    case habit = "Habit"
    case bonus = "Bonus"

    var label: String {
        switch self {
        case .all:
            return "All types"
        case .daily:
            return "Daily jobs"
        case .habit:
            return "Habits"
        case .bonus:
            return "Bonus tasks"
        }
    }
}

private enum HistoryFilter: String, CaseIterable {
    case all
    case daily = "Daily"
    case habit = "Habit"
    case bonus = "Bonus"
    case money = "Money"
    case pending = "Pending"
    case approved = "Approved"
    case rejected = "Rejected"

    var label: String {
        switch self {
        case .all:
            return "All"
        case .daily:
            return "Daily jobs"
        case .habit:
            return "Habits"
        case .bonus:
            return "Bonus tasks"
        case .money:
            return "Money"
        case .pending:
            return "Pending"
        case .approved:
            return "Approved"
        case .rejected:
            return "Rejected"
        }
    }
}

private enum ChoreFilter: String, CaseIterable {
    case all
    case daily
    case habit
    case bonus
    case disabled

    var label: String {
        switch self {
        case .all:
            return "All"
        case .daily:
            return "Daily"
        case .habit:
            return "Habit"
        case .bonus:
            return "Bonus"
        case .disabled:
            return "Disabled"
        }
    }
}

private enum ChoreType: String, CaseIterable {
    case daily = "Daily"
    case habit = "Habit"
    case bonus = "Bonus"

    var label: String {
        switch self {
        case .daily:
            return "Daily"
        case .habit:
            return "Habit"
        case .bonus:
            return "Bonus"
        }
    }
}

private enum MoneyEntryType: String, CaseIterable {
    case deposit = "Deposit"
    case withdrawal = "Withdrawal"
    case startingBalance = "StartingBalance"

    var label: String {
        switch self {
        case .deposit:
            return "Deposit"
        case .withdrawal:
            return "Withdrawal"
        case .startingBalance:
            return "Balance adjustment"
        }
    }
}

private struct MoneyForm {
    var entryType: MoneyEntryType = .startingBalance
    var entryDate: Date = Date()
    var amount = ""
    var narrative = "Balance adjustment"
    var notes = ""

    mutating func updateNarrativeForType() {
        if narrative.isEmpty || narrative == "Balance adjustment" || narrative == "Deposit" || narrative == "Withdrawal" {
            narrative = entryType.label
        }
    }
}

private struct ChoreForm {
    var label = ""
    var type: ChoreType = .daily
    var amount = ""
    var sortOrder = "0"
    var isActive = true
    var kidIds: Set<Int> = []
    var startDate: Date = Date()
    var endDate: Date = Date()
    var useEndDate = false

    init() {}

    init(from chore: KidsChore) {
        label = chore.Label
        type = ChoreType(rawValue: chore.ChoreType) ?? .daily
        amount = chore.Amount > 0 ? String(chore.Amount) : ""
        sortOrder = String(chore.SortOrder)
        isActive = chore.IsActive
        kidIds = Set(chore.AssignedKidIds ?? [])
        startDate = KidsFormatters.parseDate(chore.StartDate) ?? Date()
        if let endDateValue = KidsFormatters.parseDate(chore.EndDate) {
            endDate = endDateValue
            useEndDate = true
        } else {
            endDate = Date()
            useEndDate = false
        }
    }
}

private struct EntryForm {
    var entryId: Int?
    var entryDate: Date = Date()
    var type: ChoreType = .daily
    var choreId: Int = 0
    var amount = ""
    var notes = ""
    var status = ""

    init() {}

    init(date: Date) {
        entryDate = date
    }

    init(from entry: KidsAdminHistoryItem, date: Date) {
        entryId = entry.Id
        entryDate = date
        type = ChoreType(rawValue: entry.ChoreType ?? "Daily") ?? .daily
        choreId = entry.ChoreId ?? 0
        amount = entry.Amount > 0 ? String(entry.Amount) : ""
        notes = entry.Notes ?? ""
        status = entry.Status ?? ""
    }
}

private enum CalendarStatus {
    case none
    case done
    case missed
    case progress
}

private struct KidsAdminCalendarCell: Identifiable {
    let id = UUID()
    let key: String
    let isEmpty: Bool
    let dateKey: String
    let dayNumber: Int
    let statusText: String
    let statusTone: CalendarStatus
    let pendingCount: Int
    let moneyTotal: Double
    let isToday: Bool

    init(key: String) {
        self.key = key
        self.isEmpty = true
        self.dateKey = ""
        self.dayNumber = 0
        self.statusText = ""
        self.statusTone = .none
        self.pendingCount = 0
        self.moneyTotal = 0
        self.isToday = false
    }

    init(
        key: String,
        isEmpty: Bool,
        dateKey: String,
        dayNumber: Int,
        statusText: String,
        statusTone: CalendarStatus,
        pendingCount: Int,
        moneyTotal: Double,
        isToday: Bool
    ) {
        self.key = key
        self.isEmpty = isEmpty
        self.dateKey = dateKey
        self.dayNumber = dayNumber
        self.statusText = statusText
        self.statusTone = statusTone
        self.pendingCount = pendingCount
        self.moneyTotal = moneyTotal
        self.isToday = isToday
    }

    var statusColor: Color {
        switch statusTone {
        case .done:
            return .green
        case .missed:
            return .red
        case .progress:
            return .orange
        case .none:
            return .secondary
        }
    }

    var moneyLabel: String {
        guard moneyTotal != 0 else { return "" }
        let formatted = KidsFormatters.formatCurrency(abs(moneyTotal))
        return moneyTotal > 0 ? "+\(formatted)" : "-\(formatted)"
    }
}

private struct KidsAdminHistoryItem {
    let Kind: String
    let Key: String
    let Id: Int
    let EntryDate: String
    let CreatedAt: String
    let Title: String
    let ChoreType: String?
    let Status: String?
    let ChoreId: Int?
    let Notes: String?
    let Amount: Double
    let EntryType: String?

    var isLedger: Bool { Kind == "ledger" }
    var amountLabel: String {
        guard Amount != 0 else { return "" }
        return KidsFormatters.formatCurrency(Amount)
    }

    init(entry: KidsChoreEntry) {
        Kind = "chore"
        Key = "chore-\(entry.Id)"
        Id = entry.Id
        EntryDate = entry.EntryDate
        CreatedAt = entry.CreatedAt
        Title = entry.ChoreLabel
        ChoreType = entry.ChoreType
        Status = entry.Status
        ChoreId = entry.ChoreId
        Notes = entry.Notes
        Amount = entry.Amount
        EntryType = nil
    }

    init(ledger: KidsLedgerEntry) {
        Kind = "ledger"
        Key = "ledger-\(ledger.Id)"
        Id = ledger.Id
        EntryDate = ledger.EntryDate
        CreatedAt = ledger.CreatedAt
        Title = ledger.Narrative?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? ledger.Narrative!
            : "Money"
        ChoreType = nil
        Status = nil
        ChoreId = nil
        Notes = ledger.Notes
        Amount = ledger.Amount
        EntryType = ledger.EntryType
    }
}

private struct KidsAdminChoreGroup {
    let title: String
    let chores: [KidsChore]
}

private struct KidsTotalsBalance {
    let entries: [KidsLedgerEntry]

    func balance(at dateKey: String) -> Double {
        guard let cutoff = KidsFormatters.parseDate(dateKey)?.timeIntervalSince1970 else { return 0 }
        return entries.reduce(0) { total, entry in
            guard let time = KidsFormatters.parseDate(entry.EntryDate)?.timeIntervalSince1970 else { return total }
            guard time <= cutoff else { return total }
            return total + entry.Amount
        }
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
