import pytest
from app import create_app


def test_app_refuses_to_start_missing_chain_secret(temp_env):
    """Test that app refuses to start when CHAIN_SECRET is missing."""
    bad_cfg = dict(temp_env)
    bad_cfg["CHAIN_SECRET"] = ""
    with pytest.raises(ValueError, match="CHAIN_SECRET.*missing"):
        create_app(bad_cfg)


def test_app_refuses_to_start_short_chain_secret(temp_env):
    """Test that app refuses to start when CHAIN_SECRET is too short (< 32 chars)."""
    bad_cfg = dict(temp_env)
    bad_cfg["CHAIN_SECRET"] = "short-secret-less-than-32-chars"
    with pytest.raises(ValueError, match="at least 32 characters"):
        create_app(bad_cfg)


def test_app_refuses_to_start_default_placeholder_secret(temp_env):
    """Test that app refuses to start when CHAIN_SECRET is a known default or example string."""
    bad_cfg = dict(temp_env)
    bad_cfg["CHAIN_SECRET"] = "bt032-dev-insecure-fallback-secret-2026"
    with pytest.raises(ValueError, match="insecure default/placeholder"):
        create_app(bad_cfg)


def test_app_refuses_to_start_missing_jwt_secret(temp_env):
    """Test that app refuses to start when JWT_SECRET is missing."""
    bad_cfg = dict(temp_env)
    bad_cfg["JWT_SECRET"] = ""
    with pytest.raises(ValueError, match="JWT_SECRET.*missing"):
        create_app(bad_cfg)


def test_app_refuses_to_start_missing_log_secret(temp_env):
    """Test that app refuses to start when LOG_SECRET is missing."""
    bad_cfg = dict(temp_env)
    bad_cfg["LOG_SECRET"] = ""
    with pytest.raises(ValueError, match="LOG_SECRET.*missing"):
        create_app(bad_cfg)


def test_app_starts_successfully_with_valid_secrets(temp_env):
    """Test that app starts cleanly with 32+ char valid random secrets."""
    good_cfg = dict(temp_env)
    good_cfg["CHAIN_SECRET"] = "a" * 32
    good_cfg["JWT_SECRET"] = "b" * 32
    good_cfg["LOG_SECRET"] = "c" * 32
    app = create_app(good_cfg)
    assert app is not None

