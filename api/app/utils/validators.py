import re
from datetime import datetime

# Allowed country pattern: letters, spaces, hyphens, apostrophes, periods, parentheses & ampersand
_COUNTRY_RE = re.compile(r"^[\w\-\.'\(\)&\s]+$", re.UNICODE)

def validate_country(country: str):
    """
    Basic validation for country string passed to endpoints.
    Raises ValueError if invalid.
    """
    if country is None:
        raise ValueError("Country cannot be None.")
    if not isinstance(country, str):
        raise ValueError("Country must be a string.")
    country = country.strip()
    if country == "":
        raise ValueError("Country cannot be empty.")
    if len(country) > 200:
        raise ValueError("Country name too long.")
    # allow broad range of characters but reject control characters
    if not _COUNTRY_RE.match(country):
        raise ValueError("Country contains invalid characters.")
    return country


def validate_year(year: int):
    """
    Validate a single year integer: must be reasonable (1900 .. current_year+1).
    Raises ValueError if invalid.
    """
    if year is None:
        raise ValueError("Year is required.")
    try:
        year = int(year)
    except Exception:
        raise ValueError("Year must be an integer.")
    now = datetime.utcnow().year
    if year < 1900 or year > now + 1:
        raise ValueError(f"Year {year} is out of allowed range (1900 - {now+1}).")
    return year


def validate_year_range(start_year: int, end_year: int):
    """
    Validate a year range. Raises ValueError for bad inputs.
    """
    sy = validate_year(start_year)
    ey = validate_year(end_year)
    if sy > ey:
        raise ValueError("start_year must be <= end_year.")
    return sy, ey