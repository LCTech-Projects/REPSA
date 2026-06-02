import pandas as pd
import os
import tempfile
from typing import List, Dict, Any, Optional, Tuple
from app.utils.config import Config
from app.utils.cache import cache

_HOURLY_PER_CAPITA_SPECS: Tuple[Tuple[str, float], ...] = (
    ("electricity_demand_per_capita (kWh/person)", 1e-3),
    ("electricity_demand_per_capita (MWh/person)", 1.0),
    ("electricity_demand_per_capita (MWh)", 1.0),
    ("electricity_demand_per_capita (kWh)", 1e-3),
)
_HOURLY_PER_CAPITA_WA_SPECS: Tuple[Tuple[str, float], ...] = (
    ("electricity_demand_per_capita_with_access (kWh/person)", 1e-3),
    ("electricity_demand_per_capita_with_access (MWh/person)", 1.0),
    ("electricity_demand_per_capita_with_access (MWh)", 1.0),
    ("electricity_demand_per_capita_with_access (kWh)", 1e-3),
)


def _first_scaled_series(df: pd.DataFrame, specs: Tuple[Tuple[str, float], ...]) -> Optional[pd.Series]:
    for col, scale in specs:
        if col in df.columns:
            return pd.to_numeric(df[col], errors="coerce") * scale
    return None


def _normalize_hourly_per_capita_mwh(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    plain = _first_scaled_series(out, _HOURLY_PER_CAPITA_SPECS)
    if plain is not None:
        out["electricity_demand_per_capita_MWh"] = plain
    wa = _first_scaled_series(out, _HOURLY_PER_CAPITA_WA_SPECS)
    if wa is not None:
        out["electricity_demand_per_capita_with_access_MWh"] = wa
    return out

class HourlyElectricityDemandService:
    def __init__(self):
        self.data_dir = Config.DATA_DIR
        self.hourly_data_path = os.path.join(self.data_dir, 'historical', 'hourly')
    
    def _resolve_country_file(self, country: str) -> str:
        """Resolve the correct CSV filename for a given country name.
        Tries multiple variants to match file naming conventions.
        """
        # Base sanitization
        base = country.strip()
        base_no_apost = base.replace("'", "")
        base_multi_space = " ".join(base_no_apost.split())

        candidates = [
            f"{base_multi_space}.csv",
            f"{base_multi_space.replace(' ', '_')}.csv",
            f"{base_multi_space.replace(' ', '-')}.csv",
            f"{base_multi_space.replace('-', '_')}.csv",
            f"{base_multi_space.replace('-', ' ')}.csv",
        ]

        for fname in candidates:
            path = os.path.join(self.hourly_data_path, fname)
            if os.path.exists(path):
                return path
        
        # As a last resort, try case-insensitive match among files
        try:
            for f in os.listdir(self.hourly_data_path):
                if f.lower().rstrip('.csv') == base_multi_space.lower():
                    return os.path.join(self.hourly_data_path, f)
        except FileNotFoundError:
            pass
        
        raise FileNotFoundError(
            f"Hourly data not available for country: {country}. Ensure a CSV exists in {self.hourly_data_path}."
        )
    
    def _load_country_data(self, country: str) -> pd.DataFrame:
        """Load hourly data for a specific country"""
        country_file = self._resolve_country_file(country)
        
        df = pd.read_csv(country_file)
        # Convert datetime column to datetime object
        df['datetime'] = pd.to_datetime(df['datetime'])

        rename_map = {}
        if 'electricity_demand (MWh)' in df.columns and 'electricity_demand_MWh' not in df.columns:
            rename_map['electricity_demand (MWh)'] = 'electricity_demand_MWh'
        if rename_map:
            df = df.rename(columns=rename_map)

        df = _normalize_hourly_per_capita_mwh(df)

        return df
    
    @cache.memoize(timeout=3600)
    def get_hourly_demand_by_date(self, country: str, date: str) -> List[Dict[str, Any]]:
        """
        Get hourly electricity demand data for a specific date
        Returns: [{datetime, electricity_demand_MWh, electricity_demand_per_capita_MWh, electricity_demand_per_capita_with_access_MWh}]
        """
        try:
            target_date = pd.to_datetime(date).date()
        except ValueError:
            raise ValueError(f"Invalid date format: {date}. Use YYYY-MM-DD format.")
        
        df = self._load_country_data(country)
        
        # Filter by date
        date_data = df[df['datetime'].dt.date == target_date].copy()
        
        if date_data.empty:
            return []
        
        # Convert to required format
        result = []
        for _, row in date_data.iterrows():
            result.append({
                'datetime': row['datetime'].strftime('%Y-%m-%d %H:%M:%S'),
                'electricity_demand_MWh': float(row['electricity_demand_MWh']) if pd.notna(row['electricity_demand_MWh']) else None,
                'electricity_demand_per_capita_MWh': float(row['electricity_demand_per_capita_MWh']) if 'electricity_demand_per_capita_MWh' in row.index and pd.notna(row['electricity_demand_per_capita_MWh']) else None,
                'electricity_demand_per_capita_with_access_MWh': float(row['electricity_demand_per_capita_with_access_MWh']) if 'electricity_demand_per_capita_with_access_MWh' in row.index and pd.notna(row['electricity_demand_per_capita_with_access_MWh']) else None,
            })
        
        # Sort by datetime
        result.sort(key=lambda x: x['datetime'])
        
        return result
    
    @cache.memoize(timeout=3600)
    def get_hourly_demand_by_year(self, country: str, year: int) -> List[Dict[str, Any]]:
        """
        Get hourly electricity demand data for a specific year
        Returns: [{datetime, electricity_demand_MWh, electricity_demand_per_capita_MWh, electricity_demand_per_capita_with_access_MWh}]
        """
        df = self._load_country_data(country)
        
        # Filter by year
        year_data = df[df['datetime'].dt.year == year].copy()
        
        if year_data.empty:
            return []
        
        # Convert to required format
        result = []
        for _, row in year_data.iterrows():
            result.append({
                'datetime': row['datetime'].strftime('%Y-%m-%d %H:%M:%S'),
                'electricity_demand_MWh': float(row['electricity_demand_MWh']) if pd.notna(row['electricity_demand_MWh']) else None,
                'electricity_demand_per_capita_MWh': float(row['electricity_demand_per_capita_MWh']) if 'electricity_demand_per_capita_MWh' in row.index and pd.notna(row['electricity_demand_per_capita_MWh']) else None,
                'electricity_demand_per_capita_with_access_MWh': float(row['electricity_demand_per_capita_with_access_MWh']) if 'electricity_demand_per_capita_with_access_MWh' in row.index and pd.notna(row['electricity_demand_per_capita_with_access_MWh']) else None,
            })
        
        # Sort by datetime
        result.sort(key=lambda x: x['datetime'])
        
        return result
    
    def export_hourly_demand_by_date_to_csv(self, country: str, date: str) -> str:
        """
        Export hourly demand data for a specific date to CSV
        Returns path to temporary CSV file
        """
        data = self.get_hourly_demand_by_date(country, date)
        
        if not data:
            raise ValueError(f"No hourly data found for country {country} on date {date}")
        
        # Convert to DataFrame for CSV export
        df = pd.DataFrame(data)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        df.to_csv(temp_file.name, index=False)
        
        return temp_file.name
    
    def export_hourly_demand_by_year_to_csv(self, country: str, year: int) -> str:
        """
        Export hourly demand data for a specific year to CSV
        Returns path to temporary CSV file
        """
        data = self.get_hourly_demand_by_year(country, year)
        
        if not data:
            raise ValueError(f"No hourly data found for country {country} for year {year}")
        
        # Convert to DataFrame for CSV export
        df = pd.DataFrame(data)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        df.to_csv(temp_file.name, index=False)
        
        return temp_file.name
    
    def get_available_countries(self) -> List[str]:
        """Get list of available countries with hourly data"""
        if not os.path.exists(self.hourly_data_path):
            return []
        
        csv_files = [f for f in os.listdir(self.hourly_data_path) if f.endswith('.csv')]
        # Convert filenames to display names (underscores -> spaces)
        countries = [os.path.splitext(f)[0].replace('_', ' ') for f in csv_files]
        return sorted(countries)
    
    def get_available_years(self, country: str) -> List[int]:
        """Get list of available years for a country, capped by YEAR_FILTER_LIMIT"""
        try:
            df = self._load_country_data(country)
            years = sorted(df['datetime'].dt.year.unique().tolist())
            # Filter years to not exceed YEAR_FILTER_LIMIT
            filtered_years = [int(year) for year in years if int(year) <= Config.YEAR_FILTER_LIMIT]
            return filtered_years
        except FileNotFoundError:
            return []