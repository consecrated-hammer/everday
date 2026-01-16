import json
import re
from datetime import date
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.auth.deps import NowUtc
from app.modules.life_admin.models import (
    LifeCategory,
    LifeDropdown,
    LifeDropdownOption,
    LifeField,
    LifePerson,
    LifeRecord,
)

FIELD_TYPES = {
    "Text",
    "LongText",
    "Number",
    "Currency",
    "Date",
    "DateRange",
    "Dropdown",
    "Person",
    "RecordLink",
    "Boolean",
}


def NormalizeKey(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized or "field"


def NormalizeSlug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or "category"


def EnsureUniqueSlug(db: Session, base_slug: str, exclude_id: int | None = None) -> str:
    slug = base_slug
    suffix = 2
    while True:
        query = db.query(LifeCategory).filter(func.lower(LifeCategory.Slug) == slug.lower())
        if exclude_id:
            query = query.filter(LifeCategory.Id != exclude_id)
        if not query.first():
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


def EnsureUniqueKey(
    db: Session, category_id: int, base_key: str, exclude_id: int | None = None
) -> str:
    key = base_key
    suffix = 2
    while True:
        query = db.query(LifeField).filter(
            LifeField.CategoryId == category_id,
            func.lower(LifeField.Key) == key.lower(),
        )
        if exclude_id:
            query = query.filter(LifeField.Id != exclude_id)
        if not query.first():
            return key
        key = f"{base_key}_{suffix}"
        suffix += 1


def ListCategories(db: Session, include_inactive: bool = False) -> list[LifeCategory]:
    query = db.query(LifeCategory)
    if not include_inactive:
        query = query.filter(LifeCategory.IsActive == 1)
    return query.order_by(
        LifeCategory.SortOrder.asc(),
        LifeCategory.Name.asc(),
        LifeCategory.Id.asc(),
    ).all()


def CreateCategory(db: Session, user_id: int, input_data: dict[str, Any]) -> LifeCategory:
    slug_base = NormalizeSlug(input_data["Name"])
    slug = EnsureUniqueSlug(db, slug_base)
    now = NowUtc()
    record = LifeCategory(
        Name=input_data["Name"].strip(),
        Slug=slug,
        Description=input_data.get("Description"),
        SortOrder=input_data.get("SortOrder", 0),
        IsActive=input_data.get("IsActive", True),
        CreatedByUserId=user_id,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateCategory(
    db: Session,
    category_id: int,
    input_data: dict[str, Any],
) -> LifeCategory | None:
    record = db.query(LifeCategory).filter(LifeCategory.Id == category_id).first()
    if not record:
        return None
    if input_data["Name"].strip().lower() != record.Name.lower():
        slug_base = NormalizeSlug(input_data["Name"])
        record.Slug = EnsureUniqueSlug(db, slug_base, exclude_id=record.Id)
    record.Name = input_data["Name"].strip()
    record.Description = input_data.get("Description")
    record.SortOrder = input_data.get("SortOrder", 0)
    record.IsActive = input_data.get("IsActive", True)
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteCategory(db: Session, category_id: int) -> bool:
    record = db.query(LifeCategory).filter(LifeCategory.Id == category_id).first()
    if not record:
        return False
    db.query(LifeField).filter(LifeField.CategoryId == category_id).delete(
        synchronize_session=False
    )
    db.query(LifeRecord).filter(LifeRecord.CategoryId == category_id).delete(
        synchronize_session=False
    )
    db.delete(record)
    db.commit()
    return True


def ListFields(db: Session, category_id: int) -> list[LifeField]:
    return (
        db.query(LifeField)
        .filter(LifeField.CategoryId == category_id)
        .order_by(LifeField.SortOrder.asc(), LifeField.Id.asc())
        .all()
    )


def _validate_field_definition(
    db: Session,
    field_type: str,
    dropdown_id: int | None,
    linked_category_id: int | None,
) -> None:
    if field_type not in FIELD_TYPES:
        raise ValueError("Unsupported field type")
    if field_type == "Dropdown":
        if not dropdown_id:
            raise ValueError("Dropdown fields require a dropdown")
        exists = db.query(LifeDropdown).filter(LifeDropdown.Id == dropdown_id).first()
        if not exists:
            raise ValueError("Dropdown not found")
    if field_type == "RecordLink":
        if not linked_category_id:
            raise ValueError("Record link fields require a linked category")
        exists = db.query(LifeCategory).filter(LifeCategory.Id == linked_category_id).first()
        if not exists:
            raise ValueError("Linked category not found")


def CreateField(
    db: Session,
    category_id: int,
    input_data: dict[str, Any],
) -> LifeField:
    _validate_field_definition(
        db,
        input_data["FieldType"],
        input_data.get("DropdownId"),
        input_data.get("LinkedCategoryId"),
    )
    base_key = NormalizeKey(input_data.get("Key") or input_data["Name"])
    key = EnsureUniqueKey(db, category_id, base_key)
    now = NowUtc()
    record = LifeField(
        CategoryId=category_id,
        Name=input_data["Name"].strip(),
        Key=key,
        FieldType=input_data["FieldType"],
        IsRequired=input_data.get("IsRequired", False),
        IsMulti=input_data.get("IsMulti", False),
        SortOrder=input_data.get("SortOrder", 0),
        DropdownId=input_data.get("DropdownId"),
        LinkedCategoryId=input_data.get("LinkedCategoryId"),
        ConfigJson=json.dumps(input_data.get("Config") or {}),
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateField(db: Session, field_id: int, input_data: dict[str, Any]) -> LifeField | None:
    record = db.query(LifeField).filter(LifeField.Id == field_id).first()
    if not record:
        return None
    _validate_field_definition(
        db,
        input_data["FieldType"],
        input_data.get("DropdownId"),
        input_data.get("LinkedCategoryId"),
    )
    base_key = NormalizeKey(input_data.get("Key") or input_data["Name"])
    record.Key = EnsureUniqueKey(db, record.CategoryId, base_key, exclude_id=record.Id)
    record.Name = input_data["Name"].strip()
    record.FieldType = input_data["FieldType"]
    record.IsRequired = input_data.get("IsRequired", False)
    record.IsMulti = input_data.get("IsMulti", False)
    record.SortOrder = input_data.get("SortOrder", 0)
    record.DropdownId = input_data.get("DropdownId")
    record.LinkedCategoryId = input_data.get("LinkedCategoryId")
    record.ConfigJson = json.dumps(input_data.get("Config") or {})
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteField(db: Session, field_id: int) -> bool:
    record = db.query(LifeField).filter(LifeField.Id == field_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def ListDropdowns(db: Session) -> list[LifeDropdown]:
    return db.query(LifeDropdown).order_by(LifeDropdown.Name.asc()).all()


def CreateDropdown(db: Session, input_data: dict[str, Any]) -> LifeDropdown:
    now = NowUtc()
    record = LifeDropdown(
        Name=input_data["Name"].strip(),
        Description=input_data.get("Description"),
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateDropdown(db: Session, dropdown_id: int, input_data: dict[str, Any]) -> LifeDropdown | None:
    record = db.query(LifeDropdown).filter(LifeDropdown.Id == dropdown_id).first()
    if not record:
        return None
    record.Name = input_data["Name"].strip()
    record.Description = input_data.get("Description")
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteDropdown(db: Session, dropdown_id: int) -> bool:
    in_use = (
        db.query(LifeField.Id)
        .filter(LifeField.DropdownId == dropdown_id)
        .first()
    )
    if in_use:
        raise ValueError("Dropdown is in use by existing fields")
    record = db.query(LifeDropdown).filter(LifeDropdown.Id == dropdown_id).first()
    if not record:
        return False
    db.query(LifeDropdownOption).filter(LifeDropdownOption.DropdownId == dropdown_id).delete(
        synchronize_session=False
    )
    db.delete(record)
    db.commit()
    return True


def ListDropdownOptions(db: Session, dropdown_id: int) -> list[LifeDropdownOption]:
    return (
        db.query(LifeDropdownOption)
        .filter(LifeDropdownOption.DropdownId == dropdown_id)
        .order_by(LifeDropdownOption.SortOrder.asc(), LifeDropdownOption.Label.asc())
        .all()
    )


def CreateDropdownOption(
    db: Session, dropdown_id: int, input_data: dict[str, Any]
) -> LifeDropdownOption:
    now = NowUtc()
    record = LifeDropdownOption(
        DropdownId=dropdown_id,
        Label=input_data["Label"].strip(),
        Value=input_data.get("Value"),
        SortOrder=input_data.get("SortOrder", 0),
        IsActive=input_data.get("IsActive", True),
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdateDropdownOption(
    db: Session, option_id: int, input_data: dict[str, Any]
) -> LifeDropdownOption | None:
    record = db.query(LifeDropdownOption).filter(LifeDropdownOption.Id == option_id).first()
    if not record:
        return None
    record.Label = input_data["Label"].strip()
    record.Value = input_data.get("Value")
    record.SortOrder = input_data.get("SortOrder", 0)
    record.IsActive = input_data.get("IsActive", True)
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def ListPeople(db: Session) -> list[LifePerson]:
    return db.query(LifePerson).order_by(LifePerson.Name.asc()).all()


def CreatePerson(db: Session, input_data: dict[str, Any]) -> LifePerson:
    now = NowUtc()
    record = LifePerson(
        Name=input_data["Name"].strip(),
        UserId=input_data.get("UserId"),
        Notes=input_data.get("Notes"),
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def UpdatePerson(db: Session, person_id: int, input_data: dict[str, Any]) -> LifePerson | None:
    record = db.query(LifePerson).filter(LifePerson.Id == person_id).first()
    if not record:
        return None
    record.Name = input_data["Name"].strip()
    record.UserId = input_data.get("UserId")
    record.Notes = input_data.get("Notes")
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _parse_date(value: str) -> str:
    return date.fromisoformat(value).isoformat()


def _normalize_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise ValueError("Invalid boolean value")


def _normalize_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError as exc:
            raise ValueError("Invalid number") from exc
    raise ValueError("Invalid number")


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict)) and not value:
        return True
    return False


def _validate_dropdown_values(
    db: Session, dropdown_id: int, values: list[int]
) -> list[int]:
    options = (
        db.query(LifeDropdownOption)
        .filter(
            LifeDropdownOption.DropdownId == dropdown_id,
            LifeDropdownOption.Id.in_(values),
            LifeDropdownOption.IsActive == 1,
        )
        .all()
    )
    if len(options) != len(values):
        raise ValueError("Dropdown option not found")
    return values


def _validate_person_values(db: Session, values: list[int]) -> list[int]:
    people = db.query(LifePerson).filter(LifePerson.Id.in_(values)).all()
    if len(people) != len(values):
        raise ValueError("Person not found")
    return values


def _validate_record_values(
    db: Session, category_id: int, values: list[int]
) -> list[int]:
    records = (
        db.query(LifeRecord)
        .filter(LifeRecord.CategoryId == category_id, LifeRecord.Id.in_(values))
        .all()
    )
    if len(records) != len(values):
        raise ValueError("Linked record not found")
    return values


def NormalizeRecordData(
    db: Session, category_id: int, input_data: dict[str, Any]
) -> tuple[dict[str, Any], list[LifeField]]:
    fields = ListFields(db, category_id)
    cleaned: dict[str, Any] = {}
    for field in fields:
        value = input_data.get(field.Key)
        if _is_empty(value):
            if field.IsRequired:
                raise ValueError(f"{field.Name} is required")
            continue
        if field.FieldType in {"Text", "LongText"}:
            if not isinstance(value, str):
                raise ValueError(f"{field.Name} must be text")
            cleaned[field.Key] = value.strip()
            continue
        if field.FieldType in {"Number", "Currency"}:
            cleaned[field.Key] = _normalize_number(value)
            continue
        if field.FieldType == "Date":
            if not isinstance(value, str):
                raise ValueError(f"{field.Name} must be a date")
            cleaned[field.Key] = _parse_date(value)
            continue
        if field.FieldType == "DateRange":
            if not isinstance(value, dict):
                raise ValueError(f"{field.Name} must be a date range")
            start = value.get("StartDate")
            end = value.get("EndDate")
            if _is_empty(start):
                if field.IsRequired:
                    raise ValueError(f"{field.Name} start date is required")
                cleaned[field.Key] = {"StartDate": None, "EndDate": None}
                continue
            cleaned[field.Key] = {
                "StartDate": _parse_date(start),
                "EndDate": _parse_date(end) if end else None,
            }
            continue
        if field.FieldType == "Dropdown":
            if not field.DropdownId:
                raise ValueError("Dropdown not configured")
            values = value if isinstance(value, list) else [value]
            normalized = [int(entry) for entry in values]
            validated = _validate_dropdown_values(db, field.DropdownId, normalized)
            cleaned[field.Key] = validated if field.IsMulti else validated[0]
            continue
        if field.FieldType == "Person":
            values = value if isinstance(value, list) else [value]
            normalized = [int(entry) for entry in values]
            validated = _validate_person_values(db, normalized)
            cleaned[field.Key] = validated if field.IsMulti else validated[0]
            continue
        if field.FieldType == "RecordLink":
            if not field.LinkedCategoryId:
                raise ValueError("Linked category not configured")
            values = value if isinstance(value, list) else [value]
            normalized = [int(entry) for entry in values]
            validated = _validate_record_values(db, field.LinkedCategoryId, normalized)
            cleaned[field.Key] = validated if field.IsMulti else validated[0]
            continue
        if field.FieldType == "Boolean":
            cleaned[field.Key] = _normalize_boolean(value)
            continue
        raise ValueError("Unsupported field type")
    return cleaned, fields


def ResolveRecordTitle(
    db: Session,
    data: dict[str, Any],
    fields: list[LifeField],
    fallback: str = "Record",
) -> str:
    for field in fields:
        if field.Key not in data:
            continue
        value = data[field.Key]
        if value is None:
            continue
        if field.FieldType in {"Text", "LongText", "Number", "Currency", "Date"}:
            return str(value)
        if field.FieldType == "DateRange" and isinstance(value, dict):
            start = value.get("StartDate")
            if start:
                return str(start)
        if field.FieldType == "Dropdown" and field.DropdownId:
            option = (
                db.query(LifeDropdownOption)
                .filter(LifeDropdownOption.Id == int(value))
                .first()
            )
            if option:
                return option.Label
        if field.FieldType == "Person":
            person = db.query(LifePerson).filter(LifePerson.Id == int(value)).first()
            if person:
                return person.Name
        if field.FieldType == "RecordLink" and field.LinkedCategoryId:
            record = db.query(LifeRecord).filter(LifeRecord.Id == int(value)).first()
            if record and record.Title:
                return record.Title
    return fallback


def ListRecords(db: Session, category_id: int) -> list[LifeRecord]:
    return (
        db.query(LifeRecord)
        .filter(LifeRecord.CategoryId == category_id)
        .order_by(LifeRecord.CreatedAt.desc(), LifeRecord.Id.desc())
        .all()
    )


def CreateRecord(
    db: Session,
    category_id: int,
    user_id: int,
    input_data: dict[str, Any],
) -> LifeRecord:
    data, fields = NormalizeRecordData(db, category_id, input_data["Data"])
    now = NowUtc()
    record = LifeRecord(
        CategoryId=category_id,
        Title=input_data.get("Title"),
        DataJson=json.dumps(data),
        CreatedByUserId=user_id,
        UpdatedByUserId=user_id,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    if not record.Title:
        record.Title = ResolveRecordTitle(db, data, fields, fallback=f"Record {record.Id}")
        record.UpdatedAt = NowUtc()
        db.add(record)
        db.commit()
        db.refresh(record)
    return record


def UpdateRecord(
    db: Session,
    record_id: int,
    user_id: int,
    input_data: dict[str, Any],
) -> LifeRecord | None:
    record = db.query(LifeRecord).filter(LifeRecord.Id == record_id).first()
    if not record:
        return None
    data, fields = NormalizeRecordData(db, record.CategoryId, input_data["Data"])
    record.DataJson = json.dumps(data)
    record.Title = input_data.get("Title") or ResolveRecordTitle(
        db, data, fields, fallback=record.Title or f"Record {record.Id}"
    )
    record.UpdatedByUserId = user_id
    record.UpdatedAt = NowUtc()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def DeleteRecord(db: Session, record_id: int) -> bool:
    record = db.query(LifeRecord).filter(LifeRecord.Id == record_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def ListRecordLookup(db: Session, category_id: int) -> list[LifeRecord]:
    return (
        db.query(LifeRecord)
        .filter(LifeRecord.CategoryId == category_id)
        .order_by(LifeRecord.Title.asc(), LifeRecord.Id.asc())
        .all()
    )
