"""Pytest fixtures for REPSA API tests."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

# Endpoint tests exercise CSV/API paths; a disposable SQLite URI satisfies Flask-SQLAlchemy.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")


@pytest.fixture()
def app():
    from app import create_app

    application = create_app()
    application.config.update({"TESTING": True})
    return application


@pytest.fixture()
def client(app):
    return app.test_client()
