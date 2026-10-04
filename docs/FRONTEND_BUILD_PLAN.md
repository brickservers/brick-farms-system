# BrickFarm Web App Build Plan

## Product Goal

Build `app.brickfarms.ng` as the actual SaaS workspace for farm operators, agronomists, investors, auditors, and field teams. The public marketing and pricing site will live separately at `brickfarms.ng`.

## Experience Principles

- Dense, calm, operational interface for repeated daily use.
- Agriculture theme using dark green, dark brown, white, and black.
- Mobile friendly and PWA-ready, with offline-friendly demo and cached app shell.
- Translatable from the start: English, French, Spanish, Swahili, Tiv, Hausa, Igbo, Yoruba.
- Free mode for small farmers and retention; demo mode for prospects.
- Enterprise-ready surfaces for sensors, reports, finance, roles, and map workflows.

## Route Structure

- `/` Overview: command center with KPIs, priorities, plot pulse.
- `/farms` Farm registry and farm creation workflow.
- `/map` OpenLayers farm map with plot editing, task pins, sensor heatmap, vector tiles, and plot actions.
- `/tasks` Work planning, field operations, observations.
- `/sensors` Device registry, readings, health, ingestion readiness.
- `/finance` Transactions, investments, payouts, ROI.
- `/reports` Forecast, activity, carbon, exports.
- `/demo` Trial and free-mode limits.
- `/settings` Language, plan mode, tenant/user preferences.
- `/login` and `/register` Auth entry.

## Component Build Sequence

1. App foundation
   - React Query provider, language provider, plan/demo provider.
   - Responsive shell, sidebar, topbar, theme tokens.
   - Production build test.

2. Map module
   - OpenLayers base maps.
   - Query-backed plots, tasks, sensor readings.
   - Demo fallback data.
   - Vector tile probe and authenticated MVT loading.
   - Draw, edit, select controls.
   - Plot side panel and action placeholders.

3. Dashboard components
   - Stat tiles, activity lists, priority lists.
   - Real API fallback to demo data for empty/free accounts.

4. Domain modules
   - Farms CRUD.
   - Plots create/update/delete.
   - Task create/update and observation upload.
   - Sensor device onboarding and readings views.
   - Finance ledger, investment ROI, payouts.
   - Reports export controls.

5. SaaS and retention
   - Free limits.
   - Demo guided workspace.
   - Upgrade prompts and plan-aware disabled states.
   - Role-aware navigation.

6. Offline and PWA
   - Cache shell and static assets.
   - Cache recent API reads with React Query persistence.
   - Queue selected offline mutations later.

## Current Status

- Foundation routes and app shell: built.
- React Query installed and wired.
- Translation scaffold: built.
- Plan/free/demo mode scaffold: built.
- First OpenLayers map module: built.
- Plot CRUD from map panel: built.
- Farms, tasks, sensors, finance actions: built.
- Authenticated report exports: built.
- Route-level map code splitting: built.
- Offline GET fallback and connection indicator: built.
- Production build: passing.

## Known Follow-Ups

- Add richer offline mutation queue for create/update actions.
- Add list APIs for finance ledger/investments/payouts so Finance can stop using demo ledger rows.
- Fix existing backend/Pydantic warning about `orm_mode`.
- Review npm audit findings without forcing breaking upgrades.
