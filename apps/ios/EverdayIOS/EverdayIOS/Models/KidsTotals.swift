import Foundation

struct KidsTotalsResult {
    let CurrentTotal: Double
    let ProjectedTotal: Double
    let Series: [KidsTotalsSeriesPoint]
}

struct KidsTotalsSeriesPoint: Identifiable {
    let id = UUID()
    let DateKey: String
    let ActualAmount: Double?
    let ProjectedAmount: Double?
}

enum KidsTotals {
    static func build(
        todayKey: String,
        monthStartKey: String,
        monthEndKey: String,
        monthlyAllowance: Double,
        dailySlice: Double,
        projectionPoints: [KidsProjectionPoint] = [],
        ledgerEntries: [KidsLedgerEntry] = [],
        isCurrentMonth: Bool = true
    ) -> KidsTotalsResult {
        let cutoffKey = isCurrentMonth ? todayKey : monthEndKey
        let balanceAsOf = buildBalanceAsOf(entries: ledgerEntries)
        let balanceAtCutoff = balanceAsOf(cutoffKey)
        let projectionAtCutoff = projectionAtCutoff(
            projectionPoints: projectionPoints,
            cutoffKey: cutoffKey,
            dailySlice: dailySlice
        )
        let currentTotal = balanceAtCutoff + projectionAtCutoff
        let daysInMonth = dayDiff(startKey: monthStartKey, endKey: monthEndKey) + 1
        let remainingDays = isCurrentMonth ? max(0, dayDiff(startKey: cutoffKey, endKey: monthEndKey)) : 0
        let allowanceRemainder = max(0, monthlyAllowance - dailySlice * Double(daysInMonth))
        let projectedTotal = max(
            currentTotal + dailySlice * Double(remainingDays) + (remainingDays > 0 ? allowanceRemainder : 0),
            0
        )

        var series: [KidsTotalsSeriesPoint] = []
        if !projectionPoints.isEmpty {
            let projectionByDate = Dictionary(uniqueKeysWithValues: projectionPoints.map { ($0.Date, $0.Amount) })
            let cutoffTime = KidsFormatters.parseDate(cutoffKey)?.timeIntervalSince1970
            let finalDate = projectionPoints.last?.Date ?? monthEndKey
            let totalDaysAhead = cutoffTime != nil
                ? max(0, dayDiff(startKey: cutoffKey, endKey: finalDate))
                : 0
            let remainderPerDay = totalDaysAhead > 0 ? allowanceRemainder / Double(totalDaysAhead) : 0

            series = projectionPoints.map { point in
                let pointDate = point.Date
                let pointTime = KidsFormatters.parseDate(pointDate)?.timeIntervalSince1970
                let isOnOrBeforeCutoff = (cutoffTime != nil && pointTime != nil) ? pointTime! <= cutoffTime! : true
                let isOnOrAfterCutoff = (cutoffTime != nil && pointTime != nil) ? pointTime! >= cutoffTime! : false
                let daysAhead = (cutoffTime != nil && pointTime != nil)
                    ? Int(round((pointTime! - cutoffTime!) / 86400))
                    : 0
                let pointProjection = projectionByDate[pointDate] ?? point.Amount
                let balanceAtPoint = balanceAsOf(pointDate)
                let actualAmount = isOnOrBeforeCutoff ? balanceAtPoint + pointProjection : nil
                let projectedAmount = isOnOrAfterCutoff
                    ? currentTotal + dailySlice * Double(daysAhead) + remainderPerDay * Double(daysAhead)
                    : nil
                return KidsTotalsSeriesPoint(
                    DateKey: pointDate,
                    ActualAmount: actualAmount,
                    ProjectedAmount: projectedAmount
                )
            }
        }

        return KidsTotalsResult(
            CurrentTotal: currentTotal,
            ProjectedTotal: projectedTotal,
            Series: series
        )
    }

    private static func dayDiff(startKey: String, endKey: String) -> Int {
        guard let start = KidsFormatters.parseDate(startKey),
              let end = KidsFormatters.parseDate(endKey) else {
            return 0
        }
        return Int(round(end.timeIntervalSince(start) / 86400))
    }

    private static func buildBalanceAsOf(entries: [KidsLedgerEntry]) -> (String) -> Double {
        if entries.isEmpty {
            return { _ in 0 }
        }
        return { dateKey in
            guard let cutoff = KidsFormatters.parseDate(dateKey)?.timeIntervalSince1970 else { return 0 }
            return entries.reduce(0) { total, entry in
                guard let time = KidsFormatters.parseDate(entry.EntryDate)?.timeIntervalSince1970 else {
                    return total
                }
                guard time <= cutoff else { return total }
                return total + entry.Amount
            }
        }
    }

    private static func projectionAtCutoff(
        projectionPoints: [KidsProjectionPoint],
        cutoffKey: String,
        dailySlice: Double
    ) -> Double {
        if !projectionPoints.isEmpty {
            let projectionByDate = Dictionary(uniqueKeysWithValues: projectionPoints.map { ($0.Date, $0.Amount) })
            if let value = projectionByDate[cutoffKey] {
                return value
            }
            return projectionPoints.last?.Amount ?? 0
        }
        return 0
    }
}
