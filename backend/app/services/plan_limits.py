from math import inf

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


PLAN_LIMITS = {
    "free": {"farms": 1, "plots": 1, "sensors": 0, "users": 1, "workers": 1},
    "sprout": {"farms": 1, "plots": 4, "sensors": 4, "users": 4, "workers": 4},
    "growth": {"farms": 2, "plots": 10, "sensors": 5, "users": 10, "workers": 10},
    "enterprise": {"farms": inf, "plots": inf, "sensors": inf, "users": inf, "workers": inf},
    "demo": {"farms": inf, "plots": inf, "sensors": inf, "users": inf, "workers": inf},
}

RESOURCE_TABLES = {
    "farms": ("farm", "tenant_id"),
    "plots": ("plots", "tenant_id"),
    "sensors": ("sensor_devices", "tenant_id"),
    "users": ('"user"', "tenant_id"),
    "workers": ("farm_worker", "tenant_id"),
}


def get_plan_limits(plan: str | None):
    return PLAN_LIMITS.get((plan or "free").lower(), PLAN_LIMITS["free"])


async def get_tenant_plan(db: AsyncSession, tenant_id: str) -> str:
    res = await db.execute(text("SELECT plan FROM tenant WHERE id = :tenant_id"), {"tenant_id": tenant_id})
    row = res.first()
    return (row.plan if row else "free") or "free"


async def assert_plan_limit(db: AsyncSession, tenant_id: str, resource: str) -> None:
    plan = await get_tenant_plan(db, tenant_id)
    limit = get_plan_limits(plan).get(resource, 0)
    if limit == inf:
        return
    table, tenant_column = RESOURCE_TABLES[resource]
    extra = " AND is_active = true" if resource == "users" else ""
    res = await db.execute(text(f"SELECT COUNT(*) AS total FROM {table} WHERE {tenant_column} = :tenant_id{extra}"), {"tenant_id": tenant_id})
    total = int(res.scalar() or 0)
    if total >= int(limit):
        raise HTTPException(
            status_code=403,
            detail=f"Your {plan} plan allows {int(limit)} {resource}. Upgrade your plan to add more.",
        )
