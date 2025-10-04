import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # External API keys
    REALTIME_API_KEY = os.environ.get('REALTIME_API_KEY')
    FORECAST_API_KEY = os.environ.get('FORECAST_API_KEY')
    
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
