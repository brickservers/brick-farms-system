# Frontend ↔ Backend API Mapping

This document summarizes which frontend pages call which backend API endpoints (canonical backend at `/backend`).

## Summary

- Canonical backend: `/backend` (use this for development and deployment). The `brickfarms` copy has been archived/removed from the working tree to avoid duplication.

## Routes and coverage

- Authentication
  - Backend: `backend/app/api/v1/auth.py` — `/auth/token`, `/auth/signup`, `/auth/refresh`
  - Frontend: `frontend-web/src/pages/Login.tsx`, `frontend-web/src/pages/Register.tsx` — use `frontend-web/src/api/auth.ts`

- Farms
  - Backend: `backend/app/api/v1/farms.py` — `/farms` (GET, POST)
  - Frontend: `frontend-web/src/pages/Farms.tsx` → `frontend-web/src/api/farm.ts` (`listFarms`, `createFarm`)

- Plots (map)
  - Backend: `backend/app/api/v1/plots.py` — `/plots` (GET, POST, PUT, DELETE)
  - Frontend: `frontend-web/src/components/map/FarmMapModule.tsx` and `frontend-web/src/pages/FarmMap.tsx` → `createPlot`, `listPlots`, `updatePlot`, `deletePlot`

- Tasks / Observations
  - Backend: `backend/app/api/v1/tasks.py` — `/tasks`, `/observations`, `/observations/multipart`
  - Frontend: `frontend-web/src/pages/Tasks.tsx`, `frontend-web/src/components/map/*` → `createTask`, `listTasks`, `createObservation`

- Farm plans (templates + upload)
  - Backend: `backend/app/api/v1/farm_plans.py` — `/farm-plans`, `/farm-plans/{id}/activities`, `/farm-plans/template.csv`, `/farm-plans/upload`
  - Frontend: `frontend-web/src/pages/FarmPlans.tsx` → `listFarmPlans`, `createFarmPlan`, `createFarmPlanActivity`, `downloadFarmPlanTemplate`, `uploadFarmPlanTemplate`

- Sensors
  - Backend: `backend/app/api/v1/sensors.py` — `/sensors/devices`, `/sensors/readings` (ingest endpoints exist separately)
  - Frontend: `frontend-web/src/pages/Sensors.tsx` → `listSensorDevices`, `listSensorReadings`, `createSensorDevice`

- Team / Workers
  - Backend: `backend/app/api/v1/team.py`, `backend/app/api/v1/workers.py`
  - Frontend: `frontend-web/src/pages/Team.tsx`, `frontend-web/src/pages/Workers.tsx` → `listTeamUsers`, `createTeamUser`, `listWorkers`, `createWorker`, `updateWorker`, `deactivateWorker`

- Finance / Payments / Reports
  - Backend: `backend/app/api/v1/finance.py` — investments, payouts, transactions, ROI (added list endpoints)
  - Backend: `backend/app/api/v1/payments.py` — `/payments/checkout`, `/payments/verify`
  - Frontend: `frontend-web/src/pages/Finance.tsx` and `frontend-web/src/pages/Settings.tsx` → `createInvestment`, `createPayout`, `getInvestmentRoi`, `startPlanCheckout`, `verifyPlanPayment` (new list helpers added)

- Tiles (map vector tiles)
  - Backend: `backend/app/api/v1/tiles.py` — `/tiles/{z}/{x}/{y}/{layer}`
  - Frontend: `frontend-web/src/components/map/FarmMapModule.tsx` (vector tile layer)

## Gaps / Next actions

- Add finance list endpoints (investments, payouts, transactions) — implemented in backend and wired to frontend in this change set.
- Add a small payment verification page to confirm provider redirects — implemented in frontend.

If you want, I can also generate a CSV export of this mapping, or push the mapping into project docs or a tracker ticket list.
