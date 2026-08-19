"""add_status_colors_to_user

Revision ID: 0008_add_status_colors_to_user
Revises: 0007_add_color_theme_to_user
Create Date: 2026-08-18 22:43:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0008_add_status_colors_to_user"
down_revision: Union[str, Sequence[str], None] = "0007_add_color_theme_to_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "users" in existing_tables:
        existing_columns = {c["name"] for c in inspector.get_columns("users")}
        if "status_colors" not in existing_columns:
            op.add_column(
                "users",
                sa.Column("status_colors", sa.String(length=1024), nullable=True),
            )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "users" in existing_tables:
        existing_columns = {c["name"] for c in inspector.get_columns("users")}
        if "status_colors" in existing_columns:
            op.drop_column("users", "status_colors")
