"""add owner profile and tenant country fields

Revision ID: 0008_user_profile_notifications
Revises: 0007_create_farm_workers
Create Date: 2026-06-13
"""
from alembic import op

revision = "0008_user_profile_notifications"
down_revision = "0007_create_farm_workers"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE tenant ADD COLUMN IF NOT EXISTS country varchar(2)")
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS first_name varchar(120)')
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_name varchar(120)')
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone varchar(40)')
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS dob date')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_tenant_role ON "user" (tenant_id, role)')


def downgrade():
    op.execute('DROP INDEX IF EXISTS ix_user_tenant_role')
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS dob')
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS phone')
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS last_name')
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS first_name')
    op.execute("ALTER TABLE tenant DROP COLUMN IF EXISTS country")
