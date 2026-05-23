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

## Features (v3)
1. **Google Social Login** — Emergent-managed Google OAuth
2. **Multi Budget Pot** — Multiple budgets with categories (Makan, Transport, Kopi/Jajan, Hiburan, Belanja, Umum) with icons
3. **Edit Ongoing Budget** — Change total balance, label, refill date of existing pots (proportional balance adjustment)
4. **Auto-Refill** — Budget automatically resets when refill date passes
5. **Daily Allowance Dashboard** — Dynamic calculation per budget pot with pot selector chips
6. **Inline Expense Input** — Textbox with Rp prefix + quick fill buttons (+10k/+20k/+50k/+100k)
7. **Thousand Separator** — Indonesian format (dots: 1.000.000) on all numeric inputs
8. **Budget Health Status** — Aman (≥60%), Agak Panas (≥35%), Rem Dikit (≥15%), Boncos (<15%)
9. **Expense History** — Grouped by date, checkboxes per row, select all, bulk delete, X icon delete, filterable by pot
10. **Streak & Daily Habit** — Current streak, longest streak, 7-day calendar
11. **Push Notifications** — Reminders every 6h if no expense logged today
12. **Dark/Light Mode** — User toggleable theme
13. **Bilingual (ID/EN)** — Indonesian & English language toggle

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/session | Create session from Google OAuth |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| POST | /api/budgets | Create budget pot |
| GET | /api/budgets | List all active budget pots (with auto-refill) |
| PATCH | /api/budgets/{id} | Edit budget (total_balance, label, refill_date) |
| DELETE | /api/budgets/{id} | Delete budget pot |
| POST | /api/expenses | Add expense + record streak |
| GET | /api/expenses | List expenses (optional budget_id filter) |
| POST | /api/expenses/bulk-delete | Bulk delete expenses + restore balances |
| DELETE | /api/expenses/{id} | Delete expense + restore balance |
| GET | /api/dashboard | Dashboard data (optional budget_id, auto-refill) |
| GET | /api/streak | Streak info (current, longest, 7-day) |
| GET | /api/notification-check | Check if user needs reminder |

## Future Features
- Share streak to social media
- CSV/Cloud export
- Shared budget pots (bersama pasangan/keluarga)
