"""
ESKOM Model Training and Synthetic Hourly Electricity Demand Generation

This module contains functions for:
1. Training a GradientBoostingRegressor model on South African ESKOM hourly demand data
2. Generating synthetic hourly electricity demand data for other African countries

The model is trained exclusively on South African data to ensure proper generalization
to other African countries with similar energy sector characteristics.
"""

import os
import zipfile
import pandas as pd
import numpy as np
import joblib
from joblib import load
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from tqdm import tqdm
import matplotlib.pyplot as plt


# ============================================================================
# CONSTANTS
# ============================================================================

AFRICA_COUNTRIES = [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", 
    "Cabo Verde", "Cameroon", "Central African Republic", "Chad", "Comoros",
    "Democratic Republic of Congo", "Congo", "Djibouti", "Egypt", 
    "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", 
    "Gambia, The", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho",
    "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", 
    "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria",
    "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", 
    "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan",
    "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"
]


# ============================================================================
# MODEL TRAINING
# ============================================================================

def train_eskom_model(eskom_csv, owid_csv, model_output_path):
    """
    Train a GradientBoostingRegressor model on Eskom hourly demand + OWID-WB yearly features.
    Uses ONLY South African data for training to ensure proper generalization.

    Parameters:
    -----------
    eskom_csv : str
        Path to Eskom data (must include 'Date Time Hour Beginning' and 'RSA Contracted Demand' columns).
    owid_csv : str
        Path to OWID-WB dataset (must include country, year, population, electricity demand, access).
    model_output_path : str
        Path to save trained model (.pkl).

    Returns:
    --------
    tuple
        (model, train_metrics, test_metrics) - Trained model and evaluation metrics.
    """
    # Load Eskom hourly data
    eskom = pd.read_csv(eskom_csv)
    if "RSA Contracted Demand" not in eskom.columns:
        raise KeyError(
            f"'RSA Contracted Demand' not found in {eskom_csv}. "
            f"Available columns: {list(eskom.columns)}"
        )

    # Extract datetime components
    eskom["Datetime"] = pd.to_datetime(eskom["Date Time Hour Beginning"])
    eskom["year"] = eskom["Datetime"].dt.year
    eskom["month"] = eskom["Datetime"].dt.month
    eskom["day"] = eskom["Datetime"].dt.day
    eskom["hour"] = eskom["Datetime"].dt.hour
    eskom["weekday"] = eskom["Datetime"].dt.weekday

    # Convert demand to MWh and then kWh (for model consistency)
    eskom["demand_MWh"] = eskom["RSA Contracted Demand"]
    eskom["demand_kWh"] = eskom["RSA Contracted Demand"] * 1e3

    print(f"Eskom data years: {sorted(eskom['year'].unique())}")
    print(f"Eskom date range: {eskom['Datetime'].min()} to {eskom['Datetime'].max()}")

    # Load OWID yearly data for South Africa (2019–2024)
    owid = pd.read_csv(owid_csv)
    owid = owid.rename(columns={
        "country": "country",
        "year": "year",
        "electricity_demand": "yearly_demand_TWh",
        "Access to electricity (% of total population)": "access_pct",
        "population": "population"
    })

    # Keep only relevant columns
    owid = owid[["country", "year", "population", "access_pct", "yearly_demand_TWh"]]

    # Convert yearly demand from TWh → kWh for model consistency
    owid["yearly_demand_kWh"] = owid["yearly_demand_TWh"] * 1e9

    # Filter for South Africa only (2019–2024)
    owid_sa = owid[(owid["country"] == "South Africa") & (owid["year"].between(2019, 2024))].copy()

    print(f"OWID South Africa data years: {sorted(owid_sa['year'].unique())}")

    # Merge Eskom (hourly) with OWID (yearly)
    merged = eskom.merge(
        owid_sa[["year", "population", "access_pct", "yearly_demand_kWh"]],
        on="year", how="left"
    )

    print(f"Data shape before cleaning: {merged.shape}")

    # Drop missing rows
    merged_clean = merged.dropna(subset=["population", "access_pct", "yearly_demand_kWh"])
    print(f"Data shape after cleaning: {merged_clean.shape}")

    # Add normalized year for stability
    merged_clean["year_normalized"] = (
        (merged_clean["year"] - merged_clean["year"].min())
        / (merged_clean["year"].max() - merged_clean["year"].min())
    )

    # Define features (inputs) and target (output)
    features = [
        "hour", "weekday", "month", "year_normalized",
        "population", "access_pct", "yearly_demand_kWh"
    ]
    X = merged_clean[features]
    y = merged_clean["demand_kWh"]  # Target variable

    print(f"Final training data shape: {X.shape}")
    print(f"Target variable shape: {y.shape}")

    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, shuffle=True
    )

    # Train Gradient Boosting Regressor
    model = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Evaluate Performance
    def evaluate(y_true, y_pred, name):
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
        r2 = r2_score(y_true, y_pred)
        mase = mae / np.mean(np.abs(np.diff(y_true)))
        
        # Calculate additional metrics
        mean_actual = np.mean(y_true)
        mean_predicted = np.mean(y_pred)
        median_actual = np.median(y_true)
        median_predicted = np.median(y_pred)
        
        print(f"\n{'='*70}")
        print(f"{name} SET PERFORMANCE METRICS")
        print(f"{'='*70}")
        print(f"  Mean Absolute Error (MAE):     {mae:>15,.2f} kWh")
        print(f"  Root Mean Squared Error (RMSE): {rmse:>15,.2f} kWh")
        print(f"  Mean Absolute % Error (MAPE):   {mape:>15.2f}%")
        print(f"  R² Score (Coefficient of Determination): {r2:>15.4f}")
        print(f"  Mean Absolute Scaled Error (MASE): {mase:>15.4f}")
        print(f"\n  Actual vs Predicted Summary:")
        print(f"    Mean Actual:    {mean_actual:>15,.2f} kWh")
        print(f"    Mean Predicted: {mean_predicted:>15,.2f} kWh")
        print(f"    Median Actual:  {median_actual:>15,.2f} kWh")
        print(f"    Median Predicted: {median_predicted:>15,.2f} kWh")
        print(f"{'='*70}")
        
        return {
            "MAE": mae, 
            "RMSE": rmse, 
            "MAPE": mape, 
            "R2": r2, 
            "MASE": mase,
            "mean_actual": mean_actual,
            "mean_predicted": mean_predicted,
            "median_actual": median_actual,
            "median_predicted": median_predicted
        }

    train_metrics = evaluate(y_train, model.predict(X_train), "TRAINING")
    test_metrics = evaluate(y_test, model.predict(X_test), "TEST")
    
    # Print comparison
    print(f"\n{'='*70}")
    print("TRAINING vs TEST SET COMPARISON")
    print(f"{'='*70}")
    print(f"{'Metric':<30} {'Training':<20} {'Test':<20} {'Difference':<15}")
    print(f"{'-'*85}")
    print(f"{'R² Score':<30} {train_metrics['R2']:<20.4f} {test_metrics['R2']:<20.4f} {train_metrics['R2'] - test_metrics['R2']:<15.4f}")
    print(f"{'RMSE (kWh)':<30} {train_metrics['RMSE']:<20,.2f} {test_metrics['RMSE']:<20,.2f} {train_metrics['RMSE'] - test_metrics['RMSE']:<15,.2f}")
    print(f"{'MAE (kWh)':<30} {train_metrics['MAE']:<20,.2f} {test_metrics['MAE']:<20,.2f} {train_metrics['MAE'] - test_metrics['MAE']:<15,.2f}")
    print(f"{'MAPE (%)':<30} {train_metrics['MAPE']:<20.2f} {test_metrics['MAPE']:<20.2f} {train_metrics['MAPE'] - test_metrics['MAPE']:<15.2f}")
    print(f"{'='*70}")
    
    # Model quality assessment
    print("\n📊 MODEL QUALITY ASSESSMENT:")
    if test_metrics['R2'] > 0.9:
        print("   ✅ Excellent model fit (R² > 0.9)")
    elif test_metrics['R2'] > 0.8:
        print("   ✅ Good model fit (R² > 0.8)")
    elif test_metrics['R2'] > 0.7:
        print("   ⚠️  Moderate model fit (R² > 0.7)")
    else:
        print("   ❌ Poor model fit (R² < 0.7) - Consider retraining with different parameters")
    
    if abs(train_metrics['R2'] - test_metrics['R2']) < 0.05:
        print("   ✅ No significant overfitting detected")
    else:
        print(f"   ⚠️  Potential overfitting (R² difference: {abs(train_metrics['R2'] - test_metrics['R2']):.4f})")

    # Feature Importance
    importance = pd.DataFrame({
        "feature": features,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False)
    print(f"\n{'='*70}")
    print("FEATURE IMPORTANCE")
    print(f"{'='*70}")
    print(importance.to_string(index=False))
    print(f"{'='*70}")

    # Save model
    joblib.dump(model, model_output_path)
    print(f"\n✅ Model saved successfully to: {model_output_path}")

    # Save metrics to JSON file
    import json
    metrics_file = model_output_path.replace('.pkl', '_metrics.json')
    metrics_summary = {
        "model_path": model_output_path,
        "training_metrics": {k: float(v) for k, v in train_metrics.items()},
        "test_metrics": {k: float(v) for k, v in test_metrics.items()},
        "feature_importance": importance.to_dict('records'),
        "model_parameters": {
            "n_estimators": 300,
            "learning_rate": 0.05,
            "max_depth": 5,
            "subsample": 0.8,
            "random_state": 42
        }
    }
    with open(metrics_file, 'w') as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"✅ Performance metrics saved to: {metrics_file}")

    return model, train_metrics, test_metrics


# ============================================================================
# SYNTHETIC DATA GENERATION
# ============================================================================

def generate_synthetic_demand(
    yearly_historical_csv,
    model_path,
    country=None,
    year_or_date=None,
    countries=None,
    start_year=2019,
    end_year=2024,
    eskom_csv=None,
    output_dir="./synthetic_data",
    zip_output=False
):
    """
    Unified function to generate synthetic hourly electricity demand data.
    
    MODES:
    1. Single country with specific year/date:
       generate_synthetic_demand('data.csv', 'model.pkl', 'South Africa', '2023-04-01', eskom_csv='eskom.csv')
    
    2. Multiple countries for year range:
       generate_synthetic_demand('data.csv', 'model.pkl', countries=AFRICA_COUNTRIES, start_year=2019, end_year=2024)
    
    Parameters:
    -----------
    yearly_historical_csv : str
        Path to CSV with yearly historical data
    model_path : str
        Path to trained model file
    country : str, optional
        Single country name (for single country mode)
    year_or_date : int or str, optional
        Year (e.g., 2023) or date (e.g., '2023-04-01') for single country mode
    countries : list, optional
        List of countries for batch processing
    start_year, end_year : int
        Year range for batch processing
    eskom_csv : str, optional
        Path to Eskom data for South Africa comparison
    output_dir : str
        Directory to save output files
    zip_output : bool
        Whether to create zip file for batch processing
    
    Returns:
    --------
    pandas.DataFrame or list
        Single country: Returns DataFrame and saves CSV/PNG
        Multiple countries: Saves CSV files for each country, optionally zipped
    """
    os.makedirs(output_dir, exist_ok=True)
    model = load(model_path)

    # Load input data
    yearly_df = pd.read_csv(yearly_historical_csv)
    
    # Normalize column names
    yearly_df = yearly_df.rename(columns={
        "country": "Country", 
        "year": "Year",
        "population": "population",
        "Access to electricity (% of total population)": "access_pct"
    })

    # Check if required columns exist
    required_columns = ["Country", "Year", "population", "access_pct", "electricity_demand"]
    missing_columns = [col for col in required_columns if col not in yearly_df.columns]
    
    if missing_columns:
        raise ValueError(f"Missing required columns in yearly_historical_csv: {missing_columns}")

    # Year normalization parameters (from training data: South Africa 2019-2024)
    min_year_train = 2019
    max_year_train = 2024

    # Feature order from training
    feature_order = [
        "hour", "weekday", "month", "year_normalized",
        "population", "access_pct", "yearly_demand_kWh"
    ]

    # Determine mode: single country or multiple countries
    if country is not None:
        # SINGLE COUNTRY MODE
        return _generate_single_country(
            yearly_df, model, country, year_or_date, eskom_csv, output_dir,
            min_year_train, max_year_train, feature_order
        )
    elif countries is not None:
        # MULTIPLE COUNTRIES MODE
        return _generate_multiple_countries(
            yearly_df, model, countries, start_year, end_year, output_dir, zip_output,
            min_year_train, max_year_train, feature_order
        )
    else:
        raise ValueError("Must specify either 'country' (for single country) or 'countries' (for batch processing)")


def _generate_single_country(
    yearly_df, model, country, year_or_date, eskom_csv, output_dir,
    min_year_train, max_year_train, feature_order
):
    """
    Generate synthetic demand for a single country.
    """
    # Determine if input is a year or specific date
    try:
        date_req = pd.to_datetime(year_or_date, errors="raise")
        is_specific_date = True
        year = date_req.year
        target_date = date_req.date()
    except (ValueError, TypeError):
        is_specific_date = False
        year = int(str(year_or_date)[:4])
        target_date = None

    # Validate year range
    available_years = sorted(yearly_df['Year'].unique())
    min_year = min(available_years)
    max_year = max(available_years)
    
    if year < min_year or year > max_year:
        raise ValueError(
            f"Year {year} is outside the available data range ({min_year}-{max_year})\n"
            f"Available years for {country}: {available_years}"
        )
    
    yearly_country = yearly_df[
        (yearly_df["Country"].str.lower() == country.lower()) & 
        (yearly_df["Year"] == year)
    ]

    if yearly_country.empty:
        available_countries = yearly_df[yearly_df["Year"] == year]["Country"].unique()
        raise ValueError(
            f"No data found for {country} in {year}\n"
            f"Available countries for {year}: {sorted(available_countries)}"
        )

    # Extract and validate data
    row = yearly_country.iloc[0]
    try:
        yearly_demand_TWh = float(row["electricity_demand"])
        population = float(row["population"])
        access = float(row["access_pct"])
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid data for {country} {year}: {e}")

    # Check for NaN or invalid values
    if (np.isnan(yearly_demand_TWh) or np.isnan(population) or np.isnan(access) or
        yearly_demand_TWh <= 0 or population <= 0 or access <= 0 or access > 100):
        raise ValueError(f"Invalid data values for {country} {year}")

    # Convert yearly demand from TWh → kWh for model input
    yearly_demand_kWh = yearly_demand_TWh * 1e9

    # Generate hourly timestamps for the year
    start_date = f"{year}-01-01 00:00:00"
    end_date = f"{year}-12-31 23:00:00"
    hours = pd.date_range(start=start_date, end=end_date, freq="h")

    # Normalize year
    year_normalized = (year - min_year_train) / (max_year_train - min_year_train)

    # Prepare features with exact same order as training
    features = pd.DataFrame({
        "hour": hours.hour,
        "weekday": hours.dayofweek,
        "month": hours.month,
        "year_normalized": year_normalized,
        "population": population,
        "access_pct": access,
        "yearly_demand_kWh": yearly_demand_kWh,
    })[feature_order]

    # Predict hourly demand (MWh)
    preds = model.predict(features)

    # Scale predictions
    target_annual_mwh = yearly_demand_kWh / 1000  # Convert kWh to MWh
    scaling_factor = target_annual_mwh / preds.sum()
    preds_scaled = preds * scaling_factor
    
    print(f"📊 {country} {year}: Scaling factor: {scaling_factor:.4f}")
    print(f"📊 {country} {year}: Total predicted demand: {preds_scaled.sum():,.0f} MWh")
    print(f"📊 {country} {year}: Target annual demand: {target_annual_mwh:,.0f} MWh")

    # Compute per capita values
    per_capita_demand_kWh = (preds_scaled * 1000) / population
    per_capita_demand_with_access_kWh = (preds_scaled * 1000) / (population * (access / 100))

    # Build final dataframe
    df_full_year = pd.DataFrame({
        "country": country,
        "datetime": hours,
        "electricity_demand_MWh": preds_scaled,
        "electricity_demand_per_capita_kWh": per_capita_demand_kWh,
        "electricity_demand_per_capita_with_access_kWh": per_capita_demand_with_access_kWh,
    })

    # Save full year file
    yearly_file = os.path.join(output_dir, f"{country.replace(' ', '_')}_{year}_synthetic_hourly.csv")
    df_full_year.to_csv(yearly_file, index=False)
    print(f"✅ Yearly synthetic data saved: {yearly_file}")

    # Handle specific date if provided
    if is_specific_date:
        df_day = df_full_year[df_full_year["datetime"].dt.date == target_date].copy()
        
        if df_day.empty:
            print(f"⚠️ No data found for {target_date} in year {year}")
            return df_full_year

        # Save daily file
        daily_file = os.path.join(output_dir, f"{country.replace(' ', '_')}_{date_req.strftime('%Y_%m_%d')}_synthetic_daily.csv")
        df_day.to_csv(daily_file, index=False)
        print(f"✅ Daily synthetic data saved: {daily_file}")

        # Create plot for daily data
        _create_daily_plot(df_day, country, target_date, eskom_csv, output_dir, date_req)

        return df_day
    else:
        return df_full_year


def _generate_multiple_countries(
    yearly_df, model, countries, start_year, end_year, output_dir, zip_output,
    min_year_train, max_year_train, feature_order
):
    """
    Generate synthetic demand for multiple countries.
    """
    # Filter to available countries
    available_countries = sorted(yearly_df["Country"].unique())
    countries_to_process = [c for c in countries if c in available_countries]
    missing_countries = set(countries) - set(available_countries)
    
    if missing_countries:
        print(f"⚠️ The following countries are not in the dataset: {sorted(missing_countries)}")
    
    print(f"🌍 Generating synthetic demand for {len(countries_to_process)} countries:")
    print(f"📋 Countries: {', '.join(countries_to_process)}")
    print(f"📅 Years: {start_year}–{end_year}")

    generated_files = []

    for country in tqdm(countries_to_process, desc="Generating synthetic hourly demand"):
        try:
            print(f"\n🌍 Generating synthetic data for {country} ({start_year}–{end_year})")

            yearly_country = yearly_df[
                (yearly_df["Country"] == country) &
                (yearly_df["Year"].between(start_year, end_year))
            ]

            if yearly_country.empty:
                print(f"⚠️ Skipping {country} — no data in range {start_year}-{end_year}")
                continue

            all_records = []

            for _, row in yearly_country.iterrows():
                year = int(row["Year"])
                
                # Extract and validate data
                try:
                    yearly_demand_TWh = float(row["electricity_demand"])
                    population = float(row["population"])
                    access = float(row["access_pct"])
                except (ValueError, TypeError) as e:
                    print(f"⚠️ Skipping {country} {year} — invalid data: {e}")
                    continue
                
                # Check for invalid values
                if (np.isnan(yearly_demand_TWh) or np.isnan(population) or np.isnan(access) or
                    yearly_demand_TWh <= 0 or population <= 0 or access <= 0 or access > 100):
                    print(f"⚠️ Skipping {country} {year} — invalid values")
                    continue

                # Convert yearly demand from TWh → kWh
                yearly_demand_kWh = yearly_demand_TWh * 1e9

                # Generate hourly timestamps
                start_date = f"{year}-01-01 00:00:00"
                end_date = f"{year}-12-31 23:00:00"
                hours = pd.date_range(start=start_date, end=end_date, freq="h")

                # Normalize year
                year_normalized = (year - min_year_train) / (max_year_train - min_year_train)

                # Prepare features
                features = pd.DataFrame({
                    "hour": hours.hour,
                    "weekday": hours.dayofweek,
                    "month": hours.month,
                    "year_normalized": year_normalized,
                    "population": population,
                    "access_pct": access,
                    "yearly_demand_kWh": yearly_demand_kWh,
                })[feature_order]

                # Predict hourly demand
                preds = model.predict(features)

                # Scale predictions
                target_annual_mwh = yearly_demand_kWh / 1000
                scaling_factor = target_annual_mwh / preds.sum()
                preds_scaled = preds * scaling_factor
                
                print(f"📊 {country} {year}: Scaling factor: {scaling_factor:.4f}")

                # Compute per capita values
                per_capita_demand_kWh = (preds_scaled * 1000) / population
                per_capita_demand_with_access_kWh = (preds_scaled * 1000) / (population * (access / 100))

                # Build DataFrame
                temp_df = pd.DataFrame({
                    "country": country,
                    "datetime": hours,
                    "electricity_demand_MWh": preds_scaled,
                    "electricity_demand_per_capita_kWh": per_capita_demand_kWh,
                    "electricity_demand_per_capita_with_access_kWh": per_capita_demand_with_access_kWh,
                })

                all_records.append(temp_df)

            # Combine all yearly data for the country
            if all_records:
                combined = pd.concat(all_records)
                output_path = os.path.join(output_dir, f"{country}.csv")
                combined.to_csv(output_path, index=False)
                generated_files.append(output_path)
                print(f"✅ Saved hourly synthetic demand for {country} → {output_path}")
                
                # Print summary statistics
                total_demand_twh = combined["electricity_demand_MWh"].sum() / 1_000_000
                avg_hourly_demand = combined["electricity_demand_MWh"].mean()
                print(f"📈 {country} summary: {total_demand_twh:.2f} TWh annual, {avg_hourly_demand:,.0f} MWh hourly avg")
            else:
                print(f"⚠️ No valid data generated for {country}")

        except Exception as e:
            print(f"❌ Error generating data for {country}: {e}")

    # Create zip file if requested
    if zip_output and generated_files:
        zip_path = os.path.join(output_dir, "synthetic_hourly_demand_all_countries.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in generated_files:
                zipf.write(file_path, os.path.basename(file_path))
        print(f"📦 Created zip file with all synthetic data: {zip_path}")

    print(f"\n🎉 Completed! Generated synthetic demand for {len(generated_files)} countries")
    return generated_files


def _create_daily_plot(df_day, country, target_date, eskom_csv, output_dir, date_req):
    """
    Create daily demand plot with optional Eskom comparison for South Africa.
    """
    plt.figure(figsize=(12, 6))
    plt.plot(df_day["datetime"].dt.hour, df_day["electricity_demand_MWh"], 
            label=f"Synthetic Demand - {country}", linewidth=2, marker='o', color='blue')

    # If South Africa and eskom_csv provided, add actual data
    if country.lower() == "south africa" and eskom_csv is not None:
        try:
            # Load Eskom data for comparison
            eskom_data = pd.read_csv(eskom_csv)
            eskom_data["Datetime"] = pd.to_datetime(eskom_data["Date Time Hour Beginning"])
            eskom_data["Date"] = eskom_data["Datetime"].dt.date
            
            # Filter for the target date
            eskom_day = eskom_data[eskom_data["Date"] == target_date].copy()
            
            if not eskom_day.empty:
                # Rename to match our target column name
                if "RSA Contracted Demand" in eskom_day.columns:
                    eskom_day = eskom_day.rename(columns={"RSA Contracted Demand": "demand_MWh"})
                
                plt.plot(eskom_day["Datetime"].dt.hour, eskom_day["demand_MWh"], 
                        label="RSA Contracted Demand (Actual)", linewidth=2, marker='s', color='red', alpha=0.7)
                
                # Calculate metrics if we have actual data
                synthetic_demand = df_day["electricity_demand_MWh"].values
                actual_demand = eskom_day["demand_MWh"].values[:len(synthetic_demand)]
                
                if len(synthetic_demand) == len(actual_demand):
                    mae = mean_absolute_error(actual_demand, synthetic_demand)
                    rmse = np.sqrt(mean_squared_error(actual_demand, synthetic_demand))
                    plt.text(0.02, 0.98, f'MAE: {mae:.0f} MWh\nRMSE: {rmse:.0f} MWh', 
                            transform=plt.gca().transAxes, verticalalignment='top',
                            bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
                
                title = f"Electricity Demand for South Africa - {target_date}\n(Synthetic vs Actual)"
            else:
                title = f"Synthetic Electricity Demand for South Africa - {target_date}"
                print(f"⚠️ No Eskom data found for {target_date}")
                
        except Exception as e:
            print(f"⚠️ Could not load Eskom data for comparison: {e}")
            title = f"Synthetic Electricity Demand for South Africa - {target_date}"
    else:
        title = f"Synthetic Electricity Demand for {country} - {target_date}"

    plt.title(title)
    plt.xlabel("Hour of Day")
    plt.ylabel("Electricity Demand (MWh)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.xticks(range(0, 24))
    plt.tight_layout()
    
    png_file = os.path.join(output_dir, f"{country.replace(' ', '_')}_{date_req.strftime('%Y_%m_%d')}_demand.png")
    plt.savefig(png_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"📊 Daily demand plot saved: {png_file}")


# ============================================================================
# MODEL EVALUATION
# ============================================================================

def evaluate_model(model_path, eskom_csv, owid_csv):
    """
    Evaluate an existing trained model and display performance metrics.
    
    Parameters:
    -----------
    model_path : str
        Path to the trained model file (.pkl)
    eskom_csv : str
        Path to ESKOM hourly demand data
    owid_csv : str
        Path to OWID-WB yearly historical data
    
    Returns:
    --------
    dict
        Dictionary containing training and test metrics
    """
    import json
    
    print("=" * 70)
    print("EVALUATING MODEL PERFORMANCE")
    print("=" * 70)
    
    # Load model
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    model = load(model_path)
    print(f"✅ Loaded model from: {model_path}\n")
    
    # Load and prepare data (same as training)
    eskom = pd.read_csv(eskom_csv)
    if "RSA Contracted Demand" not in eskom.columns:
        raise KeyError(f"'RSA Contracted Demand' not found in {eskom_csv}")
    
    eskom["Datetime"] = pd.to_datetime(eskom["Date Time Hour Beginning"])
    eskom["year"] = eskom["Datetime"].dt.year
    eskom["month"] = eskom["Datetime"].dt.month
    eskom["hour"] = eskom["Datetime"].dt.hour
    eskom["weekday"] = eskom["Datetime"].dt.weekday
    eskom["demand_kWh"] = eskom["RSA Contracted Demand"] * 1e3
    
    owid = pd.read_csv(owid_csv)
    owid = owid.rename(columns={
        "country": "country",
        "year": "year",
        "electricity_demand": "yearly_demand_TWh",
        "Access to electricity (% of total population)": "access_pct",
        "population": "population"
    })
    owid = owid[["country", "year", "population", "access_pct", "yearly_demand_TWh"]]
    owid["yearly_demand_kWh"] = owid["yearly_demand_TWh"] * 1e9
    owid_sa = owid[(owid["country"] == "South Africa") & (owid["year"].between(2019, 2024))].copy()
    
    merged = eskom.merge(
        owid_sa[["year", "population", "access_pct", "yearly_demand_kWh"]],
        on="year", how="left"
    )
    merged_clean = merged.dropna(subset=["population", "access_pct", "yearly_demand_kWh"])
    merged_clean["year_normalized"] = (
        (merged_clean["year"] - merged_clean["year"].min())
        / (merged_clean["year"].max() - merged_clean["year"].min())
    )
    
    features = [
        "hour", "weekday", "month", "year_normalized",
        "population", "access_pct", "yearly_demand_kWh"
    ]
    X = merged_clean[features]
    y = merged_clean["demand_kWh"]
    
    # Split data (same random state as training)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, shuffle=True
    )
    
    # Evaluate
    def evaluate_metrics(y_true, y_pred, name):
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
        r2 = r2_score(y_true, y_pred)
        mase = mae / np.mean(np.abs(np.diff(y_true)))
        mean_actual = np.mean(y_true)
        mean_predicted = np.mean(y_pred)
        median_actual = np.median(y_true)
        median_predicted = np.median(y_pred)
        
        print(f"\n{'='*70}")
        print(f"{name} SET PERFORMANCE METRICS")
        print(f"{'='*70}")
        print(f"  Mean Absolute Error (MAE):     {mae:>15,.2f} kWh")
        print(f"  Root Mean Squared Error (RMSE): {rmse:>15,.2f} kWh")
        print(f"  Mean Absolute % Error (MAPE):   {mape:>15.2f}%")
        print(f"  R² Score (Coefficient of Determination): {r2:>15.4f}")
        print(f"  Mean Absolute Scaled Error (MASE): {mase:>15.4f}")
        print(f"\n  Actual vs Predicted Summary:")
        print(f"    Mean Actual:    {mean_actual:>15,.2f} kWh")
        print(f"    Mean Predicted: {mean_predicted:>15,.2f} kWh")
        print(f"    Median Actual:  {median_actual:>15,.2f} kWh")
        print(f"    Median Predicted: {median_predicted:>15,.2f} kWh")
        print(f"{'='*70}")
        
        return {
            "MAE": mae, "RMSE": rmse, "MAPE": mape, "R2": r2, "MASE": mase,
            "mean_actual": mean_actual, "mean_predicted": mean_predicted,
            "median_actual": median_actual, "median_predicted": median_predicted
        }
    
    train_metrics = evaluate_metrics(y_train, model.predict(X_train), "TRAINING")
    test_metrics = evaluate_metrics(y_test, model.predict(X_test), "TEST")
    
    # Comparison
    print(f"\n{'='*70}")
    print("TRAINING vs TEST SET COMPARISON")
    print(f"{'='*70}")
    print(f"{'Metric':<30} {'Training':<20} {'Test':<20} {'Difference':<15}")
    print(f"{'-'*85}")
    print(f"{'R² Score':<30} {train_metrics['R2']:<20.4f} {test_metrics['R2']:<20.4f} {train_metrics['R2'] - test_metrics['R2']:<15.4f}")
    print(f"{'RMSE (kWh)':<30} {train_metrics['RMSE']:<20,.2f} {test_metrics['RMSE']:<20,.2f} {train_metrics['RMSE'] - test_metrics['RMSE']:<15,.2f}")
    print(f"{'MAE (kWh)':<30} {train_metrics['MAE']:<20,.2f} {test_metrics['MAE']:<20,.2f} {train_metrics['MAE'] - test_metrics['MAE']:<15,.2f}")
    print(f"{'MAPE (%)':<30} {train_metrics['MAPE']:<20.2f} {test_metrics['MAPE']:<20.2f} {train_metrics['MAPE'] - test_metrics['MAPE']:<15.2f}")
    print(f"{'='*70}")
    
    # Feature importance
    importance = pd.DataFrame({
        "feature": features,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False)
    print(f"\n{'='*70}")
    print("FEATURE IMPORTANCE")
    print(f"{'='*70}")
    print(importance.to_string(index=False))
    print(f"{'='*70}")
    
    # Model quality assessment
    print("\n📊 MODEL QUALITY ASSESSMENT:")
    if test_metrics['R2'] > 0.9:
        print("   ✅ Excellent model fit (R² > 0.9)")
    elif test_metrics['R2'] > 0.8:
        print("   ✅ Good model fit (R² > 0.8)")
    elif test_metrics['R2'] > 0.7:
        print("   ⚠️  Moderate model fit (R² > 0.7)")
    else:
        print("   ❌ Poor model fit (R² < 0.7) - Consider retraining")
    
    if abs(train_metrics['R2'] - test_metrics['R2']) < 0.05:
        print("   ✅ No significant overfitting detected")
    else:
        print(f"   ⚠️  Potential overfitting (R² difference: {abs(train_metrics['R2'] - test_metrics['R2']):.4f})")
    
    # Save metrics
    metrics_file = model_path.replace('.pkl', '_evaluation_metrics.json')
    metrics_summary = {
        "model_path": model_path,
        "evaluation_date": pd.Timestamp.now().isoformat(),
        "training_metrics": {k: float(v) for k, v in train_metrics.items()},
        "test_metrics": {k: float(v) for k, v in test_metrics.items()},
        "feature_importance": importance.to_dict('records')
    }
    with open(metrics_file, 'w') as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"\n✅ Evaluation metrics saved to: {metrics_file}")
    
    return {
        "training_metrics": train_metrics,
        "test_metrics": test_metrics,
        "feature_importance": importance.to_dict('records')
    }


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def run_complete_pipeline(
    eskom_csv,
    yearly_historical_csv,
    model_output_path="eskom_hourly_model.pkl",
    train_model=True,
    generate_for_countries=None,
    generate_start_year=2019,
    generate_end_year=2024,
    output_dir="./synthetic_data"
):
    """
    Run the complete pipeline: train model and generate synthetic data.
    
    Parameters:
    -----------
    eskom_csv : str
        Path to ESKOM hourly demand data
    yearly_historical_csv : str
        Path to yearly historical data
    model_output_path : str
        Path to save/load trained model
    train_model : bool
        Whether to train the model (set False to use existing model)
    generate_for_countries : list, optional
        List of countries to generate data for. If None, uses all AFRICA_COUNTRIES
    generate_start_year : int
        Start year for generation
    generate_end_year : int
        End year for generation
    output_dir : str
        Directory to save generated synthetic data
    
    Returns:
    --------
    tuple
        (model_path, generated_files) - Path to model and list of generated files
    """
    # Step 1: Train model (if requested)
    if train_model:
        print("=" * 70)
        print("STEP 1: TRAINING MODEL")
        print("=" * 70)
        train_eskom_model(eskom_csv, yearly_historical_csv, model_output_path)
        print("\n")
    else:
        print(f"⏭️  Skipping model training. Using existing model: {model_output_path}")
        if not os.path.exists(model_output_path):
            raise FileNotFoundError(f"Model file not found: {model_output_path}")
    
    # Step 2: Generate synthetic data (if countries specified)
    generated_files = []
    if generate_for_countries is not None:
        print("=" * 70)
        print("STEP 2: GENERATING SYNTHETIC DATA")
        print("=" * 70)
        files = generate_synthetic_demand(
            yearly_historical_csv=yearly_historical_csv,
            model_path=model_output_path,
            countries=generate_for_countries,
            start_year=generate_start_year,
            end_year=generate_end_year,
            output_dir=output_dir,
            zip_output=True
        )
        generated_files = files if isinstance(files, list) else [files]
        print("\n")
    
    print("=" * 70)
    print("✅ PIPELINE COMPLETE")
    print("=" * 70)
    print(f"Model saved to: {model_output_path}")
    if generated_files:
        print(f"Generated {len(generated_files)} files in: {output_dir}")
    
    return model_output_path, generated_files


# ============================================================================
# WORKFLOW EXAMPLES
# ============================================================================

if __name__ == "__main__":
    """
    Complete workflow for preprocessing, training, and generating synthetic hourly data.
    
    Uncomment the sections you want to run:
    """
    
    # ========================================================================
    # STEP 1: TRAIN THE MODEL
    # ========================================================================
    # Train the model using ESKOM data and yearly historical data
    # This only needs to be done once, or when you want to retrain with new data
    
    # train_eskom_model(
    #     eskom_csv="ESK8664.csv",  # Path to ESKOM hourly demand data
    #     owid_csv="yearly_historical_data.csv",  # Path to yearly historical data
    #     model_output_path="eskom_hourly_model.pkl"  # Output path for trained model
    # )
    
    # ========================================================================
    # STEP 2: GENERATE SYNTHETIC DATA - SINGLE COUNTRY
    # ========================================================================
    # Generate synthetic hourly data for a single country
    
    # Option A: Generate for a specific year
    # generate_synthetic_demand(
    #     yearly_historical_csv="yearly_historical_data.csv",
    #     model_path="eskom_hourly_model.pkl",
    #     country="Nigeria",
    #     year_or_date=2022,
    #     output_dir="outputs/single_country"
    # )
    
    # Option B: Generate for a specific date (includes validation plot for South Africa)
    # generate_synthetic_demand(
    #     yearly_historical_csv="yearly_historical_data.csv",
    #     model_path="eskom_hourly_model.pkl",
    #     country="South Africa",
    #     year_or_date="2023-04-01",
    #     eskom_csv="ESK8664.csv",  # For validation plot comparison
    #     output_dir="outputs/single_country"
    # )
    
    # ========================================================================
    # STEP 3: GENERATE SYNTHETIC DATA - MULTIPLE COUNTRIES (BATCH)
    # ========================================================================
    # Generate synthetic hourly data for all African countries
    
    # generate_synthetic_demand(
    #     yearly_historical_csv="yearly_historical_data.csv",
    #     model_path="eskom_hourly_model.pkl",
    #     countries=AFRICA_COUNTRIES,
    #     start_year=2019,
    #     end_year=2024,
    #     output_dir="outputs/batch_countries",
    #     zip_output=True  # Creates a zip file with all generated CSVs
    # )
    
    # ========================================================================
    # STEP 4: EVALUATE EXISTING MODEL
    # ========================================================================
    # Evaluate an existing trained model and view performance metrics
    
    # evaluate_model(
    #     model_path="eskom_hourly_model.pkl",
    #     eskom_csv="ESK8664.csv",
    #     owid_csv="yearly_historical_data.csv"
    # )
    
    # ========================================================================
    # COMPLETE PIPELINE (TRAIN + GENERATE)
    # ========================================================================
    # Run the complete pipeline: train model and generate data for all countries
    
    # run_complete_pipeline(
    #     eskom_csv="ESK8664.csv",
    #     yearly_historical_csv="yearly_historical_data.csv",
    #     model_output_path="eskom_hourly_model.pkl",
    #     train_model=True,  # Set to False to skip training and use existing model
    #     generate_for_countries=AFRICA_COUNTRIES,  # Set to None to skip generation
    #     generate_start_year=2019,
    #     generate_end_year=2024,
    #     output_dir="outputs/complete_pipeline"
    # )
    
    print("✅ Workflow examples ready. Uncomment the sections you want to run.")
