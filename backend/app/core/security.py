from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

class TokenData(BaseModel):
    sub: str
    tenant_id: Optional[str] = None
    role: Optional[str] = None
    type: Optional[str] = None

def create_access_token(subject: str, tenant_id: str, role: str, expires_minutes: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES):
    to_encode = {"sub": subject, "tenant_id": tenant_id, "role": role, "type": "access"}
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

def create_refresh_token(subject: str, tenant_id: str, expires_minutes: int = settings.REFRESH_TOKEN_EXPIRE_MINUTES):
    to_encode = {"sub": subject, "tenant_id": tenant_id, "type": "refresh"}
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return TokenData(sub=payload.get("sub"),
                         tenant_id=payload.get("tenant_id"),
                         role=payload.get("role"),
                         type=payload.get("type"))
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
