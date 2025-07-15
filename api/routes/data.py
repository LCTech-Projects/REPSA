from flask import Blueprint, request, jsonify
from services.data_service import hourly_data, yearly_data

data_bp = Blueprint('data', __name__)

@data_bp.route("/data/hourly-elec-data", methods=["GET"])
def get_hourly_elec_data():
    country = request.args.get("country")
    year = request.args.get("year")
    data = hourly_data(country, year)
    return jsonify(data)

@data_bp.route("/data/yearly-elec-data", methods=["GET"])
def get_yearly_elec_data():
    country = request.args.get("country")
    year = request.args.get("year")
    data = yearly_data(country, year)
    return jsonify(data)