from app.modules.health.models import Food as FoodModel
from app.modules.health.services.serving_conversion_service import ConvertToBase, GetUnitKind, NormalizeUnit


def _ResolveFoodBaseUnit(serving_unit: str) -> str:
    normalized = NormalizeUnit(serving_unit or "serving")
    kind = GetUnitKind(normalized)
    if kind == "mass":
        return "g"
    if kind == "volume":
        return "mL"
    if kind == "count":
        return "each"
    return "each"


def _ResolveServingBaseAmount(serving_quantity: float, serving_unit: str) -> tuple[float, str]:
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


def CalculateServingsFromBase(
    FoodRow: FoodModel,
    BaseTotal: float,
    BaseUnit: str,
) -> float:
    serving_quantity = float(FoodRow.ServingQuantity) if FoodRow.ServingQuantity else 1.0
    normalized_serving_unit = NormalizeUnit(FoodRow.ServingUnit or "serving")
    serving_kind = GetUnitKind(normalized_serving_unit)
    normalized_base_unit = NormalizeUnit(BaseUnit or "")

    if normalized_serving_unit == "serving":
        normalized_serving_unit = "each"
        serving_kind = "count"

    if normalized_base_unit in ("g", "mL") and serving_kind in ("mass", "volume"):
        serving_base, _ = ConvertToBase(serving_quantity, normalized_serving_unit)
        if serving_base <= 0:
            raise ValueError("Serving size must be greater than zero.")
        return BaseTotal / serving_base

    if normalized_base_unit == "each" and serving_kind == "count":
        if serving_quantity <= 0:
            raise ValueError("Serving size must be greater than zero.")
        return BaseTotal / serving_quantity

    if normalized_base_unit == normalized_serving_unit:
        if serving_quantity <= 0:
            raise ValueError("Serving size must be greater than zero.")
        return BaseTotal / serving_quantity

    raise ValueError("Portion unit does not match the food serving unit.")


def ResolvePortionBase(
    FoodRow: FoodModel,
    PortionBaseUnit: str,
    PortionBaseAmount: float,
) -> tuple[str, float]:
    normalized_base_unit = NormalizeUnit(PortionBaseUnit or "")
    food_base_unit = _ResolveFoodBaseUnit(FoodRow.ServingUnit)

    if normalized_base_unit in ("ml", "l"):
        normalized_base_unit = "mL" if normalized_base_unit == "ml" else "L"

    if normalized_base_unit in ("g", "mL", "each"):
        resolved_unit = normalized_base_unit
    else:
        resolved_unit = food_base_unit

    base_amount = float(PortionBaseAmount)

    if resolved_unit in ("g", "mL") and resolved_unit != normalized_base_unit:
        base_amount, resolved_unit = ConvertToBase(base_amount, normalized_base_unit)

    return resolved_unit, base_amount


def BuildPortionValues(
    FoodRow: FoodModel,
    DisplayQuantity: float,
    PortionBaseUnit: str,
    PortionBaseAmount: float,
) -> tuple[float, str, float]:
    if DisplayQuantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    resolved_unit, resolved_amount = ResolvePortionBase(
        FoodRow,
        PortionBaseUnit,
        PortionBaseAmount,
    )
    base_total = float(DisplayQuantity) * resolved_amount
    servings = CalculateServingsFromBase(FoodRow, base_total, resolved_unit)
    return servings, resolved_unit, base_total


def BuildServePortion(
    FoodRow: FoodModel,
    DisplayQuantity: float,
) -> tuple[str, float, float]:
    serve_amount, serve_unit = _ResolveServingBaseAmount(
        float(FoodRow.ServingQuantity) if FoodRow.ServingQuantity else 1.0,
        FoodRow.ServingUnit or "serving",
    )
    base_total = float(DisplayQuantity) * serve_amount
    return serve_unit, serve_amount, base_total
