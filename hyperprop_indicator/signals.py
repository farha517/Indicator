"""Signal engine: FVG break-and-retest setups, filtered by the TEMA 8/55 trend.

How it works (bar by bar, only using information available at each bar's close):

1. Swing highs / lows are found with a pivot lookback (default 5 bars each side).
2. When a candle CLOSES above the last swing high (bullish break) we look back
   through the impulse leg for the most recent bullish Fair Value Gap
   (candle k where low[k] > high[k-2]).  That FVG becomes a pending LONG limit
   order.  Bearish breaks below the last swing low mirror this for SHORTs.
3. If price comes back and taps the limit price, the trade is filled.
   The setup is cancelled if price closes through the stop first or it
   isn't filled within `expiry_bars`.
4. Once filled, the trade is tracked until TP or SL is hit.
5. TEMA filter ("the cross"): a setup is only taken if the TEMA(8)/TEMA(55)
   relationship agrees with the direction (see `trend_filter`).
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Literal, Optional

import numpy as np
import pandas as pd

from .indicators import pivot_highs, pivot_lows, tema


@dataclass
class Settings:
    tema_fast: int = 8
    tema_slow: int = 55
    swing_left: int = 5
    swing_right: int = 5
    # "edge" = limit at the near edge of the gap (first touch),
    # "mid"  = limit at the 50% of the gap (consequent encroachment)
    entry_mode: Literal["edge", "mid"] = "edge"
    # "swing" = stop beyond the extreme of the impulse leg
    # "fvg"   = stop beyond the far edge of the gap
    sl_mode: Literal["swing", "fvg"] = "swing"
    sl_buffer_pct: float = 0.0  # extra % padding added to the stop
    rr: float = 2.0  # take profit = entry +/- rr * risk
    expiry_bars: int = 30  # cancel the limit if not filled within N bars
    # "trend" = TEMA fast above slow for longs (below for shorts)
    # "cross" = a TEMA cross in the trade's direction within `cross_lookback` bars
    # "none"  = raw FVG strategy, no TEMA filter
    trend_filter: Literal["trend", "cross", "none"] = "trend"
    cross_lookback: int = 20


@dataclass
class Trade:
    side: Literal["long", "short"]
    setup_bar: int
    setup_time: pd.Timestamp
    entry: float
    stop: float
    target: float
    fvg_top: float
    fvg_bottom: float
    fill_bar: Optional[int] = None
    fill_time: Optional[pd.Timestamp] = None
    exit_bar: Optional[int] = None
    exit_time: Optional[pd.Timestamp] = None
    status: Literal["pending", "open", "win", "loss", "cancelled", "expired"] = "pending"
    r_multiple: Optional[float] = None


@dataclass
class Result:
    df: pd.DataFrame
    trades: list[Trade] = field(default_factory=list)
    settings: Settings = field(default_factory=Settings)

    def trades_frame(self) -> pd.DataFrame:
        return pd.DataFrame([asdict(t) for t in self.trades])

    def stats(self) -> dict:
        closed = [t for t in self.trades if t.status in ("win", "loss")]
        wins = [t for t in closed if t.status == "win"]
        total_r = sum(t.r_multiple or 0 for t in closed)
        return {
            "setups": len(self.trades),
            "filled": sum(1 for t in self.trades if t.fill_bar is not None),
            "closed": len(closed),
            "wins": len(wins),
            "losses": len(closed) - len(wins),
            "win_rate": round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
            "total_R": round(float(total_r), 2),
            "open": sum(1 for t in self.trades if t.status == "open"),
            "pending": sum(1 for t in self.trades if t.status == "pending"),
        }


def _find_fvg(df: pd.DataFrame, start: int, end: int, side: str) -> Optional[tuple[int, float, float]]:
    """Most recent FVG in [start, end] in the given direction -> (bar, top, bottom)."""
    high, low = df["high"].values, df["low"].values
    for k in range(end, max(start, 2) - 1, -1):
        if side == "long" and low[k] > high[k - 2]:
            return k, low[k], high[k - 2]
        if side == "short" and high[k] < low[k - 2]:
            return k, low[k - 2], high[k]
    return None


def run(df: pd.DataFrame, s: Settings | None = None) -> Result:
    """Compute indicator columns and simulate the strategy.

    `df` needs columns: time, open, high, low, close (one row per closed candle).
    """
    s = s or Settings()
    df = df.reset_index(drop=True).copy()
    n = len(df)

    df["tema_fast"] = tema(df["close"], s.tema_fast)
    df["tema_slow"] = tema(df["close"], s.tema_slow)
    above = df["tema_fast"] > df["tema_slow"]
    prev_above = above.shift(1, fill_value=False)
    warm = df.index >= s.tema_slow  # ignore crosses during warm-up
    df["tema_bull_cross"] = above & ~prev_above & warm
    df["tema_bear_cross"] = ~above & prev_above & warm
    df["tema_trend"] = np.where(above, 1, -1)

    ph = pivot_highs(df["high"], s.swing_left, s.swing_right).values
    pl = pivot_lows(df["low"], s.swing_left, s.swing_right).values
    df["swing_high"] = np.where(ph, df["high"], np.nan)
    df["swing_low"] = np.where(pl, df["low"], np.nan)

    for col in ("long_setup", "short_setup", "long_entry", "short_entry", "win", "loss"):
        df[col] = False

    high, low, close = df["high"].values, df["low"].values, df["close"].values
    times = list(df["time"])
    bull_cross_idx = np.where(df["tema_bull_cross"].values)[0]
    bear_cross_idx = np.where(df["tema_bear_cross"].values)[0]

    def trend_ok(side: str, t: int) -> bool:
        if s.trend_filter == "none":
            return True
        if t < s.tema_slow:
            return False
        if s.trend_filter == "trend":
            return bool(above.iat[t]) if side == "long" else not bool(above.iat[t])
        crosses = bull_cross_idx if side == "long" else bear_cross_idx
        recent = crosses[(crosses <= t) & (crosses > t - s.cross_lookback)]
        still = bool(above.iat[t]) if side == "long" else not bool(above.iat[t])
        return len(recent) > 0 and still

    trades: list[Trade] = []
    pending: dict[str, Optional[Trade]] = {"long": None, "short": None}
    open_trades: list[Trade] = []
    last_sh: Optional[tuple[int, float]] = None  # (bar, price) of latest confirmed swing high
    last_sl: Optional[tuple[int, float]] = None
    sh_used = sl_used = False

    for t in range(n):
        ts = times[t]

        # 1) Manage open trades (stop checked first = conservative)
        for tr in list(open_trades):
            if t <= tr.fill_bar:
                continue
            risk = abs(tr.entry - tr.stop)
            hit_sl = low[t] <= tr.stop if tr.side == "long" else high[t] >= tr.stop
            hit_tp = high[t] >= tr.target if tr.side == "long" else low[t] <= tr.target
            if hit_sl or hit_tp:
                tr.status = "loss" if hit_sl else "win"
                tr.r_multiple = -1.0 if hit_sl else abs(tr.target - tr.entry) / risk
                tr.exit_bar, tr.exit_time = t, ts
                df.at[t, "loss" if hit_sl else "win"] = True
                open_trades.remove(tr)

        # 2) Manage pending limit orders
        for side in ("long", "short"):
            tr = pending[side]
            if tr is None or t <= tr.setup_bar:
                continue
            tapped = low[t] <= tr.entry if side == "long" else high[t] >= tr.entry
            if tapped:
                tr.fill_bar, tr.fill_time, tr.status = t, ts, "open"
                df.at[t, f"{side}_entry"] = True
                pending[side] = None
                # Same-candle stop-out (conservative assumption)
                if (side == "long" and low[t] <= tr.stop) or (side == "short" and high[t] >= tr.stop):
                    tr.status, tr.r_multiple, tr.exit_bar, tr.exit_time = "loss", -1.0, t, ts
                    df.at[t, "loss"] = True
                else:
                    open_trades.append(tr)
            elif (side == "long" and close[t] < tr.stop) or (side == "short" and close[t] > tr.stop):
                tr.status = "cancelled"
                pending[side] = None
            elif t - tr.setup_bar >= s.expiry_bars:
                tr.status = "expired"
                pending[side] = None

        # 3) Update swings that become confirmed on this bar
        p = t - s.swing_right
        if p >= 0:
            if ph[p]:
                last_sh, sh_used = (p, high[p]), False
            if pl[p]:
                last_sl, sl_used = (p, low[p]), False

        # 4) Break of structure -> new FVG limit setup
        if last_sh and not sh_used and close[t] > last_sh[1]:
            sh_used = True
            leg_start = last_sh[0] + int(np.argmin(low[last_sh[0]:t + 1]))
            fvg = _find_fvg(df, leg_start, t, "long")
            if fvg and trend_ok("long", t):
                k, top, bottom = fvg
                entry = top if s.entry_mode == "edge" else (top + bottom) / 2
                stop = low[leg_start] if s.sl_mode == "swing" else bottom
                stop *= 1 - s.sl_buffer_pct / 100
                if entry > stop:
                    tr = Trade("long", t, ts, entry, stop, entry + s.rr * (entry - stop), top, bottom)
                    if pending["long"]:
                        pending["long"].status = "cancelled"
                    pending["long"] = tr
                    trades.append(tr)
                    df.at[t, "long_setup"] = True

        if last_sl and not sl_used and close[t] < last_sl[1]:
            sl_used = True
            leg_start = last_sl[0] + int(np.argmax(high[last_sl[0]:t + 1]))
            fvg = _find_fvg(df, leg_start, t, "short")
            if fvg and trend_ok("short", t):
                k, top, bottom = fvg
                entry = bottom if s.entry_mode == "edge" else (top + bottom) / 2
                stop = high[leg_start] if s.sl_mode == "swing" else top
                stop *= 1 + s.sl_buffer_pct / 100
                if stop > entry:
                    tr = Trade("short", t, ts, entry, stop, entry - s.rr * (stop - entry), top, bottom)
                    if pending["short"]:
                        pending["short"].status = "cancelled"
                    pending["short"] = tr
                    trades.append(tr)
                    df.at[t, "short_setup"] = True

    return Result(df=df, trades=trades, settings=s)
