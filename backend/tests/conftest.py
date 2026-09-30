import os
import sys
import tempfile
from pathlib import Path
import pytest

# Add backend directory to sys.path so modules can be imported
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import create_app
from db import init_db


@pytest.fixture
def test_secret():
    return "unit-test-secure-secret-key-32810"


@pytest.fixture
def temp_env(tmp_path, test_secret):
    storage_dir = tmp_path / "storage"
    curr_dir = storage_dir / "current"
    vers_dir = storage_dir / "versions"
    curr_dir.mkdir(parents=True, exist_ok=True)
    vers_dir.mkdir(parents=True, exist_ok=True)
    db_path = tmp_path / "test_audit.db"

    init_db(db_path)

    return {
        "STORAGE_DIR": storage_dir,
        "CURRENT_STORAGE_DIR": curr_dir,
        "VERSIONS_STORAGE_DIR": vers_dir,
        "DB_PATH": db_path,
        "CHAIN_SECRET": test_secret,
        "TESTING": True,
    }


@pytest.fixture
def app(temp_env):
    test_cfg = dict(temp_env)
    test_cfg["ENABLE_DEMO_TAMPER"] = False
    app = create_app(test_cfg)
    return app


@pytest.fixture
def app_demo(temp_env):
    test_cfg = dict(temp_env)
    test_cfg["ENABLE_DEMO_TAMPER"] = True
    app = create_app(test_cfg)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def client_demo(app_demo):
    return app_demo.test_client()
