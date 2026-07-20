"""normalize_goal_subject_and_subdomain

Revision ID: a14bb4af87eb
Revises: 6e20bb72433b
Create Date: 2026-07-20 15:53:38.919750

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a14bb4af87eb'
down_revision: Union[str, Sequence[str], None] = '6e20bb72433b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Normalize goal subjects and populate subdomain from level."""
    connection = op.get_bind()

    # Normalize subject values to canonical Dutch subject names
    connection.execute(
        sa.text(
            """
            UPDATE goals
            SET subject = CASE
                WHEN lower(subject) IN ('ned', 'ned_com', 'nederlands en communicatie', 'nederlands & communicatie', 'nederlands-communicatie') THEN 'Nederlands'
                WHEN lower(subject) IN ('wiskunde', 'w_t') THEN 'Wiskunde'
                WHEN lower(subject) IN ('aardr') THEN 'Aardrijkskunde'
                WHEN lower(subject) IN ('gesch') THEN 'Geschiedenis'
                WHEN lower(subject) IN ('v_g') THEN 'Vormgeving'
                WHEN lower(subject) IN ('lele') THEN 'Levensleer'
                WHEN lower(subject) IN ('muvo') THEN 'Muziek en visuele opvoeding'
                WHEN lower(subject) IN ('rkg') THEN 'Religie en levensbeschouwing'
                ELSE subject
            END
            WHERE subject IS NOT NULL
            """
        )
    )

    # Populate subdomain from level where subdomain is still NULL
    connection.execute(
        sa.text(
            """
            UPDATE goals
            SET subdomain = level
            WHERE subdomain IS NULL
              AND level IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    """Downgrade schema.

    Note: Data migrations are not easily reversible because the original
    values are overwritten. If you need to revert, restore from a backup.
    """
    pass
