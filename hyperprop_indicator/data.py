"""Candle data: Hyperliquid public API (what HyperProp trades on) or a CSV file."""
from __future__ import annotations

import time

import pandas as pd
import requests

HL_INFO_URL = "https://api.hyperliquid.xyz/info"

INTERVAL_MS = {
    "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
    "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "8h": 28_800_000,
    "12h": 43_200_000, "1d": 86_400_000,
}


def fetch_hyperliquid(coin: str, interval: str, bars: int = 1000, drop_open_candle: bool = True) -> pd.DataFrame:
    """Fetch the latest `bars` candles for `coin` (e.g. "BTC", "ETH", "SOL").

    Hyperliquid returns at most ~5000 candles per request.
    """
    if interval not in INTERVAL_MS:
        raise ValueError(f"interval must be one of {list(INTERVAL_MS)}")
    now = int(time.time() * 1000)
    start = now - (bars + 2) * INTERVAL_MS[interval]
    payload = {"type": "candleSnapshot", "req": {"coin": coin, "interval": interval, "startTime": start, "endTime": now}}
    resp = requests.post(HL_INFO_URL, json=payload, timeout=20)
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        raise RuntimeError(f"No candles returned for {coin} {interval}")
    df = pd.DataFrame(rows)
    df = pd.DataFrame({
        "time": pd.to_datetime(df["t"], unit="ms", utc=True),
        "close_time": pd.to_datetime(df["T"], unit="ms", utc=True),
        "open": df["o"].astype(float),
        "high": df["h"].astype(float),
        "low": df["l"].astype(float),
        "close": df["c"].astype(float),
        "volume": df["v"].astype(float),
    })
    if drop_open_candle:
        df = df[df["close_time"] < pd.Timestamp.now(tz="UTC")]
    return df.drop(columns="close_time").tail(bars).reset_index(drop=True)


def load_csv(path: str) -> pd.DataFrame:
    """Load candles from CSV with columns time, open, high, low, close[, volume].

    Works with TradingView "Export chart data" files (column `time` as unix seconds or ISO date).
    """
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    t = df["time"]
    if pd.api.types.is_numeric_dtype(t):
        unit = "ms" if t.iloc[0] > 1e11 else "s"
        df["time"] = pd.to_datetime(t, unit=unit, utc=True)
    else:
        df["time"] = pd.to_datetime(t, utc=True)
    return df[[c for c in ("time", "open", "high", "low", "close", "volume") if c in df.columns]]
