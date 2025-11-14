import pytest
import sys
import os
from pathlib import Path

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Test import first
def test_import_app():
    """Test that we can import the app"""
    from app.main import app
    assert app is not None


def test_import_models():
    """Test that we can import models"""
    from app.models import Organization, User, Team
    assert Organization is not None
    assert User is not None
    assert Team is not None


def test_import_schemas():
    """Test that we can import schemas"""
    from app.schemas.base import OrganizationCreate, UserCreate
    assert OrganizationCreate is not None
    assert UserCreate is not None