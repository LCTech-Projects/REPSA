import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

from .extensions import db, migrate
from .routes.auth import auth_bp
from .routes.historical.yearly.electricity_demand import electricity_demand_bp
from .routes.historical.yearly.energy_poverty import energy_poverty_bp
from .routes.historical.yearly.production_aggregate import production_aggregate_bp
from .routes.historical.yearly.country_metrics import country_metrics_bp
from .routes.historical.hourly.electricity_demand import hourly_electricity_demand_bp
from .routes.realtime.data import realtime_bp
from .routes.story_mode.forecast import story_mode_bp
from .utils.config import Config
from .utils.cache import cache

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    CORS(app)
    cache.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)

    if os.environ.get("DATABASE_URL"):
        with app.app_context():
            from . import models  # noqa: F401
            db.create_all()
    
    # Register blueprints - all under /api/historical but with unique names
    app.register_blueprint(electricity_demand_bp, url_prefix='/api/historical')
    app.register_blueprint(energy_poverty_bp, url_prefix='/api/historical')
    app.register_blueprint(production_aggregate_bp, url_prefix='/api/historical')
    app.register_blueprint(country_metrics_bp, url_prefix='/api/historical')
    app.register_blueprint(hourly_electricity_demand_bp, url_prefix='/api/historical')
    
    # Register realtime blueprint
    app.register_blueprint(realtime_bp, url_prefix='/api/realtime')
    
    # Register story mode blueprint
    app.register_blueprint(story_mode_bp, url_prefix='/api/story-mode')

    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    return app