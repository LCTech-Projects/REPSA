from flask import Blueprint, request, jsonify, send_file
from ....services.historical.yearly.electricity_demand import HistoricalService
from ....utils.validators import validate_year, validate_year_range, validate_country

historical_bp = Blueprint('historical', __name__)
service = HistoricalService()

@historical_bp.route('/electricity-demand', methods=['GET'])
def get_electricity_demand():
    """
    Get electricity demand data for countries
    Query parameters:
    - country (optional): Specific country
    - year (optional): Single year
    - start_year, end_year (optional): Year range
    - format (optional): 'json' or 'csv' (default: 'json')
    
    Returns:
    - JSON response or CSV file download
    """
    try:
        # Get query parameters
        country = request.args.get('country')
        year = request.args.get('year')
        start_year = request.args.get('start_year')
        end_year = request.args.get('end_year')
        format_type = request.args.get('format', 'json').lower()
        
        # Validate format
        if format_type not in ['json', 'csv']:
            return jsonify({
                'success': False,
                'error': 'Format must be either "json" or "csv"'
            }), 400
        
        # Validate country if provided
        if country:
            country = validate_country(country)
        
        # Determine request type and validate
        if year and (start_year or end_year):
            return jsonify({
                'success': False,
                'error': 'Use either "year" OR "start_year/end_year", not both'
            }), 400
        
        if year:
            # Single year request
            year = validate_year(year)
            
            if format_type == 'csv':
                # Return CSV file for single year
                csv_path = service.export_electricity_demand_by_year_to_csv(year, country)
                filename = f"electricity_demand_{year}"
                if country:
                    filename += f"_{country.replace(' ', '_')}"
                filename += ".csv"
                
                return send_file(
                    csv_path,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='text/csv'
                )
            else:
                # Return JSON for single year
                data = service.get_electricity_demand_by_year(year, country)
                return jsonify({
                    'success': True,
                    'data': data,
                    'metadata': {
                        'year': year,
                        'country': country or 'all_countries',
                        'total_records': len(data)
                    }
                })
        
        elif start_year and end_year:
            # Year range request
            start_year, end_year = validate_year_range(start_year, end_year)
            
            if format_type == 'csv':
                # Return CSV file for year range
                csv_path = service.export_electricity_demand_by_range_to_csv(start_year, end_year, country)
                filename = f"electricity_demand_{start_year}_to_{end_year}"
                if country:
                    filename += f"_{country.replace(' ', '_')}"
                filename += ".csv"
                
                return send_file(
                    csv_path,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='text/csv'
                )
            else:
                # Return JSON for year range
                data = service.get_electricity_demand_by_range(start_year, end_year, country)
                return jsonify({
                    'success': True,
                    'data': data,
                    'metadata': {
                        'start_year': start_year,
                        'end_year': end_year,
                        'country': country or 'all_countries',
                        'total_countries': len(data)
                    }
                })
        
        else:
            return jsonify({
                'success': False,
                'error': 'Must provide either "year" or "start_year/end_year" parameters'
            }), 400

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': 'Internal server error'}), 500