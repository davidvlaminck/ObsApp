# Database Migraties met Alembic

Deze gids legt uit hoe je database-migraties beheert met Alembic in dit project.

## Wat is Alembic?

Alembic is een database-migratietool voor SQLAlchemy. Het genereert versiebeheerde migratiescripts die zowel schema-veranderingen (DDL) als data-transformaties (DML) bevatten kunnen.

## Architectuur

```
backend/
├── alembic/
│   ├── env.py              # Alembic configuratie (importeert app-modellen)
│   ├── script.py.mako      # Template voor nieuwe migraties
│   └── versions/
│       ├── 6e20bb72433b_initial_schema.py   # Baseline (lege migratie)
│       └── a14bb4af87eb_normalize_goal_subject_and_subdomain.py  # Data-migratie
├── alembic.ini             # Alembic instellingen
├── app/
│   └── core/
│       └── database.py     # Initialiseert Alembic bij opstarten
└── MIGRATIONS.md           # Deze gids
```

## Hoe het werkt

1. **Bij opstarten** roept [`initialize_database()`](app/core/database.py:60) eerst [`Base.metadata.create_all()`](app/core/database.py:68) aan (voor verse databases) en daarna [`run_alembic_migrations()`](app/core/database.py:70).
2. **Alembic** voert alleen nog niet toegepaste migraties uit.
3. De `alembic_version` tabel in de database bijhoudt welke migraties zijn toegepast.
4. **`seed_default_data()`** (in `database.py`) maakt alleen een admin-gebruiker en demo-school aan als deze nog niet bestaan — dit is **idempotent** en veilig voor productie.

> **Belangrijk:** Gebruik `scripts/seed.py` **alleen voor ontwikkeling**. Dat script doet een volledige database-reset (`drop_all` + `create_all`) en maakt demo-gebruikers aan (admin, lief, demo). Zie [`../AnalysisDev/production.md`](../AnalysisDev/production.md) voor de productie-deploy workflow.

## Nieuwe migratie aanmaken

### 1. Schema-verandering (autogenerate)

Als je een model aanpast (bijv. een kolom toevoegt of verwijdert):

```bash
cd backend
uv run alembic revision --autogenerate -m "beschrijving_van_de_verandering"
```

Controleer de gegenereerde migratie in `alembic/versions/`. Pas deze aan indien nodig.

### 2. Data-migratie (handmatig)

Als je data moet transformeren (bijv. waarden normaliseren):

```bash
cd backend
uv run alembic revision -m "beschrijving_van_data_verandering"
```

Bewerk het gegenereerde bestand en vul `upgrade()` met je SQL of SQLAlchemy-code:

```python
def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE goals SET subject = 'Nederlands' WHERE subject = 'ned'")
    )

def downgrade() -> None:
    # Data-migraties zijn meestal niet omkeerbaar
    pass
```

### 3. Migraties toepassen

```bash
# Alle migraties toepassen
cd backend
uv run alembic upgrade head

# Of laat de app het doen (bij opstarten)
uv run python -c "from app.core.database import initialize_database; initialize_database()"
```

### 4. Huidige status bekijken

```bash
cd backend
uv run alembic current
```

### 5. Geschiedenis bekijken

```bash
cd backend
uv run alembic history
```

## Best practices

1. **Commit migraties naar Git** — ze zijn onderdeel van je codebase.
2. **Test migraties** — voer `upgrade` en `downgrade` uit op een testdatabase.
3. **Nooit `downgrade()` leeg laten voor schema-migraties** — Alembic moet kunnen terugkeren.
4. **Data-migraties zijn idempotent** — schrijf ze zodanig dat ze veilig kunnen worden uitgevoerd op een database waar ze al eens zijn uitgevoerd.
5. **Gebruik `sa.text()` voor raw SQL** — voorkom SQL-injectie.

## Voorbeeld: Kolom toevoegen

```bash
# 1. Pas het model aan
# 2. Genereer migratie
uv run alembic revision --autogenerate -m "add_is_archived_to_observations"

# 3. Controleer en pas de migratie aan
# 4. Pas de Pydantic-schema's aan
# 5. Commit en deploy
```

## Troubleshooting

### "Target metadata is None"
Zorg dat alle modellen geïmporteerd zijn in [`alembic/env.py`](backend/alembic/env.py).

### "No such table"
Gebruik `Base.metadata.create_all()` of voer de ontbrekende migraties uit met `alembic upgrade head`.

### "Circular import"
Vermijd imports van `app.main` in `app.api.*` modules. Gebruik late imports (binnen functies) indien nodig.
