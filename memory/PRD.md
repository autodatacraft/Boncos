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
- **Database**: MongoDB (users, user_sessions, budgets, expenses, daily_checkins, shared_budgets)

## Subscription Plans (Anti Boncos Club)
| Plan | Badge | Max Pots | Price |
|------|-------|----------|-------|
| FREE | - | 2 | Gratis |
| AMERICANO | Murid Anti Boncos | 3 | Rp29.000/bln |
| KOPI_GULA_AREN | Si Paling Anti Boncos | 5 | Rp49.000/bln |
| V60 | The Last Boncos Bender | ∞ | Rp79.000/bln |

## Budget Locking Logic
- Sort pots by createdAt ascending
- Oldest allowed stay active, newest beyond limit get locked
- Locked pots: visible, read-only, no expenses, show upgrade CTA
- Downgrade NEVER deletes pots

## Features (v4)
1. **Google Social Login**
2. **Multi Budget Pot** with categories (Makan, Transport, Kopi, Hiburan, Belanja, Umum) + emoji icons
3. **Edit Ongoing Budget** (PATCH)
4. **Auto-Refill** when refill date passes
5. **Budget Pot Locking** based on subscription plan
6. **Subscription System** (4 tiers, mock payment, badges)
7. **Shared Budget Pots** (share via email, multi-user access)
8. **Share Streak** to social media (WhatsApp/IG/etc via native Share)
9. **Daily Allowance Dashboard** with pot selector (excludes locked)
10. **Inline Expense Input** with thousand separator
11. **Budget Health Status** (Aman/Agak Panas/Rem Dikit/Boncos)
12. **Expense History** with checkboxes, select all, bulk delete
13. **Streak & Daily Habit** tracking with 7-day calendar
14. **Push Notifications** (lazy import, graceful fallback on Expo Go)
15. **Dark/Light Mode** + **Bilingual (ID/EN)**
16. **Emoji Tab Icons** (🏠📋⚙️) - works even when vector icons font fails

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/plans | List subscription plans |
| POST | /api/subscribe | Subscribe to plan (mock payment) |
| POST | /api/budgets/share | Share budget with email |
| GET | /api/budgets/{id}/shared | List shared emails |
| DELETE | /api/budgets/{id}/shared/{email} | Unshare |
| PATCH | /api/budgets/{id} | Edit budget |
| POST | /api/expenses/bulk-delete | Bulk delete expenses |
| + all previous endpoints |
