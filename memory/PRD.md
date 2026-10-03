# Smart Home Finance — PRD

## Problem statement
Family finance app (Expo RN + FastAPI + MongoDB). Imported from GitHub. Iteration 2 added 4 user-requested features.

## Iteration 4 (2026-06) — 3D dashboard redesign + recurring bills/education
- Dashboard redesigned to match user 3D reference: gradient hero (glowing running balance + house glow), 2x2 stat grid (Pemasukan/Pengeluaran/Selisih/Saving Rate), month navigator, "Kewajiban Bulanan" (Tagihan/Pendidikan/Belanja cards) + gradient "Total Komitmen Bulanan". Backend dashboard summary now returns `obligations`.
- Bills are RECURRING: created once with a due DAY (1-31), repeat every month; a bill is 'lunas' for a month only when an expense is allocated to it that month, pending again next month. Backend _decorate_bills(view_month) + due_day model.
- Education items RECURRING the same way; Education screen gained back-to-dashboard arrow + month navigator.
- Savings & Shopping realization already derive from allocated transactions.

## Iteration 3 (2026-06) — Transactions as single source of truth
- Transactions can be ALLOCATED to a budget item via link_type ('bill'|'shopping'|'education'|'savings') + link_id. Realization (bill lunas, shopping/education realized, savings saved) is computed ONLY from explicitly linked transactions — removed fuzzy category matching (fixes education false-paid + overcount).
- Opening/running balance now carries across months: dashboard health_score, saving_rate and AI insight use cumulative balance, so an income=0 month funded by prior savings is NOT flagged negative/alarming.
- Reports (text/PDF/Excel + Laporan screen) now show Saldo Awal (opening) & Saldo Akhir (ending running balance).
- Month navigation added to Dashboard and Transactions (history preserved, nothing deleted).
- Unified category list (incl. Cicilan/Pinjaman/Tabungan) shared via src/categories.ts.
- All delete actions now require confirmation via global ConfirmProvider (src/confirm.tsx).

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
