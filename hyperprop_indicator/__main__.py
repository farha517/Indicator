"""Command line entry point.

  Chart / backtest:  python -m hyperprop_indicator chart --coin BTC --interval 15m
  Live alerts:       python -m hyperprop_indicator live  --coin BTC --interval 15m
"""
from __future__ import annotations

import argparse
import time
import webbrowser
from pathlib import Path

import pandas as pd

from . import alerts
from .chart import build_chart
from .data import INTERVAL_MS, fetch_hyperliquid, load_csv
from .signals import Settings, run


def _settings(a: argparse.Namespace) -> Settings:
    return Settings(tema_fast=a.tema_fast, tema_slow=a.tema_slow, swing_left=a.swing, swing_right=a.swing,
                    entry_mode=a.entry, sl_mode=a.sl, sl_buffer_pct=a.sl_buffer, rr=a.rr,
                    expiry_bars=a.expiry, trend_filter=a.filter, cross_lookback=a.cross_lookback,
                    ob_search=a.ob_search)


def _load(a: argparse.Namespace) -> pd.DataFrame:
    return load_csv(a.csv) if a.csv else fetch_hyperliquid(a.coin, a.interval, a.bars)


def _fmt(tr, coin: str) -> str:
    arrow = "BUY" if tr.side == "long" else "SELL"
    return f"{coin} {arrow} limit {tr.entry:.6g} | SL {tr.stop:.6g} | TP {tr.target:.6g}"


def cmd_chart(a: argparse.Namespace) -> None:
    res = run(_load(a), _settings(a))
    name = a.coin if not a.csv else Path(a.csv).stem
    fig = build_chart(res, title=f"{name} {a.interval} — FVG + TEMA {a.tema_fast}/{a.tema_slow}")
    out = Path(a.out or f"{name}_{a.interval}_fvg_tema.html")
    fig.write_html(out)
    print(f"Chart saved to {out.resolve()}")
    print("Stats:", res.stats())
    if a.trades:
        res.trades_frame().to_csv(a.trades, index=False)
        print(f"Trades saved to {a.trades}")
    if a.open:
        webbrowser.open(out.resolve().as_uri())


def cmd_live(a: argparse.Namespace) -> None:
    s = _settings(a)
    step = INTERVAL_MS[a.interval] / 1000
    seen: set[tuple] = set()
    first = True
    alerts.send(f"Watching {a.coin} {a.interval} (FVG + TEMA {s.tema_fast}/{s.tema_slow}, filter={s.trend_filter})")
    while True:
        try:
            res = run(fetch_hyperliquid(a.coin, a.interval, a.bars), s)
            last = len(res.df) - 1
            for tr in res.trades:
                events = [("setup", tr.setup_bar, f"NEW SETUP — place {_fmt(tr, a.coin)}")]
                if tr.fill_bar is not None:
                    events.append(("fill", tr.fill_bar, f"{'🟢' if tr.side == 'long' else '🔴'} FILLED — {_fmt(tr, a.coin)}"))
                if tr.status in ("win", "loss"):
                    events.append(("exit", tr.exit_bar, f"{'✅ TP' if tr.status == 'win' else '❌ SL'} hit — {_fmt(tr, a.coin)}"))
                if tr.status in ("cancelled", "expired"):
                    events.append(("cancel", tr.setup_bar, f"Setup {tr.status} — cancel {_fmt(tr, a.coin)}"))
                for kind, bar, msg in events:
                    key = (kind, str(tr.setup_time), tr.side)
                    if key in seen:
                        continue
                    seen.add(key)
                    # On start-up only announce things from the latest closed candle
                    if not first or (bar is not None and bar >= last) or tr.status == "pending":
                        alerts.send(msg)
            row = res.df.iloc[-1]
            if row["tema_bull_cross"] and ("x", str(row["time"])) not in seen:
                seen.add(("x", str(row["time"])))
                alerts.send(f"{a.coin} TEMA {s.tema_fast} crossed ABOVE {s.tema_slow} — trend bullish")
            if row["tema_bear_cross"] and ("x", str(row["time"])) not in seen:
                seen.add(("x", str(row["time"])))
                alerts.send(f"{a.coin} TEMA {s.tema_fast} crossed BELOW {s.tema_slow} — trend bearish")
            first = False
        except Exception as e:  # keep running through network hiccups
            print(f"[live] error: {e}")
        # sleep until just after the next candle closes
        now = time.time()
        time.sleep(step - (now % step) + 3)


def main() -> None:
    p = argparse.ArgumentParser(prog="hyperprop_indicator", description="FVG break-and-retest + TEMA 8/55 indicator")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("chart", "live"):
        sp = sub.add_parser(name)
        sp.add_argument("--coin", default="BTC", help="Hyperliquid coin, e.g. BTC, ETH, SOL")
        sp.add_argument("--interval", default="15m", choices=list(INTERVAL_MS))
        sp.add_argument("--bars", type=int, default=1000)
        sp.add_argument("--tema-fast", type=int, default=8)
        sp.add_argument("--tema-slow", type=int, default=55)
        sp.add_argument("--swing", type=int, default=5, help="pivot lookback each side for swing highs/lows")
        sp.add_argument("--entry", choices=["edge", "mid"], default="edge", help="limit at FVG edge or 50%%")
        sp.add_argument("--sl", choices=["swing", "fvg"], default="swing", help="stop beyond leg extreme or FVG")
        sp.add_argument("--sl-buffer", type=float, default=0.0, help="extra stop padding in %%")
        sp.add_argument("--rr", type=float, default=1.0, help="take profit as a multiple of risk")
        sp.add_argument("--expiry", type=int, default=30, help="cancel unfilled limit after N bars")
        sp.add_argument("--filter", choices=["trend", "cross", "none"], default="trend",
                        help="trend: TEMA fast vs slow must agree; cross: recent TEMA cross required; none: off")
        sp.add_argument("--cross-lookback", type=int, default=20)
        sp.add_argument("--ob-search", type=int, default=10, help="candles to search for the order-block candle")
        if name == "chart":
            sp.add_argument("--csv", help="use a CSV of candles instead of Hyperliquid")
            sp.add_argument("--out", help="output HTML file")
            sp.add_argument("--trades", help="also save the trade list to this CSV")
            sp.add_argument("--open", action="store_true", help="open the chart in your browser")
    a = p.parse_args()
    if a.cmd == "live":
        a.csv = None
        cmd_live(a)
    else:
        cmd_chart(a)


if __name__ == "__main__":
    main()
