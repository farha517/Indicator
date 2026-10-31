"""Interactive HTML chart: candles, TEMA 8/55, swings, FVG setups, arrows, trend background."""
from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go

from .signals import Result

BULL = "#26a69a"
BEAR = "#ef5350"


def _trend_segments(df: pd.DataFrame):
    """Yield (start_time, end_time, trend) runs for background shading."""
    trend = df["tema_trend"].values
    times = df["time"].values
    start = 0
    for i in range(1, len(df) + 1):
        if i == len(df) or trend[i] != trend[start]:
            end = times[i] if i < len(df) else times[i - 1]
            yield times[start], end, trend[start]
            start = i


def build_chart(res: Result, title: str = "FVG + TEMA Cross") -> go.Figure:
    df, s = res.df, res.settings
    last_time = df["time"].iloc[-1]
    fig = go.Figure()

    # Background colour = TEMA trend (fast above slow = green, below = red)
    for x0, x1, tr in _trend_segments(df.iloc[s.tema_slow:]):
        fig.add_vrect(x0=x0, x1=x1, fillcolor=BULL if tr == 1 else BEAR,
                      opacity=0.08, line_width=0, layer="below")

    fig.add_trace(go.Candlestick(x=df["time"], open=df["open"], high=df["high"], low=df["low"],
                                 close=df["close"], name="Price",
                                 increasing_line_color=BULL, decreasing_line_color=BEAR))
    fig.add_trace(go.Scatter(x=df["time"], y=df["tema_fast"], name=f"TEMA {s.tema_fast}",
                             line=dict(color="#2962ff", width=1.5)))
    fig.add_trace(go.Scatter(x=df["time"], y=df["tema_slow"], name=f"TEMA {s.tema_slow}",
                             line=dict(color="#ff9800", width=1.5)))

    # Swing points
    fig.add_trace(go.Scatter(x=df["time"], y=df["swing_high"], mode="markers", name="Swing high",
                             marker=dict(symbol="line-ew", size=10, color="#9e9e9e", line_width=2)))
    fig.add_trace(go.Scatter(x=df["time"], y=df["swing_low"], mode="markers", name="Swing low",
                             marker=dict(symbol="line-ew", size=10, color="#9e9e9e", line_width=2)))

    # TEMA cross markers (small)
    bc, sc = df[df["tema_bull_cross"]], df[df["tema_bear_cross"]]
    fig.add_trace(go.Scatter(x=bc["time"], y=bc["tema_fast"], mode="markers", name="TEMA bull cross",
                             marker=dict(symbol="circle", size=7, color=BULL, line=dict(color="white", width=1))))
    fig.add_trace(go.Scatter(x=sc["time"], y=sc["tema_fast"], mode="markers", name="TEMA bear cross",
                             marker=dict(symbol="circle", size=7, color=BEAR, line=dict(color="white", width=1))))

    # Order blocks: from the OB candle until price closes through them
    for ob in res.order_blocks:
        end = df["time"].iloc[ob.end_bar] if ob.end_bar is not None else last_time
        color = BULL if ob.side == "bull" else BEAR
        fig.add_shape(type="rect", x0=df["time"].iloc[ob.bar], x1=end, y0=ob.bottom, y1=ob.top,
                      fillcolor=color, opacity=0.10, line=dict(color=color, width=1, dash="dot"))

    # FVG zones + entry / SL / TP lines for every setup
    for tr in res.trades:
        x0 = tr.setup_time
        x1 = tr.exit_time or tr.fill_time or last_time
        if tr.status in ("cancelled", "expired"):
            x1 = x0 + (df["time"].iloc[1] - df["time"].iloc[0]) * s.expiry_bars if len(df) > 1 else x0
            x1 = min(x1, last_time)
        color = BULL if tr.side == "long" else BEAR
        fig.add_shape(type="rect", x0=x0, x1=x1, y0=tr.fvg_bottom, y1=tr.fvg_top,
                      fillcolor=color, opacity=0.18, line_width=0)
        if tr.fill_bar is None and tr.status != "pending":
            continue  # unfilled & dead: just show the zone
        for y, c, dash in ((tr.entry, "#ffffff", "dot"), (tr.stop, BEAR, "dash"), (tr.target, BULL, "dash")):
            fig.add_shape(type="line", x0=x0, x1=x1, y0=y, y1=y, line=dict(color=c, width=1, dash=dash))

    # Entry arrows (limit filled) — the main buy/sell signal
    le, se = df[df["long_entry"]], df[df["short_entry"]]
    long_trades = {t.fill_bar: t for t in res.trades if t.side == "long" and t.fill_bar is not None}
    short_trades = {t.fill_bar: t for t in res.trades if t.side == "short" and t.fill_bar is not None}
    fig.add_trace(go.Scatter(
        x=le["time"], y=le["low"] * 0.998, mode="markers+text", name="BUY", text=["BUY"] * len(le),
        textposition="bottom center", textfont=dict(color=BULL),
        marker=dict(symbol="triangle-up", size=14, color=BULL),
        hovertext=[f"BUY @ {long_trades[i].entry:.4f}<br>SL {long_trades[i].stop:.4f}<br>TP {long_trades[i].target:.4f}"
                   for i in le.index], hoverinfo="text"))
    fig.add_trace(go.Scatter(
        x=se["time"], y=se["high"] * 1.002, mode="markers+text", name="SELL", text=["SELL"] * len(se),
        textposition="top center", textfont=dict(color=BEAR),
        marker=dict(symbol="triangle-down", size=14, color=BEAR),
        hovertext=[f"SELL @ {short_trades[i].entry:.4f}<br>SL {short_trades[i].stop:.4f}<br>TP {short_trades[i].target:.4f}"
                   for i in se.index], hoverinfo="text"))

    st = res.stats()
    subtitle = (f"setups {st['setups']} | filled {st['filled']} | W {st['wins']} / L {st['losses']} "
                f"({st['win_rate']}%) | total {st['total_R']}R | filter: {s.trend_filter}")
    fig.update_layout(title=f"{title}<br><sup>{subtitle}</sup>", template="plotly_dark",
                      xaxis_rangeslider_visible=False, height=800, hovermode="x unified",
                      legend=dict(orientation="h", y=-0.08))
    return fig
