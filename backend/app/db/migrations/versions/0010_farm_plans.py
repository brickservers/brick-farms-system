"""add farm planning tables

Revision ID: 0010_farm_plans
Revises: 0009_farm_assets_animals
Create Date: 2026-06-17
"""
from alembic import op

revision = "0010_farm_plans"
down_revision = "0009_farm_assets_animals"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS farm_plan (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid REFERENCES farm(id) ON DELETE CASCADE,
        name varchar(200) NOT NULL,
        plan_type varchar(60) NOT NULL DEFAULT 'farm_plan',
        scope_type varchar(40) NOT NULL DEFAULT 'farm',
        period_type varchar(40) NOT NULL DEFAULT 'season',
        starts_on date,
        ends_on date,
        status varchar(40) NOT NULL DEFAULT 'draft',
        notes text,
        created_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_farm_plan_scope CHECK (scope_type IN ('workspace', 'farm', 'plot', 'crop', 'animal')),
        CONSTRAINT ck_farm_plan_period CHECK (period_type IN ('day', 'week', 'month', 'season', 'year')),
        CONSTRAINT ck_farm_plan_status CHECK (status IN ('draft', 'active', 'completed', 'archived'))
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_plan_tenant_id ON farm_plan (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_plan_farm_id ON farm_plan (farm_id)")
    op.execute("""
    CREATE TABLE IF NOT EXISTS farm_plan_activity (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        plan_id uuid NOT NULL REFERENCES farm_plan(id) ON DELETE CASCADE,
        farm_id uuid REFERENCES farm(id) ON DELETE SET NULL,
        plot_id uuid REFERENCES plots(id) ON DELETE SET NULL,
        animal_group_id uuid REFERENCES animal_group(id) ON DELETE SET NULL,
        crop varchar(120),
        title varchar(255) NOT NULL,
        description text,
        activity_type varchar(80),
        starts_on date,
        due_on date,
        repeat_rule varchar(120),
        worker_role varchar(120),
        estimated_cost numeric(14,2),
        priority varchar(40) DEFAULT 'normal',
        task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_plan_activity_tenant_id ON farm_plan_activity (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_plan_activity_plan_id ON farm_plan_activity (plan_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_plan_activity_due_on ON farm_plan_activity (due_on)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_farm_plan_activity_due_on")
    op.execute("DROP INDEX IF EXISTS ix_farm_plan_activity_plan_id")
    op.execute("DROP INDEX IF EXISTS ix_farm_plan_activity_tenant_id")
    op.execute("DROP TABLE IF EXISTS farm_plan_activity")
    op.execute("DROP INDEX IF EXISTS ix_farm_plan_farm_id")
    op.execute("DROP INDEX IF EXISTS ix_farm_plan_tenant_id")
    op.execute("DROP TABLE IF EXISTS farm_plan")
