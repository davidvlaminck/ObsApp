# ObsApp – Gedetailleerd Ontwikkelstappenplan

## Waarom School/Tenant setup als Stap 1?

Een **tenant** in deze context is een **school** - een organisatie met hun eigen leerkrachten en observaties.

**Waarom stap 1?**
1. **Data isolatie** - Zorgt ervoor dat observaties van school A niet zichtbaar zijn voor school B
2. **Schaalbaarheid** - Eenvoudig nieuwe scholen toevoegen zonder nieuwe installatie
3. **Gebruikerskoppeling** - Elke leerkracht hoort tot één school, dit moet in de database modellen
4. **Security** - Middleware kan automatisch verifiëren dat requests alleen data ophalen van de juiste school

**Voorbeeld:**
- School "Basisschool De Vlinder" heeft leerkrachten met hun observaties
- School "Basisschool De IJsbeer" heeft aparte observaties
- Beide gebruiken dezelfde app, maar zien elk alleen hun eigen data

---

## Fase 1: School/Tenant Architectuur

### Stap 1.1: School Model
**Backend model:**
```python
# app/models/school.py
class School(Base):
    id: int (PK)
    name: str  # "Basisschool De Vlinder"
    slug: str  # "basisschool-de-vlinder" (uniek, voor URLs)
    is_active: bool
    created_at: datetime
```

**Database migratie:**
- Alembic migration maken: `alembic revision --autogenerate -m "create schools table"`
- `schools` tabel aanmaken

**Seed script:**
```python
# scripts/seed_schools.py
def seed_default_school():
    school = School(name="Demo School", slug="demo-school", is_active=True)
    db.add(school)
    db.commit()
```

**Test:** School aanmaken via seed script

---

### Stap 1.2: School-User Relatie
**Backend model:**
```python
# app/models/user.py (uitbreiden)
tenant_id: int (FK naar School)  # alias: school_id
```

**Seed:** Admin user koppelen aan default school

**Test:** User behoort tot een school

---

### Stap 1.3: School Middleware
**Backend:**
- Middleware die `school_id` uit JWT token haalt
- Of uit subdomain/header
- Filter queries automatisch op school_id

**Test:** Endpoint call zonder school_id → 403

---

### Stap 1.4: School Selectie bij Login
**Frontend:**
- Login pagina uitbreiden met school dropdown
- Of automatisch detecteren via email domein
- School info opslaan in JWT token

**Test:** Login met school selectie

---

## Fase 2: Observatie Functionaliteit

### Stap 2.1: Observatie Model
**Backend model:**
```python
# app/models/observation.py
class Observation(Base):
    id: int (PK)
    tenant_id: int (FK)
    title: str
    description: str
    observation_date: date
    created_by: int (FK naar User)
    created_at: datetime
    updated_at: datetime
```

**Schema:**
```python
# app/schemas/observation.py
class ObservationCreate(BaseModel):
    title: str
    description: str
    observation_date: date

class ObservationResponse(BaseModel):
    id: int
    title: str
    description: str
    observation_date: date
    created_by: int
```

**Test:** Observatie aanmaken via API

---

### Stap 2.2: Observatie Repository
**Backend:**
```python
# app/repositories/observation_repository.py
class ObservationRepository:
    def create(self, data, user_id, tenant_id)
    def get_all(self, tenant_id)
    def get_by_id(self, id, tenant_id)
    def update(self, id, data, tenant_id)
    def delete(self, id, tenant_id)
```

**Test:** Repository methodes met mock data

---

### Stap 2.3: Observatie API Endpoints
**Backend routes:**
- `POST /api/observations` - Nieuwe observatie
- `GET /api/observations` - Lijst met filtering
- `GET /api/observations/{id}` - Enkele observatie
- `PUT /api/observations/{id}` - Update
- `DELETE /api/observations/{id}` - Verwijderen

**Test:** API calls met JWT token

---

### Stap 2.4: Observatie Invoer Scherm
**Frontend:**
- `/observations/new` pagina
- Formulier met: titel, beschrijving, datum
- Validatie (verplichte velden)
- Submit → API call → redirect naar lijst

**Test:** Form submission en validatie

---

### Stap 2.5: Observatie Lijst Scherm
**Frontend:**
- `/observations` pagina
- Tabel/grid met observaties
- Kolommen: titel, datum, acties
- Zoek/filter functionaliteit
- Klik op rij → detail scherm

**Test:** Lijst tonen en navigeren

---

## Fase 3: Observatie Details & Bewerken

### Stap 3.1: Observatie Detail Scherm
**Frontend:**
- `/observations/{id}` pagina
- Toont volledige observatie info
- Bewerk en verwijder knoppen
- Terug naar lijst link

**Test:** Detail tonen en acties

---

### Stap 3.2: Observatie Bewerken
**Frontend:**
- `/observations/{id}/edit` pagina
- Formulier met bestaande data
- Update → API call → redirect

**Test:** Update flow

---

## Fase 4: Export Functionaliteit

### Stap 4.1: PDF Export Endpoint
**Backend:**
- `GET /api/observations/{id}/pdf`
- Gebruik `reportlab` of `weasyprint`
- Generere PDF met observatie data

**Test:** PDF download en validatie

---

### Stap 4.2: PDF Export Scherm
**Frontend:**
- Knop op detail scherm: "Export PDF"
- Download functionaliteit

**Test:** Export knop en download

---

## Fase 5: Dashboard & Statistieken

### Stap 5.1: Dashboard Model
**Backend:**
- Statistieken endpoint: `GET /api/dashboard/stats`
- Aantal observaties per maand
- Recente observaties

**Test:** Stats endpoint

---

### Stap 5.2: Dashboard Scherm
**Frontend:**
- `/dashboard` pagina
- Kaartjes met aantallen
- Grafiek met observaties per maand
- Link naar nieuwe observatie

**Test:** Dashboard tonen

---

## Fase 6: Gebruikersbeheer

### Stap 6.1: Rollen Model
**Backend:**
```python
# app/models/role.py
class Role(Base):
    id: int
    name: str  # admin, leerkracht, etc.
    permissions: list[str]
```

**Test:** Rollen seeden

---

### Stap 6.2: Gebruikersbeheer Scherm
**Frontend:**
- `/admin/users` pagina
- Tabel met gebruikers
- Invite knop → modal → email invullen
- Role toewijzen

**Test:** Gebruikers lijst en invite flow

---

## Fase 7: Productie & Security

### Stap 7.1: Alembic Migrations
- Alle modellen migreren
- Upgrade/downgrade scripts

### Stap 7.2: Rate Limiting
- Login rate limiting (5 pogingen/minuut)
- IP blocking bij mislukte pogingen

### Stap 7.3: Refresh Tokens
- Refresh token endpoint
- Auto-refresh in frontend

### Stap 7.4: CORS & Security Headers
- CORS voor specifieke domeinen
- Security headers (CSP, HSTS)

---

## Uitgevoerde werkzaamheden

### Backend - School/Tenant basis

- School model toegevoegd: [`backend/app/models/school.py`](backend/app/models/school.py:8)
- User model uitgebreid met `school_id`: [`backend/app/models/user.py`](backend/app/models/user.py:8)
- Default school en admin user worden aangemaakt bij database-initialisatie: [`backend/app/core/database.py`](backend/app/core/database.py:46)
- Database-initialisatie is verplaatst van importtijd naar lazy initialisatie via [`get_db()`](backend/app/core/database.py:78), zodat Uvicorn kan opstarten zonder direct de database te benaderen.

### Backend - Observaties

- Observatie model toegevoegd: [`backend/app/models/observation.py`](backend/app/models/observation.py:8)
- Observatie schemas toegevoegd: [`backend/app/schemas/observation.py`](backend/app/schemas/observation.py:6)
- Observatie repository toegevoegd: [`backend/app/repositories/observation_repository.py`](backend/app/repositories/observation_repository.py:8)
- Observatie API endpoints toegevoegd: [`backend/app/api/observations.py`](backend/app/api/observations.py:13)
  - `POST /api/observations`
  - `GET /api/observations`
  - `GET /api/observations/{id}`
  - `PUT /api/observations/{id}`
  - `DELETE /api/observations/{id}`
- Observaties worden school-gescopeerd: een leerkracht kan alleen observaties binnen de eigen school aanmaken, lezen, bewerken en verwijderen.
- Tests toegevoegd: [`backend/tests/test_observations_api.py`](backend/tests/test_observations_api.py:1)

### Backend - Gebruikersbeheer

- User schemas toegevoegd: [`backend/app/schemas/user.py`](backend/app/schemas/user.py:4)
- User repository uitgebreid: [`backend/app/repositories/user_repository.py`](backend/app/repositories/user_repository.py:8)
- Gebruikers API endpoints toegevoegd: [`backend/app/api/users.py`](backend/app/api/users.py:14)
  - `GET /api/users`
  - `POST /api/users`
- Superuser-only autorisatie toegevoegd voor gebruikersbeheer: [`backend/app/api/auth.py`](backend/app/api/auth.py:47)
- Tests toegevoegd: [`backend/tests/test_management_api.py`](backend/tests/test_management_api.py:1)

### Backend - Uitnodigingen en wachtwoord instellen

- SMTP-configuratie toegevoegd: [`backend/app/core/config.py`](backend/app/core/config.py:11)
- Email service toegevoegd: [`backend/app/services/email_service.py`](backend/app/services/email_service.py:8)
- User model uitgebreid met:
  - `is_pending`
  - `password_reset_token`
  - `password_reset_expires_at`
- Activatie-token flow toegevoegd in [`backend/app/services/auth_service.py`](backend/app/services/auth_service.py:62)
- Set-password endpoint toegevoegd: [`backend/app/api/auth.py`](backend/app/api/auth.py:58)
- Bugfix: timezone-vergelijking voor activatie-expiry genormaliseerd in [`_is_activation_expired()`](backend/app/services/auth_service.py:71)

### Frontend - Routing en pagina's

- Landing page: [`frontend/src/pages/LandingPage.tsx`](frontend/src/pages/LandingPage.tsx:1)
- Login page: [`frontend/src/pages/LoginPage.tsx`](frontend/src/pages/LoginPage.tsx:1)
- Forbidden page: [`frontend/src/pages/ForbiddenPage.tsx`](frontend/src/pages/ForbiddenPage.tsx:1)
- Schools page: [`frontend/src/pages/SchoolsPage.tsx`](frontend/src/pages/SchoolsPage.tsx:1)
- Users page: [`frontend/src/pages/UsersPage.tsx`](frontend/src/pages/UsersPage.tsx:1)
- Set-password page: [`frontend/src/pages/SetPasswordPage.tsx`](frontend/src/pages/SetPasswordPage.tsx:1)
- Superuser route guard: [`frontend/src/components/SuperuserRoute.tsx`](frontend/src/components/SuperuserRoute.tsx:1)
- API service voor auth, scholen en gebruikers: [`frontend/src/services/auth.ts`](frontend/src/services/auth.ts:1)
- Routes toegevoegd in [`frontend/src/App.tsx`](frontend/src/App.tsx:11)

### Tests en build

- Backend tests passeren met SQLite test database:
  - `DATABASE_URL=sqlite:///./test.db uv run pytest`
- Frontend build passeert:
  - `npm run build`

---

## Openstaande requirements

### 1. Menu / navigatie toevoegen

**Status: geïmplementeerd.**

Gewenst gedrag:
- Navigatie zichtbaar na login.
- Algemene leerkracht-pagina's toegankelijk voor alle ingelogde gebruikers.
- Admin-pagina's alleen zichtbaar/toegankelijk voor superusers.
- Logout functionaliteit.

Implementatie:
- Responsieve Material Design layout toegevoegd met [`AppLayout`](frontend/src/components/AppLayout.tsx:1).
- Desktop: vaste sidebar links.
- Mobiel: hamburger menu met drawer en donkere backdrop.
- Menu-items:
  - Dashboard
  - Observaties
  - Scholen, alleen voor superusers
  - Gebruikers, alleen voor superusers
- Login stuurt gebruikers voortaan naar [`/dashboard`](frontend/src/App.tsx:11).
- Placeholder-pagina's toegevoegd voor [`DashboardPage`](frontend/src/pages/DashboardPage.tsx:1) en [`ObservationsPage`](frontend/src/pages/ObservationsPage.tsx:1).

### 2. School-isolatie verder uitwerken

Huidige situatie:
- Observaties zijn school-gescopeerd in de repository.
- Gebruikers hebben een `school_id`.
- Superusers bestaan, maar school-specifieke pagina's moeten nog consequent filteren op rol.

Gewenst gedrag:
- Normale gebruikers zien alleen data van hun eigen school.
- Superusers/admins zien data van alle scholen wanneer ze naar een admin-pagina gaan.
- Admin-pagina's moeten expliciet superuser-only blijven.

### 3. Gebruikersscherm als tabel

**Status: geïmplementeerd.**

Gewenst gedrag:
- Tabelweergave met kolommen:
  - Naam
  - E-mail
  - School
  - Rol
  - Status
  - Acties
- Duidelijk onderscheid tussen pending, actief, inactief en superuser.
- Superuser-only toegang.

Implementatie:
- [`UsersPage`](frontend/src/pages/UsersPage.tsx:1) omgezet van kaartweergave naar tabelweergave.
- Tabel krijgt kolommen voor naam, e-mail, school, rol, status en acties.
- Status badges:
  - `Uitnodiging verzonden`
  - `Actief`
  - `Inactief`
- Rol badges:
  - `Superuser`
  - `Leerkracht`
- Mobiel blijft de tabel horizontaal scrollbaar.

### 4. Te kiezen volgende implementatiestap

PWA