# Refactoring Plan - Architecture Improvement

## Doel
De grootste bestanden verkleinen en beter schikken zodat agents hun context kleiner hebben en alles sneller te vinden is.

## Analyse Grootste Bestanden

### Frontend
| Bestand | Regels | Actie | Status |
|---------|--------|-------|--------|
| `frontend/src/index.css` | 1742 | Opsplitsen in modulaire CSS | ✅ Voltooid |
| `frontend/src/pages/ObservationsPage.tsx` | 778 | Feature-based componenten | ✅ Voltooid |
| `frontend/src/pages/ManagementPage.tsx` | 672 | Feature-based componenten | ✅ Voltooid |
| `frontend/src/pages/ObservingPage.tsx` | 578 | Feature-based componenten | ✅ Voltooid |
| `frontend/src/components/AppLayout.tsx` | 378 | Controleren of te groot | ⏳ Todo |
| `frontend/src/services/auth.ts` | 327 | Controleren of te groot | ⏳ Todo |

### Backend
| Bestand | Regels | Actie | Status |
|---------|--------|-------|--------|
| `backend/scripts/seed.py` | 625 | Migration script, OK | ✅ OK |
| `backend/app/api/schools.py` | 543 | Opsplitsen in routers | ✅ Voltooid |
| `backend/app/api/auth.py` | 451 | Opsplitsen in routers | ⏳ Todo |
| `backend/app/repositories/observation_goal_repository.py` | 274 | Controleren | ⏳ Todo |
| `backend/app/repositories/student_observation_repository.py` | 272 | Controleren | ⏳ Todo |

## Voltooide Refactoring Stappen

### 1. CSS Refactoring ✅
**Oude structuur:** `frontend/src/index.css` (1742 regels)

**Nieuwe structuur:**
```
frontend/src/styles/
  base.css         (~100 regels) - CSS variabelen, reset, algemene styles
  components.css   (~200 regels) - Herbruikbare component styles (card, button, form, table, badge)
  index.css        (~10 regels) - Import alleen
```

### 2. Frontend Page Refactoring ✅
**ObservationsPage.tsx** (778 regels) opgesplitst in:
```
frontend/src/features/observations/
  components/
    ObservationGoalForm.tsx
    GoalSearchModal.tsx
    ObservationGoalsTable.tsx
  hooks/
    useObservationGoals.ts
```

**ManagementPage.tsx** (672 regels) opgesplitst in:
```
frontend/src/features/management/
  components/
    ClassForm.tsx
    ClassesTable.tsx
    StudentImportPreview.tsx
    TeacherModal.tsx
  hooks/
    useManagement.ts
```

**ObservingPage.tsx** (578 regels) opgesplitst in:
```
frontend/src/features/observing/
  components/
    ObservationFilters.tsx
    GoalsPanel.tsx
    StudentsPanel.tsx
    GoalInfoModal.tsx
    ObservationFormModal.tsx
  hooks/
    useObserving.ts
```

### 3. Backend API Router Refactoring ✅
**schools.py** (543 regels) opgesplitst in:
```
backend/app/api/
  schools.py           - School CRUD endpoints (100 regels)
  school_years.py      - SchoolYear endpoints (50 regels)
  classes.py           - Class endpoints (40 regels)
  students.py          - Student endpoints (200 regels)
  teachers.py          - Teacher endpoints (50 regels)
```

## Voortgang
- CSS refactoring: 1742 regels → 10 + 200 + 100 = 210 regels (index.css + components.css + base.css)
- ObservationsPage.tsx: 778 regels → 137 regels (page) + 380 regels (componenten) + 398 regels (hook)
- schools.py: 543 regels → 30 regels (school) + 50 + 40 + 200 + 50 = 370 regels (gesplitst)

## Volgende Stappen
1. AppLayout.tsx controleren (optioneel)
2. auth.ts controleren (optioneel)
3. Tests uitvoeren om compatibiliteit te verifiëren