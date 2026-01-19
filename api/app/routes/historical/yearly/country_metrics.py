from flask import Blueprint, request, jsonify
from app.services.historical.yearly.country_metrics import CountryMetricsService
from app.utils.validators import validate_country, validate_year
from app.utils.config import Config
from datetime import datetime

country_metrics_bp = Blueprint('country_metrics', __name__)
service = CountryMetricsService()

@country_metrics_bp.route('/country-summary', methods=['GET'])
def get_country_summary():
    """
    Get summary metrics for a country (for hover popup)
    Query parameters:
    - country (required): Country name
    - year (optional): Specific year (defaults to latest available)
    
    Returns:
    - JSON response with electricity_access, renewable_share, energy_poverty
    """
    try:
        country = request.args.get('country')
        year = request.args.get('year')
        
        if not country:
            return jsonify({
                'success': False,
                'error': 'Country parameter is required'
            }), 400
        
        country = validate_country(country)
        
        year_int = None
        if year:
            year_int = validate_year(year)
            # Cap year by YEAR_FILTER_LIMIT
            if year_int > Config.YEAR_FILTER_LIMIT:
                year_int = Config.YEAR_FILTER_LIMIT
        
        data = service.get_country_summary(country, year_int)
        
        if data is None:
            return jsonify({
                'success': False,
                'error': f'No data found for country: {country}'
            }), 404
        
        return jsonify({
            'success': True,
            'data': data
        })
    
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@country_metrics_bp.route('/country-details', methods=['GET'])
def get_country_details():
    """
    Get detailed metrics for a country (for dashboard drawer)
    Query parameters:
    - country (required): Country name
    - start_year (optional): Start year for time series
    - end_year (optional): End year for time series
    
    Returns:
    - JSON response with all country metrics and time series data
    """
    try:
        country = request.args.get('country')
        start_year = request.args.get('start_year')
        end_year = request.args.get('end_year')
        selected_year = request.args.get('selected_year')
        
        if not country:
            return jsonify({
                'success': False,
                'error': 'Country parameter is required'
            }), 400
        
        country = validate_country(country)
        
        start_year_int = None
        end_year_int = None
        selected_year_int = None
        
        if start_year:
            start_year_int = validate_year(start_year)
        if end_year:
            end_year_int = validate_year(end_year)
            # Cap end_year by YEAR_FILTER_LIMIT
            if end_year_int > Config.YEAR_FILTER_LIMIT:
                end_year_int = Config.YEAR_FILTER_LIMIT
        if selected_year:
            selected_year_int = validate_year(selected_year)
            # Cap selected_year by YEAR_FILTER_LIMIT
            if selected_year_int > Config.YEAR_FILTER_LIMIT:
                selected_year_int = Config.YEAR_FILTER_LIMIT
        
        data = service.get_country_detailed_metrics(country, start_year_int, end_year_int, selected_year_int)
        
        if data is None:
            return jsonify({
                'success': False,
                'error': f'No data found for country: {country}'
            }), 404
        
        return jsonify({
            'success': True,
            'data': data
        })
    
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@country_metrics_bp.route('/available-years', methods=['GET'])
def get_available_years():
    """
    Get list of available years in the dataset
    Returns: JSON response with list of years and latest year
    """
    try:
        years = service.get_available_years()
        latest_year = service.get_latest_year()
        
        return jsonify({
            'success': True,
            'data': {
                'years': years,
                'latest_year': latest_year
            }
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@country_metrics_bp.route('/all-countries-energy-poverty', methods=['GET'])
def get_all_countries_energy_poverty():
    """
    Get energy poverty for all countries for a specific year (for map coloring)
    Query parameters:
    - year (optional): Specific year (defaults to latest available)
    
    Returns:
    - JSON response with {country_name: energy_poverty_value}
    """
    try:
        year = request.args.get('year')
        
        year_int = None
        if year:
            year_int = validate_year(year)
            # Cap year by YEAR_FILTER_LIMIT
            if year_int > Config.YEAR_FILTER_LIMIT:
                year_int = Config.YEAR_FILTER_LIMIT
        
        data = service.get_all_countries_energy_poverty(year_int)
        
        return jsonify({
            'success': True,
            'data': data
        })
    
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

