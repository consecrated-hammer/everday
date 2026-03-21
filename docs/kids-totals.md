# Kids totals calculation

See also: `docs/kids-money-rules.md` for the product rules this math must follow.

This document defines how the Kids Portal computes current and projected totals.
The frontend uses backend-provided summary/overview data and ledger entries to keep
the calculation consistent across `/kids` and `/kids-admin`.

## Inputs

- `MonthlyAllowance`: monthly allowance for the kid.
- `DailySlice`: allowance per day (rounded by backend).
- `MonthStart`, `MonthEnd`: inclusive month range.
- `ProjectionPoints`: backend projection list with cumulative earned amount per day.
- `OverviewDays`: fallback list of days with `DailyDone`, `DailyTotal`, `BonusApprovedTotal`.
- `LedgerEntries`: balance adjustments (deposit, withdrawal, starting balance, pocket money).
- `Today`: date used as the cutoff for the current month.

## Definitions

- `LedgerBalanceAt(date)`: sum of all ledger entry amounts up to and including `date`.
- `OpeningBalance`: `max(0, LedgerBalanceAt(MonthStart - 1 day))`.
- `MonthLedgerDeltaAt(date)`: `LedgerBalanceAt(date) - LedgerBalanceAt(MonthStart - 1 day)`.
- `ProjectionAt(date)`:
  - If projection points exist, use the projection amount for `date`
    (or the last point when `date` is beyond the list).
  - Otherwise, sum `DailySlice` for protected days plus approved bonus amounts
    for all days up to `date`.
- `AllowanceRemainder`: `max(0, MonthlyAllowance - DailySlice * DaysInMonth)`.

## Current total

For the current month, the cutoff is `Today`. For past months, the cutoff is
`MonthEnd`.

```
CurrentTotal =
  OpeningBalance +
  MonthLedgerDeltaAt(cutoff) +
  ProjectionAt(cutoff)
```

## Projected total

```
RemainingDays = max(0, DaysBetween(cutoff, MonthEnd))
ProjectedTotal =
  CurrentTotal +
  (DailySlice * RemainingDays) +
  (RemainingDays > 0 ? AllowanceRemainder : 0)
```

## Chart series (kids graph)

For each date in the projection:

- `ActualAmount` = `OpeningBalance + MonthLedgerDeltaAt(date) + ProjectionAt(date)`
  for dates on or before cutoff, otherwise `null`.
- `ProjectedAmount` = `CurrentTotal + DailySlice * daysAhead + remainderPerDay * daysAhead`
  for dates on or after cutoff, otherwise `null`.
- `remainderPerDay` distributes `AllowanceRemainder` evenly across remaining days.

## Notes

- Prior months cannot drag a new month below zero. Each month starts from
  `OpeningBalance`, which floors the pre-month balance at zero.
- Current-month deposits, withdrawals, and balance adjustments still affect the
  current month via `MonthLedgerDeltaAt(date)`.
- If you also post monthly allowance into the ledger (pocket money credits), the
  totals will include both the ledger credit and the chore-based projection.
  Use one source of allowance to avoid double counting.
