# ObsApp

Multi-tenant observatie-app met FastAPI backend en React frontend.

## Vereisten

- Python 3.11+
- Node.js 18+
- uv (Python package manager)
- npm

## Lokale ontwikkeling

### 1. Backend starten

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Backend draait op `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Database initialiseren (eerste keer)

Zorg dat PostgreSQL lokaal draait en maak een database aan (bijv. `obsapp`):

```bash
sudo -u postgres psql -c "CREATE DATABASE obsapp;"
```

Start de backend (de tabellen worden automatisch aangemaakt):

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Of seed handmatig:

```bash
cd backend
uv run python scripts/seed.py
```

Dit seed een standaard admin gebruiker:
- Email: `admin@example.com`
- Wachtwoord: `admin`

### 3. Frontend starten

Open een tweede terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend draait op `http://localhost:5173`

### 4. Testen

1. Open `http://localhost:5173/login`
2. Log in met `admin@example.com` / `admin`
3. Je wordt doorgestuurd naar de landingspagina

## Database resetten

Om de database te resetten (alle data verwijderen en opnieuw seeden):

```bash
cd backend
uv run python scripts/seed.py
```

## Productie deployment

### Backend

1. Zet `DATABASE_URL` in de environment (PostgreSQL op productie):
   ```bash
   export DATABASE_URL=postgresql://user:pass@host:5432/obsapp
   ```

2. Installeer dependencies:
   ```bash
   cd backend
   uv sync --no-dev
   ```

3. Run migrations (wanneer Alembic is geconfigureerd):
   ```bash
   uv run alembic upgrade head
   ```

4. Start met Gunicorn + Uvicorn workers:
   ```bash
   uv run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

### Frontend

1. Build:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Serveer de `dist/` map met Nginx of een static file server.

### Security checklist voor productie

- [ ] Verander `SECRET_KEY` in `.env` naar een sterke, unieke waarde
- [ ] Verwijder of deactiveer de admin gebruiker (`admin@example.com`) na eerste login
- [ ] Gebruik HTTPS (Let's Encrypt / certificaten)
- [ ] Zet `DEBUG=False` in productie
- [ ] Configureer CORS voor je productie domein
- [ ] Gebruik een PostgreSQL database in plaats van SQLite
- [ ] Voeg rate limiting toe aan login endpoint
- [ ] Overweeg refresh tokens voor langere sessies

## Projectstructuur

```
obsapp/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers
│   │   ├── core/          # Config, security, database
│   │   ├── models/        # SQLAlchemy models
│   │   ├── repositories/  # Database access
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── main.py        # FastAPI app entrypoint
│   ├── scripts/
│   │   └── seed.py        # Database reset + seed
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── pages/         # Pagina's (Login, Landing)
│   │   ├── services/      # API calls
│   │   └── App.tsx        # Router
│   ├── package.json
│   └── vite.config.ts
├── AnalysisDev/           # Analyse documenten
└── README.md
```

## Volgende stappen

- [ ] Multi-tenant filtering toevoegen
- [ ] Rollen en permissies (admin, leerkracht, etc.)
- [ ] Observatie invoer en overzichten
- [ ] PDF export
- [ ] Echte gebruikersbeheer pagina
