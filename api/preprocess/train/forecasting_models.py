"""Train yearly forecasting models for story mode.

Run from repo root:
    python api/preprocess/train/forecasting_models.py
"""

import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(API_ROOT))

from app.utils.config import Config
from app.utils.ml_forecasting import train_forecasting_models


def main() -> None:
    print("=" * 70)
    print("TRAINING ML FORECASTING MODELS")
    print("=" * 70)
    print(f"Data: {API_ROOT / 'data' / 'historical' / 'yearly_historical_data.csv'}")
    print(f"Models: {Config.MODEL_DIR}")
    print("=" * 70)

    metrics = train_forecasting_models()
    if not metrics:
        print("[WARN] No models trained. Check data availability.")
        return

    for target, target_metrics in metrics.items():
        print(f"{target}: test R²={target_metrics['test']['R2']:.4f}")

    print(f"[OK] Saved to {Config.MODEL_DIR}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ERROR] {exc}")
        raise SystemExit(1) from exc
