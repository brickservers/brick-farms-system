"""create farm worker management tables

Revision ID: 0007_create_farm_workers
Revises: 0006_create_core_saas_tables
Create Date: 2026-06-07
"""
from alembic import op

revision = "0007_create_farm_workers"
down_revision = "0006_create_core_saas_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS farm_worker (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid REFERENCES farm(id) ON DELETE SET NULL,
        full_name varchar(180) NOT NULL,
        role varchar(120) NOT NULL DEFAULT 'field_worker',
        phone varchar(40),
        email varchar(255),
        status varchar(40) NOT NULL DEFAULT 'active',
        hourly_rate numeric(12,2),
        currency varchar(3) NOT NULL DEFAULT 'NGN',
        hired_at date,
        emergency_contact varchar(180),
        skills jsonb NOT NULL DEFAULT '[]'::jsonb,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_farm_worker_status CHECK (status IN ('active', 'on_leave', 'inactive')),
        CONSTRAINT ck_farm_worker_currency CHECK (char_length(currency) = 3)
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_worker_tenant_id ON farm_worker (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_worker_farm_id ON farm_worker (farm_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_worker_status ON farm_worker (status)")
    op.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_worker_tenant_phone
    ON farm_worker (tenant_id, phone)
    WHERE phone IS NOT NULL AND phone <> ''
    """)
    op.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_worker_tenant_email
    ON farm_worker (tenant_id, lower(email))
    WHERE email IS NOT NULL AND email <> ''
    """)
    op.execute("""
    ALTER TABLE task
    ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES farm_worker(id) ON DELETE SET NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_worker_id ON task (worker_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_task_worker_id")
    op.execute("ALTER TABLE task DROP COLUMN IF EXISTS worker_id")
    op.execute("DROP INDEX IF EXISTS uq_farm_worker_tenant_email")
    op.execute("DROP INDEX IF EXISTS uq_farm_worker_tenant_phone")
    op.execute("DROP INDEX IF EXISTS ix_farm_worker_status")
    op.execute("DROP INDEX IF EXISTS ix_farm_worker_farm_id")
    op.execute("DROP INDEX IF EXISTS ix_farm_worker_tenant_id")
    op.execute("DROP TABLE IF EXISTS farm_worker")
