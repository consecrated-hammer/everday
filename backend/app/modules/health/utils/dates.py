from datetime import date, datetime


def ParseIsoDate(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid date format. Use YYYY-MM-DD.") from exc
