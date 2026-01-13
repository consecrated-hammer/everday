import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import GetDb
from app.modules.auth.deps import RequireModuleRole, UserContext
from app.modules.life_admin import services
from app.modules.life_admin.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    DropdownCreate,
    DropdownOptionCreate,
    DropdownOptionOut,
    DropdownOptionUpdate,
    DropdownOut,
    DropdownUpdate,
    FieldCreate,
    FieldOut,
    FieldUpdate,
    PersonCreate,
    PersonOut,
    PersonUpdate,
    RecordCreate,
    RecordLookupOut,
    RecordOut,
    RecordUpdate,
)

router = APIRouter(prefix="/api/life-admin", tags=["life-admin"])


def _category_out(record) -> CategoryOut:
    return CategoryOut(
        Id=record.Id,
        Name=record.Name,
        Slug=record.Slug,
        Description=record.Description,
        SortOrder=record.SortOrder,
        IsActive=record.IsActive,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _field_out(record) -> FieldOut:
    config = json.loads(record.ConfigJson) if record.ConfigJson else None
    return FieldOut(
        Id=record.Id,
        CategoryId=record.CategoryId,
        Name=record.Name,
        Key=record.Key,
        FieldType=record.FieldType,
        IsRequired=record.IsRequired,
        IsMulti=record.IsMulti,
        SortOrder=record.SortOrder,
        DropdownId=record.DropdownId,
        LinkedCategoryId=record.LinkedCategoryId,
        Config=config,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _dropdown_out(record) -> DropdownOut:
    return DropdownOut(
        Id=record.Id,
        Name=record.Name,
        Description=record.Description,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _dropdown_option_out(record) -> DropdownOptionOut:
    return DropdownOptionOut(
        Id=record.Id,
        DropdownId=record.DropdownId,
        Label=record.Label,
        Value=record.Value,
        SortOrder=record.SortOrder,
        IsActive=record.IsActive,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _person_out(record) -> PersonOut:
    return PersonOut(
        Id=record.Id,
        Name=record.Name,
        UserId=record.UserId,
        Notes=record.Notes,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


def _record_out(record) -> RecordOut:
    data = json.loads(record.DataJson) if record.DataJson else {}
    return RecordOut(
        Id=record.Id,
        CategoryId=record.CategoryId,
        Title=record.Title,
        Data=data,
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


@router.get("/categories", response_model=list[CategoryOut])
def ListCategories(
    include_inactive: bool = False,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[CategoryOut]:
    return [_category_out(entry) for entry in services.ListCategories(db, include_inactive)]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def CreateCategory(
    payload: CategoryCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> CategoryOut:
    record = services.CreateCategory(db, user.Id, payload.dict())
    return _category_out(record)


@router.put("/categories/{category_id}", response_model=CategoryOut)
def UpdateCategory(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> CategoryOut:
    record = services.UpdateCategory(db, category_id, payload.dict())
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return _category_out(record)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteCategory(
    category_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    if not services.DeleteCategory(db, category_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


@router.get("/categories/{category_id}/fields", response_model=list[FieldOut])
def ListFields(
    category_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[FieldOut]:
    return [_field_out(entry) for entry in services.ListFields(db, category_id)]


@router.post("/categories/{category_id}/fields", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
def CreateField(
    category_id: int,
    payload: FieldCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> FieldOut:
    try:
        record = services.CreateField(db, category_id, payload.dict())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _field_out(record)


@router.put("/fields/{field_id}", response_model=FieldOut)
def UpdateField(
    field_id: int,
    payload: FieldUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> FieldOut:
    try:
        record = services.UpdateField(db, field_id, payload.dict())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    return _field_out(record)


@router.delete("/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteField(
    field_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    if not services.DeleteField(db, field_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")


@router.get("/dropdowns", response_model=list[DropdownOut])
def ListDropdowns(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[DropdownOut]:
    return [_dropdown_out(entry) for entry in services.ListDropdowns(db)]


@router.post("/dropdowns", response_model=DropdownOut, status_code=status.HTTP_201_CREATED)
def CreateDropdown(
    payload: DropdownCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DropdownOut:
    record = services.CreateDropdown(db, payload.dict())
    return _dropdown_out(record)


@router.put("/dropdowns/{dropdown_id}", response_model=DropdownOut)
def UpdateDropdown(
    dropdown_id: int,
    payload: DropdownUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DropdownOut:
    record = services.UpdateDropdown(db, dropdown_id, payload.dict())
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dropdown not found")
    return _dropdown_out(record)


@router.get("/dropdowns/{dropdown_id}/options", response_model=list[DropdownOptionOut])
def ListDropdownOptions(
    dropdown_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[DropdownOptionOut]:
    return [_dropdown_option_out(entry) for entry in services.ListDropdownOptions(db, dropdown_id)]


@router.post(
    "/dropdowns/{dropdown_id}/options",
    response_model=DropdownOptionOut,
    status_code=status.HTTP_201_CREATED,
)
def CreateDropdownOption(
    dropdown_id: int,
    payload: DropdownOptionCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DropdownOptionOut:
    record = services.CreateDropdownOption(db, dropdown_id, payload.dict())
    return _dropdown_option_out(record)


@router.put("/dropdowns/options/{option_id}", response_model=DropdownOptionOut)
def UpdateDropdownOption(
    option_id: int,
    payload: DropdownOptionUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> DropdownOptionOut:
    record = services.UpdateDropdownOption(db, option_id, payload.dict())
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")
    return _dropdown_option_out(record)


@router.get("/people", response_model=list[PersonOut])
def ListPeople(
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[PersonOut]:
    return [_person_out(entry) for entry in services.ListPeople(db)]


@router.post("/people", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
def CreatePerson(
    payload: PersonCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> PersonOut:
    record = services.CreatePerson(db, payload.dict())
    return _person_out(record)


@router.put("/people/{person_id}", response_model=PersonOut)
def UpdatePerson(
    person_id: int,
    payload: PersonUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> PersonOut:
    record = services.UpdatePerson(db, person_id, payload.dict())
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return _person_out(record)


@router.get("/categories/{category_id}/records", response_model=list[RecordOut])
def ListRecords(
    category_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[RecordOut]:
    return [_record_out(entry) for entry in services.ListRecords(db, category_id)]


@router.post("/categories/{category_id}/records", response_model=RecordOut, status_code=status.HTTP_201_CREATED)
def CreateRecord(
    category_id: int,
    payload: RecordCreate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> RecordOut:
    try:
        record = services.CreateRecord(db, category_id, user.Id, payload.dict())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _record_out(record)


@router.put("/records/{record_id}", response_model=RecordOut)
def UpdateRecord(
    record_id: int,
    payload: RecordUpdate,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> RecordOut:
    try:
        record = services.UpdateRecord(db, record_id, user.Id, payload.dict())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return _record_out(record)


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def DeleteRecord(
    record_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=True)),
) -> None:
    if not services.DeleteRecord(db, record_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")


@router.get("/categories/{category_id}/records/lookup", response_model=list[RecordLookupOut])
def ListRecordLookup(
    category_id: int,
    db: Session = Depends(GetDb),
    user: UserContext = Depends(RequireModuleRole("life_admin", write=False)),
) -> list[RecordLookupOut]:
    records = services.ListRecordLookup(db, category_id)
    return [
        RecordLookupOut(Id=entry.Id, Title=entry.Title or f"Record {entry.Id}") for entry in records
    ]
