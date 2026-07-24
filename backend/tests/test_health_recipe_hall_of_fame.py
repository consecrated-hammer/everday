from datetime import date, datetime
from types import SimpleNamespace

from app.modules.health.schemas import UpdateRecipeReviewInput
from app.modules.health.services import knowledge_service
from app.modules.health.services.knowledge_service import (
    GetRecipeStats,
    UpsertRecipeReview,
    _hall_of_fame_override_for_rating,
    _is_hall_of_fame,
)


def test_unrated_recipe_cannot_keep_hall_of_fame_override() -> None:
    assert _hall_of_fame_override_for_rating(None, "yes") is None
    assert _hall_of_fame_override_for_rating(None, "no") is None


def test_rated_recipe_keeps_explicit_hall_of_fame_override() -> None:
    assert _hall_of_fame_override_for_rating(9.0, "yes") == "yes"


def test_hall_of_fame_stats_are_boolean() -> None:
    assert _is_hall_of_fame("yes") is True
    assert _is_hall_of_fame("no") is False
    assert _is_hall_of_fame(None) is False


def test_hall_of_fame_partial_update_preserves_existing_rating() -> None:
    row = SimpleNamespace(
        RecipeReviewId="recipe-review-1",
        RecipeName="Test recipe",
        LogDate=date(2026, 7, 20),
        MealEntryId=None,
        Rating=8.0,
        WouldMakeAgain="yes",
        HallOfFameOverride="no",
        Notes="Existing note",
        CreatedAt=datetime(2026, 7, 20),
        UpdatedAt=datetime(2026, 7, 20),
    )

    class Query:
        def filter(self, *_args):
            return self

        def first(self):
            return row

    class Db:
        def query(self, _model):
            return Query()

        def commit(self):
            pass

        def refresh(self, _row):
            pass

    UpsertRecipeReview(
        Db(),
        2,
        UpdateRecipeReviewInput(RecipeReviewId="recipe-review-1", HallOfFameOverride="yes"),
        review_id="recipe-review-1",
    )

    assert row.Rating == 8.0
    assert row.HallOfFameOverride == "yes"
    assert row.Notes == "Existing note"


def test_recipe_stats_exclude_untemplated_foods_and_unrated_reviews(monkeypatch) -> None:
    log = SimpleNamespace(LogDate=date(2026, 7, 20), DailyLogId="daily-log-1")
    unrated_review = SimpleNamespace(RecipeName="Raw sugar", Rating=None)

    class Query:
        def __init__(self, rows):
            self.rows = rows

        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def all(self):
            return self.rows

    class Db:
        def __init__(self):
            self.calls = 0

        def query(self, _model):
            self.calls += 1
            return Query([unrated_review] if self.calls == 1 else [log])

    monkeypatch.setattr(
        knowledge_service,
        "GetEntriesForLog",
        lambda *_args: [SimpleNamespace(TemplateName=None, FoodName="Raw sugar")],
    )

    assert GetRecipeStats(Db(), 2) == []
