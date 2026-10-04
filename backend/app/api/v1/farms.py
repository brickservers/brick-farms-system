from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import tenant_scoped_user
from app.models.farm import Farm
from app.services.plan_limits import assert_plan_limit

router = APIRouter(tags=["farms"])

class FarmIn(BaseModel):
    name: str
    country: str
    state: str | None = None
    lga: str | None = None
    farm_type: str = "crop"

class FarmOut(FarmIn):
    id: str
    class Config: from_attributes = True

def _farm_out(farm: Farm):
    return {
        "id": str(farm.id),
        "name": farm.name,
        "country": farm.country,
        "state": farm.state,
        "lga": farm.lga,
        "farm_type": farm.farm_type or "crop",
    }

@router.post("/", response_model=FarmOut)
async def create_farm(data: FarmIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    await assert_plan_limit(db, str(token.tenant_id), "farms")
    farm = Farm(tenant_id=token.tenant_id, **data.model_dump())
    db.add(farm); await db.commit(); await db.refresh(farm)
    return _farm_out(farm)

@router.get("/", response_model=list[FarmOut])
async def list_farms(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(select(Farm).where(Farm.tenant_id == token.tenant_id).order_by(Farm.name))
    return [_farm_out(farm) for farm in res.scalars().all()]
