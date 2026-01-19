"""
Script to train ML forecasting models for policy analysis.

Run this script to train models that will be used for baseline forecasts
in the Policy Analyzer and Scenario Builder.

Usage:
    python train_forecasting_models.py
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.ml_forecasting import train_forecasting_models
from app.utils.config import Config

if __name__ == "__main__":
    print("="*70)
    print("TRAINING ML FORECASTING MODELS")
    print("="*70)
    print(f"Data path: {os.path.join(Config.DATA_DIR, 'historical', 'yearly_historical_data.csv')}")
    print(f"Model directory: {Config.MODEL_DIR}")
    print("="*70)
    print()
    
    try:
        metrics = train_forecasting_models()
        
        if metrics:
            print("\n" + "="*70)
            print("SUMMARY")
            print("="*70)
            for target, target_metrics in metrics.items():
                test_r2 = target_metrics['test']['R2']
                print(f"{target}:")
                print(f"  Test R²: {test_r2:.4f}")
                print(f"  Test RMSE: {target_metrics['test']['RMSE']:.2f}")
                print()
            
            print("✅ All models trained successfully!")
            print(f"Models saved to: {Config.MODEL_DIR}")
        else:
            print("⚠️  No models were trained. Check data availability.")
            
    except Exception as e:
        print(f"\n❌ Error training models: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
