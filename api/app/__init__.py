from flask import Flask
from flask_cors import CORS
from .routes.historical.yearly.electricity_demand import electricity_demand_bp
from .routes.historical.yearly.energy_poverty import energy_poverty_bp
from .routes.historical.yearly.production_aggregate import production_aggregate_bp
from .routes.historical.hourly.electricity_demand import hourly_electricity_demand_bp
from .utils.config import Config
from .utils.cache import cache

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    CORS(app)
    cache.init_app(app)
    
    # Register blueprints - all under /api/historical but with unique names
    app.register_blueprint(electricity_demand_bp, url_prefix='/api/historical')
    app.register_blueprint(energy_poverty_bp, url_prefix='/api/historical')
    app.register_blueprint(production_aggregate_bp, url_prefix='/api/historical')
    app.register_blueprint(hourly_electricity_demand_bp, url_prefix='/api/historical')
    
    return app