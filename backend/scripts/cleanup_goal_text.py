"""Cleanup script to fix existing goal text in the database.

Decodes HTML entities, removes zero-width characters, and normalizes
special spaces in all goal fields (title, description, voorbeelden, vocabulary).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import html
import re
from app.core.database import SessionLocal
from app.models.goal import Goal


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    # Decode HTML entities
    text = html.unescape(text)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Remove zero-width characters
    text = text.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "")
    # Normalize special spaces to regular space
    text = text.replace("\u202f", " ").replace("\u2008", " ")
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if line:
            line = line.lstrip("•").strip()
            if line:
                cleaned_lines.append(line)
    return "\n".join(cleaned_lines) if cleaned_lines else None


def cleanup_goals():
    db = SessionLocal()
    try:
        goals = db.query(Goal).all()
        updated = 0
        for goal in goals:
            changed = False
            for field in ["title", "description", "voorbeelden", "vocabulary"]:
                old_value = getattr(goal, field)
                if old_value:
                    new_value = clean_text(old_value)
                    if new_value != old_value:
                        setattr(goal, field, new_value)
                        changed = True
            if changed:
                updated += 1
        db.commit()
        print(f"Cleaned {updated} goals out of {len(goals)} total.")
    finally:
        db.close()


if __name__ == "__main__":
    cleanup_goals()
