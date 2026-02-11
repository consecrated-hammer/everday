import Foundation

struct BudgetPeriodTotals {
    var PerDay: Double
    var PerWeek: Double
    var PerFortnight: Double
    var PerMonth: Double
    var PerYear: Double
}

struct BudgetTotals {
    var Income: BudgetPeriodTotals
    var Expenses: BudgetPeriodTotals
    var Difference: BudgetPeriodTotals
}

struct BudgetAllocationRow: Identifiable {
    let Id: Int?
    let Name: String
    let Percent: Double
    let PerDay: Double
    let PerWeek: Double
    let PerFortnight: Double
    let PerMonth: Double
    let PerYear: Double
    let RoundedFortnight: Double
    let PercentTo100: Double

    var id: String {
        if let Id {
            return "row-\(Id)"
        }
        return "row-\(Name)"
    }
}

struct BudgetAllocationSummary {
    let TargetExpenseAllocation: Double
    let TotalAllocated: Double
    let Leftover: Double
    let Overage: Double
    let Rows: [BudgetAllocationRow]
    let TotalRow: BudgetAllocationRow
    let TotalRounded: Double
    let TotalRoundedPercent: Double
}

enum BudgetFormatters {
    static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        return formatter
    }()

    static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static func parseDate(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return apiDateFormatter.date(from: value)
    }

    static func formatDate(_ date: Date) -> String {
        apiDateFormatter.string(from: date)
    }

    static func displayDate(_ value: String?) -> String {
        guard let date = parseDate(value) else { return "-" }
        return displayDateFormatter.string(from: date)
    }

    static func formatCurrency(_ value: Double?) -> String {
        guard let value else { return "-" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "en_AU")
        let showDecimals = UserDefaults.standard.object(forKey: "everday.appearance.showDecimals") as? Bool ?? true
        formatter.minimumFractionDigits = showDecimals ? 2 : 0
        formatter.maximumFractionDigits = showDecimals ? 2 : 0
        let fallback = showDecimals ? String(format: "$%.2f", value) : String(format: "$%.0f", value)
        return formatter.string(from: NSNumber(value: value)) ?? fallback
    }

    static func parseAmount(_ value: String) -> Double? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        let normalized = trimmed.replacingOccurrences(of: ",", with: "")
        return Double(normalized)
    }

    static func buildTotals(incomeStreams: [IncomeStream], expenses: [Expense]) -> BudgetTotals {
        let income = incomeStreams.reduce(BudgetPeriodTotals(PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0)) {
            var next = $0
            next.PerDay += $1.NetPerDay ?? 0
            next.PerWeek += $1.NetPerWeek ?? 0
            next.PerFortnight += $1.NetPerFortnight ?? 0
            next.PerMonth += $1.NetPerMonth ?? 0
            next.PerYear += $1.NetPerYear ?? 0
            return next
        }
        let expense = expenses.reduce(BudgetPeriodTotals(PerDay: 0, PerWeek: 0, PerFortnight: 0, PerMonth: 0, PerYear: 0)) {
            guard $1.Enabled else { return $0 }
            var next = $0
            next.PerDay += $1.PerDay
            next.PerWeek += $1.PerWeek
            next.PerFortnight += $1.PerFortnight
            next.PerMonth += $1.PerMonth
            next.PerYear += $1.PerYear
            return next
        }
        let difference = BudgetPeriodTotals(
            PerDay: income.PerDay - expense.PerDay,
            PerWeek: income.PerWeek - expense.PerWeek,
            PerFortnight: income.PerFortnight - expense.PerFortnight,
            PerMonth: income.PerMonth - expense.PerMonth,
            PerYear: income.PerYear - expense.PerYear
        )
        return BudgetTotals(Income: income, Expenses: expense, Difference: difference)
    }

    static func buildAllocationSummary(totals: BudgetTotals, accounts: [AllocationAccount]) -> BudgetAllocationSummary {
        let incomePerFortnight = totals.Income.PerFortnight
        let targetExpenseAllocation = incomePerFortnight > 0 ? totals.Expenses.PerFortnight / incomePerFortnight : 0
        let activeAccounts = accounts.filter { $0.Enabled }
        let manualTotal = activeAccounts.reduce(0) { $0 + ($1.Percent / 100) }
        let totalAllocated = normalizeTotal(targetExpenseAllocation + manualTotal)
        let leftover = clampNearZero(max(0, 1 - totalAllocated))
        let overage = clampNearZero(max(0, totalAllocated - 1))

        func buildRow(name: String, percent: Double, id: Int? = nil) -> BudgetAllocationRow {
            let perDay = totals.Income.PerDay * percent
            let perWeek = totals.Income.PerWeek * percent
            let perFortnight = totals.Income.PerFortnight * percent
            let perMonth = totals.Income.PerMonth * percent
            let perYear = totals.Income.PerYear * percent
            let roundedFortnight = Double(Int(perFortnight.rounded()))
            let percentTo100 = incomePerFortnight > 0 ? roundedFortnight / incomePerFortnight : 0
            return BudgetAllocationRow(
                Id: id,
                Name: name,
                Percent: percent,
                PerDay: perDay,
                PerWeek: perWeek,
                PerFortnight: perFortnight,
                PerMonth: perMonth,
                PerYear: perYear,
                RoundedFortnight: roundedFortnight,
                PercentTo100: percentTo100
            )
        }

        var rows: [BudgetAllocationRow] = []
        rows.append(buildRow(name: "Leftover", percent: leftover))
        rows.append(buildRow(name: "Daily expenses", percent: targetExpenseAllocation))
        rows.append(contentsOf: activeAccounts.map { buildRow(name: $0.Name, percent: $0.Percent / 100, id: $0.Id) })

        let totalRounded = rows
            .filter { $0.Name != "Leftover" }
            .reduce(0) { $0 + $1.RoundedFortnight }
        let totalRoundedPercent = incomePerFortnight > 0 ? totalRounded / incomePerFortnight : 0

        let totalRow = buildRow(name: "Total allocated", percent: totalAllocated)

        return BudgetAllocationSummary(
            TargetExpenseAllocation: targetExpenseAllocation,
            TotalAllocated: totalAllocated,
            Leftover: leftover,
            Overage: overage,
            Rows: rows,
            TotalRow: totalRow,
            TotalRounded: totalRounded,
            TotalRoundedPercent: totalRoundedPercent
        )
    }

    static func formatPercent(_ value: Double) -> String {
        String(format: "%.2f%%", value * 100)
    }

    private static let ratioEpsilon = 0.00005

    private static func normalizeTotal(_ value: Double) -> Double {
        let normalized = (value * 1_000_000).rounded() / 1_000_000
        if abs(normalized - 1) <= ratioEpsilon {
            return 1
        }
        return normalized
    }

    private static func clampNearZero(_ value: Double) -> Double {
        if abs(value) <= ratioEpsilon {
            return 0
        }
        return value
    }
}
