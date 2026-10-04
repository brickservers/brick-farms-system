from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import tenant_scoped_user
from app.schemas.preferences import PreferenceIn, PreferenceOut
from sqlalchemy import text
import json

router = APIRouter(tags=["preferences"])


@router.get('/preferences', response_model=list[PreferenceOut])
async def list_preferences(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    q = "SELECT id, key, value, created_at, updated_at FROM user_preferences WHERE tenant_id = :tid AND user_id = :uid"
    res = await db.execute(text(q), {"tid": token.tenant_id, "uid": token.sub})
    rows = res.fetchall()
    out = []
    for r in rows:
        out.append(PreferenceOut(id=r.id, key=r.key, value=r.value, created_at=r.created_at, updated_at=r.updated_at))
    return out


@router.put('/preferences/{key}', response_model=PreferenceOut)
async def upsert_preference(key: str, payload: PreferenceIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    if key != payload.key:
        raise HTTPException(status_code=400, detail="Key mismatch")
    # upsert
    q = text("""
    INSERT INTO user_preferences (tenant_id, user_id, key, value)
    VALUES (:tid, :uid, :key, CAST(:value AS jsonb))
    ON CONFLICT (tenant_id, user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING id, key, value, created_at, updated_at
    """)
    res = await db.execute(q, {"tid": token.tenant_id, "uid": token.sub, "key": key, "value": json.dumps(payload.value)})
    row = res.fetchone()
    await db.commit()
    return PreferenceOut(id=row.id, key=row.key, value=row.value, created_at=row.created_at, updated_at=row.updated_at)
