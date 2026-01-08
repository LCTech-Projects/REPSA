import re
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from app.utils.config import Config
import os

# Optional NLP support - gracefully handles if not installed
try:
    from app.services.story_mode.nlp_extractor import HybridExtractor
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False
    HybridExtractor = None


class PolicyAnalyzer:
    """
    Analyzes policy documents using regex pattern matching (with optional 
    transformer-based NLP for improved accuracy) and generates forecasts using 
    statistical models based on historical data.
    """
    
    def __init__(self, use_nlp: Optional[bool] = None, nlp_backend: Optional[str] = None):
        """
        Initialize PolicyAnalyzer.
        
        Parameters:
        -----------
        use_nlp : bool, optional
            Whether to use transformer-based NLP for extraction.
            If None, reads from Config.USE_NLP (environment variable).
        nlp_backend : str, optional
            NLP backend to use: "spacy", "openai", or "anthropic".
            If None, reads from Config.NLP_BACKEND (environment variable).
        """
        try:
            self.data_dir = Config.DATA_DIR
            self.yearly_data_path = os.path.join(self.data_dir, 'historical', 'yearly_historical_data.csv')
            self.historical_data = None
            self._load_historical_data()
        except Exception as e:
            # If initialization fails, set empty DataFrame
            self.historical_data = pd.DataFrame()
            self.data_dir = None
            self.yearly_data_path = None
        
        # Read NLP settings from environment variables if not explicitly provided
        if use_nlp is None:
            use_nlp = Config.USE_NLP
        if nlp_backend is None:
            nlp_backend = Config.NLP_BACKEND
        
        # Initialize NLP extractor if requested and available
        self.use_nlp = use_nlp and NLP_AVAILABLE
        self.nlp_extractor = None
        if self.use_nlp and HybridExtractor:
            try:
                self.nlp_extractor = HybridExtractor(nlp_backend=nlp_backend, use_nlp=True)
                # Only print success if model actually loaded
                if self.nlp_extractor.nlp_extractor and self.nlp_extractor.nlp_extractor.model:
                    print(f"✅ NLP extraction enabled using {nlp_backend} backend")
                else:
                    print(f"⚠️  NLP extractor initialized but model failed to load")
                    print("   Falling back to regex-only extraction.")
                    self.use_nlp = False
            except Exception as e:
                error_msg = str(e)
                if "REGEX" in error_msg or "pydantic" in error_msg.lower():
                    print(f"⚠️  spaCy compatibility issue with Python 3.14")
                    print("   This is a known issue: spaCy uses Pydantic V1 which isn't compatible with Python 3.14+")
                    print("   Solutions:")
                    print("   1. Use Python 3.13 or earlier")
                    print("   2. Wait for spaCy to update (or use regex-only mode)")
                else:
                    print(f"⚠️  NLP extractor initialization failed: {e}")
                print("   Falling back to regex-only extraction.")
                self.use_nlp = False
        elif use_nlp and not NLP_AVAILABLE:
            print("⚠️  NLP requested but not available. Install with: pip install spacy && python -m spacy download en_core_web_trf")
            print("   Falling back to regex-only extraction.")
    
    def _load_historical_data(self):
        """Load historical data for forecasting"""
        try:
            if os.path.exists(self.yearly_data_path):
                self.historical_data = pd.read_csv(self.yearly_data_path)
            else:
                self.historical_data = pd.DataFrame()
        except Exception as e:
            # If loading fails, use empty DataFrame
            self.historical_data = pd.DataFrame()
    
    def extract_policy_metrics(self, policy_text: str) -> Dict[str, Any]:
        """
        Extract key metrics from policy document using regex patterns.
        Optionally uses transformer-based NLP for improved accuracy.
        
        Returns:
            Dictionary with extracted metrics:
            - renewable_target: Target renewable energy share (%)
            - investment_amount: Total investment (USD)
            - timeline_start: Start year
            - timeline_end: End year
            - solar_target: Solar capacity target (GW)
            - wind_target: Wind capacity target (GW)
            - energy_access_target: Electricity access target (%)
            - energy_poverty_target: Energy poverty reduction target (%)
            - co2_reduction_target: CO2 reduction target (%)
        """
        # Use hybrid extraction if NLP is enabled
        if self.use_nlp and self.nlp_extractor:
            return self.nlp_extractor.extract(policy_text, self._extract_with_regex)
        
        # Otherwise use regex only
        return self._extract_with_regex(policy_text)
    
    def _extract_with_regex(self, policy_text: str) -> Dict[str, Any]:
        """
        Extract metrics using regex patterns (original implementation).
        """
        text = policy_text.lower()
        metrics = {
            'renewable_target': None,
            'investment_amount': None,
            'timeline_start': None,
            'timeline_end': None,
            'solar_target': None,
            'wind_target': None,
            'energy_access_target': None,
            'energy_poverty_target': None,
            'co2_reduction_target': None,
            'clean_cooking_target': None,
            'population_growth_rate': None,
        }
        
        # Extract renewable energy target (e.g., "60% renewable", "85% by 2050")
        renewable_patterns = [
            r'(\d+(?:\.\d+)?)\s*%\s*(?:renewable|renewables)',
            r'renewable\s*(?:energy\s*)?(?:share|target|goal).*?(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*renewable.*?(?:by|in)\s*(\d{4})',
        ]
        for pattern in renewable_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['renewable_target'] = float(match.group(1))
                if len(match.groups()) > 1 and match.group(2):
                    metrics['timeline_end'] = int(match.group(2))
                break
        
        # Extract investment amounts (e.g., "$45 billion", "$18B", "45 billion dollars")
        investment_patterns = [
            r'\$(\d+(?:\.\d+)?)\s*(?:billion|b|million|m)\b',
            r'(\d+(?:\.\d+)?)\s*(?:billion|billion\s*dollars|b)\s*(?:investment|invest|funding)',
        ]
        for pattern in investment_patterns:
            match = re.search(pattern, text)
            if match:
                amount = float(match.group(1))
                if 'million' in match.group(0) or 'm' in match.group(0).lower():
                    amount = amount / 1000  # Convert to billions
                metrics['investment_amount'] = amount
                break
        
        # Extract timeline years
        year_patterns = [
            r'(?:by|in|from|until)\s*(\d{4})',
            r'(\d{4})\s*(?:to|-)\s*(\d{4})',
            r'phase\s*\d+.*?(\d{4})\s*(?:to|-)?\s*(\d{4})?',
        ]
        years_found = []
        for pattern in year_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                if isinstance(match, tuple):
                    years_found.extend([int(y) for y in match if y])
                else:
                    years_found.append(int(match))
        
        if years_found:
            years_found = sorted(set(years_found))
            if len(years_found) >= 2:
                metrics['timeline_start'] = years_found[0]
                metrics['timeline_end'] = years_found[-1]
            elif len(years_found) == 1:
                metrics['timeline_end'] = years_found[0]
        
        # Extract solar capacity target
        solar_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt).*?solar',
            r'solar.*?(\d+(?:\.\d+)?)\s*(?:gw|gigawatt)',
            r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt).*?solar.*?capacity',
        ]
        for pattern in solar_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['solar_target'] = float(match.group(1))
                break
        
        # Extract wind capacity target
        wind_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt).*?wind',
            r'wind.*?(\d+(?:\.\d+)?)\s*(?:gw|gigawatt)',
            r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt).*?wind.*?capacity',
        ]
        for pattern in wind_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['wind_target'] = float(match.group(1))
                break
        
        # Extract energy access target
        access_patterns = [
            r'(\d+(?:\.\d+)?)\s*%\s*(?:electricity\s*)?access',
            r'access.*?(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*access.*?electricity',
        ]
        for pattern in access_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['energy_access_target'] = float(match.group(1))
                break
        
        # Extract energy poverty target
        poverty_patterns = [
            r'energy\s*poverty.*?(\d+(?:\.\d+)?)\s*%',
            r'reduce.*?energy\s*poverty.*?to\s*(\d+(?:\.\d+)?)\s*%',
            r'energy\s*poverty.*?(\d+(?:\.\d+)?)\s*%',
        ]
        for pattern in poverty_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['energy_poverty_target'] = float(match.group(1))
                break
        
        # Extract CO2 reduction target
        co2_patterns = [
            r'co2.*?(\d+(?:\.\d+)?)\s*%',
            r'reduce.*?co2.*?by\s*(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*reduction.*?co2',
        ]
        for pattern in co2_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['co2_reduction_target'] = float(match.group(1))
                break
        
        # Extract clean cooking access target
        clean_cooking_patterns = [
            r'clean\s*cooking.*?(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*clean\s*cooking',
            r'clean\s*cooking.*?target.*?(\d+(?:\.\d+)?)\s*%',
        ]
        for pattern in clean_cooking_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['clean_cooking_target'] = float(match.group(1))
                break
        
        # Extract population growth rate
        growth_patterns = [
            r'population.*?growth.*?(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*population.*?growth',
            r'annual.*?growth.*?(\d+(?:\.\d+)?)\s*%',
        ]
        for pattern in growth_patterns:
            match = re.search(pattern, text)
            if match:
                metrics['population_growth_rate'] = float(match.group(1)) / 100  # Convert to decimal
                break
        
        return metrics
    
    def set_nlp_mode(self, use_nlp: bool, nlp_backend: str = "spacy"):
        """
        Enable or disable NLP-based extraction.
        
        Parameters:
        -----------
        use_nlp : bool
            Whether to use NLP extraction
        nlp_backend : str
            NLP backend: "spacy", "openai", or "anthropic"
        """
        if use_nlp and not NLP_AVAILABLE:
            print("⚠️  NLP not available. Install dependencies: pip install spacy")
            return
        
        self.use_nlp = use_nlp and NLP_AVAILABLE
        if self.use_nlp and HybridExtractor:
            try:
                self.nlp_extractor = HybridExtractor(nlp_backend=nlp_backend, use_nlp=True)
            except Exception as e:
                print(f"⚠️  Failed to initialize NLP extractor: {e}")
                self.use_nlp = False
    
    def generate_baseline_forecast(
        self, 
        country: str, 
        start_year: int, 
        end_year: int
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Generate baseline forecast using historical trends.
        
        Uses simple linear/exponential trend extrapolation based on historical data.
        """
        if self.historical_data is None or self.historical_data.empty:
            return self._generate_default_forecast(start_year, end_year)
        
        # Filter country data
        country_data = self.historical_data[
            self.historical_data['country'].str.lower() == country.lower()
        ].copy()
        
        if country_data.empty:
            return self._generate_default_forecast(start_year, end_year)
        
        # Get latest year of data
        latest_year = country_data['year'].max()
        latest_data = country_data[country_data['year'] == latest_year].iloc[0]
        
        # Calculate trends from last 5 years
        recent_years = country_data[country_data['year'] >= latest_year - 5]
        
        forecasts = {
            'renewable_share': [],
            'electricity_demand': [],
            'co2_emissions': [],
            'energy_poverty': [],
            'electricity_per_capita': [],
            'electricity_per_capita_with_access': [],
            'clean_cooking_access': [],
        }
        
        # Calculate annual growth rates - safely handle missing columns
        if len(recent_years) >= 2:
            renewable_growth = self._calculate_growth_rate(
                recent_years, 'renewables_share_elec'
            )
            demand_growth = self._calculate_growth_rate(
                recent_years, 'electricity_demand (TWh)'
            )
            co2_growth = self._calculate_growth_rate(
                recent_years, 'carbon_intensity_elec'
            )
            poverty_growth = self._calculate_growth_rate(
                recent_years, 'energy_poverty_electricity (% of total population)'
            )
            per_capita_growth = self._calculate_growth_rate(
                recent_years, 'electricity_demand_per_capita (kWh)'
            )
            per_capita_access_growth = self._calculate_growth_rate(
                recent_years, 'electricity_demand_per_capita_with_access (kWh)'
            )
            clean_cooking_growth = self._calculate_growth_rate(
                recent_years, 'Access to Clean Fuels and Technologies for cooking (% of total population)'
            )
        else:
            # Default growth rates if insufficient data
            renewable_growth = 0.02  # 2% per year
            demand_growth = 0.03  # 3% per year
            co2_growth = -0.01  # -1% per year (decreasing)
            poverty_growth = -0.02  # -2% per year (decreasing)
            per_capita_growth = 0.025  # 2.5% per year
            per_capita_access_growth = 0.03  # 3% per year
            clean_cooking_growth = 0.015  # 1.5% per year
        
        # Get baseline values - safely access Series values
        def safe_get(series, key, default):
            """Safely get value from pandas Series or dict"""
            try:
                if isinstance(series, dict):
                    value = series.get(key, default)
                else:
                    # pandas Series - use .get() method which works like dict.get()
                    if key in series.index:
                        value = series[key]
                    else:
                        value = default
                
                # Handle NaN values
                if pd.isna(value) or value is None:
                    return default
                return float(value) if not pd.isna(value) else default
            except (KeyError, IndexError, AttributeError, TypeError, ValueError):
                return default
        
        baseline_renewable = safe_get(latest_data, 'renewables_share_elec', 20)
        baseline_demand = safe_get(latest_data, 'electricity_demand (TWh)', 100)
        baseline_co2 = safe_get(latest_data, 'carbon_intensity_elec', 500)
        baseline_poverty = safe_get(latest_data, 'energy_poverty_electricity (% of total population)', 30)
        baseline_per_capita = safe_get(latest_data, 'electricity_demand_per_capita (kWh)', 1500)
        baseline_per_capita_access = safe_get(latest_data, 'electricity_demand_per_capita_with_access (kWh)', 2000)
        baseline_clean_cooking = safe_get(latest_data, 'Access to Clean Fuels and Technologies for cooking (% of total population)', 45)
        
        # Generate forecasts
        for year in range(start_year, end_year + 1):
            years_ahead = year - latest_year
            
            # Renewable share (exponential growth with cap at 100%)
            renewable_forecast = min(100, baseline_renewable * (1 + renewable_growth) ** years_ahead)
            
            # Electricity demand (exponential growth)
            demand_forecast = baseline_demand * (1 + demand_growth) ** years_ahead
            
            # CO2 emissions (decreasing trend)
            co2_forecast = max(0, baseline_co2 * (1 + co2_growth) ** years_ahead)
            
            # Energy poverty (decreasing trend)
            poverty_forecast = max(0, baseline_poverty * (1 + poverty_growth) ** years_ahead)
            
            # Electricity per capita (increasing)
            per_capita_forecast = baseline_per_capita * (1 + per_capita_growth) ** years_ahead
            
            # Electricity per capita with access (increasing faster)
            per_capita_access_forecast = baseline_per_capita_access * (1 + per_capita_access_growth) ** years_ahead
            
            # Clean cooking access (increasing, capped at 100%)
            clean_cooking_forecast = min(100, baseline_clean_cooking * (1 + clean_cooking_growth) ** years_ahead)
            
            forecasts['renewable_share'].append({
                'year': year,
                'value': round(renewable_forecast, 2)
            })
            forecasts['electricity_demand'].append({
                'year': year,
                'value': round(demand_forecast, 2)
            })
            forecasts['co2_emissions'].append({
                'year': year,
                'value': round(co2_forecast, 2)
            })
            forecasts['energy_poverty'].append({
                'year': year,
                'value': round(poverty_forecast, 2)
            })
            forecasts['electricity_per_capita'].append({
                'year': year,
                'value': round(per_capita_forecast, 2)
            })
            forecasts['electricity_per_capita_with_access'].append({
                'year': year,
                'value': round(per_capita_access_forecast, 2)
            })
            forecasts['clean_cooking_access'].append({
                'year': year,
                'value': round(clean_cooking_forecast, 2)
            })
        
        return forecasts
    
    def _calculate_growth_rate(self, data: pd.DataFrame, column: str) -> float:
        """Calculate average annual growth rate from historical data"""
        if column not in data.columns or len(data) < 2:
            return 0.0
        
        values = data[column].dropna()
        if len(values) < 2:
            return 0.0
        
        years = data.loc[values.index, 'year'].values
        values = values.values
        
        # Calculate CAGR (Compound Annual Growth Rate)
        if values[0] > 0 and values[-1] > 0:
            n_years = years[-1] - years[0]
            if n_years > 0:
                cagr = ((values[-1] / values[0]) ** (1 / n_years)) - 1
                return cagr
        
        return 0.0
    
    def _generate_default_forecast(
        self, 
        start_year: int, 
        end_year: int
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate default forecast when no historical data available"""
        forecasts = {
            'renewable_share': [],
            'electricity_demand': [],
            'co2_emissions': [],
            'energy_poverty': [],
            'electricity_per_capita': [],
            'electricity_per_capita_with_access': [],
            'clean_cooking_access': [],
        }
        
        baseline = {
            'renewable_share': 25,
            'electricity_demand': 150,
            'co2_emissions': 400,
            'energy_poverty': 25,
            'electricity_per_capita': 1500,
            'electricity_per_capita_with_access': 2000,
            'clean_cooking_access': 45,
        }
        
        for year in range(start_year, end_year + 1):
            years_ahead = year - start_year
            for key, base_value in baseline.items():
                if key == 'renewable_share':
                    value = min(100, base_value * (1.02 ** years_ahead))
                elif key == 'electricity_demand':
                    value = base_value * (1.03 ** years_ahead)
                elif key == 'co2_emissions':
                    value = max(0, base_value * (0.99 ** years_ahead))
                elif key == 'energy_poverty':
                    value = max(0, base_value * (0.98 ** years_ahead))
                elif key == 'electricity_per_capita':
                    value = base_value * (1.025 ** years_ahead)
                elif key == 'electricity_per_capita_with_access':
                    value = base_value * (1.03 ** years_ahead)
                else:  # clean_cooking_access
                    value = min(100, base_value * (1.015 ** years_ahead))
                
                forecasts[key].append({
                    'year': year,
                    'value': round(value, 2)
                })
        
        return forecasts
    
    def apply_policy_adjustments(
        self,
        baseline_forecast: Dict[str, List[Dict[str, Any]]],
        policy_metrics: Dict[str, Any],
        target_year: int
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Apply policy-driven adjustments to baseline forecast.
        
        Adjusts forecasts based on extracted policy targets.
        """
        adjusted_forecast = {
            'renewable_share': [],
            'electricity_demand': [],
            'co2_emissions': [],
            'energy_poverty': [],
            'electricity_per_capita': [],
            'electricity_per_capita_with_access': [],
            'clean_cooking_access': [],
        }
        
        # Get baseline values for target year
        baseline_renewable = next(
            (f['value'] for f in baseline_forecast['renewable_share'] if f['year'] == target_year),
            baseline_forecast['renewable_share'][-1]['value'] if baseline_forecast['renewable_share'] else 25
        )
        baseline_demand = next(
            (f['value'] for f in baseline_forecast['electricity_demand'] if f['year'] == target_year),
            baseline_forecast['electricity_demand'][-1]['value'] if baseline_forecast['electricity_demand'] else 150
        )
        baseline_co2 = next(
            (f['value'] for f in baseline_forecast['co2_emissions'] if f['year'] == target_year),
            baseline_forecast['co2_emissions'][-1]['value'] if baseline_forecast['co2_emissions'] else 400
        )
        baseline_poverty = next(
            (f['value'] for f in baseline_forecast['energy_poverty'] if f['year'] == target_year),
            baseline_forecast['energy_poverty'][-1]['value'] if baseline_forecast['energy_poverty'] else 25
        )
        
        # Apply policy adjustments
        target_renewable = policy_metrics.get('renewable_target')
        target_poverty = policy_metrics.get('energy_poverty_target')
        co2_reduction = policy_metrics.get('co2_reduction_target')
        
        # Calculate adjustment factors
        renewable_factor = (target_renewable / baseline_renewable) if target_renewable and baseline_renewable > 0 else 1.0
        poverty_factor = (target_poverty / baseline_poverty) if target_poverty and baseline_poverty > 0 else 1.0
        co2_factor = (1 - co2_reduction / 100) if co2_reduction else 1.0
        
        # Apply gradual adjustments over time
        for forecast_item in baseline_forecast['renewable_share']:
            year = forecast_item['year']
            baseline_value = forecast_item['value']
            
            # Calculate progress toward target (0 to 1)
            start_year = baseline_forecast['renewable_share'][0]['year']
            progress = (year - start_year) / (target_year - start_year) if target_year > start_year else 1.0
            progress = max(0, min(1, progress))
            
            # Apply adjustment
            if target_renewable:
                adjusted_value = baseline_value + (target_renewable - baseline_renewable) * progress
                adjusted_value = max(0, min(100, adjusted_value))
            else:
                adjusted_value = baseline_value
            
            adjusted_forecast['renewable_share'].append({
                'year': year,
                'value': round(adjusted_value, 2)
            })
        
        # Apply similar adjustments to other metrics
        for forecast_item in baseline_forecast['electricity_demand']:
            adjusted_forecast['electricity_demand'].append(forecast_item)
        
        # Copy per capita forecasts (will be adjusted based on access targets)
        for forecast_item in baseline_forecast.get('electricity_per_capita', []):
            adjusted_forecast['electricity_per_capita'].append(forecast_item)
        
        # Adjust per capita with access based on energy access target
        target_access = policy_metrics.get('energy_access_target')
        baseline_access = 72  # Default baseline
        for forecast_item in baseline_forecast.get('electricity_per_capita_with_access', []):
            year = forecast_item['year']
            baseline_value = forecast_item['value']
            start_year = baseline_forecast['electricity_per_capita_with_access'][0]['year'] if baseline_forecast.get('electricity_per_capita_with_access') else start_year
            progress = (year - start_year) / (target_year - start_year) if target_year > start_year else 1.0
            progress = max(0, min(1, progress))
            
            # If access increases, per capita with access should increase proportionally
            if target_access:
                access_factor = 1 + ((target_access - baseline_access) / baseline_access) * progress if baseline_access > 0 else 1.0
                adjusted_value = baseline_value * access_factor
            else:
                adjusted_value = baseline_value
            
            adjusted_forecast['electricity_per_capita_with_access'].append({
                'year': year,
                'value': round(adjusted_value, 2)
            })
        
        # Adjust clean cooking access
        target_clean_cooking = policy_metrics.get('clean_cooking_target')
        baseline_clean_cooking_list = baseline_forecast.get('clean_cooking_access', [])
        baseline_clean_cooking = baseline_clean_cooking_list[-1].get('value', 45) if baseline_clean_cooking_list and len(baseline_clean_cooking_list) > 0 else 45
        for forecast_item in baseline_clean_cooking_list:
            year = forecast_item['year']
            baseline_value = forecast_item['value']
            start_year = baseline_clean_cooking_list[0]['year'] if baseline_clean_cooking_list and len(baseline_clean_cooking_list) > 0 else start_year
            progress = (year - start_year) / (target_year - start_year) if target_year > start_year else 1.0
            progress = max(0, min(1, progress))
            
            if target_clean_cooking:
                adjusted_value = baseline_value + (target_clean_cooking - baseline_clean_cooking) * progress
                adjusted_value = max(0, min(100, adjusted_value))
            else:
                adjusted_value = baseline_value
            
            adjusted_forecast['clean_cooking_access'].append({
                'year': year,
                'value': round(adjusted_value, 2)
            })
        
        for forecast_item in baseline_forecast['co2_emissions']:
            year = forecast_item['year']
            baseline_value = forecast_item['value']
            start_year = baseline_forecast['co2_emissions'][0]['year']
            progress = (year - start_year) / (target_year - start_year) if target_year > start_year else 1.0
            progress = max(0, min(1, progress))
            
            if co2_reduction:
                adjusted_value = baseline_value * (1 - (co2_reduction / 100) * progress)
            else:
                adjusted_value = baseline_value
            
            adjusted_forecast['co2_emissions'].append({
                'year': year,
                'value': round(max(0, adjusted_value), 2)
            })
        
        for forecast_item in baseline_forecast['energy_poverty']:
            year = forecast_item['year']
            baseline_value = forecast_item['value']
            start_year = baseline_forecast['energy_poverty'][0]['year']
            progress = (year - start_year) / (target_year - start_year) if target_year > start_year else 1.0
            progress = max(0, min(1, progress))
            
            if target_poverty:
                adjusted_value = baseline_value + (target_poverty - baseline_poverty) * progress
            else:
                adjusted_value = baseline_value
            
            adjusted_forecast['energy_poverty'].append({
                'year': year,
                'value': round(max(0, min(100, adjusted_value)), 2)
            })
        
        return adjusted_forecast
    
    def analyze_policy(
        self,
        policy_text: str,
        country: Optional[str] = None,
        target_year: int = 2100
    ) -> Dict[str, Any]:
        """
        Complete policy analysis pipeline:
        1. Extract metrics from policy text
        2. Generate baseline forecast
        3. Apply policy adjustments
        4. Return results
        """
        # Extract policy metrics
        policy_metrics = self.extract_policy_metrics(policy_text)
        
        # Determine start year
        start_year = policy_metrics.get('timeline_start') or 2025
        end_year = policy_metrics.get('timeline_end') or target_year
        
        # Generate baseline forecast
        baseline_forecast = self.generate_baseline_forecast(
            country or 'Algeria',  # Default country
            start_year,
            end_year
        )
        
        # Apply policy adjustments
        adjusted_forecast = self.apply_policy_adjustments(
            baseline_forecast,
            policy_metrics,
            end_year
        )
        
        # Calculate summary metrics
        final_year_data = {
            'renewable_share': adjusted_forecast['renewable_share'][-1]['value'] if adjusted_forecast['renewable_share'] else 0,
            'electricity_demand': adjusted_forecast['electricity_demand'][-1]['value'] if adjusted_forecast['electricity_demand'] else 0,
            'co2_emissions': adjusted_forecast['co2_emissions'][-1]['value'] if adjusted_forecast['co2_emissions'] else 0,
            'energy_poverty': adjusted_forecast['energy_poverty'][-1]['value'] if adjusted_forecast['energy_poverty'] else 0,
        }
        
        # Generate AI overview
        ai_overview = self._generate_ai_overview(policy_metrics, adjusted_forecast, final_year_data, start_year, end_year)
        
        return {
            'policy_metrics': policy_metrics,
            'forecasts': adjusted_forecast,
            'summary': final_year_data,
            'timeline': {
                'start_year': start_year,
                'end_year': end_year
            },
            'ai_overview': ai_overview
        }
    
    def _generate_ai_overview(
        self,
        policy_metrics: Dict[str, Any],
        forecasts: Dict[str, List[Dict[str, Any]]],
        summary: Dict[str, float],
        start_year: int,
        end_year: int
    ) -> str:
        """
        Generate a natural language summary of the policy analysis and forecasts.
        """
        overview_parts = []
        
        # Policy targets summary
        if policy_metrics.get('renewable_target'):
            overview_parts.append(
                f"Based on the policy's target of achieving {policy_metrics['renewable_target']}% renewable energy share"
            )
        else:
            overview_parts.append("Based on current trends and policy initiatives")
        
        # Key findings
        if forecasts.get('renewable_share'):
            final_renewable = forecasts['renewable_share'][-1]['value']
            overview_parts.append(
                f"the renewable energy share is projected to reach {final_renewable:.1f}% by {end_year}."
            )
        
        # Energy poverty analysis
        if forecasts.get('energy_poverty'):
            final_poverty = forecasts['energy_poverty'][-1]['value']
            initial_poverty = forecasts['energy_poverty'][0]['value'] if forecasts['energy_poverty'] else final_poverty
            poverty_reduction = initial_poverty - final_poverty
            
            if policy_metrics.get('energy_poverty_target'):
                overview_parts.append(
                    f"\n\nEnergy poverty is forecasted to decrease from {initial_poverty:.1f}% to {final_poverty:.1f}% by {end_year}, "
                    f"achieving the policy target of {policy_metrics['energy_poverty_target']}%. "
                    f"This represents a reduction of {poverty_reduction:.1f} percentage points over the policy period."
                )
            else:
                overview_parts.append(
                    f"\n\nEnergy poverty is projected to decrease from {initial_poverty:.1f}% to {final_poverty:.1f}% by {end_year}, "
                    f"representing a {poverty_reduction:.1f} percentage point reduction."
                )
        
        # Electricity access and per capita
        if forecasts.get('electricity_per_capita_with_access') and forecasts.get('electricity_per_capita'):
            final_per_capita = forecasts['electricity_per_capita'][-1]['value']
            final_per_capita_access = forecasts['electricity_per_capita_with_access'][-1]['value']
            
            if policy_metrics.get('energy_access_target'):
                overview_parts.append(
                    f"\n\nWith the policy's target of {policy_metrics['energy_access_target']}% electricity access, "
                    f"electricity consumption per capita for those with access is projected to reach {final_per_capita_access:.0f} kWh/year by {end_year}, "
                    f"while overall per capita consumption will be {final_per_capita:.0f} kWh/year."
                )
            else:
                overview_parts.append(
                    f"\n\nElectricity consumption per capita is forecasted to reach {final_per_capita:.0f} kWh/year by {end_year}, "
                    f"with those having access consuming {final_per_capita_access:.0f} kWh/year."
                )
        
        # Clean cooking
        if forecasts.get('clean_cooking_access'):
            final_clean_cooking = forecasts['clean_cooking_access'][-1]['value']
            initial_clean_cooking = forecasts['clean_cooking_access'][0]['value'] if forecasts['clean_cooking_access'] else final_clean_cooking
            
            if policy_metrics.get('clean_cooking_target'):
                overview_parts.append(
                    f"\n\nClean cooking access is projected to increase from {initial_clean_cooking:.1f}% to {final_clean_cooking:.1f}% by {end_year}, "
                    f"meeting the policy target of {policy_metrics['clean_cooking_target']}%."
                )
            else:
                overview_parts.append(
                    f"\n\nClean cooking access is forecasted to improve from {initial_clean_cooking:.1f}% to {final_clean_cooking:.1f}% by {end_year}."
                )
        
        # CO2 emissions
        if forecasts.get('co2_emissions'):
            final_co2 = forecasts['co2_emissions'][-1]['value']
            initial_co2 = forecasts['co2_emissions'][0]['value'] if forecasts['co2_emissions'] else final_co2
            co2_reduction_pct = ((initial_co2 - final_co2) / initial_co2 * 100) if initial_co2 > 0 else 0
            
            if policy_metrics.get('co2_reduction_target'):
                overview_parts.append(
                    f"\n\nCO2 emissions intensity is projected to decrease from {initial_co2:.1f} to {final_co2:.1f} gCO₂/kWh by {end_year}, "
                    f"achieving a {co2_reduction_pct:.1f}% reduction, which aligns with the policy's target of {policy_metrics['co2_reduction_target']}% reduction."
                )
            else:
                overview_parts.append(
                    f"\n\nCO2 emissions intensity is forecasted to decrease from {initial_co2:.1f} to {final_co2:.1f} gCO₂/kWh by {end_year}, "
                    f"representing a {co2_reduction_pct:.1f}% reduction."
                )
        
        # Investment impact
        if policy_metrics.get('investment_amount'):
            overview_parts.append(
                f"\n\nThe policy's planned investment of ${policy_metrics['investment_amount']:.1f} billion over the period "
                f"({start_year}-{end_year}) is expected to drive these improvements across renewable energy deployment, "
                f"grid modernization, and energy access expansion."
            )
        
        # Conclusion
        overview_parts.append(
            f"\n\nOverall, if the policy targets are met, significant progress is expected in reducing energy poverty, "
            f"expanding electricity access, and transitioning to renewable energy sources by {end_year}."
        )
        
        return "".join(overview_parts)

