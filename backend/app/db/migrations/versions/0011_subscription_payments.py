"""add subscription payment records

Revision ID: 0011_subscription_payments
Revises: 0010_farm_plans
Create Date: 2026-06-17
"""
from alembic import op

revision = "0011_subscription_payments"
down_revision = "0010_farm_plans"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS subscription_payment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
        plan varchar(50) NOT NULL,
        amount numeric(14,2) NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'NGN',
        billing_period varchar(20) NOT NULL DEFAULT 'monthly',
        provider varchar(40) NOT NULL DEFAULT 'flutterwave',
        provider_reference varchar(120),
        tx_ref varchar(120) NOT NULL UNIQUE,
        checkout_url text,
        status varchar(40) NOT NULL DEFAULT 'pending',
        raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        verified_at timestamptz
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_subscription_payment_tenant_id ON subscription_payment (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_subscription_payment_tx_ref ON subscription_payment (tx_ref)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_subscription_payment_tx_ref")
    op.execute("DROP INDEX IF EXISTS ix_subscription_payment_tenant_id")
    op.execute("DROP TABLE IF EXISTS subscription_payment")
