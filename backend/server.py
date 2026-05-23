from fastapi import FastAPI, APIRouter, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Models ───
class SessionInput(BaseModel):
    session_id: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str

class BudgetCreate(BaseModel):
    total_balance: float
    refill_date: str  # ISO date string
    label: Optional[str] = "Budget Utama"

class BudgetResponse(BaseModel):
    budget_id: str
    user_id: str
    total_balance: float
    current_balance: float
    refill_date: str
    label: str
    created_at: str

class ExpenseCreate(BaseModel):
    amount: float
    note: Optional[str] = ""
    budget_id: str

class ExpenseResponse(BaseModel):
    expense_id: str
    user_id: str
    budget_id: str
    amount: float
    note: str
    created_at: str

class DashboardResponse(BaseModel):
    budget_id: str
    label: str
    total_balance: float
    current_balance: float
    refill_date: str
    days_remaining: int
    daily_allowance: float
    today_spent: float
    today_remaining: float
    health_status: str
    total_spent: float

# ─── Auth helpers ───
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.user_sessions.delete_one({"session_token": token})
            return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

# ─── Startup: create indexes ───
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.budgets.create_index("user_id")
    await db.expenses.create_index([("user_id", 1), ("budget_id", 1)])
    await db.expenses.create_index("created_at")
    logger.info("MongoDB indexes created")

# ─── Auth Routes ───
@api_router.post("/auth/session")
async def create_session(body: SessionInput):
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
        if resp.status_code != 200:
            return {"error": "Invalid session"}, 401
        data = resp.json()

    email = data["email"]
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "session_token": session_token}

@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}, 401
    return UserResponse(**user)

@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}

# ─── Budget Routes ───
@api_router.post("/budgets")
async def create_budget(body: BudgetCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}
    
    # Deactivate any existing active budget
    await db.budgets.update_many(
        {"user_id": user["user_id"], "active": True},
        {"$set": {"active": False}}
    )
    
    budget_id = f"budget_{uuid.uuid4().hex[:12]}"
    budget = {
        "budget_id": budget_id,
        "user_id": user["user_id"],
        "total_balance": body.total_balance,
        "current_balance": body.total_balance,
        "refill_date": body.refill_date,
        "label": body.label or "Budget Utama",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.budgets.insert_one(budget)
    del budget["_id"]
    del budget["active"]
    return BudgetResponse(**budget)

@api_router.get("/budgets")
async def get_active_budget(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}
    budget = await db.budgets.find_one(
        {"user_id": user["user_id"], "active": True},
        {"_id": 0}
    )
    if not budget:
        return {"budget": None}
    return {
        "budget_id": budget["budget_id"],
        "user_id": budget["user_id"],
        "total_balance": budget["total_balance"],
        "current_balance": budget["current_balance"],
        "refill_date": budget["refill_date"],
        "label": budget["label"],
        "created_at": budget["created_at"],
    }

# ─── Expense Routes ───
@api_router.post("/expenses")
async def create_expense(body: ExpenseCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}
    
    budget = await db.budgets.find_one(
        {"budget_id": body.budget_id, "user_id": user["user_id"], "active": True},
        {"_id": 0}
    )
    if not budget:
        return {"error": "Budget not found"}
    
    new_balance = budget["current_balance"] - body.amount
    await db.budgets.update_one(
        {"budget_id": body.budget_id},
        {"$set": {"current_balance": new_balance}}
    )
    
    expense_id = f"exp_{uuid.uuid4().hex[:12]}"
    expense = {
        "expense_id": expense_id,
        "user_id": user["user_id"],
        "budget_id": body.budget_id,
        "amount": body.amount,
        "note": body.note or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(expense)
    del expense["_id"]
    return ExpenseResponse(**expense)

@api_router.get("/expenses")
async def get_expenses(budget_id: Optional[str] = None, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}
    
    query = {"user_id": user["user_id"]}
    if budget_id:
        query["budget_id"] = budget_id
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"expenses": expenses}

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}
    
    expense = await db.expenses.find_one(
        {"expense_id": expense_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not expense:
        return {"error": "Expense not found"}
    
    # Restore balance to budget
    await db.budgets.update_one(
        {"budget_id": expense["budget_id"], "active": True},
        {"$inc": {"current_balance": expense["amount"]}}
    )
    await db.expenses.delete_one({"expense_id": expense_id})
    return {"message": "Expense deleted"}

# ─── Dashboard Route ───
@api_router.get("/dashboard")
async def get_dashboard(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        return {"error": "Unauthorized"}
    
    budget = await db.budgets.find_one(
        {"user_id": user["user_id"], "active": True},
        {"_id": 0}
    )
    if not budget:
        return {"dashboard": None}
    
    # Calculate days remaining
    refill_date = datetime.fromisoformat(budget["refill_date"]).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days_remaining = max((refill_date - now).days, 1)
    
    # Calculate today's spending
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_expenses = await db.expenses.find(
        {
            "user_id": user["user_id"],
            "budget_id": budget["budget_id"],
            "created_at": {"$gte": today_start.isoformat()}
        },
        {"_id": 0}
    ).to_list(500)
    today_spent = sum(e["amount"] for e in today_expenses)
    
    # Total spent
    total_spent = budget["total_balance"] - budget["current_balance"]
    
    # Daily allowance
    daily_allowance = budget["current_balance"] / days_remaining if days_remaining > 0 else 0
    today_remaining = daily_allowance - today_spent
    
    # Health status
    ratio = budget["current_balance"] / budget["total_balance"] if budget["total_balance"] > 0 else 0
    if ratio >= 0.6:
        health_status = "aman"
    elif ratio >= 0.35:
        health_status = "agak_panas"
    elif ratio >= 0.15:
        health_status = "rem_dikit"
    else:
        health_status = "boncos"
    
    return DashboardResponse(
        budget_id=budget["budget_id"],
        label=budget["label"],
        total_balance=budget["total_balance"],
        current_balance=budget["current_balance"],
        refill_date=budget["refill_date"],
        days_remaining=days_remaining,
        daily_allowance=round(daily_allowance, 0),
        today_spent=today_spent,
        today_remaining=round(today_remaining, 0),
        health_status=health_status,
        total_spent=total_spent,
    )

# ─── Health check ───
@api_router.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
