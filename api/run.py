"""Local Flask app entrypoint for development.

Run:
    python api/run.py
"""

import os

from app import create_app

# Local dev: create auth tables on startup when Neon is configured.
if os.environ.get("DATABASE_URL") and not os.environ.get("DB_AUTO_CREATE_TABLES"):
    os.environ["DB_AUTO_CREATE_TABLES"] = "true"

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)