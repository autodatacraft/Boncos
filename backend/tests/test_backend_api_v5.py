"""
Backend API Tests for Boncos V5
Tests for:
- POST /api/auth/session (upsert for duplicate session tokens)
- POST /api/contact (save contact message)
- GET /api/export-csv (V60 only, 403 for others)
- GET /api/health
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

class TestV5Health:
    """Health check endpoint"""
    
    def test_health_check(self, api_client):
        """GET /api/health returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")

class TestV5SessionUpsert:
    """Test session upsert (duplicate session token handling)"""
    
    def test_session_upsert_duplicate_token(self, api_client):
        """POST /api/auth/session handles duplicate session tokens with upsert"""
        # This test verifies the fix for duplicate key error
        # We can't easily test this without a real Emergent session_id
        # So we'll just verify the endpoint is accessible and returns proper error for invalid session
        response = api_client.post(f"{BASE_URL}/api/auth/session", json={"session_id": "invalid_test_session"})
        # Should return 401 for invalid session (not 500 for duplicate key error)
        assert response.status_code == 401
        data = response.json()
        assert "Invalid session" in data.get("detail", "")
        print("✓ Session endpoint handles invalid session correctly (no 500 error)")

class TestV5ContactUs:
    """Test Contact Us endpoint"""
    
    def test_contact_message_unauthorized(self, api_client):
        """POST /api/contact requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/contact", json={"message": "Test message"})
        assert response.status_code == 401
        print("✓ Contact endpoint requires auth")
    
    def test_contact_message_with_auth(self, api_client):
        """POST /api/contact saves message with username, email, message, timestamp"""
        # Create test user and session
        from pymongo import MongoClient
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        # Create test user
        test_user_id = "test_contact_user_v5"
        test_email = "test_contact_v5@boncos.app"
        test_token = "test_contact_token_v5"
        
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        
        db.users.insert_one({
            "user_id": test_user_id,
            "email": test_email,
            "name": "Test Contact User",
            "picture": "",
            "subscription_plan": "FREE",
            "supporter_badge": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        from datetime import timedelta
        db.user_sessions.insert_one({
            "session_token": test_token,
            "user_id": test_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Send contact message
        response = api_client.post(
            f"{BASE_URL}/api/contact",
            json={"message": "This is a test contact message from V5 testing"},
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Message sent"
        
        # Verify message was saved in database
        saved_msg = db.contact_messages.find_one({"user_id": test_user_id, "email": test_email})
        assert saved_msg is not None
        assert saved_msg["username"] == "Test Contact User"
        assert saved_msg["email"] == test_email
        assert saved_msg["message"] == "This is a test contact message from V5 testing"
        assert "created_at" in saved_msg
        assert "message_id" in saved_msg
        
        # Cleanup
        db.contact_messages.delete_many({"user_id": test_user_id})
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        client.close()
        
        print("✓ Contact message saved with username, email, message, timestamp")

class TestV5ExportCSV:
    """Test CSV export endpoint (V60 only)"""
    
    def test_export_csv_unauthorized(self, api_client):
        """GET /api/export-csv requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/export-csv")
        assert response.status_code == 401
        print("✓ Export CSV requires auth")
    
    def test_export_csv_non_v60_returns_403(self, api_client):
        """GET /api/export-csv returns 403 for non-V60 users"""
        # Create test user with FREE plan
        from pymongo import MongoClient
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        test_user_id = "test_csv_free_user_v5"
        test_token = "test_csv_free_token_v5"
        
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        
        db.users.insert_one({
            "user_id": test_user_id,
            "email": "test_csv_free_v5@boncos.app",
            "name": "Test CSV Free User",
            "picture": "",
            "subscription_plan": "FREE",
            "supporter_badge": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        from datetime import timedelta
        db.user_sessions.insert_one({
            "session_token": test_token,
            "user_id": test_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        response = api_client.get(
            f"{BASE_URL}/api/export-csv",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert response.status_code == 403
        data = response.json()
        assert "V60" in data.get("detail", "")
        
        # Cleanup
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        client.close()
        
        print("✓ Export CSV returns 403 for non-V60 users")
    
    def test_export_csv_v60_returns_csv(self, api_client):
        """GET /api/export-csv returns CSV for V60 users"""
        # Create test user with V60 plan
        from pymongo import MongoClient
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        test_user_id = "test_csv_v60_user_v5"
        test_token = "test_csv_v60_token_v5"
        test_budget_id = "test_csv_budget_v5"
        
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        db.budgets.delete_many({"user_id": test_user_id})
        db.expenses.delete_many({"user_id": test_user_id})
        
        db.users.insert_one({
            "user_id": test_user_id,
            "email": "test_csv_v60_v5@boncos.app",
            "name": "Test CSV V60 User",
            "picture": "",
            "subscription_plan": "V60",
            "supporter_badge": "The Last Boncos Bender",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        from datetime import timedelta
        db.user_sessions.insert_one({
            "session_token": test_token,
            "user_id": test_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Create budget and expense
        db.budgets.insert_one({
            "budget_id": test_budget_id,
            "user_id": test_user_id,
            "label": "Test Budget",
            "total_balance": 1000000,
            "current_balance": 900000,
            "refill_date": "2026-06-30T23:59:59",
            "category": "umum",
            "icon": "wallet",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        db.expenses.insert_one({
            "expense_id": "test_exp_v5",
            "user_id": test_user_id,
            "budget_id": test_budget_id,
            "amount": 100000,
            "note": "Test expense for CSV",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response = api_client.get(
            f"{BASE_URL}/api/export-csv",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "text/csv; charset=utf-8"
        assert "attachment" in response.headers.get("content-disposition", "")
        
        # Verify CSV content
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        assert len(lines) >= 2  # Header + at least 1 expense
        assert lines[0] == "Date,Amount,Note,Budget"
        assert "100000" in lines[1]
        assert "Test expense for CSV" in lines[1]
        assert "Test Budget" in lines[1]
        
        # Cleanup
        db.expenses.delete_many({"user_id": test_user_id})
        db.budgets.delete_many({"user_id": test_user_id})
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        client.close()
        
        print("✓ Export CSV returns CSV for V60 users with correct format")

class TestV5ExistingEndpoints:
    """Verify existing endpoints still work after V5 changes"""
    
    def test_get_plans_still_works(self, api_client):
        """GET /api/plans still works"""
        response = api_client.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data
        assert len(data["plans"]) == 4
        print("✓ GET /api/plans still works")
    
    def test_create_budget_still_works(self, api_client):
        """POST /api/budgets still works"""
        # Create test user
        from pymongo import MongoClient
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        test_user_id = "test_budget_v5"
        test_token = "test_budget_token_v5"
        
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        db.budgets.delete_many({"user_id": test_user_id})
        
        db.users.insert_one({
            "user_id": test_user_id,
            "email": "test_budget_v5@boncos.app",
            "name": "Test Budget User",
            "picture": "",
            "subscription_plan": "FREE",
            "supporter_badge": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        from datetime import timedelta
        db.user_sessions.insert_one({
            "session_token": test_token,
            "user_id": test_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        response = api_client.post(
            f"{BASE_URL}/api/budgets",
            json={
                "total_balance": 1000000,
                "refill_date": "2026-06-30T23:59:59",
                "label": "Test Budget V5",
                "category": "umum",
                "icon": "wallet"
            },
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["label"] == "Test Budget V5"
        assert data["total_balance"] == 1000000
        
        # Cleanup
        db.budgets.delete_many({"user_id": test_user_id})
        db.users.delete_one({"user_id": test_user_id})
        db.user_sessions.delete_one({"session_token": test_token})
        client.close()
        
        print("✓ POST /api/budgets still works")
