"""Serve the OpenAPI specification and Swagger UI."""

from pathlib import Path

from flask import Blueprint, Response, jsonify, send_file

docs_bp = Blueprint("docs", __name__)

OPENAPI_PATH = Path(__file__).resolve().parents[2] / "openapi.yaml"


@docs_bp.get("/openapi.yaml")
def openapi_yaml():
    if not OPENAPI_PATH.is_file():
        return jsonify({"success": False, "error": "OpenAPI specification not found"}), 404
    return send_file(
        OPENAPI_PATH,
        mimetype="application/yaml",
        download_name="openapi.yaml",
        max_age=0,
    )


@docs_bp.get("/openapi.json")
def openapi_json():
    if not OPENAPI_PATH.is_file():
        return jsonify({"success": False, "error": "OpenAPI specification not found"}), 404
    try:
        import yaml
    except ImportError:
        return jsonify({
            "success": False,
            "error": "PyYAML is required to serve openapi.json",
        }), 500
    spec = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
    return jsonify(spec)


@docs_bp.get("/docs")
def swagger_ui():
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>REPSA API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>
"""
    return Response(html, mimetype="text/html")
