"""create core saas auth and operations tables

Revision ID: 0006_create_core_saas_tables
Revises: 0005_create_user_preferences
Create Date: 2026-06-05
"""
from alembic import op

revision = "0006_create_core_saas_tables"
down_revision = "0005_create_user_preferences"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS tenant (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(200) NOT NULL UNIQUE,
        plan varchar(50) NOT NULL DEFAULT 'free'
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS "user" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        email varchar(255) NOT NULL UNIQUE,
        hashed_password varchar(255) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        role varchar(50) NOT NULL DEFAULT 'admin'
    )
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_tenant_id ON "user" (tenant_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_email ON "user" (email)')

    op.execute("""
    CREATE TABLE IF NOT EXISTS membership (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        role varchar(50) NOT NULL DEFAULT 'admin'
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_membership_tenant_id ON membership (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_membership_user_id ON membership (user_id)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS farm (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        name varchar(200) NOT NULL,
        country varchar(2) NOT NULL,
        state varchar(100),
        lga varchar(100)
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_tenant_id ON farm (tenant_id)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS fieldplot (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        geom geometry(POLYGON,4326) NOT NULL,
        area_ha numeric(10,2),
        soil_type varchar(120),
        irrigation varchar(120)
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_fieldplot_tenant_id ON fieldplot (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fieldplot_farm_id ON fieldplot (farm_id)")

    op.execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crop_category') THEN
        CREATE TYPE crop_category AS ENUM ('crop', 'tree');
      END IF;
    END
    $$;
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS crop (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        category crop_category NOT NULL,
        common_name varchar(120) NOT NULL,
        scientific_name varchar(200),
        descriptors json DEFAULT '{}'::json
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_crop_tenant_id ON crop (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_crop_common_name ON crop (common_name)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS variety (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        crop_id uuid NOT NULL REFERENCES crop(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        attributes json DEFAULT '{}'::json
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_variety_tenant_id ON variety (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_variety_crop_id ON variety (crop_id)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS task (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid,
        workorder_id uuid,
        title varchar(255) NOT NULL,
        description text,
        assignee_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
        status varchar(50) NOT NULL DEFAULT 'pending',
        location geometry(POINT,4326),
        gps_accuracy_m double precision,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        due_at timestamptz,
        meta jsonb DEFAULT '{}'::jsonb
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_tenant_id ON task (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_status ON task (status)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS observation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        plot_id uuid,
        task_id uuid,
        observer_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
        ts timestamptz NOT NULL DEFAULT now(),
        notes text,
        metrics jsonb DEFAULT '{}'::jsonb,
        location geometry(POINT,4326)
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_observation_tenant_id ON observation (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_observation_plot_id ON observation (plot_id)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS photo_report (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        observation_id uuid,
        url text NOT NULL,
        thumb_url text,
        exif jsonb DEFAULT '{}'::jsonb,
        ts timestamptz NOT NULL DEFAULT now()
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS activity (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid,
        action varchar(120) NOT NULL,
        ts timestamptz NOT NULL DEFAULT now(),
        meta jsonb DEFAULT '{}'::jsonb
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_activity_tenant_id ON activity (tenant_id)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS yields (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid,
        plot_id uuid,
        ts timestamptz NOT NULL DEFAULT now(),
        yield_kg double precision NOT NULL DEFAULT 0
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_yields_tenant_id ON yields (tenant_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS yields")
    op.execute("DROP TABLE IF EXISTS activity")
    op.execute("DROP TABLE IF EXISTS photo_report")
    op.execute("DROP TABLE IF EXISTS observation")
    op.execute("DROP TABLE IF EXISTS task")
    op.execute("DROP TABLE IF EXISTS variety")
    op.execute("DROP TABLE IF EXISTS crop")
    op.execute("DROP TYPE IF EXISTS crop_category")
    op.execute("DROP TABLE IF EXISTS fieldplot")
    op.execute("DROP TABLE IF EXISTS farm")
    op.execute("DROP TABLE IF EXISTS membership")
    op.execute('DROP TABLE IF EXISTS "user"')
    op.execute("DROP TABLE IF EXISTS tenant")
