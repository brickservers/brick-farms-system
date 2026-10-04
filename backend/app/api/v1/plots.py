from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.db.session import get_db
from app.schemas.plot import PlotCreate, PlotOut, PlotUpdate
from app.api.deps import tenant_scoped_user
from app.core.security import TokenData
from app.services.geoservice import invalidate_tiles_for_bbox
from app.services.plan_limits import assert_plan_limit

router = APIRouter(tags=["plots"])


def check_role_can_write(token: TokenData):
    if not token or token.role not in ("owner", "admin", "agronomist"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role privileges")


def check_role_can_read(token: TokenData):
    if not token or token.role not in ("owner", "admin", "agronomist", "field_worker", "accountant", "investor", "auditor", "gov_viewer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role privileges")


@router.post("/plots", response_model=PlotOut, status_code=status.HTTP_201_CREATED)
async def create_plot(payload: PlotCreate, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    check_role_can_write(token)
    await assert_plan_limit(db, str(token.tenant_id), "plots")
    farm_res = await db.execute(text("SELECT id FROM farm WHERE id = :farm_id AND tenant_id = :tenant_id"), {"farm_id": str(payload.farm_id), "tenant_id": str(token.tenant_id)})
    if not farm_res.first():
        raise HTTPException(status_code=400, detail="Farm must belong to this tenant")
    geom_json = json.dumps(payload.geom_geojson.dict())
    sql = text(
        """
        INSERT INTO plots (tenant_id, farm_id, name, description, crop_type, area_ha, geom)
        VALUES (:tenant_id, :farm_id, :name, :description, :crop_type,
               ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(:geom_json),4326),6933))/10000.0,
               ST_SetSRID(ST_GeomFromGeoJSON(:geom_json), 4326))
        RETURNING id, tenant_id, farm_id, name, description, crop_type, area_ha, ST_AsGeoJSON(geom) as geom_geojson, created_at, updated_at
        """
    )
    params = {
        "tenant_id": str(token.tenant_id),
        "farm_id": str(payload.farm_id),
        "name": payload.name,
        "description": payload.description,
        "crop_type": payload.crop_type,
        "geom_json": geom_json,
    }
    res = await db.execute(sql, params)
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create plot")
    geom = json.loads(row.geom_geojson)
    # compute bbox and invalidate tiles
    bbox_res = await db.execute(text("SELECT ST_Extent(geom) FROM plots WHERE id = :id"), {"id": row.id})
    bbox_row = bbox_res.fetchone()
    if bbox_row and bbox_row[0]:
        # bbox string like BOX(minx miny,maxx maxy)
        box = bbox_row[0]
        try:
            coords = box.replace('BOX(', '').replace(')', '').split(',')
            minx, miny = map(float, coords[0].split())
            maxx, maxy = map(float, coords[1].split())
            await invalidate_tiles_for_bbox(str(token.tenant_id), 'plots', minx, miny, maxx, maxy)
        except Exception:
            pass
    return PlotOut(id=row.id, tenant_id=row.tenant_id, farm_id=row.farm_id, name=row.name, description=row.description, crop_type=row.crop_type, area_ha=row.area_ha if hasattr(row, 'area_ha') else None, geom_geojson=geom, created_at=row.created_at, updated_at=row.updated_at)


@router.get("/plots", response_model=List[PlotOut])
async def list_plots(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    check_role_can_read(token)
    sql = text("SELECT id, tenant_id, farm_id, name, description, crop_type, area_ha, ST_AsGeoJSON(geom) as geom_geojson, created_at, updated_at FROM plots WHERE tenant_id = :tenant_id ORDER BY created_at DESC")
    res = await db.execute(sql, {"tenant_id": str(token.tenant_id)})
    rows = res.fetchall()
    out = []
    for r in rows:
        geom = json.loads(r.geom_geojson) if r.geom_geojson else None
        out.append(PlotOut(id=r.id, tenant_id=r.tenant_id, farm_id=r.farm_id, name=r.name, description=r.description, crop_type=r.crop_type, area_ha=r.area_ha, geom_geojson=geom, created_at=r.created_at, updated_at=r.updated_at))
    return out


@router.get("/plots/{plot_id}", response_model=PlotOut)
async def get_plot(plot_id: str, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    check_role_can_read(token)
    sql = text("SELECT id, tenant_id, farm_id, name, description, crop_type, area_ha, ST_AsGeoJSON(geom) as geom_geojson, created_at, updated_at FROM plots WHERE id = :id AND tenant_id = :tenant_id")
    res = await db.execute(sql, {"id": plot_id, "tenant_id": str(token.tenant_id)})
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Plot not found")
    geom = json.loads(row.geom_geojson) if row.geom_geojson else None
    return PlotOut(id=row.id, tenant_id=row.tenant_id, farm_id=row.farm_id, name=row.name, description=row.description, crop_type=row.crop_type, area_ha=row.area_ha, geom_geojson=geom, created_at=row.created_at, updated_at=row.updated_at)


@router.put("/plots/{plot_id}", response_model=PlotOut)
async def update_plot(plot_id: str, payload: PlotUpdate, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    check_role_can_write(token)
    sets = []
    params = {"id": plot_id, "tenant_id": str(token.tenant_id)}
    if payload.name is not None:
        sets.append("name = :name"); params["name"] = payload.name
    if payload.description is not None:
        sets.append("description = :description"); params["description"] = payload.description
    if payload.crop_type is not None:
        sets.append("crop_type = :crop_type"); params["crop_type"] = payload.crop_type
    if payload.area_ha is not None:
        sets.append("area_ha = :area_ha"); params["area_ha"] = payload.area_ha
    if payload.geom_geojson is not None:
        geom_json = json.dumps(payload.geom_geojson.dict())
        sets.append("geom = ST_SetSRID(ST_GeomFromGeoJSON(:geom_json), 4326)"); params["geom_json"] = geom_json
        # compute area_ha on update
        sets.append("area_ha = ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(:geom_json),4326),6933))/10000.0")

    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")

    sql = text(f"""
        UPDATE plots SET {', '.join(sets)}, updated_at = now()
        WHERE id = :id AND tenant_id = :tenant_id
        RETURNING id, tenant_id, farm_id, name, description, crop_type, area_ha, ST_AsGeoJSON(geom) as geom_geojson, created_at, updated_at
    """)
    res = await db.execute(sql, params)
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Plot not found")
    geom = json.loads(row.geom_geojson) if row.geom_geojson else None
    # invalidate tiles for updated geometry
    bbox_res = await db.execute(text("SELECT ST_Extent(geom) FROM plots WHERE id = :id AND tenant_id = :tenant_id"), {"id": row.id, "tenant_id": str(token.tenant_id)})
    bbox_row = bbox_res.fetchone()
    if bbox_row and bbox_row[0]:
        box = bbox_row[0]
        try:
            coords = box.replace('BOX(', '').replace(')', '').split(',')
            minx, miny = map(float, coords[0].split())
            maxx, maxy = map(float, coords[1].split())
            await invalidate_tiles_for_bbox(str(row.tenant_id), 'plots', minx, miny, maxx, maxy)
        except Exception:
            pass
    return PlotOut(id=row.id, tenant_id=row.tenant_id, farm_id=row.farm_id, name=row.name, description=row.description, crop_type=row.crop_type, area_ha=row.area_ha if hasattr(row, 'area_ha') else None, geom_geojson=geom, created_at=row.created_at, updated_at=row.updated_at)


@router.delete("/plots/{plot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plot(plot_id: str, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    check_role_can_write(token)
    # capture bbox before delete
    bbox_res = await db.execute(text("SELECT ST_Extent(geom) FROM plots WHERE id = :id AND tenant_id = :tenant_id"), {"id": plot_id, "tenant_id": str(token.tenant_id)})
    bbox_row = bbox_res.fetchone()
    sql = text("DELETE FROM plots WHERE id = :id AND tenant_id = :tenant_id RETURNING id, tenant_id")
    res = await db.execute(sql, {"id": plot_id, "tenant_id": str(token.tenant_id)})
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Plot not found")
    # invalidate tiles
    if bbox_row and bbox_row[0]:
        try:
            box = bbox_row[0]
            coords = box.replace('BOX(', '').replace(')', '').split(',')
            minx, miny = map(float, coords[0].split())
            maxx, maxy = map(float, coords[1].split())
            await invalidate_tiles_for_bbox(str(row.tenant_id), 'plots', minx, miny, maxx, maxy)
        except Exception:
            pass
    return None
