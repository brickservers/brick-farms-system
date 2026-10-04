# BrickFarm Production Runbook

## Current Live Setup

- `app.brickfarms.ng` serves the built React frontend from `frontend-web/dist` through Apache.
- `api.brickfarms.ng` proxies through Apache to the host backend on `127.0.0.1:8001`.
- The backend runs as `brickfarm-backend.service` under `systemd`.
- PostgreSQL/PostGIS should use the Lightsail managed database once `backend/.env.prod.local` has the live password and migrations have been run.
- Legacy local PostgreSQL, if still present, runs in the `brickfarm-db` Docker container on host port `5433`.
- Redis currently runs in the `brickfarm-redis` Docker container on host port `6380`.
- Daily local PostgreSQL backups run via `brickfarm-db-backup.timer`.

## Day-To-Day Commands

Set or rotate the managed database password without exposing it in shell history:

```bash
cd /opt/bitnami/apache2/htdocs/farm
infra/scripts/set_prod_db_password.sh
```

Backend status:

```bash
sudo systemctl status brickfarm-backend.service --no-pager
```

Backend logs:

```bash
sudo journalctl -u brickfarm-backend.service -f
```

Restart backend after code or env changes:

```bash
sudo systemctl restart brickfarm-backend.service
```

Build frontend:

```bash
cd /opt/bitnami/apache2/htdocs/farm/frontend-web
npm run build
```

Check API:

```bash
curl -k https://api.brickfarms.ng/healthz
```

Run a database backup now:

```bash
cd /opt/bitnami/apache2/htdocs/farm
infra/scripts/backup_postgres.sh
```

Run production migrations:

```bash
cd /opt/bitnami/apache2/htdocs/farm
infra/scripts/run_prod_migrations.sh
```

## Backup Plan

Local server backup:

- Stored under `/opt/bitnami/backups/brickfarm/postgres`.
- Retention defaults to 14 days.
- Scheduled daily around `02:15 UTC`.

Encrypt the latest backup:

```bash
export BACKUP_PASSPHRASE='use-a-long-secret-from-the-password-vault'
infra/scripts/encrypt_latest_backup.sh
```

Sync encrypted backup to another server or mounted drive:

```bash
export REMOTE_BACKUP_TARGET='user@backup-server:/backups/brickfarm/postgres/'
infra/scripts/sync_backup_to_remote.sh
```

Do not commit raw database dumps into the application repository. If GitHub is used for backups, use a separate private backup repository and commit only encrypted `.enc` files plus checksums.

## Recommended Growth Path

### Phase 1: Current Lightsail, Stable MVP

Keep:

- Apache for TLS and frontend static serving.
- `systemd` Gunicorn backend.
- PostgreSQL/PostGIS on this server temporarily.
- Daily local backups plus encrypted offsite copies.

Improve soon:

- Move PostgreSQL out of Docker into a managed database or dedicated database host.
- Add monitoring for disk, memory, API health, and backup freshness.
- Store uploaded files/media in object storage rather than on the app server.

### Phase 2: Larger Lightsail

Recommended when traffic grows but operations should stay simple:

- App server: Lightsail 4 vCPU / 8 GB RAM or larger.
- Database: Lightsail PostgreSQL high availability managed database.
- Keep frontend static on Apache or move static assets to a CDN later.
- Keep a second Lightsail app server ready with the same repo, env, and service files.

Use this if you want simple pricing and fewer moving pieces.

### Phase 3: EC2/RDS Production SaaS

Recommended for serious multi-tenant SaaS:

- App layer: two EC2 instances in separate Availability Zones.
- Load balancer: Application Load Balancer for `api.brickfarms.ng`.
- Database: Amazon RDS PostgreSQL Multi-AZ with PostGIS support.
- Cache: ElastiCache Redis or a dedicated Redis instance.
- Storage: S3 for uploads, reports, and generated files.
- Backups: RDS automated backups, manual snapshots before migrations, encrypted offsite exports.

Initial RDS recommendation:

- Engine: PostgreSQL 16 or latest supported version that supports required PostGIS extensions.
- Class: `db.t4g.medium` for early production, or `db.m7g.large` when reporting/analytics grows.
- Storage: 100 GB gp3 to start, storage autoscaling enabled.
- Availability: Multi-AZ enabled.
- Backups: 7-14 day automated retention, point-in-time recovery enabled.
- Security: private subnet/VPC access only from app servers; no public database access.

## Redundant Server Strategy

Best near-term approach:

- Primary server serves production.
- Secondary server is warm standby.
- Data source of truth remains one PostgreSQL primary.
- Secondary receives encrypted backups and can be promoted manually if primary fails.

Best long-term approach:

- Use RDS Multi-AZ for automatic database failover.
- Run two app servers behind a load balancer.
- Keep app servers stateless.
- Store uploads in S3.

Avoid dual-writing application data to two independent PostgreSQL primaries. It creates conflict and data-loss risk. Use database replication or managed Multi-AZ instead.

## Migration Checklist

1. Take a fresh backup:

```bash
infra/scripts/backup_postgres.sh
```

2. Encrypt and sync it off-server.

3. Confirm the managed database supports PostGIS and pgcrypto.

4. Put the live password into the ignored private env override:

```bash
infra/scripts/set_prod_db_password.sh
```

5. Confirm `backend/.env.prod` points at the managed database and `backend/.env.prod.local` contains only the secret override:

```env
DB_HOST=ls-8057ed7a6e1ab0e3c4a26c01d143c38562699461.c6zyssamuf5b.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=brickfarm
DB_USER=brickfarm
DB_PASS=...
REDIS_URL=redis://new-redis-host:6379/0
```

6. Run migrations:

```bash
infra/scripts/run_prod_migrations.sh
```

7. Restart backend:

```bash
sudo systemctl restart brickfarm-backend.service
```

8. Verify:

```bash
curl -k https://api.brickfarms.ng/healthz
```
