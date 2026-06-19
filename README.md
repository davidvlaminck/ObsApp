# ObsApp

Multi-tenant observatie-app met FastAPI backend en React frontend.

## Vereisten

- Python 3.11+
- Node.js 18+
- uv (Python package manager)
- npm

## PostgreSQL installeren en configureren op Linux

De backend verwacht standaard deze PostgreSQL-connectie:

```env
DATABASE_URL=postgresql://obsapp_user:obsapp_pass@localhost:5432/obsapp
```

Deze instructies gaan ervan uit dat PostgreSQL nog niet geïnstalleerd is op een Linux-machine. Als PostgreSQL al geïnstalleerd is, sla de installatiestappen over en voer enkel de stappen voor het aanmaken van de databasegebruiker en database uit.

### Debian/Ubuntu

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Controleer de service:

```bash
systemctl status postgresql --no-pager
```

### Fedora/RHEL

```bash
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb --unit postgresql
sudo systemctl enable --now postgresql
```

Controleer de service:

```bash
systemctl status postgresql --no-pager
```

### Databasegebruiker en database aanmaken

Voer dit uit als gebruiker met `sudo`-rechten. Dit maakt de PostgreSQL-role `obsapp_user` aan met wachtwoord `obsapp_pass`, maakt database `obsapp` aan als die nog niet bestaat, en wijst de database toe aan `obsapp_user`.

```bash
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'obsapp_user') THEN
    CREATE ROLE obsapp_user WITH LOGIN PASSWORD 'obsapp_pass';
  ELSE
    ALTER ROLE obsapp_user WITH LOGIN PASSWORD 'obsapp_pass';
  END IF;
END
$$;

SELECT 'CREATE DATABASE obsapp OWNER obsapp_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'obsapp')\gexec
ALTER DATABASE obsapp OWNER TO obsapp_user;
SQL
```

Test de connectie met de applicatiegebruiker:

```bash
PGPASSWORD=obsapp_pass psql -h localhost -U obsapp_user -d obsapp -c "SELECT current_user, current_database();"
```

Verwachte output bevat:

```text
 current_user | current_database
--------------+------------------
 obsapp_user  | obsapp
```

### `.env` controleren

Controleer of `backend/.env` dezelfde database-URL bevat:

```env
DATABASE_URL=postgresql://obsapp_user:obsapp_pass@localhost:5432/obsapp
```

Als je een andere databasegebruiker, wachtwoord, host of databasenaam kiest, pas `DATABASE_URL` in `backend/.env` aan. Commit geen echte wachtwoorden naar de repository.

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

Als je de PostgreSQL-installatie hierboven hebt gevolgd, bestaan de databasegebruiker `obsapp_user` en database `obsapp` al.

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

Om de database te resetten (alle tabellen verwijderen, opnieuw aanmaken en opnieuw seeden):

```bash
cd backend
uv run python scripts/seed.py
```

Dit reset enkel de tabellen in de database. De PostgreSQL-role `obsapp_user` en database `obsapp` blijven behouden.

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
