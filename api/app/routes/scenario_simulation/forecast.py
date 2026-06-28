from typing import Optional

from flask import Blueprint, request, jsonify
from app.services.scenario_simulation.scenario_simulator import ScenarioSimulator
from app.utils.validators import validate_country

scenario_simulation_bp = Blueprint("scenario_simulation", __name__)

_simulator: Optional[ScenarioSimulator] = None


def get_simulator() -> ScenarioSimulator:
    global _simulator
    if _simulator is None:
        _simulator = ScenarioSimulator()
    return _simulator


@scenario_simulation_bp.route("/simulate-scenario", methods=["POST"])
def simulate_scenario():
    """
    Run the scenario explorer.

    Request body (JSON):
    - scenario_params or policy_metrics: scenario parameters
    - scenario_mode (optional): explore | bau
    - country (optional): country name
    - start_year (optional): default 2025
    - target_year (optional): default 2100
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "Invalid Request",
                "message": "No data provided. Please provide scenario parameters.",
            }), 400

        scenario_params = data.get("scenario_params") or data.get("policy_metrics")
        if scenario_params is None:
            scenario_params = {}

        if not isinstance(scenario_params, dict):
            return jsonify({
                "success": False,
                "error": "Invalid Parameters",
                "message": "Please provide scenario_params as a dictionary.",
            }), 400

        country = data.get("country")
        if country:
            try:
                country = validate_country(country)
            except ValueError:
                pass

        start_year = data.get("start_year", 2025)
        target_year = data.get("target_year", 2100)

        if not isinstance(start_year, int) or start_year < 2025 or start_year > 2099:
            return jsonify({
                "success": False,
                "error": "Invalid Start Year",
                "message": f"Start year must be between 2025 and 2099. You provided: {start_year}",
            }), 400

        if not isinstance(target_year, int) or target_year < start_year or target_year > 2100:
            return jsonify({
                "success": False,
                "error": "Invalid Forecast Year",
                "message": f"Forecast year must be between {start_year} and 2100. You provided: {target_year}",
            }), 400

        simulator = get_simulator()
        scenario_params = dict(scenario_params)
        scenario_params["timeline_start"] = start_year
        scenario_params["timeline_end"] = target_year
        scenario_params["scenario_mode"] = data.get(
            "scenario_mode",
            scenario_params.get("scenario_mode", "explore"),
        )
        scenario_params.pop("path_shape", None)

        simulated = simulator.simulate_scenario(
            country=country or "Algeria",
            start_year=start_year,
            end_year=target_year,
            scenario_params=scenario_params,
        )

        return jsonify({
            "success": True,
            "data": {
                "scenario_mode": scenario_params.get("scenario_mode", "explore"),
                "scenario_params": scenario_params,
                "forecasts": simulated.get("forecasts", {}),
                "assumptions": simulated.get("assumptions", {}),
                "baselines": simulated.get("baselines", {}),
                "summary": simulated.get("summary", {}),
                "warnings": simulated.get("warnings", []),
                "country_envelope": simulated.get("country_envelope", {}),
                "validation": simulated.get("validation", {}),
                "timeline": {
                    "start_year": start_year,
                    "end_year": target_year,
                },
            },
        })

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "Invalid Input",
            "message": f"Invalid input provided: {str(e)}. Please check your scenario parameters and try again.",
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
            error_message = "Required data files are missing."
        elif "MemoryError" in error_type:
            error_message = "The scenario parameters are too large to process."
        elif "KeyError" in error_type or "AttributeError" in error_type:
            error_message = "An error occurred while processing the scenario data."
        elif "ValueError" in error_type:
            error_message = f"Invalid data format: {error_str}."
        elif "TypeError" in error_type:
            error_message = "Data type error occurred during simulation."

        return jsonify({
            "success": False,
            "error": "Simulation Error",
            "message": error_message,
        }), 500
