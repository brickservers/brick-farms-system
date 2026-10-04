"""add farm assets and animal groups

Revision ID: 0009_farm_assets_animals
Revises: 0008_user_profile_notifications
Create Date: 2026-06-14
"""
from alembic import op

revision = "0009_farm_assets_animals"
down_revision = "0008_user_profile_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE farm ADD COLUMN IF NOT EXISTS farm_type varchar(60) NOT NULL DEFAULT 'crop'")
    op.execute("""
    CREATE TABLE IF NOT EXISTS farm_asset (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
        plot_id uuid REFERENCES plots(id) ON DELETE SET NULL,
        name varchar(180) NOT NULL,
        asset_type varchar(60) NOT NULL,
        status varchar(40) NOT NULL DEFAULT 'active',
        quantity numeric(14,2) NOT NULL DEFAULT 1,
        unit varchar(40),
        value numeric(14,2),
        currency varchar(3) NOT NULL DEFAULT 'NGN',
        acquired_at date,
        location_note varchar(255),
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_farm_asset_type CHECK (asset_type IN ('tool', 'machinery', 'building', 'structure', 'plot', 'vehicle', 'equipment', 'storage', 'animal_housing', 'other')),
        CONSTRAINT ck_farm_asset_status CHECK (status IN ('active', 'maintenance', 'retired', 'lost'))
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_asset_tenant_id ON farm_asset (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_asset_farm_id ON farm_asset (farm_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_asset_plot_id ON farm_asset (plot_id)")
    op.execute("""
    CREATE TABLE IF NOT EXISTS animal_group (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        farm_id uuid NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
        plot_id uuid REFERENCES plots(id) ON DELETE SET NULL,
        name varchar(180) NOT NULL,
        species varchar(80) NOT NULL,
        breed varchar(120),
        count integer NOT NULL DEFAULT 0,
        age_value numeric(8,2),
        age_unit varchar(20),
        sex varchar(30),
        health_status varchar(80),
        purpose varchar(80),
        housing_asset_id uuid REFERENCES farm_asset(id) ON DELETE SET NULL,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_animal_group_tenant_id ON animal_group (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_animal_group_farm_id ON animal_group (farm_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_animal_group_plot_id ON animal_group (plot_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_animal_group_plot_id")
    op.execute("DROP INDEX IF EXISTS ix_animal_group_farm_id")
    op.execute("DROP INDEX IF EXISTS ix_animal_group_tenant_id")
    op.execute("DROP TABLE IF EXISTS animal_group")
    op.execute("DROP INDEX IF EXISTS ix_farm_asset_plot_id")
    op.execute("DROP INDEX IF EXISTS ix_farm_asset_farm_id")
    op.execute("DROP INDEX IF EXISTS ix_farm_asset_tenant_id")
    op.execute("DROP TABLE IF EXISTS farm_asset")
    op.execute("ALTER TABLE farm DROP COLUMN IF EXISTS farm_type")
