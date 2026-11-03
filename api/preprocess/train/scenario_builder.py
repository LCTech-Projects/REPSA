"""Train the scenario-builder growth panel model.

Run from repo root:
    python api/preprocess/train/scenario_builder.py
"""

import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(API_ROOT))

from preprocess.train.scenario_builder_trainer import run_pipeline


def main() -> None:
    print("=" * 70)
    print("TRAIN SCENARIO BUILDER MODEL")
    print("=" * 70)
    out = run_pipeline()
    print("[OK] Done")
    print(f"Summary: {out['summary_json']}")
    print(f"Metrics: {out['metrics_csv']}")
    print(f"Model: {out['model_path']}")
    print(f"Charts: {out['charts_dir']}")


if __name__ == "__main__":
    main()
