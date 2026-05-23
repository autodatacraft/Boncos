# Boncos — Daily Budget Pacing App PRD

## Overview
Boncos adalah aplikasi mobile untuk membantu user menjawab: "Hari ini gue masih aman spend berapa?"

## Core Formula
```
jatah_harian = sisa_saldo / sisa_hari_menuju_refill
```

## Tech Stack
- **Backend**: FastAPI + MongoDB (Motor)
- **Frontend**: Expo Router (React Native) with TypeScript
- **Auth**: Google OAuth via Emergent-managed auth
- **Database**: MongoDB (users, user_sessions, budgets, expenses, daily_checkins)

## Features (MVP v2)
1. **Google Social Login** — Emergent-managed Google OAuth
2. **Multi Budget Pot** — Multiple budgets with categories (Makan, Transport, Kopi/Jajan, Hiburan, Belanja, Umum)
3. **Daily Allowance Dashboard** — Dynamic calculation per budget pot
4. **Inline Expense Input** — Textbox with Rp prefix + quick fill buttons (+10k/+20k/+50k/+100k) that add to textbox
5. **Thousand Separator** — Indonesian format (dots: 1.000.000)
6. **Budget Health Status** — Aman (≥60%), Agak Panas (≥35%), Rem Dikit (≥15%), Boncos (<15%)
7. **Expense History** — Grouped by date, filterable by budget pot, with delete
8. **Streak & Daily Habit** — Current streak, longest streak, 7-day calendar, auto-records on expense input
9. **Dark/Light Mode** — User toggleable theme
10. **Bilingual (ID/EN)** — Indonesian & English language toggle

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/session | Create session from Google OAuth |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| POST | /api/budgets | Create budget pot |
| GET | /api/budgets | List all active budget pots |
| DELETE | /api/budgets/{id} | Delete budget pot |
| POST | /api/expenses | Add expense + record streak |
| GET | /api/expenses | List expenses (optional budget_id filter) |
| DELETE | /api/expenses/{id} | Delete expense + restore balance |
| GET | /api/dashboard | Dashboard data (optional budget_id filter) |
| GET | /api/streak | Streak info (current, longest, 7-day) |

## Design
- Neo-brutalist style with hard shadows and thick borders
- Status-colored hero card (Green/Yellow/Orange/Red)
- Character illustrations for each health status
- Inline expense form with quick-fill buttons

## Future Features
- Daily reminder notifications
- CSV/Cloud export
- Shared budget pots
