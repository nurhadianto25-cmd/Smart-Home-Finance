# Smart Home Finance — PRD

## Problem statement
Family finance app (Expo RN + FastAPI + MongoDB). Imported from GitHub. Iteration 2 added 4 user-requested features.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB. All routes under `/api`.
- Frontend: Expo Router. Theme tokens + reactive theming in `src/theme.ts` (makeStyles/useTheme). Global prefs store `src/store.ts`, provider `src/prefs.tsx`, i18n `src/i18n.ts`. Currency-aware `idr()` in `src/api.ts`.

## User personas
- Parents managing household income, expenses, bills, savings, and children's education budgets.

## Core requirements (static)
- Auth (email + Google), transactions, bills (auto-pay), savings goals, education budgets, shopping, dashboard, AI insights, reports (text/PDF/Excel).

## Implemented
- 2026-06 (import): Full MVP set up and running.
- 2026-06 (iteration 2):
  - Continuous running balance: `GET /api/dashboard/summary` returns `cumulative_balance` (all income − all expense up to selected month) and `opening_balance`. Dashboard shows RUNNING BALANCE + OPENING BALANCE + NET THIS MONTH.
  - User photo on dashboard header (tap → Settings).
  - Custom date-range reports: `report/text|pdf|excel?start=YYYY-MM-DD&end=YYYY-MM-DD`; Reports screen has month/custom toggle + start/end inputs.
  - Preferences app-wide: Theme (dark/light), Language (ID/EN, full UI translation on primary screens), Currency (IDR/USD display conversion @ Rp16.000). Persisted via local storage, reactive via external store.
  - Backend deps pinned: reportlab, openpyxl.

## Backlog / remaining (P1/P2)
- P1: Translate deep secondary-screen labels (education categories, some modal field labels remain Indonesian).
- P2: Bill due reminders, per-category monthly budget caps, shareable monthly report link.

## Next tasks
- Optional: finish i18n coverage on belanja/pendidikan/tabungan inner labels.
