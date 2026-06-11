# ObsApp – Stappenplan MVP

## Doel
Zo snel mogelijk een lokaal runnende website met:
1. Een inlogpagina
2. Na inloggen: een landingspagina

Daarna kunnen we stap voor stap uitbreiden.

---

## Stap 1: Projectstructuur opzetten
- Backend: FastAPI met basisstructuur
- Frontend: React + TypeScript met basisstructuur
- Zorg dat beide lokaal te runnen zijn

## Stap 2: Backend – Basis + Auth
- Maak een eenvoudige `/auth/login` endpoint
- Gebruik voor nu hardcoded credentials of een simpele user-store
- Retourneer een JWT token of session cookie
- Maak een beschermde `/auth/me` endpoint om de ingelogde gebruiker op te halen

## Stap 3: Frontend – Loginpagina
- Maak een loginformulier (email + wachtwoord)
- Verstuur credentials naar backend
- Sla token op (localStorage of cookie)
- Bij succes: redirect naar landingspagina

## Stap 4: Frontend – Landingspagina
- Toon een eenvoudige landingspagina met "Welkom, [gebruiker]"
- Toon een uitlogknop die de session beëindigt

## Stap 5: Lokaal testen
- Backend starten: `uvicorn main:app --reload`
- Frontend starten: `npm run dev` (of `vite`)
- Test de flow: login → landingspagina → uitloggen

---

## Technische keuzes MVP
- **Backend**: FastAPI, Pydantic, SQLAlchemy 2.0 (voor later), JWT via `python-jose`
- **Frontend**: React 18 + TypeScript + Vite, React Router, Axios of fetch
- **Auth**: JWT-based (kortlevend access token + refresh token voor later)
- **Styling**: Voor nu simpele CSS of Tailwind (laatste keuze aan gebruiker)
