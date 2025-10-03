from flask import Blueprint, jsonify, send_file
from ..services.historical import HistoricalService
from ..utils.validators import validate_country, validate_year

historical_bp = Blueprint('historical', __name__)
service = HistoricalService()

@historical_bp.route('/demand/<country>/<int:year>')
def get_historical_demand(country, year):
    try:
        validate_country(country)
        validate_year(year)
        
        data = service.get_demand_data(country, year)
        return jsonify({
            'success': True,
            'data': data,
            'metadata': {
                'country': country,
                'year': year,
                'type': 'historical_demand'
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@historical_bp.route('/demand-per-capita/<country>/<int:year>')
def get_demand_per_capita(country, year):
    # Similar structure
    pass

@historical_bp.route('/download/<country>/<int:year>')
def download_historical_csv(country, year):
    try:
        csv_path = service.generate_csv_export(country, year)
        return send_file(csv_path, as_attachment=True, 
                        download_name=f'{country}_{year}_demand.csv')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400