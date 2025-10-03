import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # External API keys
    REALTIME_API_KEY = os.environ.get('REALTIME_API_KEY')
    FORECAST_API_KEY = os.environ.get('FORECAST_API_KEY')
    
    # Data paths
    DATA_DIR = os.path.join(os.path.dirname(__file__), '../../data')
    MODEL_DIR = os.path.join(os.path.dirname(__file__), '../../ml_models')

class DevelopmentConfig(Config):
    DEBUG = True
    CACHE_TYPE = 'SimpleCache'

class ProductionConfig(Config):
    DEBUG = False
    CACHE_TYPE = 'RedisCache'