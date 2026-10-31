"""Core indicator math: TEMA and swing-high / swing-low pivots."""
from __future__ import annotations

import pandas as pd


def ema(series: pd.Series, length: int) -> pd.Series:
    """Exponential moving average (same smoothing as TradingView's ta.ema)."""
    return series.ewm(span=length, adjust=False).mean()


def tema(series: pd.Series, length: int) -> pd.Series:
    """Triple EMA: 3*EMA1 - 3*EMA2 + EMA3."""
    e1 = ema(series, length)
    e2 = ema(e1, length)
    e3 = ema(e2, length)
    return 3 * e1 - 3 * e2 + e3


def pivot_highs(high: pd.Series, left: int, right: int) -> pd.Series:
    """True at bar i if high[i] is the highest of the `left` bars before and `right` bars after.

    NOTE: a pivot at bar i is only *known* at bar i + right. The signal engine
    accounts for that so there's no look-ahead.
    """
    window = left + right + 1
    rolling_max = high.rolling(window).max().shift(-right)
    return (high == rolling_max) & rolling_max.notna()


def pivot_lows(low: pd.Series, left: int, right: int) -> pd.Series:
    window = left + right + 1
    rolling_min = low.rolling(window).min().shift(-right)
    return (low == rolling_min) & rolling_min.notna()
