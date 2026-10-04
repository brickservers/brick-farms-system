from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.api.deps import tenant_scoped_user
from app.models.tenant import Tenant
from app.services.plan_limits import get_plan_limits

router = APIRouter(tags=["tenants"])

class TenantOut(BaseModel):
    id: str
    name: str
    plan: str
    user_name: str | None = None
    user_email: str | None = None
    limits: dict | None = None
    class Config: from_attributes = True

@router.get("/me", response_model=TenantOut)
async def my_tenant(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(select(Tenant).where(Tenant.id == token.tenant_id))
    tenant = res.scalar_one()
    user_res = await db.execute(text('SELECT first_name, last_name, email FROM "user" WHERE id = :user_id'), {"user_id": token.sub})
    user = user_res.first()
    user_name = None
    user_email = None
    if user:
        user_email = user.email
        user_name = " ".join(part for part in [user.first_name, user.last_name] if part) or user.email
    limits = get_plan_limits(tenant.plan)
    return {"id": str(tenant.id), "name": tenant.name, "plan": tenant.plan, "user_name": user_name, "user_email": user_email, "limits": {key: ("unlimited" if value == float("inf") else value) for key, value in limits.items()}}
