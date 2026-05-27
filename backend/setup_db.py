import os
import uuid
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "boncos")


async def create_indexes(db):
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)

    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)

    await db.budgets.create_index("user_id")
    await db.budgets.create_index("budget_id", unique=True)

    await db.expenses.create_index([("user_id", 1), ("budget_id", 1)])
    await db.expenses.create_index("created_at")
    await db.expenses.create_index("expense_id", unique=True)

    await db.daily_checkins.create_index(
        [("user_id", 1), ("date", 1)],
        unique=True,
    )

    await db.shared_budgets.create_index(
        [("budget_id", 1), ("shared_with_email", 1)],
        unique=True,
    )

    await db.contact_messages.create_index("message_id", unique=True)
    await db.contact_messages.create_index("user_id")


async def seed_test_data(db):
    now = datetime.now(timezone.utc)

    user_id = "user_local_test"
    session_token = "local_test_token"
    budget_id = "budget_local_makan"

    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "email": "local@test.com",
                "name": "Local Test User",
                "picture": "",
                "subscription_plan": "FREE",
                "supporter_badge": None,
                "created_at": now.isoformat(),
            }
        },
        upsert=True,
    )

    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user_id,
                "expires_at": now + timedelta(days=7),
                "created_at": now,
            }
        },
        upsert=True,
    )

    await db.budgets.update_one(
        {"budget_id": budget_id},
        {
            "$set": {
                "budget_id": budget_id,
                "user_id": user_id,
                "total_balance": 3_000_000,
                "current_balance": 3_000_000,
                "refill_date": (now + timedelta(days=30)).isoformat(),
                "label": "Makan",
                "category": "makan",
                "icon": "wallet",
                "active": True,
                "created_at": now.isoformat(),
            }
        },
        upsert=True,
    )

    expense_id = f"exp_{uuid.uuid4().hex[:12]}"

    existing_expense = await db.expenses.find_one(
        {"user_id": user_id, "budget_id": budget_id, "note": "Seed expense"}
    )

    if not existing_expense:
        await db.expenses.insert_one(
            {
                "expense_id": expense_id,
                "user_id": user_id,
                "budget_id": budget_id,
                "amount": 70_000,
                "note": "Seed expense",
                "created_at": now.isoformat(),
            }
        )

        await db.budgets.update_one(
            {"budget_id": budget_id},
            {"$inc": {"current_balance": -70_000}},
        )

    await db.daily_checkins.update_one(
        {"user_id": user_id, "date": now.strftime("%Y-%m-%d")},
        {
            "$set": {
                "user_id": user_id,
                "date": now.strftime("%Y-%m-%d"),
                "updated_at": now.isoformat(),
            }
        },
        upsert=True,
    )


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connecting to MongoDB: {MONGO_URL}")
    print(f"Using database: {DB_NAME}")

    await create_indexes(db)
    print("✅ Indexes created")

    await seed_test_data(db)
    print("✅ Test data seeded")

    collections = await db.list_collection_names()
    print("Collections:")
    for collection in sorted(collections):
        count = await db[collection].count_documents({})
        print(f" - {collection}: {count} documents")

    print("\nLocal test auth token:")
    print("Bearer local_test_token")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())