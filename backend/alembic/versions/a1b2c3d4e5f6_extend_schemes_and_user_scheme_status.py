"""Extend schemes and add user_scheme_status table

Revision ID: a1b2c3d4e5f6
Revises: fc5a65efd89e
Create Date: 2026-10-22 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fc5a65efd89e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 0. Convert benefit_type enum to VARCHAR on PostgreSQL if needed
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE schemes ALTER COLUMN benefit_type TYPE VARCHAR USING benefit_type::text;")

    # 1. Add extended columns to schemes table using batch_alter_table for SQLite compatibility
    with op.batch_alter_table('schemes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('benefit_amount_inr', sa.Numeric(), nullable=True))
        batch_op.add_column(sa.Column('benefit_period', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('driver_tags', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('documents', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('apply_steps', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('last_verified_at', sa.DateTime(timezone=True), nullable=True))

    # 2. Create user_scheme_status table
    op.create_table(
        'user_scheme_status',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('scheme_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['scheme_id'], ['schemes.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'scheme_id', name='uq_user_scheme_status')
    )
    op.create_index(op.f('ix_user_scheme_status_user_id'), 'user_scheme_status', ['user_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_user_scheme_status_user_id'), table_name='user_scheme_status')
    op.drop_table('user_scheme_status')
    with op.batch_alter_table('schemes', schema=None) as batch_op:
        batch_op.drop_column('last_verified_at')
        batch_op.drop_column('apply_steps')
        batch_op.drop_column('documents')
        batch_op.drop_column('driver_tags')
        batch_op.drop_column('benefit_period')
        batch_op.drop_column('benefit_amount_inr')
