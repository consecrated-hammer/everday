from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.modules.health.schemas import CreateRecipeReviewInput, UpdateRecipeReviewInput
from app.modules.health.services.knowledge_service import DeleteRecipeReview, GetRecipeReviews, GetRecipeStats, UpsertRecipeReview


def UpsertRecipeReviewRecord(db: Session, user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    review_id = str(payload.get("RecipeReviewId") or "").strip() or None
    schema = UpdateRecipeReviewInput(**payload) if review_id else CreateRecipeReviewInput(**payload)
    item = UpsertRecipeReview(db, user_id, schema, review_id=review_id)
    return item.model_dump(mode="json")


def GetRecipeReviewHistory(db: Session, user_id: int, limit: int = 200) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json") for item in GetRecipeReviews(db, user_id, limit=limit)]


def DeleteRecipeReviewRecord(db: Session, user_id: int, review_id: str) -> None:
    DeleteRecipeReview(db, user_id, review_id)


def GetRecipeStatsView(
    db: Session,
    user_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json") for item in GetRecipeStats(db, user_id, start_date, end_date, limit)]
