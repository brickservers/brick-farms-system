# backend/app/main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.logging import setup_logging

from app.api.v1 import auth, tenants, farms, fields, crops, sensors, tasks, tiles, uploads, plots, finance, reports, preferences, workers, team, assets, farm_plans, payments

setup_logging()
app = FastAPI(title="BrickFarm API", version="0.1.0")

if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(tenants.router, prefix="/api/v1/tenants")
app.include_router(farms.router, prefix="/api/v1/farms")
app.include_router(fields.router, prefix="/api/v1/fields")
app.include_router(crops.router, prefix="/api/v1/crops")
app.include_router(sensors.router, prefix="/api/v1/sensors")
app.include_router(plots.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1/finance")
app.include_router(reports.router, prefix="/api/v1/reports")
app.include_router(preferences.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(workers.router, prefix="/api/v1/workers")
app.include_router(team.router, prefix="/api/v1/team")
app.include_router(assets.router, prefix="/api/v1/assets")
app.include_router(farm_plans.router, prefix="/api/v1/farm-plans")
app.include_router(payments.router, prefix="/api/v1/payments")
app.include_router(tiles.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")

@app.get("/healthz")
async def healthz():
    return {"status":"ok","env":settings.ENV}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
