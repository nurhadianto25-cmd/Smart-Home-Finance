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

## 2026-10-04 — Tabungan 3D Redesign
- Redesigned Tabungan screen to match 3D reference: gradient hero with 3D savings-jar illustration, horizontal stat cards (Total/Aktif/Setoran/Progress ring/Tercapai), goal cards with per-type 3D icons (shield, suitcase, graduation, car, house, piggy), "X bulan lagi" badge, savings growth line chart, distribution donut, insight list, milestone tracker (25/50/75/100), deposits list (Setoran Terakhir / Tabungan Rutin tabs), and "Cara Kerja" steps.
- Generated 3D illustration assets via Gemini Nano Banana (gemini-3.1-flash-image-preview), post-processed to transparent PNGs in /app/frontend/assets/images/savings/ (hero, shield, vacation, education, car, house, piggy, target, avatar). Scripts: /app/scripts/gen_savings_assets.py, remove_checkerboard.py.
- Added 3D avatar as default profile fallback on Dashboard + Pengaturan.
- Backend: SavingsIn gained optional `monthly` and `note` fields (for monthly deposit estimate + description). Added SavingsLineChart to src/components/charts.tsx.


## 2026-10-04 — Laporan 3D Redesign
- Rebuilt Laporan screen to match 3D reference: gradient hero with SVG 3D chart art (ReportHeroArt), period selector (Hari Ini/Minggu Ini/Bulan Ini/Tahun Ini/Custom) with "Dibandingkan dengan" comparison, 4 stat cards (Pemasukan/Pengeluaran/Selisih/Saving Rate) with vs-prev deltas, Cash Flow line chart (6/12 bulan) with totals, Pengeluaran per Kategori donut + legend, Breakdown Pengeluaran list, Kewajiban Finansial (grouped by bill kind + % of income), Kalender Keuangan (month grid with income/expense dots + daily activity), Tabungan yearly bar chart + stats, Financial Insights, Export (Excel/PDF working via backend; CSV generated client-side), Riwayat Laporan (year + month chips).
- All report metrics computed client-side from /transactions, /bills, /savings for full period/comparison flexibility.
- Added charts: BarsChart, ReportHeroArt, ExportArt in src/components/charts.tsx.
- NOTE: Bespoke raster 3D illustrations (report hero + export box) could not be generated — Emergent Universal LLM key budget exhausted (max $1.00 reached). Used polished SVG 3D-style art as substitute; can regenerate rasters after top-up. Scripts ready: gen_savings_assets.py (items report_hero, export_box) + remove_checkerboard.py (both honor SHF_OUT env).


## 2026-10-04 — Pengaturan 3D Redesign + Fitur
- Rebuilt Pengaturan to match 3D reference with all 9 sections + Pendidikan Daftar Anak: gradient hero w/ SVG 3D art (SettingsHeroArt: gears+shield+plant), 3D avatar, Pusat Bantuan.
- Working features: Profil (Nama Lengkap→backend; Nama Panggilan/Username→prefs; Mata Uang/Format Tanggal/Bahasa dropdowns), Ubah Foto (backend) + child photo upload.
- Keamanan: Username edit, PIN set/change (4-digit keypad modal), Kunci Otomatis, Biometrik (expo-local-authentication hardware check), Kunci Saat Diminimalkan, Logout. New AppLockGate (src/applock.tsx) mounted in app/_layout enforces PIN+biometric lock on cold start / background / auto-lock.
- Tampilan: Tema Gelap/Terang/Mengikuti Perangkat (themeMode→scheme via Appearance), Mode Dashboard, Efek Animasi, Ukuran Teks, Kerapatan — all persisted.
- Kategori: custom category CRUD (src/customcats.ts, persisted via storage) with icon/color picker, Pengeluaran/Pemasukan tabs.
- Data & Penyimpanan: Backup (export JSON of all data, download/share) + Restore (import JSON, recreate records via DocumentPicker/web file), Auto Backup + Frekuensi (prefs), Informasi Penyimpanan (live counts + data size).
- Manajemen Data: Hapus Transaksi Tertentu (→transaksi), Bersihkan Data Periode (date-range delete), Hapus Semua Data (full wipe w/ confirm), Pulihkan Data Terakhir (restore).
- Mata Uang: IDR/USD/SGD/EUR/MYR — idr() now multi-currency (RATES + CURRENCY_META in store.ts); switching converts amounts app-wide instantly.
- Tentang Aplikasi (version + info modals + mailto) and Ringkasan Aplikasi (6 live stat cards).
- Store extended with full PrefsState; prefs.tsx persists all keys. Added expo-local-authentication, expo-document-picker.
- NOTE: raster 3D illustrations still unavailable (Universal LLM key budget exhausted) — used SVG 3D-style art.


## 2026-10-04 — Scrollable Bottom Tab Bar
- Replaced the fixed 4-tab bottom bar with a horizontally scrollable bar showing all 8 main menus: Dashboard, Transaksi, Belanja, Tagihan, Pendidikan, Tabungan, Laporan, Analisis (swipe left/right). Pengaturan stays in the 3-dot menu (unchanged).
- Moved belanja/tabungan/laporan/analisis screens from (app)/ into (app)/(tabs)/ as real tab routes; fixed tabungan relative asset requires (../../ → ../../../). URLs unchanged so 3-dot menu router.push links still resolve.
- New src/components/scrollable-tabbar.tsx (custom Tabs tabBar) + rewritten (tabs)/_layout.tsx declaring 8 Tabs.Screen in order. Active tab highlighted; respects bottom safe-area inset.

