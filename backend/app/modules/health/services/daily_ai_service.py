"""
Service for running automated daily AI suggestions at 6am.
For parent-role users who have logged several meals over several days in the last 7 days.
"""

from datetime import date, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.auth.models import User
from app.modules.health.models import AiSuggestionRun, DailyLog, MealEntry
from app.modules.health.services.ai_suggestions_service import GetAiSuggestions
from app.modules.notifications.services import CreateNotification


MINIMUM_MEAL_COUNT = 6  # Several meals
MINIMUM_DAY_COUNT = 3  # Several days
LOOKBACK_DAYS = 7


def _IsEligibleForSuggestions(db: Session, user_id: int, run_date: date) -> bool:
    """Check if user has logged enough data in last 7 days to warrant suggestions."""
    start_date = run_date - timedelta(days=LOOKBACK_DAYS - 1)
    
    # Count distinct days with meal entries
    days_logged_query = (
        db.query(func.count(func.distinct(DailyLog.LogDate)))
        .join(MealEntry, MealEntry.DailyLogId == DailyLog.DailyLogId)
        .filter(
            DailyLog.UserId == user_id,
            DailyLog.LogDate >= start_date,
            DailyLog.LogDate <= run_date,
        )
    )
    days_logged = days_logged_query.scalar() or 0
    
    if days_logged < MINIMUM_DAY_COUNT:
        return False
    
    # Count total meal entries
    meal_count_query = (
        db.query(func.count(MealEntry.MealEntryId))
        .join(DailyLog, DailyLog.DailyLogId == MealEntry.DailyLogId)
        .filter(
            DailyLog.UserId == user_id,
            DailyLog.LogDate >= start_date,
            DailyLog.LogDate <= run_date,
        )
    )
    meal_count = meal_count_query.scalar() or 0
    
    return meal_count >= MINIMUM_MEAL_COUNT


def _HasAlreadyRun(db: Session, user_id: int, run_date: date) -> bool:
    """Check if suggestions have already been generated for this user today."""
    existing = (
        db.query(AiSuggestionRun)
        .filter(
            AiSuggestionRun.UserId == user_id,
            AiSuggestionRun.RunDate == run_date,
        )
        .first()
    )
    return existing is not None


def _RecordRun(
    db: Session,
    user_id: int,
    run_date: date,
    suggestions_count: int,
    model_used: str | None,
    notification_sent: bool,
    error_message: str | None = None,
) -> AiSuggestionRun:
    """Record that a suggestion run was performed."""
    now = NowUtc()
    record = AiSuggestionRun(
        UserId=user_id,
        RunDate=run_date,
        SuggestionsGenerated=suggestions_count,
        ModelUsed=model_used,
        NotificationSent=notification_sent,
        ErrorMessage=error_message,
        CreatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def RunDailyAiSuggestions(db: Session, admin_user_id: int, run_date: date | None = None) -> dict:
    """
    Run AI suggestions for all eligible parent users.
    
    Returns dict with:
    - EligibleUsers: number of users who met criteria
    - SuggestionsGenerated: number of users who got suggestions
    - NotificationsSent: number of notifications sent
    - Errors: number of failures
    """
    if run_date is None:
        run_date = NowUtc().date()
    
    # Get all parent-role users
    parent_users = db.query(User).filter(User.Role == "Parent").all()
    
    eligible_count = 0
    suggestions_count = 0
    notifications_count = 0
    error_count = 0
    
    for user in parent_users:
        # Skip if already ran today
        if _HasAlreadyRun(db, user.Id, run_date):
            continue
        
        # Check eligibility
        if not _IsEligibleForSuggestions(db, user.Id, run_date):
            continue
        
        eligible_count += 1
        
        try:
            # Generate suggestions
            suggestions, model_used = GetAiSuggestions(db, user.Id, run_date.isoformat())
            suggestions_generated = len(suggestions)
            
            # Create notification
            CreateNotification(
                db,
                user_id=user.Id,
                created_by_user_id=admin_user_id,
                title="Your daily health insights are ready",
                body=f"We've prepared {suggestions_generated} personalized suggestions based on your recent activity.",
                notification_type="HealthAiSuggestion",
                link_url="/health/insights#ai-suggestions",
                action_label="View suggestions",
                source_module="health",
                source_id=f"ai-suggestions-{run_date.isoformat()}",
            )
            
            # Record successful run
            _RecordRun(
                db,
                user.Id,
                run_date,
                suggestions_generated,
                model_used,
                notification_sent=True,
            )
            
            suggestions_count += 1
            notifications_count += 1
            
        except Exception as exc:  # noqa: BLE001
            error_message = str(exc)
            # Record failed run
            _RecordRun(
                db,
                user.Id,
                run_date,
                0,
                None,
                notification_sent=False,
                error_message=error_message,
            )
            error_count += 1
    
    return {
        "EligibleUsers": eligible_count,
        "SuggestionsGenerated": suggestions_count,
        "NotificationsSent": notifications_count,
        "Errors": error_count,
    }
