import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
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

_STATIC_DIST = Path(__file__).resolve().parent.parent / "static" / "dist"


def _cors_origins() -> list[str] | str:
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return "*"


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": _cors_origins()}})
    cache.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)

    if os.environ.get("DATABASE_URL") and os.environ.get("DB_AUTO_CREATE_TABLES", "").lower() in {
        "1",
        "true",
        "yes",
    }:
        with app.app_context():
            try:
                from . import models  # noqa: F401
                db.create_all()
                app.logger.info("Database tables created or already exist")
            except Exception:
                app.logger.exception("DB_AUTO_CREATE_TABLES failed; continuing without blocking startup")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    app.register_blueprint(electricity_demand_bp, url_prefix="/api/historical")
    app.register_blueprint(energy_poverty_bp, url_prefix="/api/historical")
    app.register_blueprint(production_aggregate_bp, url_prefix="/api/historical")
    app.register_blueprint(country_metrics_bp, url_prefix="/api/historical")
    app.register_blueprint(hourly_electricity_demand_bp, url_prefix="/api/historical")
    app.register_blueprint(realtime_bp, url_prefix="/api/realtime")
    app.register_blueprint(story_mode_bp, url_prefix="/api/story-mode")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    if _STATIC_DIST.is_dir():

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_spa(path: str):
            if path.startswith("api/"):
                return jsonify({"success": False, "error": "Not found"}), 404
            requested = _STATIC_DIST / path
            if path and requested.is_file():
                return send_from_directory(_STATIC_DIST, path)
            return send_from_directory(_STATIC_DIST, "index.html")

    return app