"""make_activity_theme_id_required

Revision ID: 02a3b4c5d6e7
Revises: 7a8b9c0d1e2f
Create Date: 2026-07-23 11:14:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02a3b4c5d6e7'
down_revision: Union[str, Sequence[str], None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if 'activities' not in existing_tables:
        return

    op.execute(sa.text("UPDATE activities SET theme_id = (SELECT id FROM themes LIMIT 1) WHERE theme_id IS NULL"))
    op.alter_column('activities', 'theme_id', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if 'activities' not in existing_tables:
        return

    op.alter_column('activities', 'theme_id', existing_type=sa.Integer(), nullable=True)
