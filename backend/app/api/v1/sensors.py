from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from app.api.deps import tenant_scoped_user
from app.models.sensor import SensorDevice
from app.schemas.sensor import DeviceIn, DeviceOut, ReadingIn
from app.schemas.sensor import DeviceUpdate
from app.db.session import get_db
from app.services.notifications import send_bulk_email
from app.services.plan_limits import assert_plan_limit

router = APIRouter(tags=["sensors"])


@router.post("/devices", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(d: DeviceIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    await assert_plan_limit(db, str(token.tenant_id), "sensors")
    dev = SensorDevice(tenant_id=token.tenant_id, **d.model_dump())
    db.add(dev)
    await db.commit()
    await db.refresh(dev)
    return dev


@router.get("/devices", response_model=list[DeviceOut])
async def list_devices(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(text("SELECT id, farm_id, plot_id, name, protocol, api_key FROM sensor_devices WHERE tenant_id = :tid"), {"tid": token.tenant_id})
    rows = res.fetchall()
    out = []
    for r in rows:
        out.append(DeviceOut(id=r.id, farm_id=r.farm_id, plot_id=r.plot_id, name=r.name, protocol=r.protocol, api_key=r.api_key))
    return out


@router.patch("/devices/{device_id}", response_model=DeviceOut)
async def update_device(device_id: str, payload: DeviceUpdate, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    sets = []
    params = {"id": device_id}
    if payload.name is not None:
        sets.append("name = :name"); params["name"] = payload.name
    if payload.protocol is not None:
        sets.append("protocol = :protocol"); params["protocol"] = payload.protocol
    if payload.plot_id is not None:
        sets.append("plot_id = :plot_id"); params["plot_id"] = payload.plot_id
    if payload.api_key is not None:
        sets.append("api_key = :api_key"); params["api_key"] = payload.api_key
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    sql = text(f"""
    UPDATE sensor_devices SET {', '.join(sets)}, created_at = created_at
    WHERE id = :id AND tenant_id = :tid
    RETURNING id, farm_id, plot_id, name, protocol, api_key
    """)
    params["tid"] = token.tenant_id
    res = await db.execute(sql, params)
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")
    return DeviceOut(id=row.id, farm_id=row.farm_id, plot_id=row.plot_id, name=row.name, protocol=row.protocol, api_key=row.api_key)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(device_id: str, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    sql = text("DELETE FROM sensor_devices WHERE id = :id AND tenant_id = :tid RETURNING id")
    res = await db.execute(sql, {"id": device_id, "tid": token.tenant_id})
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")
    return None


@router.post("/readings", status_code=status.HTTP_201_CREATED)
async def ingest_reading(payload: ReadingIn, db: AsyncSession = Depends(get_db), x_api_key: str | None = Header(None)):
    """Simple HTTP ingestion endpoint for sensor readings.

    Devices can POST readings with their `device_id` and `api_key` in payload or via header.
    For simplicity this endpoint expects valid `device_id` and `api_key` fields and inserts into `sensor_readings`.
    """
    # validate device api_key
    check_sql = text("SELECT api_key, tenant_id FROM sensor_devices WHERE id = :id")
    dev_res = await db.execute(check_sql, {"id": payload.device_id})
    dev = dev_res.fetchone()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    # require API key header and validate
    expected_key = getattr(dev, 'api_key', None)
    if not x_api_key or x_api_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    insert_sql = text("""
    INSERT INTO sensor_readings (tenant_id, device_id, metric, value, unit, timestamp, location)
    VALUES (:tenant_id, :device_id, :metric, :value, :unit, :timestamp, ST_SetSRID(ST_GeomFromGeoJSON(:location),4326))
    RETURNING id
    """)
    loc_json = None
    if payload.location:
        import json as _json
        loc_json = _json.dumps(payload.location)
    params = {
        "tenant_id": dev.tenant_id,
        "device_id": str(payload.device_id),
        "metric": payload.metric,
        "value": payload.value,
        "unit": payload.unit,
        "timestamp": payload.timestamp or text('now()'),
        "location": loc_json,
    }
    res = await db.execute(insert_sql, params)
    row = res.fetchone()
    await db.commit()
    owner_res = await db.execute(
        text('SELECT email FROM "user" WHERE tenant_id = :tenant_id AND is_active = true AND role IN (\'owner\', \'admin\', \'agronomist\')'),
        {"tenant_id": str(dev.tenant_id)},
    )
    await send_bulk_email(
        [item.email for item in owner_res.fetchall()],
        "BrickFarms DAP sensor reading received",
        f"Sensor reading received.\n\nMetric: {payload.metric}\nValue: {payload.value} {payload.unit or ''}\nDevice: {payload.device_id}\n\nSigned,\nBrickServers NG Limited",
    )
    id_val = None
    if row:
        try:
            id_val = row[0]
        except Exception:
            id_val = getattr(row, 'id', None)
    return {"id": id_val}


@router.get("/readings/query")
async def query_readings(device_id: str | None = None, from_ts: str | None = None, to_ts: str | None = None, metric: str | None = None, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    filters = ["tenant_id = :tid"]
    params = {"tid": token.tenant_id}
    if device_id:
        filters.append("device_id = :device_id")
        params["device_id"] = device_id
    if metric:
        filters.append("metric = :metric")
        params["metric"] = metric
    if from_ts:
        filters.append("timestamp >= CAST(:from_ts AS timestamptz)")
        params["from_ts"] = from_ts
    if to_ts:
        filters.append("timestamp <= CAST(:to_ts AS timestamptz)")
        params["to_ts"] = to_ts

    q = f"""
    SELECT id, device_id, metric, value, unit, timestamp, ST_AsGeoJSON(location) as location
    FROM sensor_readings
    WHERE {' AND '.join(filters)}
    ORDER BY timestamp ASC
    LIMIT 10000
    """
    res = await db.execute(text(q), params)
    rows = res.fetchall()
    out = []
    for r in rows:
        loc = None
        if r.location:
            import json as _json
            loc = _json.loads(r.location)
        out.append({"id": r.id, "device_id": r.device_id, "metric": r.metric, "value": r.value, "unit": r.unit, "timestamp": r.timestamp, "location": loc})
    return out
