from flask import Flask
from flask_cors import CORS
from config import Config
from routes.data import data_bp
from routes.stats import stats_bp

app = Flask(__name__)
app.config.from_object(Config)

CORS(app)

app.register_blueprint(data_bp, url_prefix="/api")
app.register_blueprint(stats_bp, url_prefix="/api")

if __name__ == "__main__":
    app.run(debug=True)