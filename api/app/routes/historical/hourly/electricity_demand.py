from flask import Blueprint, request, jsonify, send_file
from app.services.historical.hourly.electricity_demand import HourlyElectricityDemandService
from app.utils.validators import validate_country, validate_year

hourly_electricity_demand_bp = Blueprint('hourly_electricity_demand', __name__)
service = HourlyElectricityDemandService()

@hourly_electricity_demand_bp.route('/hourly-electricity-demand', methods=['GET'])
def get_hourly_electricity_demand():
    """
    Get hourly electricity demand data for a country
    Query parameters:
    - country (required): Specific country
    - date (optional): Specific date (YYYY-MM-DD)
    - year (optional): Specific year
    - format (optional): 'json' or 'csv' (default: 'json')
    
    Returns:
    - JSON response or CSV file download
    """
    try:
        # Get query parameters
        country = request.args.get('country')
        date = request.args.get('date')
        year = request.args.get('year')
        format_type = request.args.get('format', 'json').lower()
        
        # Validate format
        if format_type not in ['json', 'csv']:
            return jsonify({
                'success': False,
                'error': 'Format must be either "json" or "csv"'
            }), 400
        
        # Validate required parameters
        if not country:
            return jsonify({
                'success': False,
                'error': 'Country parameter is required'
            }), 400
        
        country = validate_country(country)
        
        # Determine request type and validate
        if date and year:
            return jsonify({
                'success': False,
                'error': 'Use either "date" OR "year", not both'
            }), 400
        
        if not date and not year:
            return jsonify({
                'success': False,
                'error': 'Must provide either "date" or "year" parameter'
            }), 400
        
        if date:
            # Specific date request
            if format_type == 'csv':
                # Return CSV file for date
                csv_path = service.export_hourly_demand_by_date_to_csv(country, date)
                filename = f"hourly_demand_{country}_{date.replace('-', '_')}.csv"
                
                return send_file(
                    csv_path,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='text/csv'
                )
            else:
                # Return JSON for date
                data = service.get_hourly_demand_by_date(country, date)
                return jsonify({
                    'success': True,
                    'data': data,
                    'metadata': {
                        'country': country,
                        'date': date,
                        'total_hours': len(data),
                        'data_type': 'hourly'
                    }
                })
        
        else:
            # Year request
            year = validate_year(year)
            
            if format_type == 'csv':
                # Return CSV file for year
                csv_path = service.export_hourly_demand_by_year_to_csv(country, year)
                filename = f"hourly_demand_{country}_{year}.csv"
                
                return send_file(
                    csv_path,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='text/csv'
                )
            else:
                # Return JSON for year
                data = service.get_hourly_demand_by_year(country, year)
                return jsonify({
                    'success': True,
                    'data': data,
                    'metadata': {
                        'country': country,
                        'year': year,
                        'total_hours': len(data),
                        'data_type': 'hourly'
                    }
                })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except FileNotFoundError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@hourly_electricity_demand_bp.route('/available-countries', methods=['GET'])
def get_available_countries():
    """Get list of available countries with hourly data"""
    try:
        countries = service.get_available_countries()
        return jsonify({
            'success': True,
            'data': countries,
            'metadata': {
                'total_countries': len(countries)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@hourly_electricity_demand_bp.route('/available-years/<country>', methods=['GET'])
def get_available_years(country):
    """Get list of available years for a country"""
    try:
        country = validate_country(country)
        years = service.get_available_years(country)
        return jsonify({
            'success': True,
            'data': years,
            'metadata': {
                'country': country,
                'total_years': len(years)
            }
        })
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except FileNotFoundError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500