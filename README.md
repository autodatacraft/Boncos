# ☕ Boncos

> “Hari ini gue masih aman spend berapa sih?”

Boncos adalah aplikasi budgeting mobile dengan pendekatan **daily spending pacing**.

Berbeda dari expense tracker biasa yang cuma mencatat pengeluaran, Boncos membantu user menentukan:

* berapa batas aman pengeluaran hari ini
* apakah budget mulai panas
* apakah harus mulai nahan sebelum boncos total 😭

Core formula Boncos:

```text
daily_allowance = remaining_balance / remaining_days
```

Contoh:

* Budget makan: Rp3.000.000
* Durasi: 30 hari
* Hari pertama spend: Rp70.000

Maka:

* Remaining balance = Rp2.930.000
* Remaining days = 29
* Daily allowance baru = Rp101.034

---

# ✨ Features

## 💸 Dynamic Daily Allowance

Allowance harian otomatis update berdasarkan:

* sisa saldo
* sisa hari menuju refill/gajian

---

## ⚡ Super Fast Expense Input

Designed untuk dipakai tiap hari tanpa friction.

* quick amount button
* minimal tap
* instant save
* mobile-first UX

---

## 📊 Budget Health Status

Status budget:

* Masih Aman
* Agak Panas
* Rem Dikit Bos
* Boncos Total

---

## 🧠 Multi Budget Pot

Pisahkan budget:

* makan
* transport
* entertainment
* jajan impulsif 😭

---

## 🔥 Daily Habit Focus

Boncos dibangun untuk membentuk habit:

> “cek kondisi budget setiap hari”

Bukan sekadar jadi spreadsheet mobile.

---

# ☕ Anti Boncos Club

Support developer sambil unlock lebih banyak budget pot.

| Tier            | Badge                  | Benefit                              |
| --------------- | ---------------------- | -------------------------------------|
| Americano       | Murid Anti Boncos      | +1 budget pot                        |
| Kopi Gula Aren  | Si Paling Anti Boncos  | +3 budget pot                        |
| V60 Brew Coffee | The Last Boncos Bender | Unlimited budget pot + export to CSV |

CTA:

```text
Join Anti Boncos Club
```

---

# 🛠 Tech Stack

## Frontend

* React Native
* Expo
* Expo Router
* TypeScript

## Backend

* FastAPI
* Python

## Database

* MongoDB
* Motor (async MongoDB driver)

## State Management

* Zustand

## Styling

* NativeWind

---

# 📱 Platform

Primary platform:

* Android
* iOS (compatible)

Built with:

* Expo React Native

---

# 🏗 Project Structure

```text
frontend/
backend/

frontend/
 ├── app/
 ├── components/
 ├── services/
 ├── stores/
 └── utils/

backend/
 ├── server.py
 ├── routes/
 ├── models/
 └── services/
```

---

# 🚀 Running the Project

## Frontend

```bash
cd frontend
npm install
npx expo start
```

---

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

---

# 🔐 Environment Variables

Backend `.env` example:

```env
MONGO_URL=your_mongodb_url
DB_NAME=boncos
```

---

# 🎯 Product Philosophy

Boncos is not trying to become:

* accounting software
* finance bro dashboard
* spreadsheet simulator

Boncos is built to answer one simple question:

> “Hari ini gue masih aman nggak?”

---

# ⚠️ Disclaimer

Boncos cannot stop:

* impulsive Shopee checkout
* midnight Tokopedia wisdom
* random boba purchases
* “self reward” justification attacks

Use responsibly 😭

---

# 📌 Status

Currently under active development.

Future roadmap:

* RevenueCat subscription
* push notification reminder
* streak system
* analytics dashboard
* export to Google Sheets
* offline-first mode

---

# ❤️ Support

If Boncos helps you survive before payday:

```text
Join Anti Boncos Club ☕
```
