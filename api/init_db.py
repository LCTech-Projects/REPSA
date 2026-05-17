"""Create auth tables in Neon. Run: python init_db.py (from api/)"""

from dotenv import load_dotenv

load_dotenv()

from app import create_app
from app.extensions import db
from app import models  # noqa: F401

app = create_app()

with app.app_context():
    db.create_all()
    print("Database tables created.")
