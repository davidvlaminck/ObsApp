"""add_label_to_activity_goals

Revision ID: 7a8b9c0d1e2f
Revises: 03f5f24d0423
Create Date: 2026-07-22 18:07:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '03f5f24d0423'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        columns = [col['name'] for col in inspector.get_columns('activity_goals')]
    except sa.exc.NoSuchTableError:
        return
    if 'label' not in columns:
        op.add_column('activity_goals', sa.Column('label', sa.String(length=200), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        columns = [col['name'] for col in inspector.get_columns('activity_goals')]
    except sa.exc.NoSuchTableError:
        return
    if 'label' in columns:
        op.drop_column('activity_goals', 'label')
