# Smart Home Finance — Product Requirements

## Overview
Aplikasi keuangan keluarga Indonesia bertema gelap dengan aksen neon, mengikuti gaya dashboard "Smart Home Finance". Pengguna dapat mengelola pemasukan/pengeluaran, tagihan, cicilan, belanja bulanan, kebutuhan pendidikan anak, tabungan (target), plus insight AI dalam Bahasa Indonesia.

## Tech Stack
- Frontend: Expo (React Native) + Expo Router (57), react-native-safe-area-context, react-native-svg untuk chart, MaterialDesignIcons
- Backend: FastAPI + Motor (MongoDB), JWT (email/password), Emergent Google Sign-in, Emergent LLM (Claude Sonnet 5) untuk insight
- Storage: MongoDB (users, user_sessions, transactions, bills, shopping, savings, education_children, education_items)

## Auth
- Register/Login Email+Password (JWT 7 hari)
- Google Sign-in via Emergent (`session_id` → `POST /api/auth/session` → `session_token`)
- `/api/auth/me`, `/api/auth/logout`

## Navigation
- 4 Tab bawah: Dashboard, Transaksi, Tagihan, Tabungan
- Modal Menu (ikon hamburger di Dashboard): Belanja, Pendidikan, Laporan, Analisis, Pengaturan
- Modal Add Transaction

## Screens
- **Dashboard**: financial balance, income/expense/saving rate/tx count stats, financial health ring, expense donut, cashflow line chart (6 bulan), upcoming bills, savings goals, AI insight card.
- **Transaksi**: filter chips (Semua/Pemasukan/Pengeluaran), grouped by date, tambah via modal.
- **Tagihan**: 5 status group (Segera/Belum/Terlambat/Lunas), filter by kind (rutin/cicilan/pinjaman/lainnya), toggle lunas, delete.
- **Tabungan**: hero total, target cards dengan jar animation & progress ring, add/edit/delete.
- **Belanja**: monthly budget summary, item cards with budget vs realisasi progress, status badge.
- **Pendidikan**: multi-child, per-child budget items, agenda.
- **Laporan**: monthly summary + charts.
- **Analisis**: AI insight (regenerate), health score, saving rate, top kategori.
- **Pengaturan**: profile, tema, bahasa, logout.

## Design
- Dark navy `#0A0E1A` bg, neon accents (green success `#10D96A`, red error `#FF4757`, blue info `#3D7EFF`, purple brand `#9B6BFF`, orange warning `#FF9D3D`).
- Cards `#12182B`, inputs `#1C243B`, borders `#2A3441`.

## Key Endpoints
- Auth: `/api/auth/register|login|session|me|logout`
- CRUD: `/api/transactions`, `/api/bills`, `/api/shopping`, `/api/savings`, `/api/education/children`, `/api/education/items`
- Aggregation: `/api/dashboard/summary`, `/api/insights/generate`
