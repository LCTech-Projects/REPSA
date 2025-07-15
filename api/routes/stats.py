from flask import Blueprint, jsonify
from utils.data_loader import DataStore

stats_bp = Blueprint('stats', __name__)

@stats_bp.route("/stats", methods=["GET"])
def get_stats():
    data = DataStore.load_data()
    stats = {
        "total_records": len(data),
        "available_countries": data['country'].nunique(),
        "available_years": data['year'].nunique()
    }
    return jsonify(stats)