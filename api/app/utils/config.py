import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # External API keys
    REALTIME_API_KEY = os.environ.get('REALTIME_API_KEY')
    FORECAST_API_KEY = os.environ.get('FORECAST_API_KEY')
    
    # NLP Configuration for Policy Analyzer
    USE_NLP = os.environ.get('USE_NLP', 'false').lower() == 'true'  # Default: disabled (set to 'true' in .env to enable)
    NLP_BACKEND = os.environ.get('NLP_BACKEND', 'spacy')  # Options: spacy, openai, anthropic, huggingface
    NLP_MODEL_NAME = os.environ.get('NLP_MODEL_NAME', 'en_core_web_trf')  # spaCy model name
    
    # ML Forecasting Configuration
    USE_ML_FORECASTING = os.environ.get('USE_ML_FORECASTING', 'true').lower() == 'true'  # Default: enabled (hybrid approach)
    
    # Year Filter Limit - Maximum year that can be selected in filters (to avoid incomplete data)
    YEAR_FILTER_LIMIT = int(os.environ.get('YEAR_FILTER_LIMIT', '2023'))  # Default: 2023
    
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