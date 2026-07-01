# Refactoring Plan - Architecture Improvement

## Doel
De grootste bestanden verkleinen en beter schikken zodat agents hun context kleiner hebben en alles sneller te vinden is.

## Analyse Grootste Bestanden

### Frontend
| Bestand | Regels | Actie | Status |
|---------|--------|-------|-------|
| `frontend/src/index.css` | 1742 | Opsplitsen in modulaire CSS | ✅ Voltooid |
| `frontend/src/pages/ObservationsPage.tsx` | 778 | Feature-based componenten | ⏳ Todo  |
| `frontend/src/pages/ManagementPage.tsx` | 672 | Feature-based componenten | ⏳ Todo |
| `frontend/src/pages/ObservingPage.tsx` | 578 | Feature-based componenten | ⏳ Todo |
| `frontend/src/components/AppLayout.tsx` | 378 | Controleren of te groot | ⏳ Todo |
| `frontend/src/services/auth.ts` | 327 | Controleren of te groot | ⏳ Todo |

### Backend
| Bestand | Regels | Actie | Status |
|---------|--------|-------|--------|
| `backend/scripts/seed.py` | 625 | Migration script, OK | ⏳ Todo  |
| `backend/app/api/schools.py` | 543 | Opsplitsen in routers | ⏳ Todo  |
| `backend/app/api/auth.py` | 451 | Opsplitsen in routers | ⏳ Todo |
| `backend/app/repositories/observation_goal_repository.py` | 274 | Controleren | ⏳ Todo |
| `backend/app/repositories/student_observation_repository.py` | 272 | Controleren | ⏳ Todo |

## Voltooide Refactoring Stappen

### 1. CSS Refactoring ✅
zie frontend/CSS_ARCHITECTURE.md
