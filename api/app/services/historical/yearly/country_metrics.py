import pandas as pd
import os
from typing import Dict, Any, Optional, List
from app.utils.config import Config
from app.utils.cache import cache

class CountryMetricsService:
    def __init__(self):
        self.data_dir = Config.DATA_DIR
        self.yearly_data_path = os.path.join(self.data_dir, 'historical', 'yearly_historical_data.csv')
    
    def _load_yearly_data(self) -> pd.DataFrame:
        """Load the yearly historical data CSV"""
        if not os.path.exists(self.yearly_data_path):
            raise FileNotFoundError(f"Yearly data file not found at {self.yearly_data_path}")
        
        return pd.read_csv(self.yearly_data_path)
    
    def _normalize_country_name(self, df: pd.DataFrame, country: str) -> pd.DataFrame:
        """Normalize country name for matching"""
        country_normalized = country.lower().strip()
        df['country_normalized'] = df['country'].str.lower().str.strip()
        filtered = df[df['country_normalized'] == country_normalized].copy()
        filtered = filtered.drop('country_normalized', axis=1)
        return filtered
    
    @cache.memoize(timeout=3600)
    def get_country_summary(self, country: str, year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Get summary metrics for a country (for hover popup)
        Returns: {country, year, electricity_access, renewable_share, energy_poverty}
        """
        df = self._load_yearly_data()
        
        # Filter by country
        country_data = self._normalize_country_name(df, country)
        
        if country_data.empty:
            return None
        
        # Use latest year if not specified
        if year is None:
            year = int(country_data['year'].max())
        
        year_data = country_data[country_data['year'] == year]
        
        if year_data.empty:
            return None
        
        row = year_data.iloc[0]
        
        return {
            'country': row['country'],
            'year': int(row['year']),
            'electricity_access': float(row['Access to electricity (% of total population)']) if pd.notna(row.get('Access to electricity (% of total population)')) else None,
            'renewable_share': float(row['renewables_share_elec']) if pd.notna(row.get('renewables_share_elec')) else None,
            'energy_poverty': float(row['energy_poverty_electricity (% of total population)']) if pd.notna(row.get('energy_poverty_electricity (% of total population)')) else None,
        }
    
    @cache.memoize(timeout=3600)
    def get_country_detailed_metrics(self, country: str, start_year: Optional[int] = None, end_year: Optional[int] = None, selected_year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Get all detailed metrics for a country (for dashboard drawer)
        Returns comprehensive country data with all metrics
        """
        df = self._load_yearly_data()
        
        # Filter by country
        country_data = self._normalize_country_name(df, country)
        
        if country_data.empty:
            return None
        
        # Filter by year range if provided
        if start_year:
            country_data = country_data[country_data['year'] >= start_year]
        if end_year:
            country_data = country_data[country_data['year'] <= end_year]
        
        if country_data.empty:
            return None
        
        # Get selected year data for key figures (or latest if not specified)
        if selected_year:
            year_for_key_figures = selected_year
        else:
            year_for_key_figures = int(country_data['year'].max())
        
        year_data = country_data[country_data['year'] == year_for_key_figures]
        if year_data.empty:
            # Fallback to latest year if selected year not found
            year_for_key_figures = int(country_data['year'].max())
            year_data = country_data[country_data['year'] == year_for_key_figures]
        
        if year_data.empty:
            return None
        
        latest_data = year_data.iloc[0]
        
        # Get region and income group (from first available row)
        first_row = country_data.iloc[0]
        
        # Prepare time series data
        time_series = []
        for _, row in country_data.iterrows():
            time_series.append({
                'year': int(row['year']),
                'electricity_demand': float(row['electricity_demand (TWh)']) if pd.notna(row.get('electricity_demand (TWh)')) else None,
                'electricity_generation': float(row['electricity_generation (TWh)']) if pd.notna(row.get('electricity_generation (TWh)')) else None,
                'electricity_demand_per_capita': float(row['electricity_demand_per_capita (kWh)']) if pd.notna(row.get('electricity_demand_per_capita (kWh)')) else None,
                'electricity_demand_per_capita_with_access': float(row['electricity_demand_per_capita_with_access (kWh)']) if pd.notna(row.get('electricity_demand_per_capita_with_access (kWh)')) else None,
                'population': float(row['population']) if pd.notna(row.get('population')) else None,
                'clean_cooking_access': float(row['Access to Clean Fuels and Technologies for cooking (% of total population)']) if pd.notna(row.get('Access to Clean Fuels and Technologies for cooking (% of total population)')) else None,
                'energy_poverty': float(row['energy_poverty_electricity (% of total population)']) if pd.notna(row.get('energy_poverty_electricity (% of total population)')) else None,
                'energy_poverty_multidimensional': float(row['energy_poverty_multidimensional (% of total population)']) if pd.notna(row.get('energy_poverty_multidimensional (% of total population)')) else None,
                'energy_poverty_rural': float(row['energy_poverty_electricity_rural (% of rural population)']) if pd.notna(row.get('energy_poverty_electricity_rural (% of rural population)')) else None,
                'energy_poverty_urban': float(row['energy_poverty_electricity_urban (% of urban population)']) if pd.notna(row.get('energy_poverty_electricity_urban (% of urban population)')) else None,
                'carbon_intensity': float(row['carbon_intensity_elec']) if pd.notna(row.get('carbon_intensity_elec')) else None,
                'renewable_share': float(row['renewables_share_elec']) if pd.notna(row.get('renewables_share_elec')) else None,
                'solar_electricity': float(row['solar_electricity']) if pd.notna(row.get('solar_electricity')) else None,
                'wind_electricity': float(row['wind_electricity']) if pd.notna(row.get('wind_electricity')) else None,
                'hydro_electricity': float(row['hydro_electricity']) if pd.notna(row.get('hydro_electricity')) else None,
                'fossil_share': float(row['fossil_share_elec']) if pd.notna(row.get('fossil_share_elec')) else None,
                'electricity_access': float(row['Access to electricity (% of total population)']) if pd.notna(row.get('Access to electricity (% of total population)')) else None,
            })
        
        # Remove duplicates by year (keep last entry for each year)
        seen_years = {}
        for entry in time_series:
            year = entry['year']
            seen_years[year] = entry
        time_series = list(seen_years.values())
        
        # Sort by year
        time_series.sort(key=lambda x: x['year'])
        
        return {
            'country': first_row['country'],
            'iso_code': first_row.get('iso_code', ''),
            'key_figures': {
                'electricity_access': float(latest_data['Access to electricity (% of total population)']) if pd.notna(latest_data.get('Access to electricity (% of total population)')) else None,
                'population': float(latest_data['population']) if pd.notna(latest_data.get('population')) else None,
                'energy_poverty': float(latest_data['energy_poverty_electricity (% of total population)']) if pd.notna(latest_data.get('energy_poverty_electricity (% of total population)')) else None,
            },
            'time_series': time_series,
        }
    
    @cache.memoize(timeout=3600)
    def get_available_years(self) -> List[int]:
        """Get list of available years in the dataset"""
        df = self._load_yearly_data()
        years = sorted(df['year'].unique().tolist())
        return [int(year) for year in years]
    
    @cache.memoize(timeout=3600)
    def get_latest_year(self) -> int:
        """Get the latest year available in the dataset"""
        df = self._load_yearly_data()
        return int(df['year'].max())
    
    @cache.memoize(timeout=3600)
    def get_all_countries_energy_poverty(self, year: Optional[int] = None) -> Dict[str, Optional[float]]:
        """
        Get energy poverty for all countries for a specific year (for map coloring)
        Returns: {country_name: energy_poverty_value or None}
        """
        df = self._load_yearly_data()
        
        # Use latest year if not specified
        if year is None:
            year = int(df['year'].max())
        
        year_data = df[df['year'] == year].copy()
        
        if year_data.empty:
            return {}
        
        result = {}
        for _, row in year_data.iterrows():
            country_name = row['country']
            energy_poverty = row.get('energy_poverty_electricity (% of total population)')
            result[country_name] = float(energy_poverty) if pd.notna(energy_poverty) else None
        
        return result

