import pandas as pd
from config import Config

class DataStore:
    _yearly_data = None  # Separate cache for yearly data
    _hourly_data = None  # Separate cache for hourly data
    
    @classmethod
    def load_yearly_elec_data(cls):
        if cls._yearly_data is None:
            cls._yearly_data = pd.read_csv(Config.DATA_PATH1)
        return cls._yearly_data
    
    @classmethod
    def load_hourly_elec_data(cls):
        if cls._hourly_data is None:
            cls._hourly_data = pd.read_csv(Config.DATA_PATH2)
        return cls._hourly_data
    
    @classmethod
    def filter_hourly_elec_data(cls, country=None, year=None):
        df = cls.load_hourly_elec_data().copy()  # Work with a copy

        if country:
            df = df[df['Country'] == country]

        if year:
            try:
                year = int(year)
                df['Datetime'] = pd.to_datetime(df['Datetime'], errors='coerce')
                df = df[df['Datetime'].dt.year == year]
            except ValueError:
                pass
            
        if not df.empty:
            if 'Datetime' in df.columns:
                df['Datetime'] = df['Datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
            return df.replace({pd.NA: None}).to_dict('records')
        return []
    
    @classmethod
    def filter_yearly_elec_data(cls, country=None, year=None):
        df = cls.load_yearly_elec_data().copy()  # Work with a copy

        if country:
            df = df[df['country'] == country]

        if year:
            try:
                year = int(year)
                df['year'] = pd.to_numeric(df['year'], errors='coerce').astype('Int64')
                df = df[df['year'] == year]
            except ValueError:
                pass

        if not df.empty:
            return df.replace({pd.NA: None}).to_dict('records')
        return []
    
    @classmethod
    def clear_cache(cls):
        """Clear all cached data"""
        cls._yearly_data = None
        cls._hourly_data = None
        cls._sa_data = None