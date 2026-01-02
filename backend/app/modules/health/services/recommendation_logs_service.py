from sqlalchemy.orm import Session

from app.modules.health.models import RecommendationLog
from app.modules.health.schemas import RecommendationLog as RecommendationLogSchema
from app.modules.health.services.nutrition_recommendations_service import NutritionRecommendation


def SaveRecommendationLog(
    db: Session,
    UserId: int,
    Age: int,
    HeightCm: float,
    WeightKg: float,
    ActivityLevel: str,
    Recommendation: NutritionRecommendation,
) -> int:
    record = RecommendationLog(
        UserId=UserId,
        Age=Age,
        HeightCm=HeightCm,
        WeightKg=WeightKg,
        ActivityLevel=ActivityLevel,
        DailyCalorieTarget=Recommendation.DailyCalorieTarget,
        ProteinTargetMin=Recommendation.ProteinTargetMin,
        ProteinTargetMax=Recommendation.ProteinTargetMax,
        FibreTarget=Recommendation.FibreTarget,
        CarbsTarget=Recommendation.CarbsTarget,
        FatTarget=Recommendation.FatTarget,
        SaturatedFatTarget=Recommendation.SaturatedFatTarget,
        SugarTarget=Recommendation.SugarTarget,
        SodiumTarget=Recommendation.SodiumTarget,
        Explanation=Recommendation.Explanation,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record.RecommendationLogId


def GetRecommendationLogsByUser(
    db: Session,
    UserId: int,
    Limit: int = 10,
) -> list[RecommendationLogSchema]:
    rows = (
        db.query(RecommendationLog)
        .filter(RecommendationLog.UserId == UserId)
        .order_by(RecommendationLog.CreatedAt.desc())
        .limit(Limit)
        .all()
    )
    return [
        RecommendationLogSchema(
            RecommendationLogId=row.RecommendationLogId,
            UserId=row.UserId,
            CreatedAt=row.CreatedAt,
            Age=row.Age,
            HeightCm=float(row.HeightCm),
            WeightKg=float(row.WeightKg),
            ActivityLevel=row.ActivityLevel,
            DailyCalorieTarget=row.DailyCalorieTarget,
            ProteinTargetMin=float(row.ProteinTargetMin),
            ProteinTargetMax=float(row.ProteinTargetMax),
            FibreTarget=float(row.FibreTarget) if row.FibreTarget is not None else None,
            CarbsTarget=float(row.CarbsTarget) if row.CarbsTarget is not None else None,
            FatTarget=float(row.FatTarget) if row.FatTarget is not None else None,
            SaturatedFatTarget=float(row.SaturatedFatTarget) if row.SaturatedFatTarget is not None else None,
            SugarTarget=float(row.SugarTarget) if row.SugarTarget is not None else None,
            SodiumTarget=float(row.SodiumTarget) if row.SodiumTarget is not None else None,
            Explanation=row.Explanation,
        )
        for row in rows
    ]
