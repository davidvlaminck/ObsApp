# ObsApp – Stappenplan MVP

## Doel
Zo snel mogelijk een lokaal runnende website met:
1. Een inlogpagina
2. Na inloggen: een landingspagina

Daarna kunnen we stap voor stap uitbreiden.

---

## Stap 1: Projectstructuur opzetten ✅
- Backend: FastAPI met basisstructuur
- Frontend: React + TypeScript met basisstructuur
- Zorg dat beide lokaal te runnen zijn

## Stap 2: Backend – Basis + Auth ✅
- Maak een eenvoudige `/auth/login` endpoint
- Gebruik voor nu hardcoded credentials of een simpele user-store
- Retourneer een JWT token of session cookie
- Maak een beschermde `/auth/me` endpoint om de ingelogde gebruiker op te halen

## Stap 3: Frontend – Loginpagina ✅
- Maak een loginformulier (email + wachtwoord)
- Verstuur credentials naar backend
- Sla token op (localStorage of cookie)
- Bij succes: redirect naar landingspagina

## Stap 4: Frontend – Landingspagina ✅
- Toon een eenvoudige landingspagina met "Welkom, [gebruiker]"
- Toon een uitlogknop die de session beëindigt

## Stap 5: Lokaal testen ✅
- Backend starten: `uv run uvicorn app.main:app --reload`
- Frontend starten: `npm run dev` (of `vite`)
- Test de flow: login → landingspagina → uitloggen

## Stap 6: Database migratie naar PostgreSQL ✅
- Configureer `DATABASE_URL` in `.env`
- Gebruik PostgreSQL in plaats van SQLite
- Seed script werkt automatisch met nieuwe database

## Stap 7: Tests toevoegen ✅
- Backend: pytest met SQLite in-memory en PostgreSQL integratie tests
- Frontend: vitest + testing-library (dependencies toegevoegd)

---

# Volgende stappen (na MVP)

## Fase 1: Multi-tenant basis
- [ ] Tenant model en database schema
- [ ] Tenant middleware/filtering in backend
- [ ] Tenant selectie bij login (indien meerdere tenants)

## Fase 2: Gebruikersbeheer
- [ ] Rollen systeem (admin, leerkracht, etc.)
- [ ] Gebruikersbeheer pagina (CRUD)
- [ ] Wachtwoord reset functionaliteit

## Fase 3: Observaties
- [ ] Observatie model (titel, beschrijving, datum, etc.)
- [ ] Observatie invoer formulier
- [ ] Observatie lijst/weergave
- [ ] Filteren en zoeken

## Fase 4: Export & Rapportage
- [ ] PDF export van observaties
- [ ] Statistieken dashboard
- [ ] Export naar Excel/CSV

## Fase 5: Productie klaar maken
- [ ] Alembic migrations
- [ ] Rate limiting op login
- [ ] Refresh tokens
- [ ] CORS configuratie
- [ ] HTTPS setup
- [ ] Monitoring en logging

---

## Technische keuzes MVP
- **Backend**: FastAPI, Pydantic, SQLAlchemy 2.0, JWT via `python-jose`
- **Frontend**: React 18 + TypeScript + Vite, React Router, Axios
- **Auth**: JWT-based (kortlevend access token)
- **Styling**: Material Design CSS (geen MUI vanwege compatibiliteit issues)
- **Database**: PostgreSQL (lokaal) / SQLite (backup)
- **Tests**: pytest (backend), vitest (frontend)
