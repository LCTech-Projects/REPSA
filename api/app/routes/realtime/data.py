from flask import Blueprint, request, jsonify
from app.services.realtime.aggregator import RealtimeAggregator
from app.utils.validators import validate_country

realtime_bp = Blueprint('realtime', __name__)
aggregator = RealtimeAggregator()

@realtime_bp.route('/realtime-data', methods=['GET'])
def get_realtime_data():
    """
    Get realtime energy data estimates for a country using statistical aggregation.
    
    This endpoint analyzes historical trends from authoritative sources
    and projects current estimates using statistical methods.
    
    Authoritative Sources:
    - World Bank Open Data: Population, electricity access, energy poverty metrics
    - Our World in Data (OWID): Historical energy and electricity statistics
    - Electricity Maps: Grid data and electricity generation information
    - ESKOM (South Africa): Hourly electricity demand data for ML model training
    
    Query parameters:
    - country (required): Country name
    
    Returns:
    - JSON response with projected current values, live counters, and methodology
    """
    try:
        country = request.args.get('country')
        
        if not country:
            return jsonify({
                'success': False,
                'error': 'Country parameter is required'
            }), 400
        
        country = validate_country(country)
        
        # Get realtime estimates using statistical aggregation
        data = aggregator.get_realtime_estimates(country)
        
        # Check if there was an error
        if 'error' in data:
            return jsonify({
                'success': False,
                'error': data['error']
            }), 404
        
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

