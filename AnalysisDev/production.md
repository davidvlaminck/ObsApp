# Production Deployment & Maintenance Guide

## 1. Deploying Code Updates (No Downtime, No Data Loss)

After pulling new code, deploy with:

```bash
cd /opt/obsapp
git tag pre-update-$(date +%Y%m%d%H%M%S)
git pull origin main

cd backend
uv sync --no-dev
uv run alembic upgrade head   # Apply schema migrations
sudo systemctl restart obsapp-backend

cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

**Key point:** `alembic upgrade head` applies only schema changes (new columns, tables). It preserves all existing data.

---

## 2. What Runs on Every Backend Startup

`initialize_database()` in `database.py` runs once per process (via `get_db()` dependency):

1. **`Base.metadata.create_all(bind=engine)`** — Creates tables that don't exist (no-op if they already exist)
2. **`run_alembic_migrations()`** — Applies pending alembic migrations (idempotent)
3. **`seed_default_data()`** — Creates `admin@example.com` + "Demo School" **only if they don't exist** (idempotent, safe for production)

This means **restarting the backend alone is usually sufficient** to apply schema changes. Running `alembic upgrade head` manually before restart is best practice but not strictly required.

---

## 3. Seeding: Development vs Production

| Mechanism | What it does | When to use | Safe for production? |
|-----------|-------------|-------------|---------------------|
| `seed.py` (`scripts/seed.py`) | Full DB reset (`drop_all` + `create_all`) + creates admin, teacher, demo user, goals, activities, observations | **Development only** — bootstraps demo data | **NO** — destroys all data |
| `initialize_database()` → `seed_default_data()` | Creates admin + demo school if missing | **Always** — runs on every backend startup | **YES** — idempotent |
| `alembic upgrade head` | Applies schema migrations only | **Always** — before backend restart after code changes | **YES** — preserves data |

### Why `seed.py` should NEVER run in production

`seed.py`'s `reset_database()` does `Base.metadata.drop_all(bind=engine)` which drops **every table** including `alembic_version`, then recreates them. This destroys all user data (teachers, students, observations, user preferences). It exists only to bootstrap a fresh development environment with demo data.

### What each seed creates

| User | Created by | Password |
|------|-----------|----------|
| `admin@example.com` | `seed_default_data()` (auto) or `seed.py` | `admin` |
| `lieve@example.com` (teacher) | `seed.py` only | `lieve` |
| `demo@example.com` (demo user) | `seed.py` only | `demo` |

**Only `admin`** is auto-created by the app on startup. All other users must be created through the application's registration system or admin interface.

---

## 4. Adding a New Database Column (Example Workflow)

When you add a field to a model (e.g., `color_theme` on `User`):

1. **Edit the model** — add the column with a `default=` for Python-side default
2. **Generate the migration:**
   ```bash
   uv run alembic revision --autogenerate -m "add_color_theme_to_user"
   ```
3. **Ensure the migration is idempotent** — check if the column exists before adding:
   ```python
   def upgrade() -> None:
       conn = op.get_bind()
       inspector = sa.inspect(conn)
       existing_columns = {c["name"] for c in inspector.get_columns("users")}
       if "color_theme" not in existing_columns:
           op.add_column("users", sa.Column("color_theme", sa.String(length=50),
                         nullable=False, server_default="teil"))
   ```
4. **Update schemas** — add the field to Pydantic response schemas
5. **Deploy:**
   ```bash
   uv run alembic upgrade head
   sudo systemctl restart obsapp-backend
   ```

Existing rows automatically get the `server_default` value.

---

## 5. Common Issues & Solutions

### Issue: "No such table: users" after deployment

**Cause:** Tables were dropped (e.g., by `seed.py`) but `alembic_version` still shows head, so alembic skips table creation.

**Fix:**
```bash
# Option A: Let the app recreate tables (safe, idempotent)
sudo systemctl restart obsapp-backend

# Option B: Manually create tables
cd backend && uv run python -c "from app.core.database import Base, engine; from app.models import *; Base.metadata.create_all(bind=engine)"
```

### Issue: "Column 'color_theme' does not exist" errors

**Cause:** The alembic migration hasn't been applied to the database.

**Fix:**
```bash
cd backend && uv run alembic upgrade head
```

### Issue: Admin user can't log in after fresh deploy

**Cause:** `seed_default_data()` may not have run yet (first request hasn't triggered it).

**Fix:** Make any request to the API (which triggers `initialize_database()`), or:
```bash
cd backend && uv run python -c "from app.core.database import initialize_database; initialize_database()"
```

### Issue: Alembic says "already at head" but tables are missing

**Cause:** Database was partially reset (tables dropped but `alembic_version` retained).

**Fix:**
```bash
# Force alembic to re-baseline at current head
cd backend && uv run alembic stamp head
# Then let the app create missing tables on next startup
sudo systemctl restart obsapp-backend
```

---

## 6. Health Check & Verification After Deploy

```bash
# 1. Check backend is responding
curl http://localhost:8001/health

# 2. Check alembic is at head
cd backend && uv run alembic current

# 3. Check tables exist
uv run python -c "from app.core.database import engine; from sqlalchemy import inspect; print(inspect(engine).get_table_names())"

# 4. Test login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin"}'

# 5. Test authenticated endpoint
TOKEN=$(curl -s http://localhost:8001/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}' | jq -r .access_token)
curl http://localhost:8001/api/user-settings -H "Authorization: Bearer $TOKEN"
```
