from flask import Blueprint, request, jsonify
from app.services.realtime.scraper import RealtimeDataScraper
from app.utils.validators import validate_country

realtime_bp = Blueprint('realtime', __name__)
scraper = RealtimeDataScraper()

@realtime_bp.route('/realtime-data', methods=['GET'])
def get_realtime_data():
    """
    Get realtime energy data for a country
    Query parameters:
    - country (required): Country name
    - sources (optional): Comma-separated list of sources (worldometer, renewables, electricitymaps)
    
    Returns:
    - JSON response with realtime data from specified sources
    """
    try:
        country = request.args.get('country')
        sources_param = request.args.get('sources', 'worldometer,renewables,electricitymaps')
        
        if not country:
            return jsonify({
                'success': False,
                'error': 'Country parameter is required'
            }), 400
        
        country = validate_country(country)
        
        # Parse sources
        sources = [s.strip() for s in sources_param.split(',')]
        
        # Get realtime data
        data = scraper.get_realtime_data(country, sources)
        
        return jsonify({
            'success': True,
            'data': data
        })
    
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

