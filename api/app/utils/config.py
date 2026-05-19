import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
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

    # Year Filter Limit - Maximum year that can be selected in filters (to avoid incomplete data)
    YEAR_FILTER_LIMIT = int(os.environ.get('YEAR_FILTER_LIMIT', '2023'))  # Default: 2023

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