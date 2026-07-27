import os
from datetime import datetime


def _database_url() -> str | None:
    url = os.environ.get("DATABASE_URL")
    if url and url.startswith("postgres://"):
        # Neon/Heroku often use postgres://; SQLAlchemy requires postgresql://
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def _default_year_filter_limit() -> int:
    """Prior calendar year (e.g. 2026 when the current year is 2027)."""
    return datetime.now().year - 1


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Neon (and other serverless Postgres) closes idle SSL connections; pre-ping avoids stale pool connections.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or SECRET_KEY
    JWT_ACCESS_EXPIRES_MINUTES = int(os.environ.get('JWT_ACCESS_EXPIRES_MINUTES', '10080'))
    EMAIL_SENDER_API_KEY = os.environ.get('EMAIL_SENDER_API_KEY')
    RESEND_FROM_EMAIL = os.environ.get(
        'RESEND_FROM_EMAIL',
        'REPSA <onboarding@resend.dev>',
    )
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300

    # Max selectable historical year: prior calendar year
    # (e.g. 2026 when the current year is 2027).
    YEAR_FILTER_LIMIT = _default_year_filter_limit()

    # Realtime endpoint cache (seconds). Keep short so timestamp-driven counters stay fresh.
    REALTIME_CACHE_TIMEOUT = int(os.environ.get('REALTIME_CACHE_TIMEOUT', '60'))

    # Data paths
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # /api/app
    DATA_DIR = os.path.join(BASE_DIR, '../data')           # /api/data
    MODEL_DIR = os.path.join(BASE_DIR, '../ml_models')     # /api/ml_models


class DevelopmentConfig(Config):
    DEBUG = True
    CACHE_TYPE = 'SimpleCache'


class ProductionConfig(Config):
    DEBUG = False
    CACHE_TYPE = 'RedisCache'
