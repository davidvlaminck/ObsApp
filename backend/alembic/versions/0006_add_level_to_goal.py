"""add_level_to_goal

Revision ID: 0006_add_level_to_goal
Revises: 02a3b4c5d6e7
Create Date: 2026-08-18 15:58:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0006_add_level_to_goal'
down_revision: Union[str, Sequence[str], None] = '02a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if 'goals' not in existing_tables:
        return

    existing_columns = {c['name'] for c in inspector.get_columns('goals')}
    if 'level' not in existing_columns:
        op.add_column('goals', sa.Column('level', sa.String(length=10), nullable=True))
        op.create_index('ix_goals_level', 'goals', ['level'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if 'goals' not in existing_tables:
        return

    existing_columns = {c['name'] for c in inspector.get_columns('goals')}
    if 'level' in existing_columns:
        op.drop_index('ix_goals_level', table_name='goals')
        op.drop_column('goals', 'level')
