from flask import Blueprint, request, jsonify, current_app
from app.services.story_mode.policy_analyzer import PolicyAnalyzer
from app.utils.validators import validate_country

story_mode_bp = Blueprint('story_mode', __name__)

def get_analyzer():
    """
    Lazy initialization of PolicyAnalyzer.
    Reads NLP preferences from environment variables (Config.USE_NLP, Config.NLP_BACKEND).
    """
    # PolicyAnalyzer will automatically read NLP/ML settings from Config (env vars)
    return PolicyAnalyzer()

@story_mode_bp.route('/analyze-policy', methods=['POST'])
def analyze_policy():
    """
    Analyze a policy document and generate forecasts.
    
    Request body (JSON):
    - policy_text (required): Policy document text
    - country (optional): Country name for context
    - target_year (optional): Forecast end year (default: 2100)
    
    Returns:
    - JSON response with policy metrics, forecasts, and summary
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Invalid Request',
                'message': 'No data provided. Please ensure you are sending a valid policy document.'
            }), 400
        
        policy_text = data.get('policy_text')
        if not policy_text:
            return jsonify({
                'success': False,
                'error': 'Policy Document Required',
                'message': 'Please provide a policy document text to analyze. You can either type the content or upload a text file.'
            }), 400
        
        if not isinstance(policy_text, str) or len(policy_text.strip()) < 10:
            return jsonify({
                'success': False,
                'error': 'Invalid Policy Document',
                'message': 'The policy document is too short or invalid. Please provide a policy document with at least 10 characters of meaningful content.'
            }), 400
        
        country = data.get('country')
        if country:
            try:
                country = validate_country(country)
            except ValueError:
                # If country validation fails, use it as-is (will use default in analyzer)
                pass
        
        target_year = data.get('target_year', 2100)
        if not isinstance(target_year, int) or target_year < 2025 or target_year > 2100:
            return jsonify({
                'success': False,
                'error': 'Invalid Forecast Year',
                'message': f'Forecast year must be between 2025 and 2100. You provided: {target_year}'
            }), 400
        
        # Get analyzer (lazy initialization)
        analyzer = get_analyzer()
        
        # Analyze policy
        result = analyzer.analyze_policy(
            policy_text=policy_text,
            country=country,
            target_year=target_year
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid Input',
            'message': f'Invalid input provided: {str(e)}. Please check your policy document and try again.'
        }), 400
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_type = type(e).__name__
        error_str = str(e)
        
        print(f"Error in analyze_policy: {error_type}: {error_str}")
        print(f"Traceback: {error_trace}")
        
        # Provide user-friendly error message based on error type
        error_message = "An unexpected error occurred while analyzing your policy document."
        
        if "FileNotFoundError" in error_type:
            error_message = "Required data files are missing. The system will use default values for forecasting."
        elif "MemoryError" in error_type:
            error_message = "The policy document is too large to process. Please try with a shorter document or break it into smaller sections."
        elif "KeyError" in error_type:
            # More specific KeyError handling
            if "country" in error_str.lower():
                error_message = "The selected country data is not available. The system will use default forecasting values."
            else:
                error_message = f"Data processing error: {error_str}. The system will attempt to use default values."
        elif "AttributeError" in error_type:
            error_message = "An error occurred while processing the policy data. Please ensure your policy document contains valid text and try again."
        elif "ValueError" in error_type:
            error_message = f"Invalid data format: {error_str}. Please check your policy document and try again."
        elif "TypeError" in error_type:
            error_message = "Data type error occurred during analysis. Please ensure your policy document contains properly formatted text."
        
        return jsonify({
            'success': False,
            'error': 'Analysis Error',
            'message': error_message
        }), 500

@story_mode_bp.route('/simulate-scenario', methods=['POST'])
def simulate_scenario():
    """
    Simulate a scenario using manual parameters (for Scenario Builder).
    
    Request body (JSON):
    - policy_metrics (required): Dictionary with manual parameters:
        - renewable_target: Target renewable energy share (%)
        - energy_access_target: Electricity access target (%)
        - energy_poverty_target: Energy poverty reduction target (%)
        - co2_reduction_target: CO2 reduction target (%)
        - clean_cooking_target: Clean cooking access target (%)
        - solar_target: Solar capacity target (GW)
        - wind_target: Wind capacity target (GW)
        - investment_amount: Total investment (USD billions)
        - population_growth_rate: Population growth rate (decimal, e.g., 0.02 for 2%)
    - country (optional): Country name for context
    - start_year (optional): Forecast start year (default: 2025)
    - target_year (optional): Forecast end year (default: 2100)
    
    Returns:
    - JSON response with forecasts and summary (same format as analyze_policy)
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Invalid Request',
                'message': 'No data provided. Please provide scenario parameters.'
            }), 400
        
        policy_metrics = data.get('policy_metrics')
        if not policy_metrics or not isinstance(policy_metrics, dict):
            return jsonify({
                'success': False,
                'error': 'Invalid Parameters',
                'message': 'Please provide policy_metrics as a dictionary with scenario parameters.'
            }), 400
        
        country = data.get('country')
        if country:
            try:
                country = validate_country(country)
            except ValueError:
                pass
        
        start_year = data.get('start_year', 2025)
        target_year = data.get('target_year', 2100)
        
        if not isinstance(start_year, int) or start_year < 2025 or start_year > 2099:
            return jsonify({
                'success': False,
                'error': 'Invalid Start Year',
                'message': f'Start year must be between 2025 and 2099. You provided: {start_year}'
            }), 400
        
        if not isinstance(target_year, int) or target_year < start_year or target_year > 2100:
            return jsonify({
                'success': False,
                'error': 'Invalid Forecast Year',
                'message': f'Forecast year must be between {start_year} and 2100. You provided: {target_year}'
            }), 400
        
        # Get analyzer (lazy initialization)
        analyzer = get_analyzer()
        
        # Add timeline to policy_metrics
        policy_metrics['timeline_start'] = start_year
        policy_metrics['timeline_end'] = target_year
        
        simulated = analyzer.simulate_model_driven_scenario(
            country=country or 'Algeria',
            start_year=start_year,
            end_year=target_year,
            policy_metrics=policy_metrics,
        )
        adjusted_forecast = simulated.get('forecasts', {})
        final_year_data = simulated.get('summary', {})
        
        return jsonify({
            'success': True,
            'data': {
                'policy_metrics': policy_metrics,
                'forecasts': adjusted_forecast,
                'summary': final_year_data,
                'timeline': {
                    'start_year': start_year,
                    'end_year': target_year
                }
            }
        })
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid Input',
            'message': f'Invalid input provided: {str(e)}. Please check your scenario parameters and try again.'
        }), 400
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_type = type(e).__name__
        error_str = str(e)
        
        print(f"Error in simulate_scenario: {error_type}: {error_str}")
        print(f"Traceback: {error_trace}")
        
        error_message = "An unexpected error occurred while simulating your scenario."
        
        if "FileNotFoundError" in error_type:
            error_message = "Required data files are missing. The system will use default values for forecasting."
        elif "MemoryError" in error_type:
            error_message = "The scenario parameters are too large to process. Please try with smaller values."
        elif "KeyError" in error_type or "AttributeError" in error_type:
            error_message = "An error occurred while processing the scenario data. Please ensure your parameters are valid and try again."
        elif "ValueError" in error_type:
            error_message = f"Invalid data format: {error_str}. Please check your scenario parameters and try again."
        elif "TypeError" in error_type:
            error_message = "Data type error occurred during simulation. Please ensure your parameters are properly formatted."
        
        return jsonify({
            'success': False,
            'error': 'Simulation Error',
            'message': error_message
        }), 500

