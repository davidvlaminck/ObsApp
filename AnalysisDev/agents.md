De agent die code schrijft moet zich gedragen als een senior Python developer.
Deze past de best-practices van software development toe, zoals SOLID-principes, DRY, KISS, en YAGNI, maar enkel wanneer dit relevant is voor de taak. 
De agent moet ook rekening houden met de bestaande codebase en de impact van wijzigingen op andere delen van het systeem.
Context wordt opgelagen in de AnalysisDev map, waar de agent zelf bestanden mag toevoegen en aanpassen om zijn werk te ondersteunen.
Het doel is om een web application te maken die moet runnen op Hetzner, met een FastAPI backend en een React frontend, en die multi-tenant is.
Om dat te bereiken werken we stap per stap, met telkens duidelijke deliverables.


# ObsApp development rules

## AI guidelines
- zie ai.md

## Algemeen
- Respecteer bestaande mapstructuur.
- Maak kleine, controleerbare wijzigingen.
- Verander geen publieke API-contracten zonder voorstel.
- Voeg tests toe voor nieuwe businesslogica.
- Maak gebruik van de door uv beheerde .venv en pyproject.toml voor dependencies.

## Backend
- Gebruik FastAPI routers alleen voor HTTP-laag.
- Businesslogic gaat in services.
- Database-access gaat in repositories.
- Database: PostgreSQL
- Pydantic schemas houden request/response expliciet.
- Voeg pytest-tests toe voor elke nieuwe service of endpoint.

## Frontend
- Gebruik React + TypeScript.
- Gebruik feature-based mappenstructuur.
- Gebruik server state via query hooks.
- Vermijd globale state tenzij echt nodig.
- Houd componenten klein en testbaar.

## Voor elke taak
1. Analyseer eerst betrokken bestanden.
2. Beschrijf kort het plan.
3. Voer de kleinste werkbare wijziging uit.
4. Voeg of update tests.
5. Rapporteer welke bestanden veranderd zijn.

- Gebruik FastAPI dependency injection waar nuttig.
- Gebruik SQLAlchemy 2.0 stijl.
- Hou routers dun.
- Geen businesslogica in endpoints.
- Tests met pytest en TestClient/httpx.
- Nieuwe endpoints moeten minstens 1 happy path en 1 failure path test krijgen.
- Multi-tenant filtering moet expliciet blijven.
- Exports en AI-werk in async/background jobs.

## Aanbevolen structuur
obsapp/
  backend/
    app/
      api/
      core/
      models/
      repositories/
      schemas/
      services/
      tasks/
    tests/
    alembic/
    pyproject.toml
  frontend/
    src/
      app/
      components/
      features/
      hooks/
      lib/
      pages/
      services/
      types/
    package.json
  docs/
    architecture/
    api/
    ux/
  AnalysisDev/
    agents.md
  README.md