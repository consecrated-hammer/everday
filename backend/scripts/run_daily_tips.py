#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import app.db as db_module
from app.modules.health.services.daily_tip_service import RunDailyTips


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate health daily tips for one slot.")
    parser.add_argument("--slot", choices=["morning", "midday", "dinner"], help="Tip slot to generate.")
    parser.add_argument("--run-date", help="YYYY-MM-DD override. Defaults to today.")
    parser.add_argument("--run-time", help="HH:MM override used when slot is not provided.")
    parser.add_argument("--user-id", type=int, help="Optional single user override.")
    parser.add_argument("--admin-user-id", type=int, default=1, help="Actor user id for audit context.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    run_date = date.fromisoformat(args.run_date) if args.run_date else None

    db_module._ensure_engine()
    db = db_module.SessionLocal()
    try:
        result = RunDailyTips(
            db,
            admin_user_id=args.admin_user_id,
            run_date=run_date,
            run_time=args.run_time,
            slot=args.slot,
            user_id=args.user_id,
        )
    finally:
        db.close()

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
