import json
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import tenant_scoped_user

router = APIRouter(tags=["assets"])


class AssetIn(BaseModel):
    farm_id: UUID
    plot_id: Optional[UUID] = None
    name: str = Field(..., min_length=1, max_length=180)
    asset_type: str = "tool"
    status: str = "active"
    quantity: Decimal = Decimal("1")
    unit: Optional[str] = None
    value: Optional[Decimal] = None
    currency: str = "NGN"
    acquired_at: Optional[str] = None
    location_note: Optional[str] = None
    meta: dict = Field(default_factory=dict)


class AnimalGroupIn(BaseModel):
    farm_id: UUID
    plot_id: Optional[UUID] = None
    name: str = Field(..., min_length=1, max_length=180)
    species: str = Field(..., min_length=1, max_length=80)
    breed: Optional[str] = None
    count: int = 0
    age_value: Optional[Decimal] = None
    age_unit: Optional[str] = None
    sex: Optional[str] = None
    health_status: Optional[str] = None
    purpose: Optional[str] = None
    housing_asset_id: Optional[UUID] = None
    meta: dict = Field(default_factory=dict)


def _json_row(row):
    data = dict(row._mapping)
    for key in ("id", "tenant_id", "farm_id", "plot_id", "housing_asset_id"):
      if data.get(key) is not None:
          data[key] = str(data[key])
    for key in ("quantity", "value", "age_value"):
      if data.get(key) is not None:
          data[key] = float(data[key])
    if isinstance(data.get("meta"), str):
        data["meta"] = json.loads(data["meta"])
    return data


async def _ensure_farm(db: AsyncSession, tenant_id: str, farm_id: str):
    res = await db.execute(text("SELECT id FROM farm WHERE id = :farm_id AND tenant_id = :tenant_id"), {"farm_id": farm_id, "tenant_id": tenant_id})
    if not res.first():
        raise HTTPException(400, "Farm must belong to this tenant")


@router.get("")
async def list_assets(farm_id: Optional[UUID] = Query(None), plot_id: Optional[UUID] = Query(None), asset_type: Optional[str] = Query(None), ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    filters = ["a.tenant_id = :tenant_id"]
    params = {"tenant_id": str(token.tenant_id)}
    if farm_id:
        filters.append("a.farm_id = :farm_id")
        params["farm_id"] = str(farm_id)
    if plot_id:
        filters.append("a.plot_id = :plot_id")
        params["plot_id"] = str(plot_id)
    if asset_type:
        filters.append("a.asset_type = :asset_type")
        params["asset_type"] = asset_type
    res = await db.execute(text(f"""
    SELECT a.*, f.name AS farm_name, p.name AS plot_name
    FROM farm_asset a
    LEFT JOIN farm f ON f.id = a.farm_id
    LEFT JOIN plots p ON p.id = a.plot_id
    WHERE {' AND '.join(filters)}
    ORDER BY a.created_at DESC
    LIMIT 1000
    """), params)
    return [_json_row(row) for row in res.fetchall()]


@router.post("")
async def create_asset(payload: AssetIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    await _ensure_farm(db, str(token.tenant_id), str(payload.farm_id))
    data = payload.model_dump()
    data.update(tenant_id=str(token.tenant_id), farm_id=str(payload.farm_id), plot_id=str(payload.plot_id) if payload.plot_id else None, meta=json.dumps(payload.meta or {}))
    res = await db.execute(text("""
    INSERT INTO farm_asset (tenant_id, farm_id, plot_id, name, asset_type, status, quantity, unit, value, currency, acquired_at, location_note, meta)
    VALUES (:tenant_id, :farm_id, :plot_id, :name, :asset_type, :status, :quantity, :unit, :value, :currency, :acquired_at, :location_note, CAST(:meta AS jsonb))
    RETURNING *
    """), data)
    row = res.first()
    await db.commit()
    return _json_row(row)


@router.get("/animals")
async def list_animals(farm_id: Optional[UUID] = Query(None), plot_id: Optional[UUID] = Query(None), ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    filters = ["g.tenant_id = :tenant_id"]
    params = {"tenant_id": str(token.tenant_id)}
    if farm_id:
        filters.append("g.farm_id = :farm_id")
        params["farm_id"] = str(farm_id)
    if plot_id:
        filters.append("g.plot_id = :plot_id")
        params["plot_id"] = str(plot_id)
    res = await db.execute(text(f"""
    SELECT g.*, f.name AS farm_name, p.name AS plot_name, a.name AS housing_asset_name
    FROM animal_group g
    LEFT JOIN farm f ON f.id = g.farm_id
    LEFT JOIN plots p ON p.id = g.plot_id
    LEFT JOIN farm_asset a ON a.id = g.housing_asset_id
    WHERE {' AND '.join(filters)}
    ORDER BY g.created_at DESC
    LIMIT 1000
    """), params)
    return [_json_row(row) for row in res.fetchall()]


@router.post("/animals")
async def create_animal_group(payload: AnimalGroupIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    await _ensure_farm(db, str(token.tenant_id), str(payload.farm_id))
    data = payload.model_dump()
    data.update(
        tenant_id=str(token.tenant_id),
        farm_id=str(payload.farm_id),
        plot_id=str(payload.plot_id) if payload.plot_id else None,
        housing_asset_id=str(payload.housing_asset_id) if payload.housing_asset_id else None,
        meta=json.dumps(payload.meta or {}),
    )
    res = await db.execute(text("""
    INSERT INTO animal_group (tenant_id, farm_id, plot_id, name, species, breed, count, age_value, age_unit, sex, health_status, purpose, housing_asset_id, meta)
    VALUES (:tenant_id, :farm_id, :plot_id, :name, :species, :breed, :count, :age_value, :age_unit, :sex, :health_status, :purpose, :housing_asset_id, CAST(:meta AS jsonb))
    RETURNING *
    """), data)
    row = res.first()
    await db.commit()
    return _json_row(row)
