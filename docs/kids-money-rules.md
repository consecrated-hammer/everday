# Kids Money Rules

This document defines the product rules for kids money so the app does not mix
audit/accounting data with the number a kid can actually spend.

## Canonical terms

- `Ledger total`
  The raw sum of all ledger entries. This is history and audit data.
- `Available balance`
  The amount the kid can spend right now. This is the main user-facing number.
- `Month earned`
  The amount earned from chores in the current month.
- `Parent adjustment`
  A manual parent override such as a deposit, withdrawal, or balance adjustment.

## Core rules

1. Kids never owe money.
   `Available balance` must never be less than `0`.

2. A new month starts from a floored opening balance.
   On day 1, the starting point is:
   `max(0, balance carried into the month)`.

3. Prior negative history does not reduce the new month below zero.
   A negative prior ledger total is kept for audit purposes only. It does not
   create “kid debt”.

4. Current-month activity still counts.
   Deposits, withdrawals, and balance adjustments in the current month change
   the current month’s available balance.

5. Chore earnings build through the month.
   If a kid completes every required chore day and has no withdrawals or manual
   adjustments, the maximum available from chores for the month is the configured
   monthly allowance, such as `$40`.

6. Withdrawals stop at the limit.
   If a requested withdrawal would push `Available balance` below `0`, the
   request must be rejected.

## Product formula

For the current month:

```text
OpeningBalance = max(0, balance before month start)
AvailableBalance = max(
  0,
  OpeningBalance + CurrentMonthLedgerDelta + CurrentMonthEarned
)
```

Where:

- `CurrentMonthLedgerDelta` includes current-month deposits, withdrawals, and
  balance adjustments.
- `CurrentMonthEarned` is the current month’s chore-earned amount/projection.

## Examples

1. Previous month ended at `-20`, new month starts, no new activity yet.
   Available balance = `0`.

2. Previous month ended at `-20`, kid earns `12` this month, no withdrawals.
   Available balance = `12`.

3. Previous month ended at `15`, kid earns `12` this month, parent withdraws `5`.
   Available balance = `22`.

4. Available balance is `12`, parent tries to withdraw `15`.
   Reject the withdrawal.

5. Kid does every chore day for the whole month, monthly allowance is `40`, and
   there are no withdrawals or manual adjustments.
   End-of-month available from chores = `40`.

## Implementation note

Do not use `Ledger total` as the main UI balance. Use `Available balance`.
