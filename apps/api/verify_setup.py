#!/usr/bin/env python3
"""
Final verification script to check acceptance criteria:
1. alembic upgrade head creates schema
2. uvicorn runs
3. /health returns 200
4. OpenAPI spec includes base resources (no auth yet)
"""
import subprocess
import time
import requests
import sys
import os

def run_command(cmd, cwd=None):
    """Run command and return result"""
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return result.returncode == 0, result.stdout, result.stderr

def test_alembic_migration():
    """Test alembic upgrade head creates schema"""
    print("Testing Alembic migration...")
    success, stdout, stderr = run_command(
        "source venv/bin/activate && DATABASE_URL=sqlite+aiosqlite:///./test.db alembic upgrade head"
    )
    if success:
        print("✓ Alembic migration successful")
        # Clean up test database
        run_command("rm -f test.db")
        return True
    else:
        print(f"✗ Alembic migration failed: {stderr}")
        return False

def test_uvicorn_runs():
    """Test uvicorn runs"""
    print("Testing Uvicorn startup...")
    # Start server in background
    run_command("source venv/bin/activate && python run.py > server_test.log 2>&1 &")
    
    # Wait for startup
    time.sleep(5)
    
    # Check if process is running
    success, stdout, stderr = run_command("pgrep -f 'python run.py'")
    if success and stdout.strip():
        print("✓ Uvicorn server started successfully")
        return True
    else:
        print("✗ Uvicorn server failed to start")
        return False

def test_health_endpoint():
    """Test /health returns 200"""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://localhost:8000/api/v1/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy" and data.get("database") == "connected":
                print("✓ Health endpoint returning 200 with healthy status")
                return True
            else:
                print(f"✗ Health endpoint returned unexpected data: {data}")
                return False
        else:
            print(f"✗ Health endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health endpoint error: {e}")
        return False

def test_openapi_spec():
    """Test OpenAPI spec includes base resources"""
    print("Testing OpenAPI specification...")
    try:
        response = requests.get("http://localhost:8000/openapi.json", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "paths" in data and "/api/v1/health" in data["paths"]:
                print("✓ OpenAPI spec includes base resources")
                return True
            else:
                print("✗ OpenAPI spec missing base resources")
                return False
        else:
            print(f"✗ OpenAPI spec returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ OpenAPI spec error: {e}")
        return False

def cleanup():
    """Clean up processes and files"""
    run_command("pkill -f 'python run.py'")
    run_command("rm -f test.db server_test.log")

def main():
    """Run all acceptance criteria tests"""
    print("Running FastAPI Backend Core Setup Verification\n")
    
    results = []
    
    # Test 1: Alembic migration
    results.append(test_alembic_migration())
    
    # Test 2: Uvicorn runs
    results.append(test_uvicorn_runs())
    
    if results[1]:  # Only continue if server started
        # Test 3: Health endpoint
        results.append(test_health_endpoint())
        
        # Test 4: OpenAPI spec
        results.append(test_openapi_spec())
    else:
        results.append(False)
        results.append(False)
    
    # Cleanup
    cleanup()
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All acceptance criteria met!")
        return 0
    else:
        print("❌ Some acceptance criteria not met")
        return 1

if __name__ == "__main__":
    sys.exit(main())