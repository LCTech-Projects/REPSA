import pandas as pd
import os
import tempfile
from typing import List, Dict, Any
from app.utils.config import Config
from app.utils.cache import cache

class HourlyElectricityDemandService:
    def __init__(self):
        self.data_dir = Config.DATA_DIR
        self.hourly_data_path = os.path.join(self.data_dir, 'historical', 'hourly')
    
    def _load_country_data(self, country: str) -> pd.DataFrame:
        """Load hourly data for a specific country"""
        country_file = os.path.join(self.hourly_data_path, f"{country}.csv")
        
        if not os.path.exists(country_file):
            raise FileNotFoundError(f"Hourly data file not found for country: {country} at {country_file}")
        
        df = pd.read_csv(country_file)
        # Convert datetime column to datetime object
        df['datetime'] = pd.to_datetime(df['datetime'])
        return df
    
    @cache.memoize(timeout=3600)
    def get_hourly_demand_by_date(self, country: str, date: str) -> List[Dict[str, Any]]:
        """
        Get hourly electricity demand data for a specific date
        Returns: [{datetime, electricity_demand_MWh, electricity_demand_per_capita_kWh, electricity_demand_per_capita_with_access_kWh}]
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
                'electricity_demand_per_capita_kWh': float(row['electricity_demand_per_capita_kWh']) if pd.notna(row['electricity_demand_per_capita_kWh']) else None,
                'electricity_demand_per_capita_with_access_kWh': float(row['electricity_demand_per_capita_with_access_kWh']) if pd.notna(row['electricity_demand_per_capita_with_access_kWh']) else None
            })
        
        # Sort by datetime
        result.sort(key=lambda x: x['datetime'])
        
        return result
    
    @cache.memoize(timeout=3600)
    def get_hourly_demand_by_year(self, country: str, year: int) -> List[Dict[str, Any]]:
        """
        Get hourly electricity demand data for a specific year
        Returns: [{datetime, electricity_demand_MWh, electricity_demand_per_capita_kWh, electricity_demand_per_capita_with_access_kWh}]
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
                'electricity_demand_per_capita_kWh': float(row['electricity_demand_per_capita_kWh']) if pd.notna(row['electricity_demand_per_capita_kWh']) else None,
                'electricity_demand_per_capita_with_access_kWh': float(row['electricity_demand_per_capita_with_access_kWh']) if pd.notna(row['electricity_demand_per_capita_with_access_kWh']) else None
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
        countries = [os.path.splitext(f)[0] for f in csv_files]
        return sorted(countries)
    
    def get_available_years(self, country: str) -> List[int]:
        """Get list of available years for a country"""
        try:
            df = self._load_country_data(country)
            return sorted(df['datetime'].dt.year.unique().tolist())
        except FileNotFoundError:
            return []