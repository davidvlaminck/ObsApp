"""replace_activity_goals_with_activity_observation_goals

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

    existing_tables = inspector.get_table_names()
    if 'activity_goals' in existing_tables:
        op.drop_table('activity_goals')

    if 'activity_observation_goals' not in existing_tables:
        op.create_table(
            'activity_observation_goals',
            sa.Column('activity_id', sa.Integer(), nullable=False),
            sa.Column('observation_goal_id', sa.Integer(), nullable=False),
            sa.Column('label', sa.String(length=200), nullable=True),
            sa.Column('observe', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.ForeignKeyConstraint(['activity_id'], ['activities.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['observation_goal_id'], ['observation_goals.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('activity_id', 'observation_goal_id'),
        )
        op.create_index('ix_activity_observation_goals_activity_id', 'activity_observation_goals', ['activity_id'])
        op.create_index('ix_activity_observation_goals_observation_goal_id', 'activity_observation_goals', ['observation_goal_id'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    existing_tables = inspector.get_table_names()
    if 'activity_observation_goals' in existing_tables:
        op.drop_index('ix_activity_observation_goals_observation_goal_id', table_name='activity_observation_goals')
        op.drop_index('ix_activity_observation_goals_activity_id', table_name='activity_observation_goals')
        op.drop_table('activity_observation_goals')
