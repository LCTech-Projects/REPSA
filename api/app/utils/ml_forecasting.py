"""
ML-based Forecasting for Policy Analysis

This module provides machine learning models for forecasting annual energy metrics
across African countries. It trains separate models for each forecast variable:
- Renewable energy share
- Electricity demand
- CO2 emissions intensity
- Energy poverty
- Per-capita electricity consumption
- Clean cooking access

The models use historical country data to learn patterns and can be used for
baseline forecasts, which are then adjusted by policy interventions.
"""

import os
import pandas as pd
import numpy as np
import joblib
from typing import Dict, List, Optional, Tuple, Any
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, mean_absolute_percentage_error
from app.utils.config import Config


class MLForecaster:
    """
    Machine Learning-based forecaster for annual energy metrics.
    
    Trains separate models for each forecast variable using historical
    country data across all African countries.
    """
    
    def __init__(self, data_path: Optional[str] = None, model_dir: Optional[str] = None):
        """
        Initialize ML Forecaster.
        
        Parameters:
        -----------
        data_path : str, optional
            Path to yearly historical data CSV. Defaults to Config.DATA_DIR.
        model_dir : str, optional
            Directory to save/load models. Defaults to Config.MODEL_DIR.
        """
        self.data_path = data_path or os.path.join(Config.DATA_DIR, 'historical', 'yearly_historical_data.csv')
        self.model_dir = model_dir or Config.MODEL_DIR
        
        # Ensure model directory exists
        os.makedirs(self.model_dir, exist_ok=True)
        
        # Models for each forecast variable
        self.models = {}
        self.feature_columns = []
        self.target_columns = [
            'renewables_share_elec',
            'electricity_demand (TWh)',
            'carbon_intensity_elec',
            'energy_poverty_electricity (% of total population)',
            'electricity_demand_per_capita (kWh)',
            'electricity_demand_per_capita_with_access (kWh)',
            'Access to Clean Fuels and Technologies for cooking (% of total population)'
        ]
        
        # Model file paths
        self.model_paths = {
            'renewables_share_elec': os.path.join(self.model_dir, 'forecast_renewable_share.pkl'),
            'electricity_demand (TWh)': os.path.join(self.model_dir, 'forecast_demand.pkl'),
            'carbon_intensity_elec': os.path.join(self.model_dir, 'forecast_co2.pkl'),
            'energy_poverty_electricity (% of total population)': os.path.join(self.model_dir, 'forecast_poverty.pkl'),
            'electricity_demand_per_capita (kWh)': os.path.join(self.model_dir, 'forecast_per_capita.pkl'),
            'electricity_demand_per_capita_with_access (kWh)': os.path.join(self.model_dir, 'forecast_per_capita_access.pkl'),
            'Access to Clean Fuels and Technologies for cooking (% of total population)': os.path.join(self.model_dir, 'forecast_clean_cooking.pkl')
        }
        
        self.data = None
        self._load_data()
    
    def _load_data(self):
        """Load historical data."""
        try:
            if os.path.exists(self.data_path):
                self.data = pd.read_csv(self.data_path)
                print(f"✅ Loaded {len(self.data)} rows from {self.data_path}")
            else:
                print(f"⚠️  Data file not found: {self.data_path}")
                self.data = pd.DataFrame()
        except Exception as e:
            print(f"⚠️  Error loading data: {e}")
            self.data = pd.DataFrame()
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features for ML models.
        
        Features:
        - year (normalized)
        - population (log scale for stability)
        - electricity_access_rate
        - lagged values (previous year's target variable)
        - country indicators (optional, could use one-hot encoding)
        """
        features_df = df.copy()
        
        # Normalize year (0-1 range)
        min_year = features_df['year'].min()
        max_year = features_df['year'].max()
        features_df['year_normalized'] = (features_df['year'] - min_year) / (max_year - min_year) if max_year > min_year else 0
        
        # Log transform population for stability
        features_df['log_population'] = np.log1p(features_df['population'])
        
        # Access rate
        features_df['access_rate'] = features_df.get('Access to electricity (% of total population)', 0)
        
        # Add lagged features (previous year's value) for each target
        for target_col in self.target_columns:
            if target_col in features_df.columns:
                lag_col = f'{target_col}_lag1'
                features_df[lag_col] = features_df.groupby('country')[target_col].shift(1)
        
        # Select feature columns
        feature_cols = ['year_normalized', 'log_population', 'access_rate']
        
        # Add lagged features that exist
        for target_col in self.target_columns:
            lag_col = f'{target_col}_lag1'
            if lag_col in features_df.columns:
                feature_cols.append(lag_col)
        
        self.feature_columns = feature_cols
        return features_df[feature_cols + ['country', 'year']]
    
    def train_models(self, test_size: float = 0.2, random_state: int = 42) -> Dict[str, Dict[str, float]]:
        """
        Train ML models for all forecast variables.
        
        Parameters:
        -----------
        test_size : float
            Proportion of data for testing (default: 0.2)
        random_state : int
            Random seed for reproducibility
        
        Returns:
        --------
        dict
            Dictionary with training metrics for each model
        """
        if self.data is None or self.data.empty:
            print("⚠️  No data available for training")
            return {}
        
        print("\n" + "="*70)
        print("TRAINING ML FORECASTING MODELS")
        print("="*70)
        
        # Prepare features
        features_df = self._prepare_features(self.data)
        
        # Remove rows with missing features or targets
        valid_rows = features_df.notna().all(axis=1)
        for target_col in self.target_columns:
            if target_col in self.data.columns:
                valid_rows = valid_rows & self.data[target_col].notna()
        
        features_clean = features_df[valid_rows].copy()
        data_clean = self.data[valid_rows].copy()
        
        if len(features_clean) < 100:
            print(f"⚠️  Insufficient data for training ({len(features_clean)} rows)")
            return {}
        
        print(f"📊 Training on {len(features_clean)} country-year observations")
        print(f"📊 Features: {', '.join(self.feature_columns)}")
        
        X = features_clean[self.feature_columns].values
        metrics = {}
        
        # Train a model for each target variable
        for target_col in self.target_columns:
            if target_col not in data_clean.columns:
                print(f"⚠️  Skipping {target_col}: column not found")
                continue
            
            y = data_clean[target_col].values
            
            # Remove any remaining NaN values
            valid_mask = ~(np.isnan(X).any(axis=1) | np.isnan(y))
            X_clean = X[valid_mask]
            y_clean = y[valid_mask]
            
            if len(X_clean) < 50:
                print(f"⚠️  Insufficient data for {target_col}: {len(X_clean)} rows")
                continue
            
            print(f"\n📈 Training model for: {target_col}")
            print(f"   Data points: {len(X_clean)}")
            
            # Train/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X_clean, y_clean, test_size=test_size, random_state=random_state, shuffle=True
            )
            
            # Train Gradient Boosting model
            model = GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=5,
                subsample=0.8,
                random_state=random_state,
                verbose=0
            )
            
            model.fit(X_train, y_train)
            
            # Evaluate
            train_pred = model.predict(X_train)
            test_pred = model.predict(X_test)
            
            train_metrics = {
                'R2': r2_score(y_train, train_pred),
                'RMSE': np.sqrt(mean_squared_error(y_train, train_pred)),
                'MAE': mean_absolute_error(y_train, train_pred),
                'MAPE': mean_absolute_percentage_error(y_train, train_pred) * 100
            }
            
            test_metrics = {
                'R2': r2_score(y_test, test_pred),
                'RMSE': np.sqrt(mean_squared_error(y_test, test_pred)),
                'MAE': mean_absolute_error(y_test, test_pred),
                'MAPE': mean_absolute_percentage_error(y_test, test_pred) * 100
            }
            
            print(f"   Train R²: {train_metrics['R2']:.4f}, Test R²: {test_metrics['R2']:.4f}")
            print(f"   Train RMSE: {train_metrics['RMSE']:.2f}, Test RMSE: {test_metrics['RMSE']:.2f}")
            
            # Save model
            model_path = self.model_paths[target_col]
            joblib.dump(model, model_path)
            print(f"   ✅ Model saved to: {model_path}")
            
            self.models[target_col] = model
            metrics[target_col] = {
                'train': train_metrics,
                'test': test_metrics
            }
        
        print("\n" + "="*70)
        print("TRAINING COMPLETE")
        print("="*70)
        
        return metrics
    
    def load_models(self) -> bool:
        """
        Load pre-trained models from disk.
        
        Returns:
        --------
        bool
            True if models loaded successfully, False otherwise
        """
        loaded_count = 0
        for target_col, model_path in self.model_paths.items():
            if os.path.exists(model_path):
                try:
                    self.models[target_col] = joblib.load(model_path)
                    loaded_count += 1
                except Exception as e:
                    print(f"⚠️  Error loading {target_col} model: {e}")
        
        if loaded_count > 0:
            print(f"✅ Loaded {loaded_count}/{len(self.model_paths)} forecasting models")
            return True
        else:
            print("⚠️  No pre-trained models found. Train models first.")
            return False
    
    def forecast(
        self,
        country: str,
        start_year: int,
        end_year: int,
        historical_data: Optional[pd.DataFrame] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Generate ML-based forecasts for a country.
        
        Parameters:
        -----------
        country : str
            Country name
        start_year : int
            Start year for forecast
        end_year : int
            End year for forecast
        historical_data : pd.DataFrame, optional
            Historical data for the country (if not provided, uses self.data)
        
        Returns:
        --------
        dict
            Dictionary with forecasts for each variable
        """
        if not self.models:
            if not self.load_models():
                print("⚠️  No models available. Returning empty forecasts.")
                return self._empty_forecast(start_year, end_year)
        
        # Use provided data or load from self.data
        if historical_data is None:
            historical_data = self.data
        
        if historical_data is None or historical_data.empty:
            print("⚠️  No historical data available")
            return self._empty_forecast(start_year, end_year)
        
        # Filter country data
        country_data = historical_data[
            historical_data['country'].str.lower() == country.lower()
        ].copy()
        
        if country_data.empty:
            print(f"⚠️  No data found for {country}")
            return self._empty_forecast(start_year, end_year)
        
        # Get latest year of data
        latest_year = country_data['year'].max()
        latest_data = country_data[country_data['year'] == latest_year].iloc[0]
        
        # Prepare features for forecasting
        forecasts = {}
        
        # For each target variable, generate forecasts
        for target_col in self.target_columns:
            if target_col not in self.models:
                continue
            
            model = self.models[target_col]
            forecast_list = []
            
            # Get last known value for lagged feature
            last_value = latest_data.get(target_col, 0)
            last_population = latest_data.get('population', 1)
            last_access = latest_data.get('Access to electricity (% of total population)', 50)
            
            # Generate forecasts year by year
            for year in range(start_year, end_year + 1):
                # Prepare features for this year
                # Estimate population growth (simple exponential)
                years_ahead = year - latest_year
                if years_ahead > 0:
                    # Assume 2% population growth (could be improved)
                    estimated_population = last_population * (1.02 ** years_ahead)
                    estimated_access = min(100, last_access * (1.01 ** years_ahead))  # Slow access growth
                else:
                    estimated_population = last_population
                    estimated_access = last_access
                
                # Normalize year (use same normalization as training)
                min_year = historical_data['year'].min()
                max_year = historical_data['year'].max()
                year_normalized = (year - min_year) / (max_year - min_year) if max_year > min_year else 0.5
                
                # Build feature vector
                features = np.array([[
                    year_normalized,
                    np.log1p(estimated_population),
                    estimated_access,
                    last_value  # Lagged value
                ]])
                
                # Predict
                try:
                    prediction = model.predict(features)[0]
                    
                    # Apply constraints
                    if 'share' in target_col.lower() or 'access' in target_col.lower() or 'poverty' in target_col.lower():
                        prediction = max(0, min(100, prediction))
                    elif 'demand' in target_col.lower() or 'per_capita' in target_col.lower():
                        prediction = max(0, prediction)
                    
                    forecast_list.append({
                        'year': year,
                        'value': round(float(prediction), 2)
                    })
                    
                    # Update last_value for next iteration (use prediction as lag)
                    last_value = prediction
                    
                except Exception as e:
                    print(f"⚠️  Error forecasting {target_col} for {year}: {e}")
                    # Fallback: use last known value
                    forecast_list.append({
                        'year': year,
                        'value': round(float(last_value), 2)
                    })
            
            # Map to forecast dictionary keys
            if target_col == 'renewables_share_elec':
                forecasts['renewable_share'] = forecast_list
            elif target_col == 'electricity_demand (TWh)':
                forecasts['electricity_demand'] = forecast_list
            elif target_col == 'carbon_intensity_elec':
                forecasts['co2_emissions'] = forecast_list
            elif target_col == 'energy_poverty_electricity (% of total population)':
                forecasts['energy_poverty'] = forecast_list
            elif target_col == 'electricity_demand_per_capita (kWh)':
                forecasts['electricity_per_capita'] = forecast_list
            elif target_col == 'electricity_demand_per_capita_with_access (kWh)':
                forecasts['electricity_per_capita_with_access'] = forecast_list
            elif target_col == 'Access to Clean Fuels and Technologies for cooking (% of total population)':
                forecasts['clean_cooking_access'] = forecast_list
        
        return forecasts
    
    def _empty_forecast(self, start_year: int, end_year: int) -> Dict[str, List[Dict[str, Any]]]:
        """Return empty forecast structure."""
        return {
            'renewable_share': [],
            'electricity_demand': [],
            'co2_emissions': [],
            'energy_poverty': [],
            'electricity_per_capita': [],
            'electricity_per_capita_with_access': [],
            'clean_cooking_access': []
        }


def train_forecasting_models(data_path: Optional[str] = None, model_dir: Optional[str] = None) -> Dict[str, Dict[str, float]]:
    """
    Convenience function to train all forecasting models.
    
    Parameters:
    -----------
    data_path : str, optional
        Path to yearly historical data CSV
    model_dir : str, optional
        Directory to save models
    
    Returns:
    --------
    dict
        Training metrics for all models
    """
    forecaster = MLForecaster(data_path=data_path, model_dir=model_dir)
    return forecaster.train_models()


if __name__ == "__main__":
    # Example usage
    print("Training ML forecasting models...")
    metrics = train_forecasting_models()
    print("\nTraining complete!")
    print(f"Trained {len(metrics)} models")
