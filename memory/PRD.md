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
- **Database**: MongoDB (users, user_sessions, budgets, expenses)

## Features (MVP)
1. **Google Social Login** — Emergent-managed Google OAuth
2. **Budget Setup** — Set total balance + refill/payday date + label
3. **Daily Allowance Dashboard** — Dynamic calculation of daily safe spending
4. **Quick Expense Input** — 10k/20k/50k/100k buttons + custom amount modal
5. **Budget Health Status** — Aman (≥60%), Agak Panas (≥35%), Rem Dikit (≥15%), Boncos (<15%)
6. **Expense History** — Grouped by date, with delete + balance restoration
7. **Dark/Light Mode** — User toggleable theme
8. **Bilingual (ID/EN)** — Indonesian & English language toggle

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/session | Create session from Google OAuth |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| POST | /api/budgets | Create/replace budget |
| GET | /api/budgets | Get active budget |
| POST | /api/expenses | Add expense |
| GET | /api/expenses | List expenses |
| DELETE | /api/expenses/{id} | Delete expense + restore balance |
| GET | /api/dashboard | Dashboard data with calculations |

## Design
- Neo-brutalist style with hard shadows and thick borders
- Status-colored hero card (Green/Yellow/Orange/Red)
- Character illustrations for each health status

## Future Features
- Multi budget pots (makan, transport, etc.)
- Streak/habit tracking
- CSV/Cloud export
- Daily reminder notifications
