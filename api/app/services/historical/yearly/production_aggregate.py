import pandas as pd
import os
import tempfile
from typing import List, Dict, Any, Optional
from app.utils.config import Config
from app.utils.cache import cache

class ProductionAggregateService:
    def __init__(self):
        self.data_dir = Config.DATA_DIR
        self.yearly_data_path = os.path.join(self.data_dir, 'historical', 'yearly_historical_data.csv')
    
    def _load_yearly_data(self) -> pd.DataFrame:
        """Load the yearly historical data CSV"""
        if not os.path.exists(self.yearly_data_path):
            raise FileNotFoundError(f"Yearly data file not found at {self.yearly_data_path}")
        
        return pd.read_csv(self.yearly_data_path)
    
    @cache.memoize(timeout=3600)
    def get_production_aggregate_by_year(self, year: int, country: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get production aggregate data for a specific year
        Returns: [{country, year, electricity_generation, electricity_demand, electricity_production_aggregate}]
        """
        df = self._load_yearly_data()
        
        # Filter by year
        year_data = df[df['year'] == year].copy()
        
        # Filter by country if specified
        if country:
            country_normalized = country.lower().strip()
            year_data['country_normalized'] = year_data['country'].str.lower().str.strip()
            year_data = year_data[year_data['country_normalized'] == country_normalized]
            year_data = year_data.drop('country_normalized', axis=1)
        
        if year_data.empty:
            return []
        
        # Convert to required format
        result = []
        for _, row in year_data.iterrows():
            result.append({
                'country': row['country'],
                'year': int(row['year']),
                'electricity_generation': float(row['electricity_generation (TWh)']) if pd.notna(row.get('electricity_generation (TWh)')) else None,
                'electricity_demand': float(row['electricity_demand (TWh)']) if pd.notna(row.get('electricity_demand (TWh)')) else None,
                'electricity_production_aggregate': float(row['electricity_production_aggregate (TWh)']) if pd.notna(row.get('electricity_production_aggregate (TWh)')) else None
            })
        
        return result
    
    @cache.memoize(timeout=3600)
    def get_production_aggregate_by_range(self, start_year: int, end_year: int, country: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get production aggregate data for a year range
        Returns: [{country, data: [{year, electricity_generation, electricity_demand, electricity_production_aggregate}]}]
        """
        df = self._load_yearly_data()
        
        # Filter by year range
        range_data = df[(df['year'] >= start_year) & (df['year'] <= end_year)].copy()
        
        # Filter by country if specified
        if country:
            country_normalized = country.lower().strip()
            range_data['country_normalized'] = range_data['country'].str.lower().str.strip()
            range_data = range_data[range_data['country_normalized'] == country_normalized]
            range_data = range_data.drop('country_normalized', axis=1)
        
        if range_data.empty:
            return []
        
        # Group by country and format data
        result = []
        for country_name in range_data['country'].unique():
            country_data = range_data[range_data['country'] == country_name]
            
            yearly_data = []
            for _, row in country_data.iterrows():
                yearly_data.append({
                    'year': int(row['year']),
                    'electricity_generation': float(row['electricity_generation (TWh)']) if pd.notna(row.get('electricity_generation (TWh)')) else None,
                    'electricity_demand': float(row['electricity_demand (TWh)']) if pd.notna(row.get('electricity_demand (TWh)')) else None,
                    'electricity_production_aggregate': float(row['electricity_production_aggregate (TWh)']) if pd.notna(row.get('electricity_production_aggregate (TWh)')) else None
                })
            
            # Sort by year
            yearly_data.sort(key=lambda x: x['year'])
            
            result.append({
                'country': country_name,
                'data': yearly_data
            })
        
        # Sort countries alphabetically
        result.sort(key=lambda x: x['country'])
        
        return result
    
    def export_production_aggregate_by_year_to_csv(self, year: int, country: Optional[str] = None) -> str:
        """
        Export production aggregate data for a specific year to CSV
        Returns path to temporary CSV file
        """
        data = self.get_production_aggregate_by_year(year, country)
        
        if not data:
            raise ValueError(f"No data found for year {year}" + (f" and country {country}" if country else ""))
        
        # Convert to DataFrame for CSV export
        df = pd.DataFrame(data)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        df.to_csv(temp_file.name, index=False)
        
        return temp_file.name
    
    def export_production_aggregate_by_range_to_csv(self, start_year: int, end_year: int, country: Optional[str] = None) -> str:
        """
        Export production aggregate data for a year range to CSV
        Returns path to temporary CSV file
        """
        data = self.get_production_aggregate_by_range(start_year, end_year, country)
        
        if not data:
            raise ValueError(f"No data found for range {start_year}-{end_year}" + (f" and country {country}" if country else ""))
        
        # Flatten the nested structure for CSV export
        flattened_data = []
        for country_data in data:
            for year_data in country_data['data']:
                flattened_data.append({
                    'country': country_data['country'],
                    'year': year_data['year'],
                    'electricity_generation': year_data['electricity_generation'],
                    'electricity_demand': year_data['electricity_demand'],
                    'electricity_production_aggregate': year_data['electricity_production_aggregate']
                })
        
        # Convert to DataFrame for CSV export
        df = pd.DataFrame(flattened_data)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        df.to_csv(temp_file.name, index=False)
        
        return temp_file.name