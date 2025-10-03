from flask import Flask
from flask_cors import CORS
from .routes.historical import historical_bp
# from .routes.realtime import realtime_bp
# from .routes.forecast import forecast_bp
from .utils.config import Config
from .utils.cache import cache

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    CORS(app)
    cache.init_app(app)
    
    # Register blueprints
    app.register_blueprint(historical_bp, url_prefix='/api/historical')
    # app.register_blueprint(realtime_bp, url_prefix='/api/realtime')
    # app.register_blueprint(forecast_bp, url_prefix='/api/forecast')
    
    return app