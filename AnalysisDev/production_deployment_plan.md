# ObsApp - Productie Deployment Plan

## Doel

Dit document beschrijft alle stappen en verbeteringen die nodig zijn om ObsApp te deployen op een productieomgeving, gehost op een **Hetzner Cloud Cost-Optimized** server.

---

## 1. Server Keuze (Hetzner Cloud)

### Aanbevolen Server: CX32

| Specificatie | Waarde |
|-------------|--------|
| vCPU | 4 |
| RAM | 8 GB |
| Opslag | 80 GB NVMe SSD |
| Bandbreedte | 20 TB |
| Prijs | ~€8,59/maand |

**Redenatie:** De CX32 biedt voldoende headroom voor een FastAPI backend + PostgreSQL database + Nginx reverse proxy, met ruimte voor toekomstige groei. Voor een kleinere installatie kan de CX22 (2 vCPU, 4 GB RAM, €4,59/maand) ook volstaan.

### Locatie
Kies een datacenter dichtbij de gebruikers (bijv. **Falkenstein (FS)** of **Nuremberg (NB)** voor Belgische/Nederlandse gebruikers).

---

## 2. Operating System

### Aanbevolen: Ubuntu 24.04 LTS

```bash
# Na eerste login:
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban curl wget git
```

### Firewall (UFW)
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (redirect naar HTTPS)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### SSH Hardening
```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

---

## 3. Database: PostgreSQL

### Installatie
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### Database & Gebruiker Aanmaken
```sql
-- Uitvoeren als postgres gebruiker
CREATE ROLE obsapp_user WITH LOGIN PASSWORD '<sterk-wachtwoord>';
CREATE DATABASE obsapp OWNER obsapp_user;
```

### PostgreSQL Configuratie (`/etc/postgresql/16/main/postgresql.conf`)
```ini
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 1GB            # ~25% van RAM op CX32
work_mem = 16MB
maintenance_work_mem = 256MB
effective_cache_size = 4GB      # ~50% van RAM
```

### Backup Strategie

#### Stap 1: Maak een backup map aan

Voer deze commando's uit op de server (via SSH):

```bash
# Maak de map aan met de juiste rechten
sudo mkdir -p /var/backups
sudo chown root:root /var/backups
sudo chmod 755 /var/backups
```

#### Stap 2: Maak een backup script

Maak een nieuw bestand aan met `sudo nano /usr/local/bin/obsapp-backup.sh`:

```bash
#!/bin/bash
# Dit script maakt een backup van de ObsApp database

# Configuratie
BACKUP_DIR="/var/backups"
DB_USER="obsapp_user"
DB_NAME="obsapp"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/obsapp_$DATE.sql.gz"
RETENTION_DAYS=7

# Maak backup map aan als die niet bestaat
mkdir -p "$BACKUP_DIR"

# Voer pg_dump uit en comprimeer het resultaat
# De wachtwoord wordt automatisch opgehaald uit .pgpass (zie Stap 3)
/usr/bin/pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Controleer of de backup succesvol was
if [ $? -eq 0 ]; then
    echo "Backup succesvol: $BACKUP_FILE"
else
    echo "Backup MISLUKT!" >&2
    exit 1
fi

# Verwijder oude backups (ouder dan 7 dagen)
find "$BACKUP_DIR" -name "obsapp_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Oude backups opgeruimd. Behouden: $(ls $BACKUP_DIR/obsapp_*.sql.gz 2>/dev/null | wc -l) bestanden"
```

Sla het bestand op en maak het uitvoerbaar:

```bash
sudo chmod +x /usr/local/bin/obsapp-backup.sh
```

#### Stap 3: Configureer database wachtwoord (zodat het script zonder wachtwoordprompt werkt)

Maak een `.pgpass` bestand in de home directory van de root gebruiker:

```bash
sudo nano /root/.pgpass
```

Voeg deze regel toe (vervang `<jouw-wachtwoord>` met het echte database wachtwoord):

```
localhost:5432:obsapp:obsapp_user:<jouw-wachtwoord>
```

Zet de juiste rechten (PostgreSQL accepteert `.pgpass` alleen als de rechten 0600 zijn):

```bash
sudo chmod 600 /root/.pgpass
```

#### Stap 4: Test het backup script

Voer het script handmatig uit om te controleren of het werkt:

```bash
sudo /usr/local/bin/obsapp-backup.sh
```

Je zou moeten zien:
```
Backup succesvol: /var/backups/obsapp_20260720_093000.sql.gz
Oude backups opgeruimd. Behouden: 1 bestanden
```

Controleer of het backup bestand bestaat:

```bash
ls -lh /var/backups/
```

Je zou een bestand moeten zien zoals `obsapp_20260720_093000.sql.gz`.

#### Stap 5: Test een restore (belangrijk!)

Een backup is alleen nuttig als je hem ook kunt terugzetten. Test dit:

```bash
# Maak een test database
sudo -u postgres createdb obsapp_test

# Herstel de backup in de test database
gunzip -c /var/backups/obsapp_*.sql.gz | sudo -u postgres psql obsapp_test

# Controleer of de data er is
sudo -u postgres psql -d obsapp_test -c "SELECT count(*) FROM users;"
```

Als je een foutmelding krijgt, controleer dan of de backup correct is gemaakt.

#### Stap 6: Automatiseer met cron (dagelijkse backup)

Open de crontab van root:

```bash
sudo crontab -e
```

Voeg deze regel toe aan het einde van het bestand:

```
# Dagelijkse backup van ObsApp database om 02:00 uur
0 2 * * * /usr/local/bin/obsapp-backup.sh >> /var/log/obsapp-backup.log 2>&1
```

Sla het bestand op en verlaat de editor.

#### Stap 7: Controleer of de cron job werkt

Wacht tot 02:00 uur of forceer de job:

```bash
# Controleer de log
sudo tail -f /var/log/obsapp-backup.log
```

Je zou de output van het script moeten zien.

#### Overzicht van het backup systeem

| Onderdeel | Locatie | Doel |
|-----------|---------|------|
| Backup script | `/usr/local/bin/obsapp-backup.sh` | Maakt dagelijkse backups |
| Backup bestanden | `/var/backups/` | Opslag van `.sql.gz` bestanden |
| Database wachtwoord | `/root/.pgpass` | Automatisch inloggen voor pg_dump |
| Log bestand | `/var/log/obsapp-backup.log` | Geschiedenis van backup runs |
| Cron job | `root crontab` | Start de backup elke dag om 02:00 |

#### Restore procedure (wanneer nodig)

Als je een restore moet doen:

```bash
# 1. Stop de backend
sudo systemctl stop obsapp-backend

# 2. Verwijder de huidige database (of hernoem voor veiligheid)
sudo -u postgres psql -c "DROP DATABASE obsapp;"
sudo -u postgres psql -c "CREATE DATABASE obsapp OWNER obsapp_user;"

# 3. Herstel de meest recente backup
sudo -u postgres gunzip -c /var/backups/obsapp_*.sql.gz | sudo -u postgres psql obsapp

# 4. Start de backend weer
sudo systemctl start obsapp-backend

# 5. Controleer of de app werkt
curl http://localhost:8000/health
```

---

## 4. Backend Deployment

### 4.1 Code Ophalen
```bash
# Op de server
cd /opt
sudo git clone <repository-url> obsapp
sudo chown -R $USER:$USER obsapp
cd obsapp/backend
```

### 4.2 Environment Configuratie

Maak `backend/.env` aan (gebruik een echte secret key!):

```env
# Database
DATABASE_URL=postgresql://obsapp_user:<sterk-wachtwoord>@localhost:5432/obsapp

# Security (VERANDER DEZE!)
SECRET_KEY=<genereer-met-openssl-rand-hex-32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
DEBUG=False
APP_NAME=ObsApp

# SMTP (gebruik een echte provider zoals Mailgun, SendGrid of Postmark)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM_EMAIL=noreply@jouwdomein.be

# Frontend
FRONTEND_BASE_URL=https://jouwdomein.be

# Demo accounts
ACTIVATION_TOKEN_EXPIRE_HOURS=48
DEMO_ACCOUNT_EXPIRE_DAYS=30
```

**Secret key genereren:**
```bash
openssl rand -hex 32
```

### 4.3 Dependencies Installeren
```bash
cd /opt/obsapp/backend
uv sync --no-dev
```

### 4.4 Database Migraties

Het project gebruikt momenteel `create_all()` met handmatige kolom-migraties in [`database.py`](backend/app/core/database.py:18). Voor productie is **Alembic** aanbevolen.

**Huidige situatie:**
- Geen Alembic configuratie (lege `backend/alembic/` map)
- Tabellen worden automatisch aangemaakt bij eerste start
- Kolom-toevoegingen gebeuren via `ensure_*_columns()` functies

**Aanbevolen actie:**
1. Configureer Alembic:
   ```bash
   cd backend
   uv run alembic init alembic
   ```
2. Genereer initiële migratie van bestaande modellen
3. Verwijder `create_all()` en `ensure_*_columns()` uit [`database.py`](backend/app/core/database.py:18)
4. Voeg alle kolom-migraties toe als Alembic revisies

**Tijdelijke workaround (zonder Alembic):**
```bash
# Eerste keer starten (tabellen worden aangemaakt)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 4.5 Systemd Service

Maak `/etc/systemd/system/obsapp-backend.service`:

```ini
[Unit]
Description=ObsApp Backend (FastAPI)
After=network.target postgresql.service

[Service]
Type=exec
WorkingDirectory=/opt/obsapp/backend
Environment="PATH=/opt/obsapp/backend/.venv/bin"
ExecStart=/opt/obsapp/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now obsapp-backend
sudo systemctl status obsapp-backend
```

### 4.6 Worker Count

Op een CX32 (4 vCPU): **4 workers** is optimaal. Voor de CX22 (2 vCPU): **2 workers**.

---

## 5. Frontend Deployment

### 5.1 Build
```bash
cd /opt/obsapp/frontend
npm install
npm run build
```

Dit genereert een `dist/` map met statische bestanden.

### 5.2 Nginx Configuratie

Maak `/etc/nginx/sites-available/obsapp`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Redirect naar HTTPS (wanneer domeinnaam beschikbaar is)
    # Zonder domeinnaam: comment deze regel uit en gebruik de onderstaande server block
    return 301 https://$host$request_uri;
}

# Tijdelijke HTTP configuratie zonder domeinnaam (gebruik server IP)
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Frontend statische bestanden
    root /opt/obsapp/frontend/dist;
    index index.html;

    # Client max body size voor uploads
    client_max_body_size 10M;

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads (student afbeeldingen)
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
    }

    # SPA fallback (alleen voor niet-API routes)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache statische bestanden
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name jouwdomein.be www.jouwdomein.be;

    # SSL certificaten (Let's Encrypt) - pas aan wanneer domeinnaam beschikbaar is
    # ssl_certificate /etc/letsencrypt/live/jouwdomein.be/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/jouwdomein.be/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend statische bestanden
    root /opt/obsapp/frontend/dist;
    index index.html;

    # Client max body size voor uploads
    client_max_body_size 10M;

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads (student afbeeldingen)
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
    }

    # SPA fallback (alleen voor niet-API routes)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache statische bestanden
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/obsapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

> **Let op:** Zonder domeinnaam kun je de app bereiken via het server IP adres (bijv. `http://123.45.67.89`). De HTTPS configuratie en SSL certificaat kunnen later toegevoegd worden wanneer je een domeinnaam hebt gekocht en deze naar je server IP laat wijzen.
```

### 5.3 Let's Encrypt SSL Certificaat (na domeinnaam aanschaffen)

Wanneer je een domeinnaam hebt gekocht en deze naar je server IP laat wijzen:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d jouwdomein.be -d www.jouwdomein.be
```

Auto-renewal is standaard geconfigureerd.

> **Zonder domeinnaam:** Je kunt de app volledig gebruiken via HTTP op het server IP adres. SSL is pas nodig wanneer je een domeinnaam hebt en HTTPS wilt gebruiken.

---

## 6. CORS Configuratie

Update [`main.py`](backend/app/main.py:15) voor productie:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://jouwdomein.be", "https://www.jouwdomein.be"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> **Zonder domeinnaam:** Voeg ook het server IP toe aan `allow_origins` voor lokale toegang via IP, bijvoorbeeld `"http://123.45.67.89"`.

---

## 7. Code Verbeteringen Nodig Voor Productie

### 7.1 Backend

| # | Verbetering | Prioriteit | Bestand |
|---|-------------|-----------|---------|
| 1 | **Secret key uit environment** | KRITIEK | [`config.py`](backend/app/core/config.py:13) - `secret_key` heeft een hardcoded default |
| 2 | **Debug=False** | KRITIEK | [`config.py`](backend/app/core/config.py:12) - `debug=True` is gevaarlijk in productie |
| 3 | **Rate limiting op login** | HOOG | [`auth.py`](backend/app/api/auth.py) - geen beperking op login pogingen |
| 4 | **Refresh tokens** | MEDIUM | [`security.py`](backend/app/core/security.py) - alleen access tokens, geen refresh |
| 5 | **Alembic migraties** | HOOG | [`database.py`](backend/app/core/database.py) - vervang `create_all()` + handmatige kolom-migraties |
| 6 | **Logging configuratie** | MEDIUM - Geen logging buiten `print()` statements |
| 7 | **Request logging** | MEDIUM - Geen request/response logging |
| 8 | **Email error handling** | MEDIUM | [`registration.py`](backend/app/api/registration.py:107) - `except Exception: pass` zwijgt over fouten |
| 9 | **Input validatie** | MEDIUM - Controleer of alle inputs correct gevalideerd worden |
| 10 | **Health check uitbreiden** | LAAG | [`main.py`](backend/app/main.py:128) - alleen `{"status": "ok"}`, geen DB check |

### 7.2 Frontend

| # | Verbetering | Prioriteit | Bestand |
|---|-------------|-----------|---------|
| 1 | **API base URL configuratie** | KRITIEK | [`auth.ts`](frontend/src/services/auth.ts:3) - `baseURL: '/api'` is OK met reverse proxy, maar geen environment vars |
| 2 | **Error boundaries** | MEDIUM - Geen React error boundaries |
| 3 | **Loading states** | MEDIUM - Controleer of alle async calls loading states hebben |
| 4 | **Environment variabelen** | LAAG | Gebruik `import.meta.env.VITE_*` voor configuratie |

### 7.3 Infrastructure

| # | Verbetering | Prioriteit |
|---|-------------|-----------|
| 1 | **Docker & Docker Compose** | OPTIONEEL - Handig voor consistentie, niet noodzakelijk voor solo dev |
| 2 | **CI/CD pipeline** | MEDIUM - GitHub Actions of GitLab CI |
| 3 | **Monitoring** | MEDIUM - UptimeRobot of zelf gehoste monitoring |
| 4 | **Backup automatisering** | KRITIEK - Zie sectie 3 |
| 5 | **.env.example** | KRITIEK - Voor ontwikkelaars |

---

## 8. Docker Configuratie (Optioneel)

Docker is **niet noodzakelijk** voor deze applicatie op een enkele CX32 server. Het is een handige optie voor consistentie en onderhoud, maar introduceert ook extra complexiteit.

**Wanneer Docker wel nuttig is:**
- Je wilt dezelfde omgeving lokaal en op de server
- Je wilt updates kunnen rollen zonder handmatig code terug te zetten
- Je later meer services toevoegt of wilt schalen

**Wanneer Docker niet nodig is:**
- Eén developer die de server zelf beheert
- Geen noodzaak voor consistente development omgevingen
- Transparantie en eenvoud zijn belangrijker dan isolatie

**Performance op CX32:** Docker heeft ~0-3% CPU overhead en ~50-100 MB RAM overhead. Voor deze applicatie is dat verwaarloosbaar.

**Aanbevolen aanpak voor solo dev:** Gebruik systemd + Nginx (zoals beschreven in secties 4.5 en 5.2). Dit is transparanter, minder layers om te debuggen, en voldoet volledig aan de behoeften.

### 8.1 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Copy application
COPY app ./app

# Create uploads directory
RUN mkdir -p uploads/students

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 8.2 Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 8.3 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: obsapp_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: obsapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      DATABASE_URL: postgresql://obsapp_user:${DB_PASSWORD}@db:5432/obsapp
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: "false"
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM_EMAIL: ${SMTP_FROM_EMAIL}
      FRONTEND_BASE_URL: ${FRONTEND_BASE_URL}
    volumes:
      - ./backend/uploads:/app/uploads
    depends_on:
      - db
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "127.0.0.1:3000:80"
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## 9. Monitoring & Logging

### 9.1 Backend Logs (Systemd)
```bash
# Logs bekijken
journalctl -u obsapp-backend -f

# Logs rotatie (automatisch via journald)
```

### 9.2 Nginx Logs
```bash
# Standaard al geconfigureerd in /var/log/nginx/
```

### 9.3 Uptime Monitoring
Gebruik een externe service zoals **UptimeRobot** of **Better Uptime** om de `/health` endpoint te monitoren:
```
https://jouwdomein.be/health
```

### 9.4 Database Monitoring
```sql
-- Controleer database grootte
SELECT pg_size_pretty(pg_database_size('obsapp'));

-- Actieve verbindingen
SELECT count(*) FROM pg_stat_activity WHERE datname = 'obsapp';
```

---

## 10. Security Checklist

### Voor Productie

- [ ] **SECRET_KEY** gegenereerd met `openssl rand -hex 32` en in `.env` geplaatst
- [ ] **DEBUG=False** in productie
- [ ] **CORS** beperkt tot productie domein
- [ ] **HTTPS** geconfigureerd met Let's Encrypt
- [ ] **Firewall** actief (UFW) - alleen 22, 80, 443 open
- [ ] **SSH** hardening (geen root login, alleen key-based)
- [ ] **Fail2ban** geconfigureerd voor SSH en Nginx
- [ ] **Database** wachtwoord is sterk en uniek
- [ ] **Admin gebruiker** wachtwoord gewijzigd na eerste login
- [x] **Rate limiting** geïmplementeerd op login endpoint (5 requests/minuut per IP via slowapi)
- [ ] **Backup** strategie actief en getest
- [ ] **.env** niet gecommit naar repository
- [ ] **Student uploads** map heeft correcte permissions (niet wereld-leesbaar)

---

## 11. Deployment Stappen (Samenvatting)

### Eénmalige Setup (zonder domeinnaam mogelijk)

1. **Server aanmaken** op Hetzner Cloud (CX32, Ubuntu 24.04)
2. **SSH key** configureren, root login uitschakelen
3. **Firewall** activeren (UFW)
4. **PostgreSQL** installeren en database aanmaken
5. **Code klonen** naar `/opt/obsapp`
6. **Backend .env** configureren met productie waarden
7. **Backend dependencies** installeren (`uv sync --no-dev`)
8. **Systemd service** aanmaken voor backend
9. **Frontend build** uitvoeren (`npm run build`)
10. **Nginx** configureren als reverse proxy (gebruik server IP in plaats van domeinnaam)
11. **Backup cronjob** instellen

> **Zonder domeinnaam:** Stappen 1-10 kunnen volledig uitgevoerd worden zonder domeinnaam. De app is bereikbaar via het server IP adres. SSL certificaat (stap 11) kan later toegevoegd worden wanneer je een domeinnaam hebt.

### Updates Deployen

```bash
cd /opt/obsapp
git pull origin main

# Backend
cd backend
uv sync --no-dev
sudo systemctl restart obsapp-backend

# Frontend
cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

---

## 12. Kosten Overzicht (Maandelijks)

| Dienst | Kosten |
|--------|--------|
| Hetzner CX32 | ~€8,59 |
| Backups (inbegrepen) | €0,00 |
| Domeinnaam | ~€1,00 - €2,00 |
| SSL Certificaat (Let's Encrypt) | €0,00 |
| Email service (SendGrid gratis tier) | €0,00 |
| **Totaal** | **~€9,59 - €10,59/maand** |

---

## 13. Volgende Stappen

1. [x] **Rate limiting op login** geïmplementeerd (5 requests/minuut per IP via slowapi)
2. [ ] **Optioneel:** Koop een domeinnaam en richt deze op de server IP (voor HTTPS en custom URL)
3. [ ] Configureer Alembic voor database migraties
4. [ ] Genereer sterke SECRET_KEY
5. [ ] Stel SMTP provider op (SendGrid/Mailgun)
6. [ ] Maak `.env.example` aan voor ontwikkelaars
7. [ ] Implementeer refresh tokens
8. [ ] Voeg logging toe aan backend
9. [ ] Test backup/restore procedure
10. [ ] Configureer monitoring (UptimeRobot)

---

*Laatst bijgewerkt: 2026-07-20*
