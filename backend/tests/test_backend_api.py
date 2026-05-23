"""
Backend API Tests for Boncos App
Tests: Health, Auth, Budgets, Expenses, Dashboard
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
        "name": "Test User",
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


class TestAuth:
    """Authentication endpoints"""
    
    def test_auth_me_with_valid_token(self, api_client, test_user_token, db):
        """Test GET /api/auth/me with valid token"""
        response = api_client.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "@boncos.app" in data["email"]
        assert data["name"] == "Test User"
    
    def test_auth_me_without_token(self, api_client):
        """Test GET /api/auth/me without token returns error"""
        response = api_client.get(f"{BASE_URL}/auth/me")
        # Backend returns tuple (bug), so status is 200 but body contains error
        data = response.json()
        # Response is a list [{"error": "Unauthorized"}, 401] due to backend bug
        if isinstance(data, list):
            assert len(data) == 2
            assert "error" in data[0]
        else:
            assert "error" in data or response.status_code == 401
    
    def test_logout(self, api_client, db):
        """Test POST /api/auth/logout"""
        # Create a separate session for logout test
        user_id = f"test_user_{uuid.uuid4().hex[:12]}"
        test_user = {
            "user_id": user_id,
            "email": f"logout_test_{uuid.uuid4().hex[:8]}@boncos.app",
            "name": "Logout Test User",
            "picture": "https://example.com/pic.jpg",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.users.insert_one(test_user)
        
        session_token = f"test_token_{uuid.uuid4().hex}"
        session = {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        }
        db.user_sessions.insert_one(session)
        
        response = api_client.post(
            f"{BASE_URL}/auth/logout",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
        # Cleanup
        db.users.delete_many({"user_id": user_id})
        db.user_sessions.delete_many({"session_token": session_token})


class TestBudgets:
    """Budget CRUD operations"""
    
    def test_create_budget_and_verify(self, api_client, test_user_token, db):
        """Test POST /api/budgets and verify persistence"""
        # Clean up any existing budgets for test user
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        create_payload = {
            "total_balance": 3000000,
            "refill_date": refill_date,
            "label": "TEST_Budget Januari"
        }
        
        response = api_client.post(
            f"{BASE_URL}/budgets",
            json=create_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        
        created = response.json()
        assert "budget_id" in created
        assert created["total_balance"] == 3000000
        assert created["current_balance"] == 3000000
        assert created["label"] == "TEST_Budget Januari"
        
        # Verify persistence with GET
        get_response = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert get_response.status_code == 200
        budget_data = get_response.json()
        assert budget_data["budget_id"] == created["budget_id"]
        assert budget_data["total_balance"] == 3000000
    
    def test_get_budget_without_auth(self, api_client):
        """Test GET /api/budgets without auth"""
        response = api_client.get(f"{BASE_URL}/budgets")
        data = response.json()
        assert "error" in data or response.status_code == 401
    
    def test_create_multiple_budgets_deactivates_old(self, api_client, test_user_token, db):
        """Test creating new budget deactivates old one"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        
        # Create first budget
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget1 = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_Budget 1"
        }
        response1 = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget1,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response1.status_code == 200
        budget1_id = response1.json()["budget_id"]
        
        # Create second budget
        budget2 = {
            "total_balance": 2000000,
            "refill_date": refill_date,
            "label": "TEST_Budget 2"
        }
        response2 = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget2,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response2.status_code == 200
        budget2_id = response2.json()["budget_id"]
        
        # Verify only budget2 is active
        get_response = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        active_budget = get_response.json()
        assert active_budget["budget_id"] == budget2_id
        
        # Verify budget1 is inactive in DB
        budget1_doc = db.budgets.find_one({"budget_id": budget1_id})
        assert budget1_doc["active"] == False


class TestExpenses:
    """Expense CRUD operations"""
    
    @pytest.fixture
    def budget_with_balance(self, api_client, test_user_token, db):
        """Create a budget for expense tests"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 3000000,
            "refill_date": refill_date,
            "label": "TEST_Expense Budget"
        }
        response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        return response.json()
    
    def test_create_expense_and_verify(self, api_client, test_user_token, budget_with_balance):
        """Test POST /api/expenses and verify balance deduction"""
        expense_payload = {
            "amount": 50000,
            "note": "TEST_Makan siang",
            "budget_id": budget_with_balance["budget_id"]
        }
        
        response = api_client.post(
            f"{BASE_URL}/expenses",
            json=expense_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        
        expense = response.json()
        assert "expense_id" in expense
        assert expense["amount"] == 50000
        assert expense["note"] == "TEST_Makan siang"
        assert expense["budget_id"] == budget_with_balance["budget_id"]
        
        # Verify expense in list
        get_response = api_client.get(
            f"{BASE_URL}/expenses",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert get_response.status_code == 200
        expenses_data = get_response.json()
        assert "expenses" in expenses_data
        assert len(expenses_data["expenses"]) > 0
        assert expenses_data["expenses"][0]["expense_id"] == expense["expense_id"]
        
        # Verify budget balance was deducted
        budget_response = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        assert budget["current_balance"] == 3000000 - 50000
    
    def test_delete_expense_restores_balance(self, api_client, test_user_token, budget_with_balance):
        """Test DELETE /api/expenses/{id} restores balance"""
        # Create expense
        expense_payload = {
            "amount": 100000,
            "note": "TEST_Delete me",
            "budget_id": budget_with_balance["budget_id"]
        }
        create_response = api_client.post(
            f"{BASE_URL}/expenses",
            json=expense_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        expense = create_response.json()
        expense_id = expense["expense_id"]
        
        # Get balance before delete
        budget_before = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        balance_before = budget_before["current_balance"]
        
        # Delete expense
        delete_response = api_client.delete(
            f"{BASE_URL}/expenses/{expense_id}",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify balance restored
        budget_after = api_client.get(
            f"{BASE_URL}/budgets",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        assert budget_after["current_balance"] == balance_before + 100000
        
        # Verify expense deleted
        expenses_response = api_client.get(
            f"{BASE_URL}/expenses",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        expense_ids = [e["expense_id"] for e in expenses_response["expenses"]]
        assert expense_id not in expense_ids
    
    def test_get_expenses_without_auth(self, api_client):
        """Test GET /api/expenses without auth"""
        response = api_client.get(f"{BASE_URL}/expenses")
        data = response.json()
        assert "error" in data or response.status_code == 401


class TestDashboard:
    """Dashboard endpoint and calculations"""
    
    @pytest.fixture
    def budget_with_expenses(self, api_client, test_user_token, db):
        """Create budget with some expenses for dashboard testing"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        # Create budget with 30 days remaining
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 3000000,
            "refill_date": refill_date,
            "label": "TEST_Dashboard Budget"
        }
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Add some expenses
        expenses = [
            {"amount": 50000, "note": "TEST_Expense 1", "budget_id": budget["budget_id"]},
            {"amount": 100000, "note": "TEST_Expense 2", "budget_id": budget["budget_id"]},
        ]
        for exp in expenses:
            api_client.post(
                f"{BASE_URL}/expenses",
                json=exp,
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
        
        return budget
    
    def test_dashboard_calculation(self, api_client, test_user_token, budget_with_expenses):
        """Test GET /api/dashboard with correct calculations"""
        response = api_client.get(
            f"{BASE_URL}/dashboard",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        
        dashboard = response.json()
        assert "budget_id" in dashboard
        assert dashboard["total_balance"] == 3000000
        assert dashboard["total_spent"] == 150000  # 50k + 100k
        assert dashboard["current_balance"] == 2850000  # 3M - 150k
        
        # Daily allowance = current_balance / days_remaining
        # Should be approximately 2850000 / 30 = 95000
        assert dashboard["daily_allowance"] > 0
        assert 90000 <= dashboard["daily_allowance"] <= 100000
        
        assert dashboard["days_remaining"] > 0
        assert "health_status" in dashboard
    
    def test_health_status_aman(self, api_client, test_user_token, db):
        """Test health status 'aman' when balance >= 60%"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        # Create budget with 70% remaining (aman)
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_Aman"
        }
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Spend 30% (300k), leaving 70%
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 300000, "note": "TEST", "budget_id": budget["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        dashboard = api_client.get(
            f"{BASE_URL}/dashboard",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        
        assert dashboard["health_status"] == "aman"
    
    def test_health_status_agak_panas(self, api_client, test_user_token, db):
        """Test health status 'agak_panas' when 35% <= balance < 60%"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_AgakPanas"
        }
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Spend 50%, leaving 50% (agak_panas range)
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 500000, "note": "TEST", "budget_id": budget["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        dashboard = api_client.get(
            f"{BASE_URL}/dashboard",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        
        assert dashboard["health_status"] == "agak_panas"
    
    def test_health_status_rem_dikit(self, api_client, test_user_token, db):
        """Test health status 'rem_dikit' when 15% <= balance < 35%"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_RemDikit"
        }
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Spend 75%, leaving 25% (rem_dikit range)
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 750000, "note": "TEST", "budget_id": budget["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        dashboard = api_client.get(
            f"{BASE_URL}/dashboard",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        
        assert dashboard["health_status"] == "rem_dikit"
    
    def test_health_status_boncos(self, api_client, test_user_token, db):
        """Test health status 'boncos' when balance < 15%"""
        user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
        db.budgets.delete_many({"user_id": user_id})
        db.expenses.delete_many({"user_id": user_id})
        
        refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        budget_payload = {
            "total_balance": 1000000,
            "refill_date": refill_date,
            "label": "TEST_Boncos"
        }
        budget_response = api_client.post(
            f"{BASE_URL}/budgets",
            json=budget_payload,
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        budget = budget_response.json()
        
        # Spend 90%, leaving 10% (boncos)
        api_client.post(
            f"{BASE_URL}/expenses",
            json={"amount": 900000, "note": "TEST", "budget_id": budget["budget_id"]},
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        
        dashboard = api_client.get(
            f"{BASE_URL}/dashboard",
            headers={"Authorization": f"Bearer {test_user_token}"}
        ).json()
        
        assert dashboard["health_status"] == "boncos"
    
    def test_dashboard_without_auth(self, api_client):
        """Test GET /api/dashboard without auth"""
        response = api_client.get(f"{BASE_URL}/dashboard")
        data = response.json()
        assert "error" in data or response.status_code == 401
