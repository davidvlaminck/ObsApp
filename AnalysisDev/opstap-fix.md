# Op Stap doeldata fix - voortgangsdocument

## Probleemstelling

In het selectievenster van Op Stap doelen werden vreemde tekens getoond, bijvoorbeeld:

```
4.1.GK3.1 - De leerlingen kennen de naam van: de rivier de Nijl.
Aardrijkskunde · Topografie · Topografisch referentiekader · Wereld
De kleuters kennen de naam van:&nbsp;​​​​​​
```

Daarnaast was de tekst van sommige doelen onvolledig en werden vakken niet schaalbaar getoond.

## Bevindingen

### 1. Vreemde tekens in database

Op 2026-06-27 geanalyseerd: **1369 van 5711 OP-Stap doelen** hadden vreemde tekens.

| Type | Tekens | Aantal | Voorbeeld |
|------|--------|--------|-----------|
| HTML-entiteiten | `&nbsp;` | 1050 | `...vlot lezen).&nbsp;` |
| HTML-entiteiten | `"` | 1934 | `...gebruiken zoals "nog",...` |
| HTML-entiteiten | `>` | 20 | `...formule > 3,...` |
| Zero-width | `\u200b` | 6+ | `...van:&nbsp;\u200b\u200b\u200b...` |
| Speciale spaties | `\u202f` | 4 | `...kenmerken\u202fspecifieke...` |

### 2. Specifiek doel 4.1.GK3.1

**Database status na cleanup:**
- Title: `De leerlingen kennen de naam van: de rivier de Nijl.`
- Description: `De kleuters kennen de naam van:`
- Subject: `Aardrijkskunde`
- Domain: `Topografie`
- Subdomain: `Topografisch referentiekader`
- Cluster: `Wereld`

**Opmerking gebruiker (2026-06-27):**
> In de tabel onderwijsdoelen, vind ik bij 4.1.1 de tekst, maar daarnaast ook de kolom "uitbreiding doelzin" en daar staat de rest van die zin (opsomming):
> - België;
> - een plaatselijke rivier;
> - de rivier de Nijl.

Dit betekent dat de **volledige tekst** beschikbaar is in de `Onderwijsdoelen (3).xlsx` tabel, maar niet in de Op Stap API response. De API geeft alleen een verkorte/afgekapte versie terug.

### 3. Excel-generatie script

**Bestand:** `AnalysisDev/Migration/fetch_opstap_minimum_goals.py`

Het script haalt data op van:
```
https://cached-api.katholiekonderwijs.vlaanderen/documents/bdc19260-bd4c-46a8-8009-b2a54f381120/snapshots/latest/krcItems
```

**Probleem:** De API levert incomplete beschrijvingen voor sommige doelen. De `&nbsp;` en zero-width spaces die in de Excel verschenen, waren opmaakartefacten die de onvolledige tekst verborgen.

**Aangepast:**
- `strip_html()` functie uitgebreid met `html.unescape()`
- Verwijdert zero-width tekens (`\u200b`, `\u200c`, `\u200d`, `\ufeff`)
- Normaliseert speciale spaties

### 4. Database herstructurering

Uitgevoerde stappen:
1. **Cleanup script** (`backend/scripts/cleanup_goal_text.py`) aangemaakt en uitgevoerd
   - 2422 doelen opgekuist van bestaande vreemde tekens
2. **Excel opnieuw gegenereerd** met gefixt `fetch_opstap_minimum_goals.py`
3. **Database herseed:** 5711 OP-Stap doelen verwijderd en opnieuw geïmporteerd
   - 4054 doelen gelinkt aan VO-doelen
   - Demo observatiedoelen opnieuw gekoppeld

### 5. Frontend CSS verbeteringen

**Bestand:** `frontend/src/index.css`

Aangepaste classes voor schaalbare vakken:
- `.goal-metadata` - `word-break: break-word`, `overflow-wrap: anywhere`
- `.goal-option` - `max-width: 100%`, flex-child met `min-width: 0`
- `.data-table td` - `word-break: break-word`, `overflow-wrap: anywhere`
- `.overview-table td` - verwijderd `text-overflow: ellipsis` + `white-space: nowrap`
- `.student-observation-table td` - idem
- `.selected-observation-goal` - flex-child met `min-width: 0`
- `.goal-detail-content` - `word-break` + `overflow-wrap` op titel en beschrijving

### 6. Backend seed functie

**Bestand:** `backend/scripts/seed.py`

`_clean_text()` functie uitgebreid:
- `html.unescape()` voor HTML-entiteiten
- Verwijderen zero-width tekens
- Normaliseren speciale spaties

## Huidige status

- Excel-generatiescript gefixt en opnieuw uitgevoerd
- Database herseed met schone data
- Frontend CSS aangepast voor schaalbare tekstweergave
- **Open punt:** Beschrijvingen van bepaalde doelen (bijv. 4.1.GK3.1) zijn nog steeds onvolledig omdat de Op Stap API die data niet levert. De volledige tekst staat wel in de `Onderwijsdoelen (3).xlsx` tabel in de kolom "uitbreiding doelzin".

## Volgende stappen (voor volgende keer)

1. **Onderzoek hoe de "uitbreiding doelzin" uit `Onderwijsdoelen (3).xlsx` gekoppeld kan worden aan de Op Stap doelen**
   - De Excel heeft waarschijnlijk een unieke identifier die overeenkomt met de Op Stap doelcode
   - Of de minimumdoelcode (K-4.1.1) kan gebruikt worden als koppeling

2. **Script uitbreiden om de uitbreiding doelzin te importeren**
   - Optie A: Lees de `Onderwijsdoelen (3).xlsx` en koppel op basis van minimumdoelcode
   - Optie B: Pas `fetch_opstap_minimum_goals.py` aan om ook de uitbreiding te lezen vanuit de API (als de API die data heeft)

3. **Beschrijvingen in database aanvullen met de uitbreiding doelzin**

4. **Re-seed doen na aanpassing**

## Aangepaste bestanden

| Bestand | Wijziging |
|---------|-----------|
| `AnalysisDev/Migration/fetch_opstap_minimum_goals.py` | `strip_html()` uitgebreid met entity decoding en zero-width verwijdering |
| `backend/scripts/seed.py` | `_clean_text()` uitgebreid met entity decoding en zero-width verwijdering |
| `backend/scripts/cleanup_goal_text.py` | Nieuw - cleanup script voor bestaande data |
| `frontend/src/index.css` | CSS voor schaalbare tekstweergave toegevoegd |
| `AnalysisDev/opstap_naar_minimumdoelen.xlsx` | Opnieuw gegenereerd met schone data |
| `AnalysisDev/opstap-fix.md` | Dit document |

## Commando's voor herhaling

```bash
# 1. Excel opnieuw genereren
cd /home/david/PycharmProjects/ObsApp
backend/.venv/bin/python AnalysisDev/Migration/fetch_opstap_minimum_goals.py

# 2. Database opschonen (verwijder alle OP_STAP goals)
backend/.venv/bin/python -c "
import sys
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from app.models.goal import Goal
db = SessionLocal()
db.query(Goal).filter(Goal.goal_type == 'OP_STAP').delete()
db.commit()
db.close()
"

# 3. Opnieuw seeden
backend/.venv/bin/python -c "
import sys
sys.path.insert(0, 'backend')
from scripts.seed import seed_opstap_goals, link_demo_observation_goal
seed_opstap_goals()
link_demo_observation_goal()
"

# 4. Cleanup van bestaande data (indien nodig)
backend/.venv/bin/python backend/scripts/cleanup_goal_text.py
```
