"""add_membership_pending_to_user

Revision ID: 0009_add_membership_pending_to_user
Revises: 0008_add_status_colors_to_user
Create Date: 2026-08-19 21:42:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0009_membership_pending"
down_revision: Union[str, Sequence[str], None] = "0008_add_status_colors_to_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "users" in existing_tables:
        existing_columns = {c["name"] for c in inspector.get_columns("users")}
        if "membership_pending" not in existing_columns:
            op.add_column(
                "users",
                sa.Column("membership_pending", sa.Boolean(), nullable=False, server_default="0"),
            )
        if "pending_koepel" not in existing_columns:
            op.add_column(
                "users",
                sa.Column("pending_koepel", sa.String(length=255), nullable=True),
            )
        if "pending_school_id" not in existing_columns:
            op.add_column(
                "users",
                sa.Column("pending_school_id", sa.Integer(), nullable=True),
            )
            op.create_foreign_key(
                "fk_users_pending_school_id",
                "users",
                "schools",
                ["pending_school_id"],
                ["id"],
            )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "users" in existing_tables:
        existing_columns = {c["name"] for c in inspector.get_columns("users")}
        if "pending_school_id" in existing_columns:
            op.drop_constraint("fk_users_pending_school_id", "users", type_="foreignkey")
            op.drop_column("users", "pending_school_id")
        if "pending_koepel" in existing_columns:
            op.drop_column("users", "pending_koepel")
        if "membership_pending" in existing_columns:
            op.drop_column("users", "membership_pending")
