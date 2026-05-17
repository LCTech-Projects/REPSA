"""Yearly/hourly electricity demand per capita: canonical MWh with legacy kWh CSV support."""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

YEARLY_PER_CAPITA_MWH = "electricity_demand_per_capita (MWh)"
YEARLY_PER_CAPITA_WITH_ACCESS_MWH = "electricity_demand_per_capita_with_access (MWh)"
YEARLY_PER_CAPITA_KWH = "electricity_demand_per_capita (kWh)"
YEARLY_PER_CAPITA_WITH_ACCESS_KWH = "electricity_demand_per_capita_with_access (kWh)"


def yearly_per_capita_mwh(row: pd.Series, *, with_access: bool) -> Optional[float]:
    """Read per-capita demand from a yearly row; prefer (MWh) columns, else (kWh)/1000."""
    mwh_c = YEARLY_PER_CAPITA_WITH_ACCESS_MWH if with_access else YEARLY_PER_CAPITA_MWH
    kwh_c = YEARLY_PER_CAPITA_WITH_ACCESS_KWH if with_access else YEARLY_PER_CAPITA_KWH
    if mwh_c in row.index and pd.notna(row[mwh_c]):
        return float(row[mwh_c])
    if kwh_c in row.index and pd.notna(row[kwh_c]):
        return float(row[kwh_c]) / 1000.0
    return None


def add_yearly_per_capita_mwh_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add electricity_demand_per_capita_mwh columns from (MWh) or legacy (kWh) source columns."""
    out = df.copy()
    if YEARLY_PER_CAPITA_MWH in out.columns:
        out["electricity_demand_per_capita_mwh"] = pd.to_numeric(out[YEARLY_PER_CAPITA_MWH], errors="coerce")
    elif YEARLY_PER_CAPITA_KWH in out.columns:
        out["electricity_demand_per_capita_mwh"] = pd.to_numeric(out[YEARLY_PER_CAPITA_KWH], errors="coerce") / 1000.0
    else:
        out["electricity_demand_per_capita_mwh"] = np.nan

    if YEARLY_PER_CAPITA_WITH_ACCESS_MWH in out.columns:
        out["electricity_demand_per_capita_with_access_mwh"] = pd.to_numeric(
            out[YEARLY_PER_CAPITA_WITH_ACCESS_MWH], errors="coerce"
        )
    elif YEARLY_PER_CAPITA_WITH_ACCESS_KWH in out.columns:
        out["electricity_demand_per_capita_with_access_mwh"] = (
            pd.to_numeric(out[YEARLY_PER_CAPITA_WITH_ACCESS_KWH], errors="coerce") / 1000.0
        )
    else:
        out["electricity_demand_per_capita_with_access_mwh"] = np.nan
    return out
