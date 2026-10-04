from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import tenant_scoped_user
from app.api.v1.auth import hash_password
from app.services.notifications import send_email
from app.services.plan_limits import assert_plan_limit

router = APIRouter(tags=["team"])

TEAM_ROLES = {
    "owner",
    "admin",
    "agronomist",
    "field_worker",
    "accountant",
    "investor",
    "auditor",
    "gov_viewer",
}
MANAGER_ROLES = {"owner", "admin"}


class TeamUserIn(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = "field_worker"

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str):
        if value not in TEAM_ROLES:
            raise ValueError("Invalid team role")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str):
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Valid email is required")
        return normalized


class TeamUserPatch(BaseModel):
    role: str | None = None
    is_active: bool | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None):
        if value is not None and value not in TEAM_ROLES:
            raise ValueError("Invalid team role")
        return value


def _require_team_manager(token):
    if token.role not in MANAGER_ROLES:
        raise HTTPException(403, "Only tenant owners and admins can manage team users")


def _row_to_team_user(row):
    data = dict(row._mapping)
    data["id"] = str(data["id"])
    data["tenant_id"] = str(data["tenant_id"])
    return data


@router.get("")
async def list_team(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    _require_team_manager(token)
    res = await db.execute(text("""
    SELECT id, tenant_id, email, role, is_active
    FROM "user"
    WHERE tenant_id = :tenant_id
    ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, email ASC
    LIMIT 500
    """), {"tenant_id": str(token.tenant_id)})
    return [_row_to_team_user(row) for row in res.fetchall()]


@router.post("")
async def create_team_user(payload: TeamUserIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    _require_team_manager(token)
    await assert_plan_limit(db, str(token.tenant_id), "users")
    try:
        res = await db.execute(text("""
        INSERT INTO "user" (tenant_id, email, hashed_password, is_active, role)
        VALUES (:tenant_id, :email, :hashed_password, true, :role)
        RETURNING id, tenant_id, email, role, is_active
        """), {
            "tenant_id": str(token.tenant_id),
            "email": payload.email.lower(),
            "hashed_password": hash_password(payload.password),
            "role": payload.role,
        })
        row = res.first()
        await db.execute(text("""
        INSERT INTO membership (tenant_id, user_id, role)
        VALUES (:tenant_id, :user_id, :role)
        """), {"tenant_id": str(token.tenant_id), "user_id": str(row.id), "role": payload.role})
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(400, "Could not create user. Email may already exist.") from exc
    await send_email(
        payload.email,
        "Your BrickFarms DAP account is ready",
        "A BrickFarms Digital Agricultural Platform account has been created for you.\n\n"
        f"Role: {payload.role}\n"
        "Login with this email and the temporary password shared by your workspace admin.\n\n"
        "Signed,\nBrickServers NG Limited",
    )
    return _row_to_team_user(row)


@router.patch("/{user_id}")
async def update_team_user(user_id: UUID, payload: TeamUserPatch, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    _require_team_manager(token)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "No team user changes supplied")
    if str(user_id) == str(token.sub) and data.get("is_active") is False:
        raise HTTPException(400, "You cannot deactivate your own account")

    assignments = []
    params = {"tenant_id": str(token.tenant_id), "user_id": str(user_id)}
    if "role" in data:
        assignments.append("role = :role")
        params["role"] = data["role"]
    if "is_active" in data:
        assignments.append("is_active = :is_active")
        params["is_active"] = data["is_active"]

    try:
        res = await db.execute(text(f"""
        UPDATE "user"
        SET {', '.join(assignments)}
        WHERE id = :user_id AND tenant_id = :tenant_id
        RETURNING id, tenant_id, email, role, is_active
        """), params)
        row = res.first()
        if not row:
            raise HTTPException(404, "Team user not found")
        if "role" in data:
            await db.execute(text("""
            UPDATE membership
            SET role = :role
            WHERE user_id = :user_id AND tenant_id = :tenant_id
            """), params)
        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(400, "Could not update team user") from exc
    return _row_to_team_user(row)


@router.delete("/{user_id}")
async def deactivate_team_user(user_id: UUID, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    db: AsyncSession
    _require_team_manager(token)
    if str(user_id) == str(token.sub):
        raise HTTPException(400, "You cannot deactivate your own account")
    res = await db.execute(text("""
    UPDATE "user"
    SET is_active = false
    WHERE id = :user_id AND tenant_id = :tenant_id
    RETURNING id, tenant_id, email, role, is_active
    """), {"user_id": str(user_id), "tenant_id": str(token.tenant_id)})
    row = res.first()
    if not row:
        raise HTTPException(404, "Team user not found")
    await db.commit()
    return _row_to_team_user(row)
