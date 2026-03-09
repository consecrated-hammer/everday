# Aubrey (KidUserId=3) prod transaction reconciliation

- Generated: 2026-03-09
- Database: `EVERDAY-PROD`
- Kid: `Aubrey Paul` (username `Aubrey`)
- Claimed starting-balance transaction: `2026-01-09 $40.00`

## Start-date overlay

- First chore-assignment start on record: `2026-01-14`
- Pocket money rule start on record: `2026-02-01`
- New-rule allowance accrual start used for reconciliation: pocket money rule start date.

## Transactions by month (prod ledger)

### 2026-01

| Date | EntryType | Narrative | Amount | Running balance | Source |
|---|---|---|---:|---:|---|
| 2026-01-09 | Deposit | Starting balance | $40.00 | $40.00 |  |
| 2026-01-11 | Withdrawal | Target jewellery  | $-16.00 | $24.00 |  |
| 2026-01-11 | Deposit | Nana Xmas | $100.00 | $124.00 |  |
| 2026-01-14 | Withdrawal | Castle plaza toys | $-28.00 | $96.00 |  |
| 2026-01-15 | Withdrawal | Skull panda | $-42.00 | $54.00 |  |
| 2026-01-24 | Withdrawal | Withdrawal | $-38.00 | $16.00 |  |

- Monthly subtotal (2026-01): **$16.00**

### 2026-02

| Date | EntryType | Narrative | Amount | Running balance | Source |
|---|---|---|---:|---:|---|
| 2026-02-01 | PocketMoney | Pocket money | $40.00 | $56.00 | PocketMoneyRule:3 |
| 2026-02-13 | Withdrawal | Robux | $-34.99 | $21.01 |  |
| 2026-02-13 | Deposit | Deposit | $34.99 | $56.00 |  |

- Monthly subtotal (2026-02): **$40.00**

### 2026-03

| Date | EntryType | Narrative | Amount | Running balance | Source |
|---|---|---|---:|---:|---|
| 2026-03-01 | PocketMoney | Pocket money | $40.00 | $96.00 | PocketMoneyRule:3 |

- Monthly subtotal (2026-03): **$40.00**

## Monthly allocation comparison (new rule vs prod)

| Month | Prod pocket-money posted | Expected closed-month allocation (new rule) | Delta (expected - prod) | Missed days | Missed deduction |
|---|---:|---:|---:|---:|---:|
| 2026-02 | $40.00 | $8.58 | $-31.42 | 22 | $31.42 |
| 2026-03 | $40.00 | $0.00 | $-40.00 | 0 | $0.00 |

## Totals

- Starting-balance transaction present in prod: **Yes** (`2026-01-09`, $40.00)
- Non-pocket ledger total (all months): **$16.00**
- Prod pocket-money total posted: **$80.00**
- Expected closed-month allocation total (new rule): **$8.58**
- Current prod ledger balance: **$96.00**
- Reconciled balance using new rule: **$24.58**
- Balance delta (new rule - prod): **$-71.42**

