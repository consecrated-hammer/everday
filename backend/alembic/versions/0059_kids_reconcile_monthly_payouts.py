"""reconcile kids monthly payouts to chore-based month-close logic

Revision ID: 0059_kids_reconcile_monthly_payouts
Revises: 0058_auth_user_approval_gating
Create Date: 2026-03-09 23:55:00.000000
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from alembic import op
import sqlalchemy as sa


revision = "0059_kids_reconcile_monthly_payouts"
down_revision = "0058_auth_user_approval_gating"
branch_labels = None
depends_on = None


ADL_TZ = ZoneInfo("Australia/Adelaide")
DEFAULT_MONTHLY_ALLOWANCE_CENTS = 4000
MONTHLY_PAYOUT_SOURCE_TYPE = "KidsMonthlyPayout"
MONTHLY_PAYOUT_ENTRY_TYPE = "PocketMoney"
LEGACY_SOURCE_TYPE = "PocketMoneyRule"
MIGRATION_NOTE = "Reconciled by 0059_kids_reconcile_monthly_payouts"

CHORE_TYPE_DAILY = "Daily"
CHORE_TYPE_BONUS = "Bonus"
STATUS_APPROVED = "Approved"


def _today_adelaide() -> date:
    return datetime.now(tz=ADL_TZ).date()


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _month_end(value: date) -> date:
    return date(value.year, value.month, _days_in_month(value.year, value.month))


def _closed_month_starts(start_date: date, today: date) -> list[date]:
    current_month_start = date(today.year, today.month, 1)
    last_closed_day = current_month_start - timedelta(days=1)

    first = date(start_date.year, start_date.month, 1)
    last = date(last_closed_day.year, last_closed_day.month, 1)
    if first > last:
        return []

    months: list[date] = []
    cursor = first
    while cursor <= last:
        months.append(cursor)
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return months


def _amount_to_cents(value: Decimal | int | float | None) -> int:
    if value is None:
        return 0
    return int(Decimal(str(value)) * 100)


def _cents_to_amount(value: int) -> Decimal:
    return (Decimal(value) / Decimal(100)).quantize(Decimal("0.01"))


def _monthly_allowance_cents(rule_amount: Decimal | int | float | None) -> int:
    if rule_amount is None:
        return DEFAULT_MONTHLY_ALLOWANCE_CENTS
    cents = _amount_to_cents(rule_amount)
    return cents if cents > 0 else DEFAULT_MONTHLY_ALLOWANCE_CENTS


def _round_daily_slice(monthly_allowance_cents: int, days_in_month: int) -> int:
    if days_in_month <= 0:
        return 0
    return (monthly_allowance_cents + days_in_month // 2) // days_in_month


def _is_active_on_date(
    is_enabled: bool, starts_on: date | None, disabled_on: date | None, on_date: date
) -> bool:
    if starts_on and on_date < starts_on:
        return False
    if disabled_on and on_date > disabled_on:
        return False
    if not is_enabled and disabled_on is None:
        return False
    return True


def _month_source_id(value: date) -> int:
    return value.year * 100 + value.month


def _compute_month_payout_cents(
    month_start: date,
    month_end: date,
    monthly_allowance_cents: int,
    chores_for_assignments: list[dict],
    entries_for_month: list[dict],
) -> int:
    days_in_month = (month_end - month_start).days + 1
    base_daily = monthly_allowance_cents // days_in_month if days_in_month > 0 else 0
    remainder = monthly_allowance_cents % days_in_month if days_in_month > 0 else 0
    fallback_daily_slice = _round_daily_slice(monthly_allowance_cents, days_in_month)

    daily_slice_by_date: dict[date, int] = {}
    cursor = month_start
    offset = 0
    while cursor <= month_end:
        daily_slice_by_date[cursor] = base_daily + (1 if offset < remainder else 0)
        cursor = cursor + timedelta(days=1)
        offset += 1

    approved_by_date: dict[date, set[int]] = {}
    approved_bonus_by_date: dict[date, int] = {}
    for entry in entries_for_month:
        if entry["Status"] != STATUS_APPROVED:
            continue
        entry_date = entry["EntryDate"]
        chore_id = int(entry["ChoreId"])
        approved_by_date.setdefault(entry_date, set()).add(chore_id)
        if entry["EffectiveChoreType"] == CHORE_TYPE_BONUS:
            bonus_cents = _amount_to_cents(entry["Amount"])
            if bonus_cents:
                approved_bonus_by_date[entry_date] = approved_bonus_by_date.get(entry_date, 0) + bonus_cents

    def _required_daily_chores(on_date: date) -> set[int]:
        required: set[int] = set()
        for row in chores_for_assignments:
            if row["ChoreType"] != CHORE_TYPE_DAILY:
                continue
            if not _is_active_on_date(
                bool(row["ChoreIsActive"]),
                row["ChoreStartsOn"],
                row["ChoreDisabledOn"],
                on_date,
            ):
                continue
            if not _is_active_on_date(
                bool(row["AssignmentIsEnabled"]),
                row["AssignmentStartsOn"],
                row["AssignmentDisabledOn"],
                on_date,
            ):
                continue
            required.add(int(row["ChoreId"]))
        return required

    running = 0
    cursor = month_start
    while cursor <= month_end:
        required = _required_daily_chores(cursor)
        approved = approved_by_date.get(cursor, set())
        protected = True if not required else required.issubset(approved)
        day_slice = daily_slice_by_date.get(cursor, fallback_daily_slice)
        if protected:
            running += day_slice
        running += approved_bonus_by_date.get(cursor, 0)
        cursor = cursor + timedelta(days=1)

    return max(running, 0)


def upgrade() -> None:
    bind = op.get_bind()
    today = _today_adelaide()

    rules = bind.execute(
        sa.text(
            """
            SELECT Id, KidUserId, Amount, StartDate, LastPostedOn, IsActive, CreatedByUserId
            FROM kids.pocket_money_rules
            WHERE IsActive = 1
            """
        )
    ).mappings().all()

    for rule in rules:
        kid_user_id = int(rule["KidUserId"])
        start_date = rule["StartDate"]
        if start_date is None:
            continue

        # Idempotent legacy cleanup: only touches still-active legacy rows.
        bind.execute(
            sa.text(
                """
                UPDATE kids.ledger_entries
                SET IsDeleted = 1,
                    UpdatedAt = SYSUTCDATETIME(),
                    Notes = CASE
                        WHEN Notes IS NULL OR LTRIM(RTRIM(Notes)) = '' THEN :note
                        ELSE CONCAT(Notes, ' | ', :note)
                    END
                WHERE KidUserId = :kid_user_id
                  AND IsDeleted = 0
                  AND EntryType = :entry_type
                  AND SourceType = :legacy_source_type
                  AND EntryDate >= :start_date
                """
            ),
            {
                "kid_user_id": kid_user_id,
                "entry_type": MONTHLY_PAYOUT_ENTRY_TYPE,
                "legacy_source_type": LEGACY_SOURCE_TYPE,
                "start_date": start_date,
                "note": MIGRATION_NOTE,
            },
        )

        month_starts = _closed_month_starts(start_date, today)
        if not month_starts:
            continue

        monthly_allowance_cents = _monthly_allowance_cents(rule["Amount"])
        min_month_start = month_starts[0]
        max_month_end = _month_end(month_starts[-1])

        chores_for_assignments = bind.execute(
            sa.text(
                """
                SELECT a.ChoreId,
                       a.IsEnabled AS AssignmentIsEnabled,
                       a.StartsOn AS AssignmentStartsOn,
                       a.DisabledOn AS AssignmentDisabledOn,
                       c.Type AS ChoreType,
                       c.IsActive AS ChoreIsActive,
                       c.StartsOn AS ChoreStartsOn,
                       c.DisabledOn AS ChoreDisabledOn
                FROM kids.chore_assignments a
                JOIN kids.chores c ON c.Id = a.ChoreId
                WHERE a.KidUserId = :kid_user_id
                """
            ),
            {"kid_user_id": kid_user_id},
        ).mappings().all()

        all_entries = bind.execute(
            sa.text(
                """
                SELECT e.EntryDate,
                       e.ChoreId,
                       e.Status,
                       COALESCE(e.ChoreType, c.Type) AS EffectiveChoreType,
                       e.Amount
                FROM kids.chore_entries e
                LEFT JOIN kids.chores c ON c.Id = e.ChoreId
                WHERE e.KidUserId = :kid_user_id
                  AND e.IsDeleted = 0
                  AND e.EntryDate >= :min_month_start
                  AND e.EntryDate <= :max_month_end
                """
            ),
            {
                "kid_user_id": kid_user_id,
                "min_month_start": min_month_start,
                "max_month_end": max_month_end,
            },
        ).mappings().all()

        entries_by_month: dict[tuple[int, int], list[dict]] = {}
        for entry in all_entries:
            key = (entry["EntryDate"].year, entry["EntryDate"].month)
            entries_by_month.setdefault(key, []).append(entry)

        for month_start in month_starts:
            month_end = _month_end(month_start)
            key = (month_start.year, month_start.month)
            month_entries = entries_by_month.get(key, [])

            payout_cents = _compute_month_payout_cents(
                month_start=month_start,
                month_end=month_end,
                monthly_allowance_cents=monthly_allowance_cents,
                chores_for_assignments=chores_for_assignments,
                entries_for_month=month_entries,
            )
            payout_amount = _cents_to_amount(payout_cents)
            source_id = _month_source_id(month_start)
            narrative = f"Monthly chore allowance ({month_start.strftime('%b %Y')})"

            existing = bind.execute(
                sa.text(
                    """
                    SELECT TOP 1 Id
                    FROM kids.ledger_entries
                    WHERE KidUserId = :kid_user_id
                      AND SourceType = :source_type
                      AND SourceId = :source_id
                      AND EntryDate = :entry_date
                    ORDER BY Id
                    """
                ),
                {
                    "kid_user_id": kid_user_id,
                    "source_type": MONTHLY_PAYOUT_SOURCE_TYPE,
                    "source_id": source_id,
                    "entry_date": month_end,
                },
            ).mappings().first()

            if existing:
                bind.execute(
                    sa.text(
                        """
                        UPDATE kids.ledger_entries
                        SET EntryType = :entry_type,
                            Amount = :amount,
                            Narrative = :narrative,
                            IsDeleted = 0,
                            UpdatedAt = SYSUTCDATETIME(),
                            CreatedByUserId = COALESCE(CreatedByUserId, :created_by_user_id),
                            Notes = CASE
                                WHEN Notes IS NULL OR LTRIM(RTRIM(Notes)) = '' THEN :note
                                ELSE Notes
                            END
                        WHERE Id = :entry_id
                        """
                    ),
                    {
                        "entry_type": MONTHLY_PAYOUT_ENTRY_TYPE,
                        "amount": payout_amount,
                        "narrative": narrative,
                        "created_by_user_id": int(rule["CreatedByUserId"]),
                        "note": MIGRATION_NOTE,
                        "entry_id": int(existing["Id"]),
                    },
                )
            else:
                bind.execute(
                    sa.text(
                        """
                        INSERT INTO kids.ledger_entries
                        (
                            KidUserId,
                            EntryType,
                            Amount,
                            EntryDate,
                            Narrative,
                            Notes,
                            CreatedByUserId,
                            SourceType,
                            SourceId,
                            IsDeleted,
                            CreatedAt,
                            UpdatedAt
                        )
                        VALUES
                        (
                            :kid_user_id,
                            :entry_type,
                            :amount,
                            :entry_date,
                            :narrative,
                            :note,
                            :created_by_user_id,
                            :source_type,
                            :source_id,
                            0,
                            SYSUTCDATETIME(),
                            SYSUTCDATETIME()
                        )
                        """
                    ),
                    {
                        "kid_user_id": kid_user_id,
                        "entry_type": MONTHLY_PAYOUT_ENTRY_TYPE,
                        "amount": payout_amount,
                        "entry_date": month_end,
                        "narrative": narrative,
                        "note": MIGRATION_NOTE,
                        "created_by_user_id": int(rule["CreatedByUserId"]),
                        "source_type": MONTHLY_PAYOUT_SOURCE_TYPE,
                        "source_id": source_id,
                    },
                )

        last_closed_end = _month_end(month_starts[-1])
        bind.execute(
            sa.text(
                """
                UPDATE kids.pocket_money_rules
                SET LastPostedOn = CASE
                        WHEN LastPostedOn IS NULL OR LastPostedOn < :last_closed_end THEN :last_closed_end
                        ELSE LastPostedOn
                    END,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE Id = :rule_id
                """
            ),
            {
                "last_closed_end": last_closed_end,
                "rule_id": int(rule["Id"]),
            },
        )


def downgrade() -> None:
    # Irreversible data reconciliation migration.
    pass
