import uuid

from sqlalchemy.orm import Session

from app.modules.health.models import Food as FoodModel
from app.modules.health.models import PortionOption as PortionOptionModel
from app.modules.health.schemas import PortionOption
from app.modules.health.services.serving_conversion_service import ConvertToBase, GetUnitKind, NormalizeUnit


def ResolveFoodBaseUnit(serving_unit: str) -> str:
    normalized = NormalizeUnit(serving_unit or "serving")
    kind = GetUnitKind(normalized)
    if kind == "mass":
        return "g"
    if kind == "volume":
        return "mL"
    if kind == "count":
        return "each"
    return "each"


def ResolveServingBaseAmount(serving_quantity: float, serving_unit: str) -> tuple[float, str]:
    normalized = NormalizeUnit(serving_unit or "serving")
    kind = GetUnitKind(normalized)
    if normalized == "serving":
        return float(serving_quantity or 1.0), "each"
    if kind == "mass" or kind == "volume":
        base_amount, base_unit = ConvertToBase(float(serving_quantity), normalized)
        return base_amount, base_unit
    if kind == "count":
        return float(serving_quantity or 1.0), "each"
    return float(serving_quantity or 1.0), "each"


def _GlobalOptions(base_unit: str) -> list[PortionOption]:
    if base_unit == "mL":
        return [
            PortionOption(Label="cup", BaseUnit="mL", BaseAmount=250, Scope="global", SortOrder=1),
            PortionOption(Label="1/2 cup", BaseUnit="mL", BaseAmount=125, Scope="global", SortOrder=2),
            PortionOption(Label="tbsp", BaseUnit="mL", BaseAmount=15, Scope="global", SortOrder=3),
            PortionOption(Label="tsp", BaseUnit="mL", BaseAmount=5, Scope="global", SortOrder=4),
            PortionOption(Label="mL", BaseUnit="mL", BaseAmount=1, Scope="global", SortOrder=5),
        ]
    if base_unit == "g":
        return [
            PortionOption(Label="tbsp", BaseUnit="g", BaseAmount=15, Scope="global", SortOrder=1),
            PortionOption(Label="tsp", BaseUnit="g", BaseAmount=5, Scope="global", SortOrder=2),
            PortionOption(Label="handful", BaseUnit="g", BaseAmount=30, Scope="global", SortOrder=3),
            PortionOption(Label="slice", BaseUnit="g", BaseAmount=25, Scope="global", SortOrder=4),
            PortionOption(Label="g", BaseUnit="g", BaseAmount=1, Scope="global", SortOrder=5),
        ]
    return [
        PortionOption(Label="each", BaseUnit="each", BaseAmount=1, Scope="global", SortOrder=1),
    ]


def GetPortionOptions(db: Session, UserId: int, FoodId: str | None) -> tuple[str, list[PortionOption]]:
    base_unit = "each"
    serve_option: PortionOption | None = None

    food_row = None
    if FoodId:
        food_row = db.query(FoodModel).filter(FoodModel.FoodId == FoodId).first()
        if food_row:
            base_unit = ResolveFoodBaseUnit(food_row.ServingUnit)
            serve_amount, serve_unit = ResolveServingBaseAmount(
                float(food_row.ServingQuantity) if food_row.ServingQuantity else 1.0,
                food_row.ServingUnit or "serving",
            )
            serve_option = PortionOption(
                Label="serving",
                BaseUnit=serve_unit,
                BaseAmount=serve_amount,
                Scope="food",
                SortOrder=0,
                IsDefault=True,
            )

    options: list[PortionOption] = []
    if serve_option:
        options.append(serve_option)

    global_options = _GlobalOptions(base_unit)
    if serve_option and base_unit == "each":
        global_options = [option for option in global_options if option.Label != "each"]
    options.extend(global_options)

    if FoodId:
        rows = (
            db.query(PortionOptionModel)
            .filter(
                PortionOptionModel.UserId == UserId,
                PortionOptionModel.FoodId == FoodId,
            )
            .order_by(PortionOptionModel.SortOrder.asc(), PortionOptionModel.CreatedAt.asc())
            .all()
        )
        for row in rows:
            options.append(
                PortionOption(
                    PortionOptionId=row.PortionOptionId,
                    FoodId=row.FoodId,
                    Label=row.Label,
                    BaseUnit=row.BaseUnit,
                    BaseAmount=float(row.BaseAmount),
                    Scope=row.Scope,
                    SortOrder=row.SortOrder,
                    IsDefault=row.IsDefault,
                )
            )

    return base_unit, options


def CreatePortionOption(
    db: Session,
    UserId: int,
    FoodId: str | None,
    Label: str,
    BaseUnit: str,
    BaseAmount: float,
    IsDefault: bool,
    SortOrder: int,
) -> PortionOption:
    record = PortionOptionModel(
        PortionOptionId=str(uuid.uuid4()),
        UserId=UserId,
        FoodId=FoodId,
        Label=Label,
        BaseUnit=BaseUnit,
        BaseAmount=BaseAmount,
        Scope="food" if FoodId else "global",
        SortOrder=SortOrder,
        IsDefault=IsDefault,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return PortionOption(
        PortionOptionId=record.PortionOptionId,
        FoodId=record.FoodId,
        Label=record.Label,
        BaseUnit=record.BaseUnit,
        BaseAmount=float(record.BaseAmount),
        Scope=record.Scope,
        SortOrder=record.SortOrder,
        IsDefault=record.IsDefault,
    )
