"""make_observation_goal_subdomain_nullable

Revision ID: 03f5f24d0423
Revises: a14bb4af87eb
Create Date: 2026-07-22 14:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03f5f24d0423'
down_revision: Union[str, Sequence[str], None] = 'a14bb4af87eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make observation_goals.subdomain nullable."""
    op.alter_column('observation_goals', 'subdomain', existing_type=sa.String(length=100), nullable=True)


def downgrade() -> None:
    """Make observation_goals.subdomain non-nullable again."""
    op.alter_column('observation_goals', 'subdomain', existing_type=sa.String(length=100), nullable=False)
