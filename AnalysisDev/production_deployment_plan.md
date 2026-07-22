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
export HOME=/root
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
HOME=/root 0 2 * * * /usr/local/bin/obsapp-backup.sh >> /var/log/obsapp-backup.log 2>&1
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
gunzip -c /var/backups/obsapp_*.sql.gz | sudo -u postgres psql obsapp

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
2. Update `alembic/env.py` voor SQLAlchemy:
   ```python
   from app.core.database import Base
   target_metadata = Base.metadata
   ```
3. Genereer initiële migratie van bestaande modellen:
   ```bash
   uv run alembic revision --autogenerate -m "Initial migration"
   ```
4. Controleer en test de migratie lokaal:
   ```bash
   uv run alembic downgrade base  # Wis schema
   uv run alembic upgrade head    # Voer migraties uit
   ```
5. Verwijder `create_all()` en `ensure_*_columns()` uit [`database.py`](backend/app/core/database.py:18)
6. Voeg migratie-check toe aan backend startup:
   ```python
   # In main.py
   from alembic.config import Config
   from alembic import command
   
   alembic_cfg = Config("alembic.ini")
   command.upgrade(alembic_cfg, "head")
   ```

**Migratie workflow in productie:**
```bash
# Voor updates
cd /opt/obsapp
git pull origin main
cd backend
uv run alembic upgrade head
sudo systemctl restart obsapp-backend
```

**Rollback procedure (als migratie faalt):**
```bash
# Controleer huidige versie
uv run alembic current

# Rollback naar vorige versie
uv run alembic downgrade -1

# Dan herstart backend
sudo systemctl restart obsapp-backend
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

    # Tijdelijke HTTP configuratie zonder domeinnaam (gebruik server IP)
    # WANNEER je een domeinnaam hebt, voeg een aparte server block toe voor HTTPS redirect:
    # server {
    #     listen 80;
    #     listen [::]:80;
    #     server_name jouwdomein.be www.jouwdomein.be;
    #     return 301 https://$host$request_uri;
    # }

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
| 0 | **Admin credentials in stdout** | KRITIEK | [`database.py`](backend/app/core/database.py:54) - seed print `admin@example.com / admin` naar stdout |
| 1 | **Secret key uit environment** | KRITIEK | [`config.py`](backend/app/core/config.py:13) - `secret_key` heeft een hardcoded default |
| 2 | **Debug=False** | KRITIEK | [`config.py`](backend/app/core/config.py:12) - `debug=True` is gevaarlijk in productie |
| 4 | **Backup alerting** | KRITIEK | Monitor failed backups, stuur alerts naar admin |
| 5 | **Alembic migraties** | HOOG | [`database.py`](backend/app/core/database.py) - vervang `create_all()` |
| 6 | **Structured logging** | HOOG | Geen logging buiten `print()`, gebruik `logging` module |
| 7 | **Health check uitbreiden** | MEDIUM | Voeg DB connectivity check toe |
| 8 | **Email error handling** | MEDIUM | [`registration.py`](backend/app/api/registration.py:107) - log fouten in plaats van silently fail |
| 9 | **Input validatie** | MEDIUM - Controleer op SQL injection, XSS |
| 10 | **Refresh tokens** | LAAG | Alleen access tokens volstaan voor deze use case |

### 7.2 Frontend

| # | Verbetering | Prioriteit | Bestand |
|---|-------------|-----------|---------|
| 1 | **API base URL configuratie** | LAAG | [`auth.ts`](frontend/src/services/auth.ts:3) - `baseURL: '/api'` is OK met reverse proxy, maar geen environment vars |
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

## 7.4 Rate Limiting op Login

Voeg `slowapi` toe aan dependencies:

```bash
cd backend
uv add slowapi
```

Implementeer rate limiting in [`auth.py`](backend/app/api/auth.py):

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    # Login logic
    pass
```

Add to main.py:
```python
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**Threshold:** 5 pogingen per minuut per IP address. Na 5 pogingen: 429 Too Many Requests.

---

## 7.5 Structured Logging

Vervang `print()` statements met `logging` module. Update [`main.py`](backend/app/main.py):

```python
import logging
import json
from logging.handlers import RotatingFileHandler

# Configureer logger
logger = logging.getLogger("obsapp")
logger.setLevel(logging.INFO)

# File handler met rotation (50MB max, 10 backups)
file_handler = RotatingFileHandler(
    "/var/log/obsapp-backend.log",
    maxBytes=50_000_000,
    backupCount=10
)

# JSON formatter voor machine-readability
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        return json.dumps(log_data)

file_handler.setFormatter(JSONFormatter())
logger.addHandler(file_handler)

# Health check met DB status
@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        logger.info("Health check passed")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "database": "disconnected"}, 503
```

**Log location:** `/var/log/obsapp-backend.log`

---

## 7.6 Error Handling voor Kritieke Operaties

Update [`registration.py`](backend/app/api/registration.py) email handling:

```python
import logging

logger = logging.getLogger("obsapp")

async def send_activation_email(email: str, token: str):
    try:
        # SMTP logic
        logger.info(f"Activation email sent to {email}")
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error for {email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Email service unavailable")
    except Exception as e:
        logger.error(f"Unexpected email error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Email service error")
```

---

## 7.7 Backup Alerting & Monitoring

Update het backup script met error notifications:

```bash
#!/bin/bash
# /usr/local/bin/obsapp-backup.sh

BACKUP_DIR="/var/backups"
DB_USER="obsapp_user"
DB_NAME="obsapp"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/obsapp_$DATE.sql.gz"
RETENTION_DAYS=7
ADMIN_EMAIL="admin@jouwdomein.be"

mkdir -p "$BACKUP_DIR"

# Backup maken
/usr/bin/pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup succesvol: $BACKUP_FILE ($BACKUP_SIZE)" | tee -a /var/log/obsapp-backup.log
    
    # Optioneel: stuur email bij succes
    # echo "Backup completed at $(date)" | mail -s "ObsApp Backup Success" "$ADMIN_EMAIL"
else
    ERROR_MSG="Backup MISLUKT op $(date)"
    echo "✗ $ERROR_MSG" >&2 | tee -a /var/log/obsapp-backup.log
    
    # KRITIEK: stuur alert email
    echo "Database backup failed. Check /var/log/obsapp-backup.log on the server." | \
        mail -s "ALERT: ObsApp Backup Failed" "$ADMIN_EMAIL"
    exit 1
fi

# Opruimen
find "$BACKUP_DIR" -name "obsapp_*.sql.gz" -mtime +$RETENTION_DAYS -delete
RETAINED=$(ls "$BACKUP_DIR"/obsapp_*.sql.gz 2>/dev/null | wc -l)
echo "Oude backups opgeruimd. Behouden: $RETAINED bestanden"
```

**Monitoring checklist:**
```bash
# Controleer laatst geslaagde backup
ls -lh /var/backups/obsapp_*.sql.gz | tail -1

# Controleer backup log op fouten
grep -E "MISLUKT|failed" /var/log/obsapp-backup.log

# Test backup alerting (handmatig)
sudo /usr/local/bin/obsapp-backup.sh
```

---

## 7.8 Deployment Rollback Strategy

Voor veilige updates met rollback mogelijkheid:

```bash
# Op de server: maak backup van huidige versie
cd /opt/obsapp
git tag pre-update-$(date +%Y%m%d%H%M%S)

# Pull nieuwe code
git pull origin main

# Test migraties (DRY RUN)
cd backend
uv run alembic upgrade head --sql > /tmp/migration-plan.sql

# Review migratie
cat /tmp/migration-plan.sql

# Voer update uit
cd /opt/obsapp/backend
uv sync --no-dev
uv run alembic upgrade head
sudo systemctl restart obsapp-backend

# Test health
sleep 2
curl http://localhost:8000/health

# Als iets misgaat: ROLLBACK
git reset --hard pre-update-$(date +%Y%m%d%H%M%S)
uv run alembic downgrade -1
sudo systemctl restart obsapp-backend
```

---

## 7.9 Load Testing & Worker Optimization

Bepaal het juiste aantal workers en cache strategie:

```bash
# Installeer Apache Bench
sudo apt install -y apache2-utils

# Test backend met 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:8000/health

# Monitor performance
watch -n 1 'ps aux | grep uvicorn | grep -v grep'
```

**Expected baseline (CX32 met 4 workers):**
- Requests per second: 50-100 (afhankelijk van query complexity)
- Response time: 50-200ms
- CPU utilization: 20-40% bij normaal load

**Aanpassingen:**
- Meer workers nodig? Verhoog naar 6-8 (test eerst!)
- Minder concurrent users? Verlaag naar 2 workers
- Note: `--workers auto` is geen geldige uvicorn CLI vlag; gebruik eenFixed aantal workers

---

## 7.10 Certificate Renewal Monitoring

Let's Encrypt certificaten vernieuwen automatisch, maar controleer regelmatig:

```bash
# Controleer vervaldatum
sudo openssl x509 -in /etc/letsencrypt/live/jouwdomein.be/cert.pem -noout -dates

# Test renewal (dry run)
sudo certbot renew --dry-run

# Setup renewal check in cron
sudo crontab -e
```

Voeg toe:
```
# Weekly certificate renewal check
0 12 * * 0 certbot renew --quiet && systemctl reload nginx
```

**Alert setup:** Monitor `/var/log/letsencrypt/` op errors:
```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log | grep -E "ERROR|CRITICAL"
```

---

## 7.11 Data Retention & GDPR Compliance

Voor student data:

```sql
-- Verwijder student accounts die ouder zijn dan 90 dagen (inactief)
-- Run deze query maandelijks via cron

DELETE FROM users 
WHERE role = 'student' 
  AND last_login < NOW() - INTERVAL '90 days'
  AND account_type = 'demo';

-- Archiveer oude uploads (student afbeeldingen ouder dan 1 jaar)
-- Run deze script maandelijks
-- find /opt/obsapp/backend/uploads/students -type f -mtime +365
```

**Aanbeveling:** Implement een data retention policy tabel:
```python
# backend/app/models/retention.py
class DataRetentionPolicy(Base):
    __tablename__ = "data_retention_policies"
    
    id = Column(Integer, primary_key=True)
    user_role = Column(String)  # admin, teacher, student
    days_before_delete = Column(Integer)  # 90, 365, etc
    last_cleanup = Column(DateTime)
```

---

## 7.12 Staging Environment

Voordat naar productie deployen:

**Setup:**
1. Clone productie database naar staging (wekelijks):
   ```bash
   # On staging server
   sudo pg_dump -U obsapp_user -h prod.server.ip obsapp | psql -U obsapp_user obsapp_staging
   ```

2. Deploy code to staging before production
3. Run smoke tests
4. Verify database migrations work
5. Check performance baseline

**Test checklist:**
```bash
# Login endpoint
curl -X POST http://staging.obsapp.local/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test123"}'

# Create resource
curl -X POST http://staging.obsapp.local/api/students \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Student"}'

# File upload
curl -X POST http://staging.obsapp.local/api/uploads \
  -F "file=@test.jpg"
```

---

## 7.13 Incident Response Playbook

**Scenario: Backend is Down**
```bash
1. Check status
   sudo systemctl status obsapp-backend

2. Review logs
   journalctl -u obsapp-backend -n 50 --no-pager

3. Restart service
   sudo systemctl restart obsapp-backend

4. Verify health
   curl http://localhost:8000/health

5. If still failing: rollback
   git reset --hard HEAD~1
   sudo systemctl restart obsapp-backend
```

**Scenario: Database is Down**
```bash
1. Check PostgreSQL
   sudo systemctl status postgresql

2. Check disk space
   df -h /var/lib/postgresql

3. Restart database
   sudo systemctl restart postgresql

4. Restore from backup (if needed)
   See section 3 "Restore procedure"
```

**Scenario: High CPU/Memory**
```bash
1. Monitor processes
   top -b -n 1

2. Kill runaway worker
   sudo kill -9 <PID>

3. Check limits in systemd service
   grep -E "CPUQuota|MemoryLimit" /etc/systemd/system/obsapp-backend.service

4. Consider scaling
   Increase workers if CPU consistently >70%
```

---

## 7.14 Enhanced Backup Strategy

Upgrade naar stratified backup retention:

```bash
#!/bin/bash
# /usr/local/bin/obsapp-backup-stratified.sh

BACKUP_DIR="/var/backups"
DB_USER="obsapp_user"
DB_NAME="obsapp"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/obsapp_$DATE.sql.gz"

# Backup
/usr/bin/pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Daily backups: keep 7 days
    find "$BACKUP_DIR" -name "obsapp_*.sql.gz" -mtime +7 -delete
    
    # Weekly backups: keep on Sundays for 4 weeks
    WEEK_BACKUP="$BACKUP_DIR/obsapp_weekly_$(date +%Y_week%U).sql.gz"
    if [ "$(date +%u)" == "0" ]; then
        cp "$BACKUP_FILE" "$WEEK_BACKUP"
        find "$BACKUP_DIR" -name "obsapp_weekly_*.sql.gz" -mtime +28 -delete
    fi
    
    # Monthly backup: keep on 1st of month for 1 year
    if [ "$(date +%d)" == "01" ]; then
        MONTH_BACKUP="$BACKUP_DIR/obsapp_monthly_$(date +%Y_%m).sql.gz"
        cp "$BACKUP_FILE" "$MONTH_BACKUP"
        find "$BACKUP_DIR" -name "obsapp_monthly_*.sql.gz" -mtime +365 -delete
    fi
    
    echo "✓ Backup completed: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "✗ Backup failed!" >&2
    exit 1
fi
```

Update crontab:
```
# Backup every 6 hours
HOME=/root 0 */6 * * * /usr/local/bin/obsapp-backup-stratified.sh >> /var/log/obsapp-backup.log 2>&1
```

| Retention Level | Frequency | Retention |
|---|---|---|
| Daily | Every 6 hours | 7 days |
| Weekly | Every Sunday | 4 weeks |
| Monthly | 1st of month | 1 year |
| Disaster | Manual (keep offsite) | Indefinite |

---

## 8. Docker (Optioneel)

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
- [ ] **Rate limiting** geïmplementeerd op login endpoint
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
8. **Database migraties setup** (Alembic)
9. **Rate limiting** implementeren (slowapi)
10. **Structured logging** configureren
11. **Systemd service** aanmaken voor backend
12. **Frontend build** uitvoeren (`npm run build`)
13. **Nginx** configureren als reverse proxy
14. **Let's Encrypt** SSL certificaat aanvragen
15. **Backup cronjob** instellen met alerting
16. **Staging environment** opzetten (optioneel maar aanbevolen)
17. **Load testing** uitvoeren
18. **Incident response** playbook testen

> **Zonder domeinnaam:** Stappen 1-10 kunnen volledig uitgevoerd worden zonder domeinnaam. De app is bereikbaar via het server IP adres. SSL certificaat (stap 11) kan later toegevoegd worden wanneer je een domeinnaam hebt.


### Updates Deployen

```bash
cd /opt/obsapp

# Maak backup van huidige versie
git tag pre-update-$(date +%Y%m%d%H%M%S)

# Pull nieuwe code
git pull origin main

# Backend update met migraties
cd backend
uv sync --no-dev
uv run alembic upgrade head

# Test health
sudo systemctl restart obsapp-backend
sleep 2
curl http://localhost:8000/health

# Frontend update
cd ../frontend
npm install
npm run build

# Reload web server
sudo systemctl reload nginx

# Logs controleren
journalctl -u obsapp-backend -n 20 --no-pager
```

## 12. Volgende Stappen (Concrete Checklist)

| Dienst | Kosten |
|--------|--------|
| Hetzner CX32 | ~€8,59 |
| Backups (inbegrepen) | €0,00 |
| Domeinnaam | ~€1,00 - €2,00 |
| SSL Certificaat (Let's Encrypt) | €0,00 |
| Email service (SendGrid gratis tier) | €0,00 |
| **Totaal** | **~€9,59 - €10,59/maand** |

---

## 13. Kosten Overzicht (Maandelijks)

### Week 1: Critical Security & Backup (Go-live prerequisites)
- [ ] Implementeer **rate limiting** op login endpoint (slowapi)
- [ ] Configureer **Alembic** voor database migraties
- [ ] Setup **backup alerting** (email notifications)
- [ ] Test **backup/restore procedure** end-to-end
- [ ] Genereer sterke **SECRET_KEY** en plaats in `.env`
- [ ] Zet **DEBUG=False** in productie config

### Week 2: Logging & Monitoring
- [ ] Voeg **structured logging** toe (JSON format)
- [ ] Configureer **log rotation** (50MB files)
- [ ] Extend **health check** met database connectivity
- [ ] Setup **certificate renewal monitoring**
- [ ] Implementeer **backup alerting** via email

### Week 3: Deployment & Testing
- [ ] Zet **staging environment** op met production data
- [ ] Voer **load testing** uit (Apache Bench)
- [ ] Document **incident response playbook**
- [ ] Test **rollback procedure** in staging
- [ ] Stel **data retention policies** in

### Week 4: Final Checks & Automation
- [ ] Maak `.env.example` aan voor ontwikkelaars
- [ ] Stel SMTP provider op (SendGrid/Mailgun)
- [ ] Automatiseer **stratified backups** (daily/weekly/monthly)
- [ ] Setup **uptime monitoring** (UptimeRobot)
- [ ] Review **security checklist** compleet
- [ ] **Go-live!**

### Post-Launch (Ongoing)
- Monitor backup logs dagelijks
- Review error logs wekelijks
- Performance tuning gebaseerd op load tests
- Plan staging synchronisatie (data refresh)
- Dokumenteer lessons learned

---

## 14. Final Checklist voor Go-Live

1. [ ] **Alembic setup**: `cd backend && uv run alembic init alembic && uv run alembic revision --autogenerate -m "Initial migration"`
2. [ ] **Rate limiting**: `uv add slowapi` en implementeer limiter op `/login` endpoint
3. [ ] **Structured logging**: Voeg JSON logger toe aan `main.py`
4. [ ] **Health check DB**: Extend `/health` met `db.execute("SELECT 1")`
5. [ ] **Backup alerting**: Update script met email notifications
6. [ ] **Load testing**: Voer `ab -n 100 -c 10 http://localhost:8000/health` uit
7. [ ] **Staging setup**: Duplicate production config op aparte server/VM
8. [ ] **Incident playbook**: Document handover en troubleshooting procedures
9. [ ] **Certificate renewal**: Test `certbot renew --dry-run`
10. [ ] **Data retention**: Maak cleanup script voor inactieve student accounts
11. [ ] **Security checklist**: Alle items groen (zie sectie 10)
12. [ ] **DNS configured**: Domeinnaam wijst naar server IP
13. [ ] **SSL working**: HTTPS verbinding werkt zonder fouten
14. [ ] **Backup tested**: Restore procedure getest en werkend
15. [ ] **Team informed**: Handover procedures geëindigd

---

*Laatst bijgewerkt: 2026-07-22*
