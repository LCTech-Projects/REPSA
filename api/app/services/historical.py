import pandas as pd
import os
from ..utils.cache import cache

class HistoricalService:
    def __init__(self):
        self.data_dir = os.path.join(os.path.dirname(__file__), '../../data/historical')
    
    @cache.cached(timeout=3600, key_prefix='historical_demand')
    def get_demand_data(self, country, year):
        # Load from CSV or generate if not exists
        file_path = os.path.join(self.data_dir, 'yearly', f'{country}_{year}.csv')
        
        if os.path.exists(file_path):
            df = pd.read_csv(file_path)
        else:
            # Generate using your existing functions
            df = self._generate_historical_data(country, year)
        
        return self._format_response(df)
    
    def _generate_historical_data(self, country, year):
        # Use your existing synthetic demand function
        from your_existing_module import generate_synthetic_demand
        return generate_synthetic_demand(
            "path_to_owid_data.csv",
            "path_to_model.pkl",
            country,
            year
        )
    
    def _format_response(self, df):
        # Convert DataFrame to API-friendly format
        if len(df) == 24:  # Daily data
            return df.to_dict('records')
        else:  # Yearly data - return aggregated view
            return {
                'yearly_summary': {
                    'total_demand': float(df['electricity_demand_MWh'].sum()),
                    'avg_daily_demand': float(df['electricity_demand_MWh'].mean()),
                    'peak_demand': float(df['electricity_demand_MWh'].max())
                },
                'monthly_breakdown': self._get_monthly_breakdown(df),
                'hourly_patterns': self._get_hourly_patterns(df)
            }