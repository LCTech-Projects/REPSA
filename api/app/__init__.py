from flask import Flask
from flask_cors import CORS
from .routes.historical.yearly.electricity_demand import historical_bp
from .utils.config import Config
from .utils.cache import cache

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    CORS(app)
    cache.init_app(app)
    
    # Register blueprints - note the new import path
    app.register_blueprint(historical_bp, url_prefix='/api/historical')
    
    return app