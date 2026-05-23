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
- **Database**: MongoDB (users, user_sessions, budgets, expenses, daily_checkins, shared_budgets, contact_messages)

## Subscription Plans (Anti Boncos Club)
| Plan | Badge | Max Pots | Price |
|------|-------|----------|-------|
| FREE | - | 2 | Gratis |
| AMERICANO | Murid Anti Boncos | 3 | Rp29.000/bln |
| KOPI_GULA_AREN | Si Paling Anti Boncos | 5 | Rp49.000/bln |
| V60 | The Last Boncos Bender | ∞ | Rp79.000/bln |

## Features (v5)
1. **Google Social Login**
2. **Multi Budget Pot** with categories + emoji icons
3. **Edit Ongoing Budget** with proportional balance adjustment
4. **Auto-Refill** when refill date passes
5. **Budget Pot Locking** based on subscription plan
6. **Subscription System** (4 tiers, MOCKED payment, badges)
7. **Shared Budget Pots** via email
8. **Share Streak** to social media
9. **Daily Allowance Dashboard** with pot selector
10. **Inline Expense Input** with thousand separator
11. **Budget Health Status** (Aman/Agak Panas/Rem Dikit/Boncos)
12. **Expense History** with checkboxes, select all, bulk delete
13. **Streak & Daily Habit** tracking with 7-day calendar
14. **Time-based Greeting** (Good Morning/Afternoon/Evening)
15. **Badge Display** under user name on dashboard
16. **Export CSV** (V60 exclusive)
17. **Contact Us** form with message saved to DB
18. **Offline Warning** banner when no internet
19. **Dark/Light Mode** + **Bilingual (ID/EN)**
20. **Emoji Tab Icons** (🏠📋⚙️)

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contact | Save contact message |
| GET | /api/export-csv | Export expenses to CSV (V60 only) |
| + all previous endpoints |
