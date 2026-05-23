"""
Backend API Tests for Boncos App - Iteration 4 (V4)
Tests: Subscription system, Budget locking, Budget sharing
Features:
- GET /api/plans (4 subscription plans)
- POST /api/subscribe (changes user plan and sets badge)
- GET /api/budgets (returns budgets with is_locked field based on plan)
- POST /api/budgets (enforces plan limit - 403 when exceeded)
- PATCH /api/budgets/{id} (rejects locked budgets - 403)
- POST /api/expenses (rejects locked budget - 403)
- POST /api/budgets/share (shares budget with email)
- GET /api/budgets/{id}/shared (returns shared emails)
- DELETE /api/budgets/{id}/shared/{email} (removes share)
- GET /api/budgets (includes shared budgets from other users)
- Budget locking logic (oldest budgets stay active, newest get locked)
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
    # Create test user with FREE plan
    user_id = f"test_user_{uuid.uuid4().hex[:12]}"
    test_user = {
        "user_id": user_id,
        "email": f"test_{uuid.uuid4().hex[:8]}@boncos.app",
        "name": "Test User V4",
        "picture": "https://example.com/pic.jpg",
        "subscription_plan": "FREE",
        "supporter_badge": None,
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
    db.shared_budgets.delete_many({"shared_by_user_id": user_id})

@pytest.fixture
def test_user_token_2(db):
    """Second test user for sharing tests"""
    user_id = f"test_user2_{uuid.uuid4().hex[:12]}"
    test_user = {
        "user_id": user_id,
        "email": f"test2_{uuid.uuid4().hex[:8]}@boncos.app",
        "name": "Test User 2 V4",
        "picture": "https://example.com/pic.jpg",
        "subscription_plan": "FREE",
        "supporter_badge": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.users.insert_one(test_user)
    
    session_token = f"test_token2_{uuid.uuid4().hex}"
    session = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    }
    db.user_sessions.insert_one(session)
    
    yield session_token
    
    # Cleanup
    db.users.delete_many({"user_id": user_id})
    db.user_sessions.delete_many({"session_token": session_token})
    db.budgets.delete_many({"user_id": user_id})
    db.expenses.delete_many({"user_id": user_id})
    db.shared_budgets.delete_many({"shared_with_email": test_user["email"]})

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
        try:
            response = api_client.get(f"{BASE_URL}/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            print("✓ Health check passed")
        except Exception as e:
            print(f"✗ Health check failed: {e}")
            raise


class TestSubscriptionPlans:
    """GET /api/plans - NEW in V4"""
    
    def test_get_plans_returns_4_plans(self, api_client):
        """Test GET /api/plans returns 4 subscription plans"""
        try:
            response = api_client.get(f"{BASE_URL}/plans")
            assert response.status_code == 200
            
            data = response.json()
            assert "plans" in data
            plans = data["plans"]
            assert len(plans) == 4
            
            # Verify plan IDs
            plan_ids = [p["id"] for p in plans]
            assert "FREE" in plan_ids
            assert "AMERICANO" in plan_ids
            assert "KOPI_GULA_AREN" in plan_ids
            assert "V60" in plan_ids
            
            # Verify FREE plan structure
            free_plan = next(p for p in plans if p["id"] == "FREE")
            assert free_plan["displayName"] == "Free"
            assert free_plan["badgeName"] is None
            assert free_plan["maxBudgetPots"] == 2
            assert free_plan["isUnlimited"] == False
            
            # Verify V60 plan (unlimited)
            v60_plan = next(p for p in plans if p["id"] == "V60")
            assert v60_plan["isUnlimited"] == True
            assert v60_plan["maxBudgetPots"] == 999
            assert v60_plan["badgeName"] == "The Last Boncos Bender"
            
            print("✓ GET /api/plans returns 4 subscription plans with correct structure")
        except Exception as e:
            print(f"✗ GET /api/plans test failed: {e}")
            raise


class TestSubscribe:
    """POST /api/subscribe - NEW in V4"""
    
    def test_subscribe_changes_user_plan_and_sets_badge(self, api_client, test_user_token, db):
        """Test POST /api/subscribe changes user plan and sets badge"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            
            # Verify user starts with FREE plan
            user_before = db.users.find_one({"user_id": user_id})
            assert user_before["subscription_plan"] == "FREE"
            assert user_before["supporter_badge"] is None
            
            # Subscribe to AMERICANO
            response = api_client.post(
                f"{BASE_URL}/subscribe",
                json={"plan_id": "AMERICANO"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 200
            
            data = response.json()
            assert data["message"] == "Subscribed"
            assert data["badge"] == "Murid Anti Boncos"
            assert data["plan"]["id"] == "AMERICANO"
            
            # Verify in DB
            user_after = db.users.find_one({"user_id": user_id})
            assert user_after["subscription_plan"] == "AMERICANO"
            assert user_after["supporter_badge"] == "Murid Anti Boncos"
            assert "subscription_updated_at" in user_after
            
            print("✓ POST /api/subscribe changes user plan and sets badge")
        except Exception as e:
            print(f"✗ POST /api/subscribe test failed: {e}")
            raise
    
    def test_subscribe_to_v60_unlimited(self, api_client, test_user_token, db):
        """Test subscribing to V60 (unlimited plan)"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            
            # Subscribe to V60
            response = api_client.post(
                f"{BASE_URL}/subscribe",
                json={"plan_id": "V60"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 200
            
            data = response.json()
            assert data["badge"] == "The Last Boncos Bender"
            
            # Verify in DB
            user_after = db.users.find_one({"user_id": user_id})
            assert user_after["subscription_plan"] == "V60"
            assert user_after["supporter_badge"] == "The Last Boncos Bender"
            
            print("✓ Subscribe to V60 unlimited plan works")
        except Exception as e:
            print(f"✗ Subscribe to V60 test failed: {e}")
            raise
    
    def test_subscribe_invalid_plan_returns_400(self, api_client, test_user_token):
        """Test POST /api/subscribe with invalid plan returns 400"""
        try:
            response = api_client.post(
                f"{BASE_URL}/subscribe",
                json={"plan_id": "INVALID_PLAN"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 400
            print("✓ Subscribe with invalid plan returns 400")
        except Exception as e:
            print(f"✗ Subscribe invalid plan test failed: {e}")
            raise


class TestBudgetLocking:
    """Budget locking based on subscription plan - NEW in V4"""
    
    def test_get_budgets_returns_is_locked_field(self, api_client, test_user_token, db):
        """Test GET /api/budgets returns is_locked field based on plan"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # User has FREE plan (max 2 pots)
            # Create 3 budgets (oldest first)
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            budget1_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget1"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget1 = budget1_response.json()
            
            budget2_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 2000000, "refill_date": refill_date, "label": "TEST_Budget2"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget2 = budget2_response.json()
            
            # Third budget should fail (FREE plan limit = 2)
            budget3_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 3000000, "refill_date": refill_date, "label": "TEST_Budget3"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert budget3_response.status_code == 403
            
            # Get budgets - should show is_locked field
            get_response = api_client.get(
                f"{BASE_URL}/budgets",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert get_response.status_code == 200
            
            data = get_response.json()
            assert "budgets" in data
            assert "plan" in data
            assert "plan_limit" in data
            assert data["plan"] == "FREE"
            assert data["plan_limit"] == 2
            
            budgets = data["budgets"]
            assert len(budgets) == 2
            
            # Both budgets should be unlocked (within limit)
            for budget in budgets:
                assert "is_locked" in budget
                assert budget["is_locked"] == False
                assert budget["locked_reason"] is None
            
            print("✓ GET /api/budgets returns is_locked field based on plan")
        except Exception as e:
            print(f"✗ GET /api/budgets is_locked test failed: {e}")
            raise
    
    def test_budget_locking_oldest_stay_active_newest_locked(self, api_client, test_user_token, db):
        """Test budget locking: oldest budgets stay active, newest get locked"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # Create 2 budgets (FREE plan limit)
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            budget1_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Oldest"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget1 = budget1_response.json()
            
            budget2_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 2000000, "refill_date": refill_date, "label": "TEST_Middle"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget2 = budget2_response.json()
            
            # Manually insert a third budget in DB (bypassing API limit check)
            budget3_id = f"budget_{uuid.uuid4().hex[:12]}"
            db.budgets.insert_one({
                "budget_id": budget3_id,
                "user_id": user_id,
                "total_balance": 3000000,
                "current_balance": 3000000,
                "refill_date": refill_date,
                "label": "TEST_Newest",
                "category": "umum",
                "icon": "wallet",
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Get budgets - should lock the newest one
            get_response = api_client.get(
                f"{BASE_URL}/budgets",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            data = get_response.json()
            budgets = data["budgets"]
            
            # Sort by created_at to verify locking logic
            budgets_sorted = sorted(budgets, key=lambda x: x.get("created_at", ""))
            
            # First 2 (oldest) should be unlocked
            assert budgets_sorted[0]["is_locked"] == False
            assert budgets_sorted[1]["is_locked"] == False
            
            # Third (newest) should be locked
            assert budgets_sorted[2]["is_locked"] == True
            assert budgets_sorted[2]["locked_reason"] == "Budget pot ini terkunci karena limit plan kamu."
            
            print("✓ Budget locking: oldest budgets stay active, newest get locked")
        except Exception as e:
            print(f"✗ Budget locking logic test failed: {e}")
            raise
    
    def test_create_budget_enforces_plan_limit(self, api_client, test_user_token, db):
        """Test POST /api/budgets enforces plan limit (403 when exceeded)"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # FREE plan allows 2 budgets
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            # Create 2 budgets (should succeed)
            for i in range(2):
                response = api_client.post(
                    f"{BASE_URL}/budgets",
                    json={"total_balance": 1000000, "refill_date": refill_date, "label": f"TEST_Budget{i+1}"},
                    headers={"Authorization": f"Bearer {test_user_token}"}
                )
                assert response.status_code == 200
            
            # Third budget should fail with 403
            response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget3"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 403
            
            data = response.json()
            assert "detail" in data
            assert "Limit reached" in data["detail"]
            assert "FREE" in data["detail"]
            
            print("✓ POST /api/budgets enforces plan limit (403 when exceeded)")
        except Exception as e:
            print(f"✗ Create budget plan limit test failed: {e}")
            raise
    
    def test_patch_locked_budget_returns_403(self, api_client, test_user_token, db):
        """Test PATCH /api/budgets/{id} rejects locked budgets (403)"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # Create 2 budgets
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            budget1_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget1"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget1 = budget1_response.json()
            
            budget2_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 2000000, "refill_date": refill_date, "label": "TEST_Budget2"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget2 = budget2_response.json()
            
            # Manually insert a third budget (will be locked)
            budget3_id = f"budget_{uuid.uuid4().hex[:12]}"
            db.budgets.insert_one({
                "budget_id": budget3_id,
                "user_id": user_id,
                "total_balance": 3000000,
                "current_balance": 3000000,
                "refill_date": refill_date,
                "label": "TEST_Locked",
                "category": "umum",
                "icon": "wallet",
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Try to edit the locked budget (should fail with 403)
            patch_response = api_client.patch(
                f"{BASE_URL}/budgets/{budget3_id}",
                json={"label": "TEST_Updated"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert patch_response.status_code == 403
            
            data = patch_response.json()
            assert "detail" in data
            assert "locked" in data["detail"].lower()
            
            print("✓ PATCH /api/budgets/{id} rejects locked budgets (403)")
        except Exception as e:
            print(f"✗ PATCH locked budget test failed: {e}")
            raise
    
    def test_create_expense_on_locked_budget_returns_403(self, api_client, test_user_token, db):
        """Test POST /api/expenses rejects locked budget (403)"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            db.expenses.delete_many({"user_id": user_id})
            
            # Create 2 budgets
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            for i in range(2):
                api_client.post(
                    f"{BASE_URL}/budgets",
                    json={"total_balance": 1000000, "refill_date": refill_date, "label": f"TEST_Budget{i+1}"},
                    headers={"Authorization": f"Bearer {test_user_token}"}
                )
            
            # Manually insert a third budget (will be locked)
            budget3_id = f"budget_{uuid.uuid4().hex[:12]}"
            db.budgets.insert_one({
                "budget_id": budget3_id,
                "user_id": user_id,
                "total_balance": 3000000,
                "current_balance": 3000000,
                "refill_date": refill_date,
                "label": "TEST_Locked",
                "category": "umum",
                "icon": "wallet",
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Try to create expense on locked budget (should fail with 403)
            expense_response = api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 50000, "note": "TEST", "budget_id": budget3_id},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert expense_response.status_code == 403
            
            data = expense_response.json()
            assert "detail" in data
            assert "locked" in data["detail"].lower()
            
            print("✓ POST /api/expenses rejects locked budget (403)")
        except Exception as e:
            print(f"✗ Create expense on locked budget test failed: {e}")
            raise
    
    def test_v60_unlimited_plan_no_locking(self, api_client, test_user_token, db):
        """Test V60 unlimited plan has no budget locking"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # Subscribe to V60
            api_client.post(
                f"{BASE_URL}/subscribe",
                json={"plan_id": "V60"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # Create 5 budgets (more than any other plan allows)
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            for i in range(5):
                response = api_client.post(
                    f"{BASE_URL}/budgets",
                    json={"total_balance": 1000000, "refill_date": refill_date, "label": f"TEST_Budget{i+1}"},
                    headers={"Authorization": f"Bearer {test_user_token}"}
                )
                assert response.status_code == 200
            
            # Get budgets - all should be unlocked
            get_response = api_client.get(
                f"{BASE_URL}/budgets",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            data = get_response.json()
            
            assert data["plan"] == "V60"
            assert data["is_unlimited"] == True
            
            budgets = data["budgets"]
            assert len(budgets) == 5
            
            # All budgets should be unlocked
            for budget in budgets:
                assert budget["is_locked"] == False
                assert budget["locked_reason"] is None
            
            print("✓ V60 unlimited plan has no budget locking")
        except Exception as e:
            print(f"✗ V60 unlimited plan test failed: {e}")
            raise


class TestBudgetSharing:
    """Budget sharing via email - NEW in V4"""
    
    def test_share_budget_with_email(self, api_client, test_user_token, test_user_token_2, db):
        """Test POST /api/budgets/share shares budget with email"""
        try:
            user1_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            user2_data = db.user_sessions.find_one({"session_token": test_user_token_2})
            user2_email = db.users.find_one({"user_id": user2_data["user_id"]})["email"]
            
            db.budgets.delete_many({"user_id": user1_id})
            db.shared_budgets.delete_many({})
            
            # User1 creates a budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Shared Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # User1 shares budget with User2
            share_response = api_client.post(
                f"{BASE_URL}/budgets/share",
                json={"budget_id": budget_id, "email": user2_email},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert share_response.status_code == 200
            
            data = share_response.json()
            assert "message" in data
            assert user2_email in data["message"]
            
            # Verify in DB
            shared = db.shared_budgets.find_one({"budget_id": budget_id, "shared_with_email": user2_email})
            assert shared is not None
            assert shared["shared_by_user_id"] == user1_id
            
            print("✓ POST /api/budgets/share shares budget with email")
        except Exception as e:
            print(f"✗ Share budget test failed: {e}")
            raise
    
    def test_get_shared_users(self, api_client, test_user_token, test_user_token_2, db):
        """Test GET /api/budgets/{id}/shared returns shared emails"""
        try:
            user1_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            user2_data = db.user_sessions.find_one({"session_token": test_user_token_2})
            user2_email = db.users.find_one({"user_id": user2_data["user_id"]})["email"]
            
            db.budgets.delete_many({"user_id": user1_id})
            db.shared_budgets.delete_many({})
            
            # User1 creates a budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # Share with User2
            api_client.post(
                f"{BASE_URL}/budgets/share",
                json={"budget_id": budget_id, "email": user2_email},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # Get shared users
            get_response = api_client.get(
                f"{BASE_URL}/budgets/{budget_id}/shared",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert get_response.status_code == 200
            
            data = get_response.json()
            assert "shared_with" in data
            assert user2_email in data["shared_with"]
            
            print("✓ GET /api/budgets/{id}/shared returns shared emails")
        except Exception as e:
            print(f"✗ Get shared users test failed: {e}")
            raise
    
    def test_unshare_budget(self, api_client, test_user_token, test_user_token_2, db):
        """Test DELETE /api/budgets/{id}/shared/{email} removes share"""
        try:
            user1_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            user2_data = db.user_sessions.find_one({"session_token": test_user_token_2})
            user2_email = db.users.find_one({"user_id": user2_data["user_id"]})["email"]
            
            db.budgets.delete_many({"user_id": user1_id})
            db.shared_budgets.delete_many({})
            
            # User1 creates and shares budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            api_client.post(
                f"{BASE_URL}/budgets/share",
                json={"budget_id": budget_id, "email": user2_email},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # Verify share exists
            shared_before = db.shared_budgets.find_one({"budget_id": budget_id, "shared_with_email": user2_email})
            assert shared_before is not None
            
            # Unshare
            unshare_response = api_client.delete(
                f"{BASE_URL}/budgets/{budget_id}/shared/{user2_email}",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert unshare_response.status_code == 200
            
            # Verify share removed
            shared_after = db.shared_budgets.find_one({"budget_id": budget_id, "shared_with_email": user2_email})
            assert shared_after is None
            
            print("✓ DELETE /api/budgets/{id}/shared/{email} removes share")
        except Exception as e:
            print(f"✗ Unshare budget test failed: {e}")
            raise
    
    def test_get_budgets_includes_shared_budgets(self, api_client, test_user_token, test_user_token_2, db):
        """Test GET /api/budgets includes shared budgets from other users"""
        try:
            user1_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            user2_data = db.user_sessions.find_one({"session_token": test_user_token_2})
            user2_id = user2_data["user_id"]
            user2_email = db.users.find_one({"user_id": user2_id})["email"]
            
            db.budgets.delete_many({"user_id": user1_id})
            db.budgets.delete_many({"user_id": user2_id})
            db.shared_budgets.delete_many({})
            
            # User1 creates a budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget1_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_User1 Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget1 = budget1_response.json()
            
            # User1 shares with User2
            api_client.post(
                f"{BASE_URL}/budgets/share",
                json={"budget_id": budget1["budget_id"], "email": user2_email},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # User2 gets budgets - should include shared budget
            get_response = api_client.get(
                f"{BASE_URL}/budgets",
                headers={"Authorization": f"Bearer {test_user_token_2}"}
            )
            assert get_response.status_code == 200
            
            data = get_response.json()
            budgets = data["budgets"]
            
            # Should have at least 1 budget (the shared one)
            assert len(budgets) >= 1
            
            # Find the shared budget
            shared_budget = next((b for b in budgets if b["budget_id"] == budget1["budget_id"]), None)
            assert shared_budget is not None
            assert shared_budget["shared"] == True
            assert "shared_by" in shared_budget
            assert shared_budget["is_locked"] == False  # Shared budgets are never locked
            
            print("✓ GET /api/budgets includes shared budgets from other users")
        except Exception as e:
            print(f"✗ Get budgets includes shared test failed: {e}")
            raise
    
    def test_cannot_share_with_self(self, api_client, test_user_token, db):
        """Test cannot share budget with yourself"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            user_email = db.users.find_one({"user_id": user_id})["email"]
            
            db.budgets.delete_many({"user_id": user_id})
            
            # Create budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            
            # Try to share with self
            share_response = api_client.post(
                f"{BASE_URL}/budgets/share",
                json={"budget_id": budget["budget_id"], "email": user_email},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert share_response.status_code == 400
            
            data = share_response.json()
            assert "yourself" in data["detail"].lower()
            
            print("✓ Cannot share budget with yourself")
        except Exception as e:
            print(f"✗ Cannot share with self test failed: {e}")
            raise
    
    def test_shared_budget_expense_creation(self, api_client, test_user_token, test_user_token_2, db):
        """Test User2 can create expenses on shared budget"""
        try:
            user1_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            user2_data = db.user_sessions.find_one({"session_token": test_user_token_2})
            user2_id = user2_data["user_id"]
            user2_email = db.users.find_one({"user_id": user2_id})["email"]
            
            db.budgets.delete_many({"user_id": user1_id})
            db.expenses.delete_many({"user_id": user1_id})
            db.expenses.delete_many({"user_id": user2_id})
            db.shared_budgets.delete_many({})
            
            # User1 creates and shares budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Shared"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            api_client.post(
                f"{BASE_URL}/budgets/share",
                json={"budget_id": budget_id, "email": user2_email},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # User2 creates expense on shared budget
            expense_response = api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 50000, "note": "TEST_Shared expense", "budget_id": budget_id},
                headers={"Authorization": f"Bearer {test_user_token_2}"}
            )
            assert expense_response.status_code == 200
            
            expense = expense_response.json()
            assert expense["amount"] == 50000
            assert expense["budget_id"] == budget_id
            assert expense["user_id"] == user2_id  # Expense belongs to User2
            
            # Verify budget balance decreased
            budget_after = db.budgets.find_one({"budget_id": budget_id})
            assert budget_after["current_balance"] == 950000  # 1M - 50k
            
            print("✓ User2 can create expenses on shared budget")
        except Exception as e:
            print(f"✗ Shared budget expense creation test failed: {e}")
            raise


class TestExistingEndpointsV4:
    """Verify existing endpoints still work after V4 changes"""
    
    def test_create_budget_still_works(self, api_client, test_user_token, db):
        """Test POST /api/budgets still works"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 3000000, "refill_date": refill_date, "label": "TEST_Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 200
            
            budget = response.json()
            assert "budget_id" in budget
            assert budget["total_balance"] == 3000000
            assert "is_locked" in budget
            assert budget["is_locked"] == False
            
            print("✓ POST /api/budgets still works")
        except Exception as e:
            print(f"✗ POST /api/budgets test failed: {e}")
            raise
    
    def test_get_streak_still_works(self, api_client, test_user_token):
        """Test GET /api/streak still works"""
        try:
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
            
            print("✓ GET /api/streak still works")
        except Exception as e:
            print(f"✗ GET /api/streak test failed: {e}")
            raise
