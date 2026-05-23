"""
Backend API Tests for Boncos App - Iteration 2
Tests: Health, Auth, Multi-Budget Pots, Expenses with budget_id filter, Dashboard with budget_id param, Streak tracking
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import uuid

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BACKEND_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)

BASE_URL = f"{BACKEND_URL}/api"

# MongoDB connection for test data setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

@pytest.fixture(scope="session")
def mongo_client():
    """MongoDB client for test data setup"""
    client = MongoClient(MONGO_URL)
    yield client
    client.close()

@pytest.fixture(scope="session")
def db(mongo_client):
    """Database instance"""
    return mongo_client[DB_NAME]

@pytest.fixture
def test_user_token(db):
    """
    Create a test user and session directly in MongoDB
    Returns the session token for authenticated requests
    Function-scoped to create fresh session for each test
    """
    # Create test user
    user_id = f"test_user_{uuid.uuid4().hex[:12]}"
    test_user = {
        "user_id": user_id,
        "email": f"test_{uuid.uuid4().hex[:8]}@boncos.app",
        "name": "Test User V2",
        "picture": "https://example.com/pic.jpg",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.users.insert_one(test_user)
    
    # Create session
    session_token = f"test_token_{uuid.uuid4().hex}"
    session = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    }
    db.user_sessions.insert_one(session)
    
    yield session_token
    
    # Cleanup after each test
    db.users.delete_many({"user_id": user_id})
    db.user_sessions.delete_many({"session_token": session_token})
    db.budgets.delete_many({"user_id": user_id})
    db.expenses.delete_many({"user_id": user_id})
    db.daily_checkins.delete_many({"user_id": user_id})

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealth:
    """Health check endpoint"""
    
    def test_health_check(self, api_client):
        """Test GET /api/health"""
        response = api_client.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")


class TestBudgetsMultiPot:
    """Multi-budget pot functionality - NEW in iteration 2"""
    
    def test_create_multiple_budgets_all_active(self, api_client, test_user_token, db):
        """Test creating multiple budgets - all should remain active"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        # Create budget 1 - makan
        budget1 = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_Makan",
            "category": "makan",
            "icon": "restaurant"
        }
        response1 = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget1,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response1.status_code == 200
        budget1_data = response1.json()
        assert budget1_data["category"] == "makan"
        assert budget1_data["icon"] == "restaurant"
        assert budget1_data["label"] == "TEST_Makan"
        
        # Create budget 2 - transport
        budget2 = {
            "total_balance": 500000,
            "refill_date": refill_date,
            "label": "TEST_Transport",
            "category": "transport",
            "icon": "car"
        }
        response2 = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget2,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response2.status_code == 200
        budget2_data = response2.json()
        assert budget2_data["category"] == "transport"
        
        # Create budget 3 - kopi
        budget3 = {
            "total_balance": 300000,
            "refill_date": refill_date,
            "label": "TEST_Kopi",
            "category": "kopi",
            "icon": "cafe"
        }
        response3 = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget3,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response3.status_code == 200
        
        # GET /api/budgets should return LIST of all active budgets
        get_response = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert get_response.status_code == 200
        budgets_data = get_response.json()
        assert "budgets" in budgets_data
        assert len(budgets_data["budgets"]) == 3
        
        # Verify all budgets are active in DB
        active_budgets = list(db.budgets.find({"user_id": user_id, "active": True}))
        assert len(active_budgets) == 3
        print("✓ Multiple active budgets working correctly")
    
    def test_delete_budget_endpoint(self, api_client, test_user_token, db):
        """Test DELETE /api/budgets/{budget_id} - NEW endpoint"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        # Create a budget
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_Delete Me",
            "category": "umum",
            "icon": "wallet"
        }
        create_response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = create_response.json()
        budget_id = budget["budget_id"]
        
        # Add an expense to this budget
        expense_payload = {
            "amount": 50000,
            "note": "TEST_Expense",
            "budget_id": budget_id
        }
        api_client.post(
            f"{BASE_URL}/expenses",
            json=expense_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        # Delete the budget
        delete_response = api_client.delete(
            f"{BASE_URL}/budgets/{budget_id}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify budget is deactivated (not deleted)
        budget_doc = db.budgets.find_one({"budget_id": budget_id})
        assert budget_doc is not None
        assert budget_doc["active"] == False
        
        # Verify related expenses are deleted
        expenses = list(db.expenses.find({"budget_id": budget_id}))
        assert len(expenses) == 0
        
        # Verify budget not in active list
        get_response = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budgets_data = get_response.json()
        budget_ids = [b["budget_id"] for b in budgets_data["budgets"]]
        assert budget_id not in budget_ids
        print("✓ Delete budget endpoint working correctly")


class TestExpensesWithBudgetFilter:
    """Expense operations with budget_id filter - UPDATED in iteration 2"""
    
    def test_create_expense_records_daily_checkin(self, api_client, test_user_token, db):
        """Test POST /api/expenses records daily checkin for streak"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        db.daily_checkins.delete_many({"user_id": user_id})
        
        # Create budget
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST"},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Create expense
        expense_response = api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 50000, "note": "TEST", "budget_id": budget["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert expense_response.status_code == 200
        
        # Verify daily checkin was created
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        checkin = db.daily_checkins.find_one({"user_id": user_id, "date": today_str})
        assert checkin is not None
        print("✓ Expense creation records daily checkin")
    
    def test_get_expenses_with_budget_filter(self, api_client, test_user_token, db):
        """Test GET /api/expenses?budget_id={id} filters by budget"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        # Create two budgets
        budget1_response = api_client.post(
            f"{BASE_URL}/budgets",
            json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget1", "category": "makan"},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget1 = budget1_response.json()
        
        budget2_response = api_client.post(
            f"{BASE_URL}/budgets",
            json={"total_balance": 500000, "refill_date": refill_date, "label": "TEST_Budget2", "category": "transport"},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget2 = budget2_response.json()
        
        # Add expenses to budget1
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 10000, "note": "TEST_B1_Exp1", "budget_id": budget1["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 20000, "note": "TEST_B1_Exp2", "budget_id": budget1["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        # Add expense to budget2
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 30000, "note": "TEST_B2_Exp1", "budget_id": budget2["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        # Get all expenses
        all_expenses_response = api_client.get(
            f"{BASE_URL}/expenses",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        all_expenses = all_expenses_response.json()["expenses"]
        assert len(all_expenses) == 3
        
        # Get expenses filtered by budget1
        budget1_expenses_response = api_client.get(
            f"{BASE_URL}/expenses?budget_id={budget1['budget_id']}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget1_expenses = budget1_expenses_response.json()["expenses"]
        assert len(budget1_expenses) == 2
        assert all(e["budget_id"] == budget1["budget_id"] for e in budget1_expenses)
        
        # Get expenses filtered by budget2
        budget2_expenses_response = api_client.get(
            f"{BASE_URL}/expenses?budget_id={budget2['budget_id']}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget2_expenses = budget2_expenses_response.json()["expenses"]
        assert len(budget2_expenses) == 1
        assert budget2_expenses[0]["budget_id"] == budget2["budget_id"]
        print("✓ Expense budget_id filter working correctly")
    
    def test_delete_expense_restores_balance(self, api_client, test_user_token, db):
        """Test DELETE /api/expenses/{id} restores balance"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        # Create budget
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST"},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Create expense
        expense_response = api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 100000, "note": "TEST", "budget_id": budget["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        expense = expense_response.json()
        
        # Verify balance deducted
        budget_after_expense = db.budgets.find_one({"budget_id": budget["budget_id"]})
        assert budget_after_expense["current_balance"] == 900000
        
        # Delete expense
        delete_response = api_client.delete(
            f"{BASE_URL}/expenses/{expense['expense_id']}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify balance restored
        budget_after_delete = db.budgets.find_one({"budget_id": budget["budget_id"]})
        assert budget_after_delete["current_balance"] == 1000000
        print("✓ Delete expense restores balance correctly")


class TestDashboardWithBudgetParam:
    """Dashboard with budget_id query param - UPDATED in iteration 2"""
    
    def test_dashboard_with_budget_id_param(self, api_client, test_user_token, db):
        """Test GET /api/dashboard?budget_id={id} returns specific budget"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        # Create two budgets
        budget1_response = api_client.post(
            f"{BASE_URL}/budgets",
            json={"total_balance": 3000000, "refill_date": refill_date, "label": "TEST_Makan", "category": "makan", "icon": "restaurant"},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget1 = budget1_response.json()
        
        budget2_response = api_client.post(
            f"{BASE_URL}/budgets",
            json={"total_balance": 500000, "refill_date": refill_date, "label": "TEST_Transport", "category": "transport", "icon": "car"},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget2 = budget2_response.json()
        
        # Add expenses to budget1
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 100000, "note": "TEST", "budget_id": budget1["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        # Get dashboard for budget1
        dashboard1_response = api_client.get(
            f"{BASE_URL}/dashboard?budget_id={budget1['budget_id']}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert dashboard1_response.status_code == 200
        dashboard1 = dashboard1_response.json()
        assert dashboard1["budget_id"] == budget1["budget_id"]
        assert dashboard1["label"] == "TEST_Makan"
        assert dashboard1["category"] == "makan"
        assert dashboard1["icon"] == "restaurant"
        assert dashboard1["total_balance"] == 3000000
        assert dashboard1["current_balance"] == 2900000
        assert dashboard1["total_spent"] == 100000
        
        # Get dashboard for budget2
        dashboard2_response = api_client.get(
            f"{BASE_URL}/dashboard?budget_id={budget2['budget_id']}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert dashboard2_response.status_code == 200
        dashboard2 = dashboard2_response.json()
        assert dashboard2["budget_id"] == budget2["budget_id"]
        assert dashboard2["label"] == "TEST_Transport"
        assert dashboard2["category"] == "transport"
        assert dashboard2["current_balance"] == 500000
        assert dashboard2["total_spent"] == 0
        print("✓ Dashboard budget_id param working correctly")


class TestStreak:
    """Streak tracking - NEW in iteration 2"""
    
    def test_streak_endpoint_structure(self, api_client, test_user_token):
        """Test GET /api/streak returns correct structure"""
        response = api_client.get(
            f"{BASE_URL}/streak",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        
        streak = response.json()
        assert "current_streak" in streak
        assert "longest_streak" in streak
        assert "today_logged" in streak
        assert "last_7_days" in streak
        assert isinstance(streak["current_streak"], int)
        assert isinstance(streak["longest_streak"], int)
        assert isinstance(streak["today_logged"], bool)
        assert isinstance(streak["last_7_days"], list)
        assert len(streak["last_7_days"]) == 7
        print("✓ Streak endpoint structure correct")
    
    def test_streak_calculation_with_checkins(self, api_client, test_user_token, db):
        """Test streak calculation with manual checkins"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.daily_checkins.delete_many({"user_id": user_id})
        
        now = datetime.now(timezone.utc)
        
        # Create checkins for last 3 consecutive days
        for i in range(3):
            date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            db.daily_checkins.insert_one({
                "user_id": user_id,
                "date": date_str,
                "updated_at": now.isoformat()
            })
        
        # Get streak
        response = api_client.get(
            f"{BASE_URL}/streak",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        streak = response.json()
        
        assert streak["current_streak"] == 3
        assert streak["today_logged"] == True
        assert streak["longest_streak"] >= 3
        
        # Verify last_7_days
        assert len(streak["last_7_days"]) == 7
        # Today should be logged
        assert streak["last_7_days"][-1]["logged"] == True
        print("✓ Streak calculation working correctly")
    
    def test_streak_breaks_with_gap(self, api_client, test_user_token, db):
        """Test streak breaks when there's a gap"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.daily_checkins.delete_many({"user_id": user_id})
        
        now = datetime.now(timezone.utc)
        
        # Create checkins with a gap
        # Day 0 (today) - logged
        db.daily_checkins.insert_one({
            "user_id": user_id,
            "date": now.strftime("%Y-%m-%d"),
            "updated_at": now.isoformat()
        })
        
        # Day -1 (yesterday) - NOT logged (gap)
        
        # Day -2, -3 (2-3 days ago) - logged
        for i in [2, 3]:
            date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            db.daily_checkins.insert_one({
                "user_id": user_id,
                "date": date_str,
                "updated_at": now.isoformat()
            })
        
        # Get streak
        response = api_client.get(
            f"{BASE_URL}/streak",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        streak = response.json()
        
        # Current streak should be 1 (only today)
        assert streak["current_streak"] == 1
        assert streak["today_logged"] == True
        # Longest streak should be 2 (days -2 and -3)
        assert streak["longest_streak"] == 2
        print("✓ Streak breaks correctly with gap")
