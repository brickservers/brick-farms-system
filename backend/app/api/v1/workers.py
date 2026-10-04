from datetime import date
from decimal import Decimal
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import tenant_scoped_user
from app.services.plan_limits import assert_plan_limit

router = APIRouter(tags=["workers"])

WORKER_STATUSES = {"active", "on_leave", "inactive"}


class WorkerIn(BaseModel):
    farm_id: Optional[UUID] = None
    full_name: str = Field(..., min_length=1, max_length=180)
    role: str = Field(default="field_worker", max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=255)
    status: str = "active"
    hourly_rate: Optional[Decimal] = None
    currency: str = Field(default="NGN", min_length=3, max_length=3)
    hired_at: Optional[date] = None
    emergency_contact: Optional[str] = Field(default=None, max_length=180)
    skills: list[str] = Field(default_factory=list)
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        if value not in WORKER_STATUSES:
            raise ValueError("status must be active, on_leave, or inactive")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str):
        return value.upper()


class WorkerPatch(BaseModel):
    farm_id: Optional[UUID] = None
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    role: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=255)
    status: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    hired_at: Optional[date] = None
    emergency_contact: Optional[str] = Field(default=None, max_length=180)
    skills: Optional[list[str]] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]):
        if value is not None and value not in WORKER_STATUSES:
            raise ValueError("status must be active, on_leave, or inactive")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]):
        return value.upper() if value else value


def _worker_row(row):
    data = dict(row._mapping)
    if isinstance(data.get("skills"), str):
        data["skills"] = json.loads(data["skills"])
    if data.get("hourly_rate") is not None:
        data["hourly_rate"] = float(data["hourly_rate"])
    return data


async def _ensure_farm_access(db: AsyncSession, tenant_id: str, farm_id: Optional[str]):
    if not farm_id:
        return
    res = await db.execute(
        text("SELECT id FROM farm WHERE id = :farm_id AND tenant_id = :tenant_id"),
        {"farm_id": farm_id, "tenant_id": tenant_id},
    )
    if not res.first():
        raise HTTPException(400, "Farm must belong to this tenant")


@router.get("")
async def list_workers(
    status: Optional[str] = Query(None),
    farm_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    ctx=Depends(tenant_scoped_user),
):
    token, db = ctx
    db: AsyncSession
    query = """
    SELECT w.id, w.tenant_id, w.farm_id, f.name AS farm_name, w.full_name, w.role,
           w.phone, w.email, w.status, w.hourly_rate, w.currency, w.hired_at,
           w.emergency_contact, w.skills, w.notes, w.created_at, w.updated_at,
           COUNT(t.id) FILTER (WHERE t.status IN ('pending', 'in_progress')) AS open_tasks
    FROM farm_worker w
    LEFT JOIN farm f ON f.id = w.farm_id AND f.tenant_id = w.tenant_id
    LEFT JOIN task t ON t.worker_id = w.id AND t.tenant_id = w.tenant_id
    WHERE w.tenant_id = :tenant_id
    """
    params = {"tenant_id": str(token.tenant_id)}
    if status:
        if status not in WORKER_STATUSES:
            raise HTTPException(400, "Invalid worker status")
        query += " AND w.status = :status"
        params["status"] = status
    if farm_id:
        query += " AND w.farm_id = :farm_id"
        params["farm_id"] = str(farm_id)
    if search:
        query += " AND (w.full_name ILIKE :search OR w.role ILIKE :search OR w.phone ILIKE :search)"
        params["search"] = f"%{search}%"
    query += """
    GROUP BY w.id, f.name
    ORDER BY CASE w.status WHEN 'active' THEN 1 WHEN 'on_leave' THEN 2 ELSE 3 END,
             w.full_name ASC
    LIMIT 500
    """
    res = await db.execute(text(query), params)
    return [_worker_row(row) for row in res.fetchall()]


@router.post("")
async def create_worker(payload: WorkerIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    await assert_plan_limit(db, str(token.tenant_id), "workers")
    values = payload.model_dump()
    values.update(
        tenant_id=str(token.tenant_id),
        farm_id=str(values["farm_id"]) if values.get("farm_id") else None,
        hired_at=values["hired_at"].isoformat() if values.get("hired_at") else None,
        skills=json.dumps(values.get("skills") or []),
    )
    await _ensure_farm_access(db, values["tenant_id"], values["farm_id"])
    try:
        res = await db.execute(text("""
        INSERT INTO farm_worker (
            tenant_id, farm_id, full_name, role, phone, email, status, hourly_rate,
            currency, hired_at, emergency_contact, skills, notes
        )
        VALUES (
            :tenant_id, :farm_id, :full_name, :role, :phone, :email, :status,
            :hourly_rate, :currency, :hired_at, :emergency_contact, CAST(:skills AS jsonb), :notes
        )
        RETURNING *
        """), values)
        row = res.first()
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(400, "Could not create worker. Check duplicate phone/email and farm access.") from exc
    return _worker_row(row)


@router.put("/{worker_id}")
async def update_worker(worker_id: UUID, payload: WorkerPatch, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "No worker changes supplied")
    if "farm_id" in data:
        await _ensure_farm_access(db, str(token.tenant_id), str(data["farm_id"]) if data["farm_id"] else None)
    assignments = []
    params = {"tenant_id": str(token.tenant_id), "worker_id": str(worker_id)}
    for key, value in data.items():
        if key == "skills":
            assignments.append("skills = CAST(:skills AS jsonb)")
            params["skills"] = json.dumps(value or [])
        elif key in {"farm_id"}:
            assignments.append(f"{key} = :{key}")
            params[key] = str(value) if value else None
        elif key == "hired_at":
            assignments.append("hired_at = :hired_at")
            params[key] = value.isoformat() if value else None
        else:
            assignments.append(f"{key} = :{key}")
            params[key] = value
    try:
        res = await db.execute(text(f"""
        UPDATE farm_worker
        SET {', '.join(assignments)}, updated_at = now()
        WHERE id = :worker_id AND tenant_id = :tenant_id
        RETURNING *
        """), params)
        row = res.first()
        if not row:
            raise HTTPException(404, "Worker not found")
        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(400, "Could not update worker. Check duplicate phone/email and farm access.") from exc
    return _worker_row(row)


@router.delete("/{worker_id}")
async def deactivate_worker(worker_id: UUID, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    res = await db.execute(text("""
    UPDATE farm_worker
    SET status = 'inactive', updated_at = now()
    WHERE id = :worker_id AND tenant_id = :tenant_id
    RETURNING id
    """), {"worker_id": str(worker_id), "tenant_id": str(token.tenant_id)})
    row = res.first()
    if not row:
        raise HTTPException(404, "Worker not found")
    await db.commit()
    return {"id": str(row.id), "status": "inactive"}
