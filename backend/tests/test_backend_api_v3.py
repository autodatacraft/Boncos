"""
Backend API Tests for Boncos App - Iteration 3 (V3)
Tests: PATCH /api/budgets/{id}, POST /api/expenses/bulk-delete, Auto-refill logic, GET /api/notification-check
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
        "name": "Test User V3",
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
        try:
            response = api_client.get(f"{BASE_URL}/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            print("✓ Health check passed")
        except Exception as e:
            print(f"✗ Health check failed: {e}")
            raise


class TestBudgetEdit:
    """PATCH /api/budgets/{budget_id} - NEW in V3"""
    
    def test_edit_budget_total_balance_adjusts_current_proportionally(self, api_client, test_user_token, db):
        """Test PATCH /api/budgets/{id} adjusts current_balance proportionally when total_balance changes"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            db.expenses.delete_many({"user_id": user_id})
            
            # Create budget with 3M total
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 3000000, "refill_date": refill_date, "label": "TEST_Edit Budget"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert budget_response.status_code == 200
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # Spend 1M (leaving 2M current, 1M spent)
            api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 1000000, "note": "TEST", "budget_id": budget_id},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # Verify current balance is 2M
            budget_before = db.budgets.find_one({"budget_id": budget_id})
            assert budget_before["current_balance"] == 2000000
            assert budget_before["total_balance"] == 3000000
            
            # Edit total_balance to 6M (doubled)
            # Spent = 3M - 2M = 1M
            # New current = 6M - 1M = 5M
            edit_response = api_client.patch(
                f"{BASE_URL}/budgets/{budget_id}",
                json={"total_balance": 6000000},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert edit_response.status_code == 200
            
            edited = edit_response.json()
            assert edited["total_balance"] == 6000000
            assert edited["current_balance"] == 5000000  # 6M - 1M spent
            
            # Verify in DB
            budget_after = db.budgets.find_one({"budget_id": budget_id})
            assert budget_after["total_balance"] == 6000000
            assert budget_after["current_balance"] == 5000000
            
            print("✓ Edit budget total_balance adjusts current_balance proportionally")
        except Exception as e:
            print(f"✗ Edit budget total_balance test failed: {e}")
            raise
    
    def test_edit_budget_label(self, api_client, test_user_token, db):
        """Test PATCH /api/budgets/{id} updates label"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # Create budget
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Old Label"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # Edit label
            edit_response = api_client.patch(
                f"{BASE_URL}/budgets/{budget_id}",
                json={"label": "TEST_New Label"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert edit_response.status_code == 200
            
            edited = edit_response.json()
            assert edited["label"] == "TEST_New Label"
            
            # Verify in DB
            budget_after = db.budgets.find_one({"budget_id": budget_id})
            assert budget_after["label"] == "TEST_New Label"
            
            print("✓ Edit budget label working")
        except Exception as e:
            print(f"✗ Edit budget label test failed: {e}")
            raise
    
    def test_edit_budget_refill_date(self, api_client, test_user_token, db):
        """Test PATCH /api/budgets/{id} updates refill_date"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            
            # Create budget
            old_refill = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": old_refill, "label": "TEST"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # Edit refill_date
            new_refill = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
            edit_response = api_client.patch(
                f"{BASE_URL}/budgets/{budget_id}",
                json={"refill_date": new_refill},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert edit_response.status_code == 200
            
            edited = edit_response.json()
            assert edited["refill_date"] == new_refill
            
            # Verify in DB
            budget_after = db.budgets.find_one({"budget_id": budget_id})
            assert budget_after["refill_date"] == new_refill
            
            print("✓ Edit budget refill_date working")
        except Exception as e:
            print(f"✗ Edit budget refill_date test failed: {e}")
            raise
    
    def test_edit_budget_not_found(self, api_client, test_user_token):
        """Test PATCH /api/budgets/{id} returns 404 for non-existent budget"""
        try:
            edit_response = api_client.patch(
                f"{BASE_URL}/budgets/nonexistent_budget_id",
                json={"label": "TEST"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert edit_response.status_code == 404
            print("✓ Edit budget returns 404 for non-existent budget")
        except Exception as e:
            print(f"✗ Edit budget 404 test failed: {e}")
            raise


class TestBulkDelete:
    """POST /api/expenses/bulk-delete - NEW in V3"""
    
    def test_bulk_delete_expenses_restores_balances(self, api_client, test_user_token, db):
        """Test POST /api/expenses/bulk-delete deletes multiple expenses and restores balances"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            db.expenses.delete_many({"user_id": user_id})
            
            # Create two budgets
            refill_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            budget1_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 1000000, "refill_date": refill_date, "label": "TEST_Budget1"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget1 = budget1_response.json()
            
            budget2_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 500000, "refill_date": refill_date, "label": "TEST_Budget2"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget2 = budget2_response.json()
            
            # Create expenses on budget1
            exp1_response = api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 100000, "note": "TEST_Exp1", "budget_id": budget1["budget_id"]},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            exp1 = exp1_response.json()
            
            exp2_response = api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 200000, "note": "TEST_Exp2", "budget_id": budget1["budget_id"]},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            exp2 = exp2_response.json()
            
            # Create expense on budget2
            exp3_response = api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 50000, "note": "TEST_Exp3", "budget_id": budget2["budget_id"]},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            exp3 = exp3_response.json()
            
            # Verify balances before delete
            budget1_before = db.budgets.find_one({"budget_id": budget1["budget_id"]})
            budget2_before = db.budgets.find_one({"budget_id": budget2["budget_id"]})
            assert budget1_before["current_balance"] == 700000  # 1M - 300k
            assert budget2_before["current_balance"] == 450000  # 500k - 50k
            
            # Bulk delete exp1 and exp3 (from different budgets)
            bulk_delete_response = api_client.post(
                f"{BASE_URL}/expenses/bulk-delete",
                json={"expense_ids": [exp1["expense_id"], exp3["expense_id"]]},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert bulk_delete_response.status_code == 200
            
            result = bulk_delete_response.json()
            assert result["deleted_count"] == 2
            
            # Verify balances restored
            budget1_after = db.budgets.find_one({"budget_id": budget1["budget_id"]})
            budget2_after = db.budgets.find_one({"budget_id": budget2["budget_id"]})
            assert budget1_after["current_balance"] == 800000  # 700k + 100k restored
            assert budget2_after["current_balance"] == 500000  # 450k + 50k restored
            
            # Verify expenses deleted
            expenses = list(db.expenses.find({"user_id": user_id}))
            expense_ids = [e["expense_id"] for e in expenses]
            assert exp1["expense_id"] not in expense_ids
            assert exp3["expense_id"] not in expense_ids
            assert exp2["expense_id"] in expense_ids  # exp2 should still exist
            
            print("✓ Bulk delete expenses restores balances correctly")
        except Exception as e:
            print(f"✗ Bulk delete test failed: {e}")
            raise
    
    def test_bulk_delete_empty_list(self, api_client, test_user_token):
        """Test POST /api/expenses/bulk-delete with empty list"""
        try:
            bulk_delete_response = api_client.post(
                f"{BASE_URL}/expenses/bulk-delete",
                json={"expense_ids": []},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert bulk_delete_response.status_code == 200
            result = bulk_delete_response.json()
            assert result["deleted_count"] == 0
            print("✓ Bulk delete with empty list works")
        except Exception as e:
            print(f"✗ Bulk delete empty list test failed: {e}")
            raise


class TestAutoRefill:
    """Auto-refill logic in GET /api/budgets and GET /api/dashboard - NEW in V3"""
    
    def test_auto_refill_in_get_budgets(self, api_client, test_user_token, db):
        """Test GET /api/budgets auto-refills budget when refill_date has passed"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            db.expenses.delete_many({"user_id": user_id})
            
            # Create budget with refill_date in the past
            past_refill = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 3000000, "refill_date": past_refill, "label": "TEST_AutoRefill"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # Spend some money
            api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 1000000, "note": "TEST", "budget_id": budget_id},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # Verify current_balance is 2M before refill
            budget_before = db.budgets.find_one({"budget_id": budget_id})
            assert budget_before["current_balance"] == 2000000
            
            # Call GET /api/budgets - should trigger auto-refill
            get_response = api_client.get(
                f"{BASE_URL}/budgets",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert get_response.status_code == 200
            
            budgets_data = get_response.json()
            refilled_budget = budgets_data["budgets"][0]
            
            # Verify budget was refilled
            assert refilled_budget["current_balance"] == 3000000  # Reset to total_balance
            assert refilled_budget["budget_id"] == budget_id
            
            # Verify refill_date was updated (should be ~25 days in future from past_refill)
            old_refill_dt = datetime.fromisoformat(past_refill.replace('Z', '+00:00'))
            new_refill_dt = datetime.fromisoformat(refilled_budget["refill_date"].replace('Z', '+00:00'))
            assert new_refill_dt > datetime.now(timezone.utc)
            
            # Verify in DB
            budget_after = db.budgets.find_one({"budget_id": budget_id})
            assert budget_after["current_balance"] == 3000000
            
            print("✓ Auto-refill in GET /api/budgets working")
        except Exception as e:
            print(f"✗ Auto-refill in GET /api/budgets test failed: {e}")
            raise
    
    def test_auto_refill_in_dashboard(self, api_client, test_user_token, db):
        """Test GET /api/dashboard auto-refills budget when refill_date has passed"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.budgets.delete_many({"user_id": user_id})
            db.expenses.delete_many({"user_id": user_id})
            
            # Create budget with refill_date in the past
            past_refill = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
            budget_response = api_client.post(
                f"{BASE_URL}/budgets",
                json={"total_balance": 2000000, "refill_date": past_refill, "label": "TEST_Dashboard Refill"},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            budget = budget_response.json()
            budget_id = budget["budget_id"]
            
            # Spend some money
            api_client.post(
                f"{BASE_URL}/expenses",
                json={"amount": 500000, "note": "TEST", "budget_id": budget_id},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            # Call GET /api/dashboard - should trigger auto-refill
            dashboard_response = api_client.get(
                f"{BASE_URL}/dashboard?budget_id={budget_id}",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert dashboard_response.status_code == 200
            
            dashboard = dashboard_response.json()
            
            # Verify budget was refilled
            assert dashboard["current_balance"] == 2000000  # Reset to total_balance
            assert dashboard["total_spent"] == 0  # Reset after refill
            
            # Verify refill_date was updated
            new_refill_dt = datetime.fromisoformat(dashboard["refill_date"].replace('Z', '+00:00'))
            assert new_refill_dt > datetime.now(timezone.utc)
            
            print("✓ Auto-refill in GET /api/dashboard working")
        except Exception as e:
            print(f"✗ Auto-refill in GET /api/dashboard test failed: {e}")
            raise


class TestNotificationCheck:
    """GET /api/notification-check - NEW in V3"""
    
    def test_notification_check_needs_reminder_true(self, api_client, test_user_token, db):
        """Test GET /api/notification-check returns needs_reminder=true when no checkin today"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.daily_checkins.delete_many({"user_id": user_id})
            
            # No checkin today
            response = api_client.get(
                f"{BASE_URL}/notification-check",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 200
            
            data = response.json()
            assert "needs_reminder" in data
            assert "today_logged" in data
            assert data["needs_reminder"] == True
            assert data["today_logged"] == False
            
            print("✓ Notification check needs_reminder=true when no checkin")
        except Exception as e:
            print(f"✗ Notification check needs_reminder=true test failed: {e}")
            raise
    
    def test_notification_check_needs_reminder_false(self, api_client, test_user_token, db):
        """Test GET /api/notification-check returns needs_reminder=false when checkin exists today"""
        try:
            user_id = db.user_sessions.find_one({"session_token": test_user_token})["user_id"]
            db.daily_checkins.delete_many({"user_id": user_id})
            
            # Create checkin for today
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            db.daily_checkins.insert_one({
                "user_id": user_id,
                "date": today_str,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            
            response = api_client.get(
                f"{BASE_URL}/notification-check",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert response.status_code == 200
            
            data = response.json()
            assert data["needs_reminder"] == False
            assert data["today_logged"] == True
            
            print("✓ Notification check needs_reminder=false when checkin exists")
        except Exception as e:
            print(f"✗ Notification check needs_reminder=false test failed: {e}")
            raise


class TestExistingEndpoints:
    """Verify existing endpoints still work after V3 changes"""
    
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
            
            print("✓ POST /api/budgets still works")
        except Exception as e:
            print(f"✗ POST /api/budgets test failed: {e}")
            raise
    
    def test_create_expense_still_works(self, api_client, test_user_token, db):
        """Test POST /api/expenses still works"""
        try:
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
                json={"amount": 50000, "note": "TEST", "budget_id": budget["budget_id"]},
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            assert expense_response.status_code == 200
            
            expense = expense_response.json()
            assert "expense_id" in expense
            assert expense["amount"] == 50000
            
            print("✓ POST /api/expenses still works")
        except Exception as e:
            print(f"✗ POST /api/expenses test failed: {e}")
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
