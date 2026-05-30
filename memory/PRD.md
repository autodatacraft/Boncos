# Boncos Product Requirements Document

Status: Active development  
Last updated: 2026-05-31  
Platforms: Android primary, iOS compatible, web useful for testing

## 1. Product Summary

Boncos is a mobile budgeting app focused on daily spending pacing. Instead of only tracking historical expenses, Boncos answers one everyday question:

> "How much can I safely spend today?"

The product calculates a dynamic daily allowance from the user's remaining balance and remaining days until refill or payday. Each expense immediately changes the user's safe daily allowance, budget health status, and spending guidance.

Core formula:

```text
daily_allowance = current_balance / days_remaining_until_refill
```

Example:

```text
Total budget: Rp3.000.000
Refill cycle: 30 days
Expense on day 1: Rp70.000

Current balance: Rp2.930.000
Remaining days: 29
New daily allowance: Rp101.034
```

## 2. Problem Statement

Many users know their monthly budget but struggle to translate that budget into a safe daily spending number. Traditional expense trackers show what happened after money is gone. Boncos should help users make a better decision before the next purchase.

Users need:

- A fast way to know today's safe spending amount.
- Low-friction expense input while they are out spending.
- Simple warnings when spending pace becomes risky.
- Separate budget pots for common spending categories.
- Habit cues that encourage daily check-ins without feeling like accounting work.

## 3. Goals

- Help users understand their safe daily spending limit in under 5 seconds after opening the app.
- Make logging a common expense possible in under 10 seconds.
- Encourage daily expense logging through streaks, reminders, and visible progress.
- Support multiple budget pots while using subscription tiers as the monetization model.
- Keep the tone casual, supportive, and Indonesia-first while also supporting English.

## 4. Non-Goals

- Full accounting, bookkeeping, or tax reporting.
- Bank account aggregation.
- Investment, debt, credit score, or financial advice features.
- Complex envelope budgeting workflows that require heavy setup.
- Multi-currency support for the first stable release.

## 5. Target Users

### Primary User

Young Indonesian earners, students, freelancers, and early-career workers who want to survive until payday without maintaining spreadsheets.

### Secondary User

Users who already track expenses but want daily pacing and a lighter mobile workflow.

### Paid User

Power users who manage multiple spending categories, share budgets, or want CSV export.

## 6. User Personas

### "Payday Pacer"

- Receives salary or allowance on a predictable cycle.
- Wants one number: safe spend today.
- Often spends on food, transport, coffee, and shopping.
- Success means avoiding end-of-month panic.

### "Budget Splitter"

- Separates money into multiple categories.
- Needs separate pots like Makan, Transport, Kopi/Jajan, Hiburan, Belanja, and Umum.
- Will upgrade if free pot limits are too restrictive.

### "Shared Pot User"

- Shares a specific budget pot with a partner, friend, or household member.
- Needs shared visibility and expense contribution without sharing the whole account.

## 7. Key User Journeys

### First-Time Setup

1. User signs in with Google.
2. User creates first budget pot with label, category, total balance, and refill date.
3. App shows today's allowance, remaining balance, days to refill, and budget health.

### Daily Check-In

1. User opens Boncos.
2. User sees greeting, selected budget pot, health status, daily allowance, and streak.
3. User decides whether spending today is safe.

### Log Expense

1. User enters amount or taps quick amount buttons.
2. User optionally adds a note.
3. User saves the expense.
4. App updates daily allowance, today's spent, today's remaining, balance, total spent, and streak state.

### Manage Budget Pots

1. User opens Settings.
2. User creates, edits, deletes, shares, or unshares budget pots.
3. If the current subscription tier limit is reached, locked pots or upgrade prompts are shown.

### Review History

1. User opens History.
2. User filters by all budgets or one budget pot.
3. User reviews grouped expenses by date.
4. User deletes one expense or selects multiple expenses for bulk deletion.

### Upgrade

1. User taps Join Anti Boncos Club or hits a plan limit.
2. User views subscription plans.
3. User selects a tier.
4. App updates pot limits and supporter badge.

## 8. Functional Requirements

### 8.1 Authentication

- Users must be able to sign in with Google.
- The backend must create or update a user profile on login.
- The backend must issue a session token.
- The app must persist the token securely where supported.
- Users must be able to log out.
- Expired or invalid sessions must return unauthorized responses.

### 8.2 Budget Pots

- Users must be able to create a budget pot with:
  - Total balance
  - Current balance initialized from total balance
  - Refill date
  - Label
  - Category
  - Icon
- Users must be able to view all owned budget pots.
- Users must be able to edit an owned budget pot.
- Editing total balance must preserve already-spent amount where possible.
- Users must be able to delete an owned pot.
- Deleting a pot must deactivate the pot and remove related expenses and sharing records.
- The app must support shared budget pots visible to invited users.
- Shared pots must not count against the invited user's own plan limit.

### 8.3 Auto-Refill

- When a budget's refill date has passed, the backend must reset current balance to total balance.
- The backend must advance refill date by 30-day increments until the new refill date is in the future.
- Auto-refill must run when budgets or dashboard data are requested.

### 8.4 Daily Allowance Dashboard

- User must see one selected active budget pot at a time.
- Dashboard must show:
  - Daily allowance
  - Budget health status
  - Days until refill
  - Today's spent
  - Today's remaining
  - Current balance
  - Total spent
- Users with multiple unlocked pots must be able to switch selected budget pot.
- Empty state must guide users to create a budget when no pot exists.

### 8.5 Budget Health

Budget health must be based on current balance divided by total balance:

| Ratio | Status key | Product copy |
| --- | --- | --- |
| >= 60% | aman | Aman / Safe |
| >= 35% and < 60% | agak_panas | Agak Panas / Getting Warm |
| >= 15% and < 35% | rem_dikit | Rem Dikit Bos / Slow Down |
| < 15% | boncos | Boncos Total / Broke |

### 8.6 Expense Logging

- User must be able to add an expense from the dashboard.
- Required field: amount.
- Optional field: note.
- Expense must belong to a budget pot.
- Saving an expense must decrease that pot's current balance.
- Saving an expense must create or update today's daily check-in.
- Quick amount buttons must support common values: Rp10.000, Rp20.000, Rp50.000, Rp100.000.
- Amount inputs must display Indonesian thousand separators.

### 8.7 Expense History

- User must be able to view expenses sorted newest first.
- User must be able to filter history by budget pot.
- Expenses must be grouped by date.
- User must be able to delete a single expense.
- User must be able to select all visible expenses and bulk delete.
- Deleting an expense must restore its amount to the associated budget's current balance.

### 8.8 Streaks and Daily Habit

- The system must track whether the user logged at least one expense per day.
- Dashboard and Settings must show current streak.
- Streak data must include:
  - Current streak
  - Longest streak
  - Today logged flag
  - Last 7 days calendar state
- Users must be able to share streak text through the platform share sheet.
- If the user has not logged today, the app should request notification permission and schedule a reminder where supported.
- If the user logs today, reminders should be cancelled.

### 8.9 Subscription and Pot Limits

Boncos uses Anti Boncos Club tiers:

| Plan ID | Display name | Badge | Max owned pots | Price |
| --- | --- | --- | ---: | --- |
| FREE | Free | None | 2 | Gratis |
| AMERICANO | Americano | Murid Anti Boncos | 3 | Rp29.000/bln |
| KOPI_GULA_AREN | Kopi Gula Aren | Si Paling Anti Boncos | 5 | Rp49.000/bln |
| V60 | V60 | The Last Boncos Bender | Unlimited | Rp79.000/bln |

- Users must be prevented from creating more owned active pots than their plan allows.
- Pots beyond the user's plan limit must be returned as locked.
- Locked owned pots must block edits and expense creation.
- Upgrade prompts must appear when a user reaches a limit or taps locked/premium actions.
- Current implementation may use mocked subscription success.
- Future production release should integrate a real payment provider such as RevenueCat.

### 8.10 Budget Sharing

- Owner must be able to share a budget pot by email.
- Owner cannot share a pot with their own email.
- Duplicate shares must be rejected.
- Owner must be able to view emails with access to a pot.
- Owner must be able to remove access from a shared email.
- Invited users must be able to view and log expenses against shared pots.
- Invited users must not be able to edit or delete the owner's pot unless explicitly added in a future permission model.

### 8.11 Export

- V60 users must be able to export expenses to CSV.
- Non-V60 users must see upgrade prompt for export.
- CSV must include:
  - Date
  - Amount
  - Note
  - Budget label

### 8.12 Contact Us

- Authenticated users must be able to submit a contact message.
- Backend must save message ID, user ID, username, email, message body, and created timestamp.

### 8.13 Offline Awareness

- App must show an offline warning when connectivity is unavailable.
- Current requirement is warning-only.
- Future offline-first mode may queue writes and sync later.

### 8.14 Theme and Language

- App must support dark and light mode.
- App must support Indonesian and English text.
- User should be able to switch language from Settings.
- Product voice should remain casual and supportive in Indonesian.

## 9. API Requirements

Base path: `/api`

| Method | Path | Requirement |
| --- | --- | --- |
| POST | `/auth/google` | Login with Google ID token |
| POST | `/auth/session` | Create session from managed auth session ID |
| GET | `/auth/me` | Return current user |
| POST | `/auth/logout` | Delete current session |
| GET | `/plans` | Return subscription plans |
| POST | `/subscribe` | Update user's subscription plan |
| POST | `/budgets` | Create budget pot |
| GET | `/budgets` | List owned and shared budget pots |
| PATCH | `/budgets/{budget_id}` | Edit owned budget pot |
| DELETE | `/budgets/{budget_id}` | Delete owned budget pot |
| POST | `/budgets/share` | Share budget pot by email |
| GET | `/budgets/{budget_id}/shared` | List users a pot is shared with |
| DELETE | `/budgets/{budget_id}/shared/{email}` | Remove shared access |
| POST | `/expenses` | Create expense |
| GET | `/expenses` | List user's expenses, optionally by budget ID |
| POST | `/expenses/bulk-delete` | Bulk delete expenses |
| DELETE | `/expenses/{expense_id}` | Delete one expense |
| GET | `/dashboard` | Return dashboard metrics, optionally by budget ID |
| GET | `/streak` | Return streak state |
| GET | `/notification-check` | Return whether reminder is needed |
| POST | `/contact` | Save contact message |
| GET | `/export-csv` | Export CSV for V60 users |
| GET | `/health` | Health check |

## 10. Data Requirements

### Users

- `user_id`
- `email`
- `name`
- `picture`
- `google_sub`
- `subscription_plan`
- `supporter_badge`
- `created_at`
- `updated_at`

### Sessions

- `session_token`
- `user_id`
- `created_at`
- `expires_at`

### Budgets

- `budget_id`
- `user_id`
- `total_balance`
- `current_balance`
- `refill_date`
- `label`
- `category`
- `icon`
- `active`
- `created_at`

### Expenses

- `expense_id`
- `user_id`
- `budget_id`
- `amount`
- `note`
- `created_at`

### Daily Check-Ins

- `user_id`
- `date`
- `updated_at`

### Shared Budgets

- `budget_id`
- `shared_with_email`
- `shared_by_user_id`
- `shared_by_name`
- `created_at`

### Contact Messages

- `message_id`
- `user_id`
- `username`
- `email`
- `message`
- `created_at`

## 11. UX Requirements

- First screen after login should prioritize today's allowance, not analytics.
- Main call-to-action should be logging an expense.
- Budget health should use clear color and copy, not only numbers.
- Empty states should be short and directive.
- Inputs should be mobile-first, large enough for quick thumb usage.
- Settings may contain power features, but the daily dashboard should stay simple.
- The app should avoid finance-heavy wording and preserve the Boncos tone.

## 12. Success Metrics

Activation:

- User creates first budget pot.
- User logs first expense.

Engagement:

- Daily active users.
- Average expense logs per active user per week.
- Percentage of users with a 3+ day streak.
- Percentage of users who open dashboard before logging an expense.

Retention:

- Day 1, Day 7, and Day 30 retention.
- Percentage of users who continue after one refill cycle.

Monetization:

- Free-to-paid conversion.
- Upgrade prompt conversion rate.
- Distribution of paid plans.
- V60 CSV export usage.

Quality:

- Expense save success rate.
- API error rate by endpoint.
- App startup to dashboard-ready time.
- Crash-free sessions.

## 13. Release Scope

### MVP

- Google login.
- Create and manage budget pots.
- Dashboard with dynamic daily allowance.
- Expense logging.
- Expense history and delete.
- Streak tracking.
- Indonesian and English UI.
- Dark and light mode.

### Beta

- Subscription plan limits with mocked payment.
- Budget sharing by email.
- CSV export for V60.
- Contact form.
- Offline warning.
- Push reminder flow.

### Production Readiness

- Real subscription/payment integration.
- Stronger auth/session hardening.
- Better native offline handling.
- Privacy policy and terms.
- App store assets and release QA.
- Analytics instrumentation.

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Mocked payments are mistaken for production-ready billing | Revenue and trust risk | Clearly gate production launch on real payment integration |
| Users misunderstand daily allowance as financial advice | Trust and compliance risk | Keep copy as spending guidance, not financial advice |
| Offline warning says data will sync but writes are not queued | User confusion | Update copy or implement offline queue before public launch |
| Shared budget permissions are too broad | Privacy or control issues | Define owner/editor/viewer permissions before expanding sharing |
| Refill cycle is fixed to 30-day increments | Incorrect pacing for some users | Add configurable refill interval after MVP |
| Timezone handling affects streaks/refills | Bad user trust | Store dates carefully and test Asia/Jakarta plus UTC boundaries |

## 15. Open Questions

- Should refill intervals always be monthly, or should users choose weekly, biweekly, and custom intervals?
- Should shared budget users be allowed to delete their own expenses only, or any expense in the shared pot?
- Should expenses be editable, not only deletable?
- Should plan limits apply to archived/deleted pots or active pots only? Current behavior uses active pots.
- Should CSV export require secure authenticated download instead of opening a raw URL?
- Should streaks count any expense, or only expense logs in owned budgets?
- Should the product keep Bahasa Indonesia as default for all users in Indonesia?

## 16. Technical Stack

Frontend:

- Expo
- React Native
- Expo Router
- TypeScript
- React Navigation
- Async/Secure storage utilities
- Expo Notifications

Backend:

- FastAPI
- Python
- Pydantic
- Motor async MongoDB driver
- MongoDB
- Google ID token verification

Testing:

- Backend pytest suites are present under `backend/tests`.
- Historical test reports are present under `test_reports`.

## 17. Acceptance Criteria Summary

- A new user can sign in, create a budget pot, and see today's allowance.
- A returning user can log an expense and see all dashboard numbers update.
- Budget health changes as balance ratio crosses defined thresholds.
- Users cannot exceed plan pot limits without upgrading.
- Locked pots cannot be edited or used for expense logging.
- Shared pots are visible to invited users.
- Expense deletion restores budget balance.
- V60 users can export CSV; non-V60 users are prompted to upgrade.
- Theme and language choices update visible UI copy.
- Contact messages are persisted.

