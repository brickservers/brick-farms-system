import csv
import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import tenant_scoped_user

router = APIRouter(tags=["farm-plans"])


class FarmPlanIn(BaseModel):
    farm_id: Optional[UUID] = None
    name: str = Field(..., min_length=1, max_length=200)
    plan_type: str = "farm_plan"
    scope_type: str = "farm"
    period_type: str = "season"
    starts_on: Optional[str] = None
    ends_on: Optional[str] = None
    status: str = "draft"
    notes: Optional[str] = None


class PlanActivityIn(BaseModel):
    farm_id: Optional[UUID] = None
    plot_id: Optional[UUID] = None
    animal_group_id: Optional[UUID] = None
    crop: Optional[str] = None
    title: str
    description: Optional[str] = None
    activity_type: Optional[str] = None
    starts_on: Optional[str] = None
    due_on: Optional[str] = None
    repeat_rule: Optional[str] = None
    worker_role: Optional[str] = None
    estimated_cost: Optional[float] = None
    priority: str = "normal"
    create_task: bool = True


def _row(row):
    data = dict(row._mapping)
    for key in ("id", "tenant_id", "farm_id", "plan_id", "plot_id", "animal_group_id", "task_id", "created_by"):
        if data.get(key) is not None:
            data[key] = str(data[key])
    if data.get("estimated_cost") is not None:
        data["estimated_cost"] = float(data["estimated_cost"])
    return data


@router.get("")
async def list_plans(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(text("""
    SELECT p.*, f.name AS farm_name, COUNT(a.id) AS activity_count
    FROM farm_plan p
    LEFT JOIN farm f ON f.id = p.farm_id AND f.tenant_id = p.tenant_id
    LEFT JOIN farm_plan_activity a ON a.plan_id = p.id
    WHERE p.tenant_id = :tenant_id
    GROUP BY p.id, f.name
    ORDER BY p.created_at DESC
    LIMIT 500
    """), {"tenant_id": str(token.tenant_id)})
    return [_row(item) for item in res.fetchall()]


@router.post("")
async def create_plan(payload: FarmPlanIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    if payload.farm_id:
        farm = await db.execute(text("SELECT id FROM farm WHERE id = :farm_id AND tenant_id = :tenant_id"), {"farm_id": str(payload.farm_id), "tenant_id": str(token.tenant_id)})
        if not farm.first():
            raise HTTPException(400, "Farm must belong to this tenant")
    res = await db.execute(text("""
    INSERT INTO farm_plan (tenant_id, farm_id, name, plan_type, scope_type, period_type, starts_on, ends_on, status, notes, created_by)
    VALUES (:tenant_id, :farm_id, :name, :plan_type, :scope_type, :period_type, :starts_on, :ends_on, :status, :notes, :created_by)
    RETURNING *
    """), {
        **payload.model_dump(),
        "tenant_id": str(token.tenant_id),
        "farm_id": str(payload.farm_id) if payload.farm_id else None,
        "created_by": token.sub,
    })
    row = res.first()
    await db.commit()
    return _row(row)


@router.get("/{plan_id}/activities")
async def list_activities(plan_id: UUID, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(text("""
    SELECT a.*, f.name AS farm_name, p.name AS plot_name, g.name AS animal_group_name
    FROM farm_plan_activity a
    LEFT JOIN farm f ON f.id = a.farm_id
    LEFT JOIN plots p ON p.id = a.plot_id
    LEFT JOIN animal_group g ON g.id = a.animal_group_id
    WHERE a.plan_id = :plan_id AND a.tenant_id = :tenant_id
    ORDER BY a.due_on NULLS LAST, a.created_at
    """), {"plan_id": str(plan_id), "tenant_id": str(token.tenant_id)})
    return [_row(item) for item in res.fetchall()]


@router.post("/{plan_id}/activities")
async def create_activity(plan_id: UUID, payload: PlanActivityIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    plan_res = await db.execute(text("SELECT id, farm_id FROM farm_plan WHERE id = :plan_id AND tenant_id = :tenant_id"), {"plan_id": str(plan_id), "tenant_id": str(token.tenant_id)})
    plan = plan_res.first()
    if not plan:
        raise HTTPException(404, "Farm plan not found")
    farm_id = str(payload.farm_id or plan.farm_id) if (payload.farm_id or plan.farm_id) else None
    task_id = None
    if payload.create_task:
        task_res = await db.execute(text("""
        INSERT INTO task (tenant_id, farm_id, title, description, status, due_at, meta)
        VALUES (:tenant_id, :farm_id, :title, :description, 'pending', :due_at, jsonb_build_object('source','farm_plan','plan_id',:plan_id))
        RETURNING id
        """), {"tenant_id": str(token.tenant_id), "farm_id": farm_id, "title": payload.title, "description": payload.description, "due_at": payload.due_on, "plan_id": str(plan_id)})
        task_id = str(task_res.first().id)
    res = await db.execute(text("""
    INSERT INTO farm_plan_activity (tenant_id, plan_id, farm_id, plot_id, animal_group_id, crop, title, description, activity_type, starts_on, due_on, repeat_rule, worker_role, estimated_cost, priority, task_id)
    VALUES (:tenant_id, :plan_id, :farm_id, :plot_id, :animal_group_id, :crop, :title, :description, :activity_type, :starts_on, :due_on, :repeat_rule, :worker_role, :estimated_cost, :priority, :task_id)
    RETURNING *
    """), {
        **payload.model_dump(exclude={"create_task"}),
        "tenant_id": str(token.tenant_id),
        "plan_id": str(plan_id),
        "farm_id": farm_id,
        "plot_id": str(payload.plot_id) if payload.plot_id else None,
        "animal_group_id": str(payload.animal_group_id) if payload.animal_group_id else None,
        "task_id": task_id,
    })
    row = res.first()
    await db.commit()
    return _row(row)


@router.get("/template.csv")
async def download_template():
    headers = ["plan_name", "farm_name", "scope_type", "period_type", "starts_on", "ends_on", "activity_title", "activity_type", "crop", "animal_group", "plot_name", "due_on", "repeat_rule", "worker_role", "estimated_cost", "priority", "description"]
    sample = ["Dry season maize plan", "Primary Farm", "farm", "season", "2026-11-01", "2027-03-30", "Soil test and land preparation", "land_preparation", "maize", "", "North Plot", "2026-11-05", "", "field_worker", "25000", "high", "Prepare soil before planting"]
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(headers)
    writer.writerow(sample)
    stream.seek(0)
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=farm-plan-template.csv"})


@router.post("/upload")
async def upload_plan_template(file: UploadFile = File(...), ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    plan_cache: dict[str, str] = {}
    for item in reader:
        plan_name = (item.get("plan_name") or "Imported farm plan").strip()
        if plan_name not in plan_cache:
            plan_res = await db.execute(text("""
            INSERT INTO farm_plan (tenant_id, name, scope_type, period_type, starts_on, ends_on, status, created_by)
            VALUES (:tenant_id, :name, :scope_type, :period_type, :starts_on, :ends_on, 'draft', :created_by)
            RETURNING id
            """), {
                "tenant_id": str(token.tenant_id),
                "name": plan_name,
                "scope_type": item.get("scope_type") or "farm",
                "period_type": item.get("period_type") or "season",
                "starts_on": item.get("starts_on") or None,
                "ends_on": item.get("ends_on") or None,
                "created_by": token.sub,
            })
            plan_cache[plan_name] = str(plan_res.first().id)
        title = (item.get("activity_title") or "").strip()
        if not title:
            continue
        task_res = await db.execute(text("""
        INSERT INTO task (tenant_id, title, description, status, due_at, meta)
        VALUES (:tenant_id, :title, :description, 'pending', :due_at, jsonb_build_object('source','farm_plan_upload','plan_id',:plan_id,'worker_role',:worker_role))
        RETURNING id
        """), {
            "tenant_id": str(token.tenant_id),
            "title": title,
            "description": item.get("description") or None,
            "due_at": item.get("due_on") or None,
            "plan_id": plan_cache[plan_name],
            "worker_role": item.get("worker_role") or None,
        })
        task_id = str(task_res.first().id)
        await db.execute(text("""
        INSERT INTO farm_plan_activity (tenant_id, plan_id, crop, title, description, activity_type, starts_on, due_on, repeat_rule, worker_role, estimated_cost, priority, task_id)
        VALUES (:tenant_id, :plan_id, :crop, :title, :description, :activity_type, :starts_on, :due_on, :repeat_rule, :worker_role, :estimated_cost, :priority, :task_id)
        """), {
            "tenant_id": str(token.tenant_id),
            "plan_id": plan_cache[plan_name],
            "crop": item.get("crop") or None,
            "title": title,
            "description": item.get("description") or None,
            "activity_type": item.get("activity_type") or None,
            "starts_on": item.get("starts_on") or None,
            "due_on": item.get("due_on") or None,
            "repeat_rule": item.get("repeat_rule") or None,
            "worker_role": item.get("worker_role") or None,
            "estimated_cost": item.get("estimated_cost") or None,
            "priority": item.get("priority") or "normal",
            "task_id": task_id,
        })
        created += 1
    await db.commit()
    return {"plans": len(plan_cache), "activities": created}
