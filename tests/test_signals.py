import numpy as np
import pandas as pd

from hyperprop_indicator.indicators import tema
from hyperprop_indicator.signals import Settings, run


def _frame(closes, spread=0.5):
    closes = np.asarray(closes, dtype=float)
    opens = np.r_[closes[0], closes[:-1]]
    return pd.DataFrame({
        "time": pd.date_range("2026-01-01", periods=len(closes), freq="15min", tz="UTC"),
        "open": opens,
        "high": np.maximum(opens, closes) + spread,
        "low": np.minimum(opens, closes) - spread,
        "close": closes,
    })


def test_tema_tracks_constant_series():
    s = pd.Series([5.0] * 100)
    assert np.allclose(tema(s, 8), 5.0)


def _break_and_retest():
    # uptrend -> swing high ~110.5 -> pullback -> impulsive break leaving a bullish FVG
    # (bar 80: low 105.5 > high 104.5 two bars earlier) -> retest into the gap -> rally
    up = list(np.linspace(80, 110, 70))
    pull = list(np.linspace(109, 103, 8))
    impulse = [104, 106, 112, 114]
    retest = [111, 108, 106]
    rally = list(np.linspace(107, 130, 25))
    return _frame(up + pull + impulse + retest + rally)


def test_bullish_break_retest_produces_winning_long():
    res = run(_break_and_retest(), Settings(swing_left=3, swing_right=3, trend_filter="none"))
    first = res.trades[0]
    assert first.side == "long" and first.setup_bar == 80
    assert (first.entry, first.stop) == (105.5, 102.5)
    assert first.target == 105.5 + 2 * 3
    assert first.fill_bar is not None and first.status == "win"
    assert res.df.loc[first.fill_bar, "long_entry"]


def test_tema_filter_blocks_counter_trend_setup():
    # At the break bar TEMA 8 is still below TEMA 55, so the trend filter rejects it
    res = run(_break_and_retest(), Settings(swing_left=3, swing_right=3, trend_filter="trend"))
    assert all(t.setup_bar != 80 for t in res.trades)


def test_no_lookahead():
    """Signals on a truncated series must match the same bars of the full series."""
    rng = np.random.default_rng(1)
    closes = 100 + np.cumsum(rng.normal(0, 1, 600))
    df = _frame(closes, spread=0.8)
    full = run(df, Settings(swing_left=3, swing_right=3)).df
    part = run(df.iloc[:400], Settings(swing_left=3, swing_right=3)).df
    cols = ["long_setup", "short_setup", "long_entry", "short_entry", "tema_bull_cross", "tema_bear_cross"]
    pd.testing.assert_frame_equal(full.loc[:399, cols], part[cols])
