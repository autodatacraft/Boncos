"""
Backend API tests for habit retention and pacing additions.
"""
import os
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def db():
    from pymongo import MongoClient

    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    yield database
    client.close()


def create_user(db, suffix):
    user_id = f"test_habit_{suffix}"
    token = f"test_habit_token_{suffix}"
    db.users.delete_one({"user_id": user_id})
    db.user_sessions.delete_one({"session_token": token})
    db.budgets.delete_many({"user_id": user_id})
    db.expenses.delete_many({"user_id": user_id})
    db.daily_checkins.delete_many({"user_id": user_id})

    db.users.insert_one({
        "user_id": user_id,
        "email": f"{suffix}@boncos.app",
        "name": "Habit User",
        "picture": "",
        "subscription_plan": "FREE",
        "supporter_badge": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return user_id, token


def cleanup_user(db, user_id, token):
    db.expenses.delete_many({"user_id": user_id})
    db.budgets.delete_many({"user_id": user_id})
    db.daily_checkins.delete_many({"user_id": user_id})
    db.users.delete_one({"user_id": user_id})
    db.user_sessions.delete_one({"session_token": token})


def test_no_spend_checkin_records_streak(api_client, db):
    user_id, token = create_user(db, "no_spend_v6")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    response = api_client.post(
        f"{BASE_URL}/api/check-in",
        json={"checkin_date": today, "note": "no_spend"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    checkin = db.daily_checkins.find_one({"user_id": user_id, "date": today})
    assert checkin is not None
    assert "no_spend" in checkin.get("sources", [])

    streak_response = api_client.get(
        f"{BASE_URL}/api/streak",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert streak_response.status_code == 200
    assert streak_response.json()["today_logged"] is True

    cleanup_user(db, user_id, token)


def test_backdated_expense_records_backdated_checkin(api_client, db):
    user_id, token = create_user(db, "backdate_v6")
    budget_id = "budget_backdate_v6"
    db.budgets.insert_one({
        "budget_id": budget_id,
        "user_id": user_id,
        "total_balance": 1000000,
        "current_balance": 1000000,
        "refill_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
        "label": "Backdate",
        "category": "umum",
        "icon": "wallet",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    response = api_client.post(
        f"{BASE_URL}/api/expenses",
        json={"budget_id": budget_id, "amount": 25000, "note": "late input", "expense_date": yesterday},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    checkin = db.daily_checkins.find_one({"user_id": user_id, "date": yesterday})
    assert checkin is not None
    assert "expense" in checkin.get("sources", [])

    cleanup_user(db, user_id, token)


def test_dashboard_returns_pacing_and_recovery_fields(api_client, db):
    user_id, token = create_user(db, "pacing_v6")
    budget_id = "budget_pacing_v6"
    db.budgets.insert_one({
        "budget_id": budget_id,
        "user_id": user_id,
        "total_balance": 1000000,
        "current_balance": 120000,
        "refill_date": (datetime.now(timezone.utc) + timedelta(days=6)).isoformat(),
        "label": "Pacing",
        "category": "umum",
        "icon": "wallet",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response = api_client.get(
        f"{BASE_URL}/api/dashboard?budget_id={budget_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "pacing_status" in data
    assert "pacing_amount" in data
    assert "pacing_insight" in data
    assert data["recovery_daily_target"] is not None
    assert data["recovery_tip"] is not None

    cleanup_user(db, user_id, token)
