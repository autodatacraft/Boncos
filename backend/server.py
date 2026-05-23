from fastapi import FastAPI, APIRouter, Request, Header, HTTPException
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

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Subscription Plans ───
PLANS = {
    "FREE": {"id": "FREE", "displayName": "Free", "badgeName": None, "priceLabel": "Gratis", "maxBudgetPots": 2, "isUnlimited": False},
    "AMERICANO": {"id": "AMERICANO", "displayName": "Americano", "badgeName": "Murid Anti Boncos", "priceLabel": "Rp29.000/bln", "maxBudgetPots": 3, "isUnlimited": False},
    "KOPI_GULA_AREN": {"id": "KOPI_GULA_AREN", "displayName": "Kopi Gula Aren", "badgeName": "Si Paling Anti Boncos", "priceLabel": "Rp49.000/bln", "maxBudgetPots": 5, "isUnlimited": False},
    "V60": {"id": "V60", "displayName": "V60", "badgeName": "The Last Boncos Bender", "priceLabel": "Rp79.000/bln", "maxBudgetPots": 999, "isUnlimited": True},
}

def get_plan_limit(plan_id: str) -> int:
    return PLANS.get(plan_id, PLANS["FREE"])["maxBudgetPots"]

def is_unlimited_plan(plan_id: str) -> bool:
    return PLANS.get(plan_id, PLANS["FREE"])["isUnlimited"]

def get_badge_for_plan(plan_id: str) -> Optional[str]:
    return PLANS.get(plan_id, PLANS["FREE"])["badgeName"]

def apply_budget_pot_locks(budgets: list, plan_id: str) -> list:
    limit = get_plan_limit(plan_id)
    unlimited = is_unlimited_plan(plan_id)
    if unlimited:
        for b in budgets:
            b["is_locked"] = False
            b["locked_reason"] = None
        return budgets
    sorted_budgets = sorted(budgets, key=lambda x: x.get("created_at", ""))
    for i, b in enumerate(sorted_budgets):
        if i < limit:
            b["is_locked"] = False
            b["locked_reason"] = None
        else:
            b["is_locked"] = True
            b["locked_reason"] = "Budget pot ini terkunci karena limit plan kamu."
    return sorted_budgets

def can_create_budget_pot(current_count: int, plan_id: str) -> bool:
    if is_unlimited_plan(plan_id):
        return True
    return current_count < get_plan_limit(plan_id)

# ─── Models ───
class SessionInput(BaseModel):
    session_id: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str
    subscription_plan: str = "FREE"
    supporter_badge: Optional[str] = None

class BudgetCreate(BaseModel):
    total_balance: float
    refill_date: str
    label: Optional[str] = "Budget Utama"
    category: Optional[str] = "umum"
    icon: Optional[str] = "wallet"

class BudgetUpdate(BaseModel):
    total_balance: Optional[float] = None
    refill_date: Optional[str] = None
    label: Optional[str] = None

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

class BulkDeleteRequest(BaseModel):
    expense_ids: List[str]

class SubscribeRequest(BaseModel):
    plan_id: str

class ShareBudgetRequest(BaseModel):
    budget_id: str
    email: str

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
    category: str
    icon: str

class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    today_logged: bool
    last_7_days: list

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

async def check_and_refill_budget(budget: dict):
    refill_date = datetime.fromisoformat(budget["refill_date"]).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if now >= refill_date:
        new_refill = refill_date + timedelta(days=30)
        while new_refill <= now:
            new_refill += timedelta(days=30)
        await db.budgets.update_one({"budget_id": budget["budget_id"]}, {"$set": {"current_balance": budget["total_balance"], "refill_date": new_refill.isoformat()}})
        return {**budget, "current_balance": budget["total_balance"], "refill_date": new_refill.isoformat()}
    return budget

# ─── Startup ───
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.budgets.create_index("user_id")
    await db.budgets.create_index("budget_id", unique=True)
    await db.expenses.create_index([("user_id", 1), ("budget_id", 1)])
    await db.expenses.create_index("created_at")
    await db.daily_checkins.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.shared_budgets.create_index([("budget_id", 1), ("shared_with_email", 1)], unique=True)
    logger.info("MongoDB indexes created")

# ─── Auth Routes ───
@api_router.post("/auth/session")
async def create_session(body: SessionInput):
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
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
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name, "picture": picture, "subscription_plan": "FREE", "supporter_badge": None, "created_at": datetime.now(timezone.utc).isoformat()})
    # Upsert session to handle duplicate session tokens (re-login)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {"session_token": session_token, "user_id": user_id, "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "session_token": session_token, "subscription_plan": user.get("subscription_plan", "FREE"), "supporter_badge": user.get("supporter_badge")}

@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return UserResponse(user_id=user["user_id"], email=user["email"], name=user["name"], picture=user["picture"], subscription_plan=user.get("subscription_plan", "FREE"), supporter_badge=user.get("supporter_badge"))

@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}

# ─── Subscription Routes ───
@api_router.get("/plans")
async def get_plans():
    return {"plans": list(PLANS.values())}

@api_router.post("/subscribe")
async def subscribe(body: SubscribeRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    # Mock payment - instant success
    badge = get_badge_for_plan(body.plan_id)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"subscription_plan": body.plan_id, "supporter_badge": badge, "subscription_updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Subscribed", "plan": plan, "badge": badge}

# ─── Budget Routes ───
@api_router.post("/budgets")
async def create_budget(body: BudgetCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    plan_id = user.get("subscription_plan", "FREE")
    active_count = await db.budgets.count_documents({"user_id": user["user_id"], "active": True})
    if not can_create_budget_pot(active_count, plan_id):
        raise HTTPException(status_code=403, detail=f"Limit reached. Upgrade to add more budget pots. Current plan: {plan_id}, max: {get_plan_limit(plan_id)}")
    budget_id = f"budget_{uuid.uuid4().hex[:12]}"
    budget = {"budget_id": budget_id, "user_id": user["user_id"], "total_balance": body.total_balance, "current_balance": body.total_balance, "refill_date": body.refill_date, "label": body.label or "Budget Utama", "category": body.category or "umum", "icon": body.icon or "wallet", "active": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.budgets.insert_one(budget)
    del budget["_id"]
    del budget["active"]
    budget["is_locked"] = False
    budget["locked_reason"] = None
    return budget

@api_router.get("/budgets")
async def get_budgets(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Own budgets
    own_budgets = await db.budgets.find({"user_id": user["user_id"], "active": True}, {"_id": 0, "active": 0}).to_list(50)
    refreshed = []
    for b in own_budgets:
        b = await check_and_refill_budget(b)
        b["shared"] = False
        refreshed.append(b)
    # Shared budgets
    shared_refs = await db.shared_budgets.find({"shared_with_email": user["email"]}, {"_id": 0}).to_list(20)
    for ref in shared_refs:
        sb = await db.budgets.find_one({"budget_id": ref["budget_id"], "active": True}, {"_id": 0, "active": 0})
        if sb:
            sb = await check_and_refill_budget(sb)
            sb["shared"] = True
            sb["shared_by"] = ref.get("shared_by_name", "")
            sb["is_locked"] = False
            sb["locked_reason"] = None
            refreshed.append(sb)
    # Apply locks to own budgets only
    plan_id = user.get("subscription_plan", "FREE")
    own_only = [b for b in refreshed if not b.get("shared")]
    shared_only = [b for b in refreshed if b.get("shared")]
    own_locked = apply_budget_pot_locks(own_only, plan_id)
    return {"budgets": own_locked + shared_only, "plan": plan_id, "plan_limit": get_plan_limit(plan_id), "is_unlimited": is_unlimited_plan(plan_id)}

@api_router.patch("/budgets/{budget_id}")
async def update_budget(budget_id: str, body: BudgetUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    budget = await db.budgets.find_one({"budget_id": budget_id, "user_id": user["user_id"], "active": True}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    # Check lock
    plan_id = user.get("subscription_plan", "FREE")
    all_budgets = await db.budgets.find({"user_id": user["user_id"], "active": True}, {"_id": 0}).to_list(50)
    locked = apply_budget_pot_locks(all_budgets, plan_id)
    target = next((b for b in locked if b["budget_id"] == budget_id), None)
    if target and target.get("is_locked"):
        raise HTTPException(status_code=403, detail="Budget pot is locked. Upgrade to edit.")
    update_fields = {}
    if body.total_balance is not None:
        spent = budget["total_balance"] - budget["current_balance"]
        update_fields["total_balance"] = body.total_balance
        update_fields["current_balance"] = max(body.total_balance - spent, 0)
    if body.refill_date is not None:
        update_fields["refill_date"] = body.refill_date
    if body.label is not None:
        update_fields["label"] = body.label
    if update_fields:
        await db.budgets.update_one({"budget_id": budget_id}, {"$set": update_fields})
    updated = await db.budgets.find_one({"budget_id": budget_id}, {"_id": 0, "active": 0})
    return updated

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    result = await db.budgets.update_one({"budget_id": budget_id, "user_id": user["user_id"]}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    await db.expenses.delete_many({"budget_id": budget_id, "user_id": user["user_id"]})
    await db.shared_budgets.delete_many({"budget_id": budget_id})
    return {"message": "Budget deleted"}

# ─── Share Budget ───
@api_router.post("/budgets/share")
async def share_budget(body: ShareBudgetRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    budget = await db.budgets.find_one({"budget_id": body.budget_id, "user_id": user["user_id"], "active": True}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if body.email == user["email"]:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")
    try:
        await db.shared_budgets.insert_one({"budget_id": body.budget_id, "shared_with_email": body.email, "shared_by_user_id": user["user_id"], "shared_by_name": user["name"], "created_at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        raise HTTPException(status_code=400, detail="Already shared with this email")
    return {"message": f"Budget shared with {body.email}"}

@api_router.get("/budgets/{budget_id}/shared")
async def get_shared_users(budget_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    shares = await db.shared_budgets.find({"budget_id": budget_id}, {"_id": 0}).to_list(20)
    return {"shared_with": [s["shared_with_email"] for s in shares]}

@api_router.delete("/budgets/{budget_id}/shared/{email}")
async def unshare_budget(budget_id: str, email: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    await db.shared_budgets.delete_one({"budget_id": budget_id, "shared_with_email": email})
    return {"message": "Unshared"}

# ─── Expense Routes ───
@api_router.post("/expenses")
async def create_expense(body: ExpenseCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    budget = await db.budgets.find_one({"budget_id": body.budget_id, "active": True}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    # Check if budget is locked (only for owner)
    if budget["user_id"] == user["user_id"]:
        plan_id = user.get("subscription_plan", "FREE")
        all_budgets = await db.budgets.find({"user_id": user["user_id"], "active": True}, {"_id": 0}).to_list(50)
        locked = apply_budget_pot_locks(all_budgets, plan_id)
        target = next((b for b in locked if b["budget_id"] == body.budget_id), None)
        if target and target.get("is_locked"):
            raise HTTPException(status_code=403, detail="Budget pot is locked. Upgrade to add expenses.")
    else:
        shared = await db.shared_budgets.find_one({"budget_id": body.budget_id, "shared_with_email": user["email"]}, {"_id": 0})
        if not shared:
            raise HTTPException(status_code=403, detail="No access to this budget")
    new_balance = budget["current_balance"] - body.amount
    await db.budgets.update_one({"budget_id": body.budget_id}, {"$set": {"current_balance": new_balance}})
    expense_id = f"exp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    expense = {"expense_id": expense_id, "user_id": user["user_id"], "budget_id": body.budget_id, "amount": body.amount, "note": body.note or "", "created_at": now.isoformat()}
    await db.expenses.insert_one(expense)
    del expense["_id"]
    today_str = now.strftime("%Y-%m-%d")
    try:
        await db.daily_checkins.update_one({"user_id": user["user_id"], "date": today_str}, {"$set": {"user_id": user["user_id"], "date": today_str, "updated_at": now.isoformat()}}, upsert=True)
    except Exception:
        pass
    return ExpenseResponse(**expense)

@api_router.get("/expenses")
async def get_expenses(budget_id: Optional[str] = None, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    query = {"user_id": user["user_id"]}
    if budget_id:
        query["budget_id"] = budget_id
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"expenses": expenses}

@api_router.post("/expenses/bulk-delete")
async def bulk_delete_expenses(body: BulkDeleteRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    expenses = await db.expenses.find({"expense_id": {"$in": body.expense_ids}, "user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    budget_amounts: dict = {}
    for exp in expenses:
        bid = exp["budget_id"]
        budget_amounts[bid] = budget_amounts.get(bid, 0) + exp["amount"]
    for bid, amount in budget_amounts.items():
        await db.budgets.update_one({"budget_id": bid, "active": True}, {"$inc": {"current_balance": amount}})
    result = await db.expenses.delete_many({"expense_id": {"$in": body.expense_ids}, "user_id": user["user_id"]})
    return {"deleted_count": result.deleted_count}

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    expense = await db.expenses.find_one({"expense_id": expense_id, "user_id": user["user_id"]}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.budgets.update_one({"budget_id": expense["budget_id"], "active": True}, {"$inc": {"current_balance": expense["amount"]}})
    await db.expenses.delete_one({"expense_id": expense_id})
    return {"message": "Expense deleted"}

# ─── Dashboard ───
@api_router.get("/dashboard")
async def get_dashboard(budget_id: Optional[str] = None, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    query = {"active": True}
    if budget_id:
        query["budget_id"] = budget_id
        # Check own or shared
        budget = await db.budgets.find_one(query, {"_id": 0})
        if budget and budget["user_id"] != user["user_id"]:
            shared = await db.shared_budgets.find_one({"budget_id": budget_id, "shared_with_email": user["email"]}, {"_id": 0})
            if not shared:
                return {"dashboard": None}
    else:
        query["user_id"] = user["user_id"]
        budget = await db.budgets.find_one(query, {"_id": 0})
    if not budget:
        return {"dashboard": None}
    budget = await check_and_refill_budget(budget)
    refill_date = datetime.fromisoformat(budget["refill_date"]).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days_remaining = max((refill_date - now).days, 1)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_expenses = await db.expenses.find({"budget_id": budget["budget_id"], "created_at": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(500)
    today_spent = sum(e["amount"] for e in today_expenses)
    total_spent = budget["total_balance"] - budget["current_balance"]
    daily_allowance = budget["current_balance"] / days_remaining if days_remaining > 0 else 0
    today_remaining = daily_allowance - today_spent
    ratio = budget["current_balance"] / budget["total_balance"] if budget["total_balance"] > 0 else 0
    if ratio >= 0.6: health_status = "aman"
    elif ratio >= 0.35: health_status = "agak_panas"
    elif ratio >= 0.15: health_status = "rem_dikit"
    else: health_status = "boncos"
    return DashboardResponse(budget_id=budget["budget_id"], label=budget["label"], total_balance=budget["total_balance"], current_balance=budget["current_balance"], refill_date=budget["refill_date"], days_remaining=days_remaining, daily_allowance=round(daily_allowance, 0), today_spent=today_spent, today_remaining=round(today_remaining, 0), health_status=health_status, total_spent=total_spent, category=budget.get("category", "umum"), icon=budget.get("icon", "wallet"))

# ─── Streak ───
@api_router.get("/streak")
async def get_streak(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    checkins = await db.daily_checkins.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(365)
    checkin_dates = set(c["date"] for c in checkins)
    today_logged = today_str in checkin_dates
    current_streak = 0
    check_date = now if today_logged else now - timedelta(days=1)
    while True:
        d = check_date.strftime("%Y-%m-%d")
        if d in checkin_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    longest_streak = 0
    if checkins:
        sorted_dates = sorted(checkin_dates)
        streak = 1
        for i in range(1, len(sorted_dates)):
            prev = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
            curr = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            if (curr - prev).days == 1: streak += 1
            else: longest_streak = max(longest_streak, streak); streak = 1
        longest_streak = max(longest_streak, streak)
    last_7 = [{"date": (now - timedelta(days=i)).strftime("%Y-%m-%d"), "logged": (now - timedelta(days=i)).strftime("%Y-%m-%d") in checkin_dates} for i in range(6, -1, -1)]
    return StreakResponse(current_streak=current_streak, longest_streak=longest_streak, today_logged=today_logged, last_7_days=last_7)

@api_router.get("/notification-check")
async def notification_check(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    checkin = await db.daily_checkins.find_one({"user_id": user["user_id"], "date": today_str}, {"_id": 0})
    return {"needs_reminder": checkin is None, "today_logged": checkin is not None}

# ─── Contact Us ───
class ContactMessage(BaseModel):
    message: str

@api_router.post("/contact")
async def send_contact(body: ContactMessage, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    msg = {"message_id": f"msg_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"], "username": user["name"], "email": user["email"], "message": body.message, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.contact_messages.insert_one(msg)
    return {"message": "Message sent"}

# ─── CSV Export (V60 only) ───
from fastapi.responses import PlainTextResponse

@api_router.get("/export-csv")
async def export_csv(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    plan = user.get("subscription_plan", "FREE")
    if plan != "V60":
        raise HTTPException(status_code=403, detail="CSV export is only available for V60 subscribers")
    expenses = await db.expenses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    budgets_list = await db.budgets.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    budget_map = {b["budget_id"]: b.get("label", "") for b in budgets_list}
    csv_lines = ["Date,Amount,Note,Budget"]
    for e in expenses:
        date = e["created_at"][:10] if e.get("created_at") else ""
        amt = str(e.get("amount", 0))
        note = str(e.get("note", "")).replace(",", ";").replace("\n", " ")
        budget_label = budget_map.get(e.get("budget_id", ""), "").replace(",", ";")
        csv_lines.append(f"{date},{amt},{note},{budget_label}")
    return PlainTextResponse("\n".join(csv_lines), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=boncos_export.csv"})

@api_router.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
