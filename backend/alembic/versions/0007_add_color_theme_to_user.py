"""add_color_theme_to_user

Revision ID: 0007_add_color_theme_to_user
Revises: 0006_add_level_to_goal
Create Date: 2026-08-18 19:38:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0007_add_color_theme_to_user"
down_revision: Union[str, Sequence[str], None] = "0006_add_level_to_goal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "users" in existing_tables:
        existing_columns = {c["name"] for c in inspector.get_columns("users")}
        if "color_theme" not in existing_columns:
            op.add_column(
                "users",
                sa.Column("color_theme", sa.String(length=50), nullable=False, server_default="teal"),
            )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "users" in existing_tables:
        existing_columns = {c["name"] for c in inspector.get_columns("users")}
        if "color_theme" in existing_columns:
            op.drop_column("users", "color_theme")
