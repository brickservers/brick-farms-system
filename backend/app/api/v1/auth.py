from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token
from app.config import settings
from jose import JWTError, jwt
from app.services.notifications import send_email, send_sms
import base64
import hashlib
import hmac
import secrets
from datetime import date

router = APIRouter(tags=["auth"])


def hash_password(password: str) -> str:
    iterations = 260000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

class SignupInput(BaseModel):
    tenant_name: str = Field(..., min_length=2, max_length=200)
    country: str = Field(..., min_length=2, max_length=2)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=120)
    last_name: str = Field(..., min_length=1, max_length=120)
    phone: str = Field(..., min_length=5, max_length=40)
    dob: date

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str):
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Valid email is required")
        return normalized

    @field_validator("country")
    @classmethod
    def normalize_country(cls, value: str):
        return value.upper()

@router.post("/signup")
async def signup(data: SignupInput, db: AsyncSession = Depends(get_db)):
    t_res = await db.execute(select(Tenant).where(Tenant.name == data.tenant_name))
    if t_res.scalar_one_or_none():
        raise HTTPException(400, "Tenant exists")
    tenant = Tenant(name=data.tenant_name, plan="free", country=data.country)
    db.add(tenant); await db.flush()
    user = User(
        tenant_id=tenant.id,
        email=data.email,
        hashed_password=hash_password(data.password),
        role="owner",
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        phone=data.phone.strip(),
        dob=data.dob,
    )
    db.add(user); await db.flush()
    await db.execute(text("""
    INSERT INTO membership (tenant_id, user_id, role)
    VALUES (:tenant_id, :user_id, :role)
    """), {"tenant_id": str(tenant.id), "user_id": str(user.id), "role": "owner"})
    await db.commit()
    await send_email(
        user.email,
        "Welcome to BrickFarms DAP",
        f"Hello {user.first_name},\n\nYour BrickFarms Digital Agricultural Platform workspace ({tenant.name}) is ready.\n\nSigned,\nBrickServers NG Limited",
    )
    await send_sms(user.phone, f"Welcome to BrickFarms DAP. Your workspace {tenant.name} is ready.")
    access = create_access_token(str(user.id), str(user.tenant_id), user.role)
    refresh = create_refresh_token(str(user.id), str(user.tenant_id))
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}

class LoginInput(BaseModel):
    email: str
    password: str

class RefreshInput(BaseModel):
    refresh_token: str

@router.post("/token")
async def token(data: LoginInput, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == data.email))
    user = res.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(data.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    access = create_access_token(str(user.id), str(user.tenant_id), user.role)
    refresh = create_refresh_token(str(user.id), str(user.tenant_id))
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}

@router.post("/refresh")
async def refresh_token(data: RefreshInput, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(data.refresh_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except JWTError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(401, "Invalid refresh token")
    res = await db.execute(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid refresh token")
    access = create_access_token(str(user.id), str(user.tenant_id), user.role)
    refresh = create_refresh_token(str(user.id), str(user.tenant_id))
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}
