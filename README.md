# Breakaway FVG + TEMA 8/55 + Order Blocks

An indicator that combines a Fair Value Gap (FVG) break-and-retest strategy with a TEMA 8/55 trend filter and order blocks. It's built for MNQ, MYM and MGC on the 2m and 15s charts.

There are two versions:
- **`tradingview/fvg_tema_ob.pine`** is the main one. It runs directly on your TradingView charts, including the mobile app.
- **`hyperprop_indicator/`** is a Python backtester for exported candle CSVs.

## How it works
1. **Range High / Range Low** are the latest confirmed swing high and swing low. You can switch this to a session time window instead.
2. A candle **closes** through the Range High (bullish) or Range Low (bearish).
3. The FVG left by that impulse move becomes the **setup zone**. A limit order is placed at the gap with a **stop-loss** and a **take-profit at 1R**.
4. When price comes back and taps the limit, a **BUY / SELL arrow** appears and an alert fires. When the trade closes, a WIN 🎉 or SL label appears and the win streak updates.
5. **TEMA 8 / 55 filter:** longs only when TEMA 8 > TEMA 55, shorts only when it's below. The background is green or red to match.
6. **Order blocks:** every break also marks the last opposite-colour candle before the move (a bullish OB is the last red candle before the push up). The box extends right until price closes through it. You get an alert the first time price taps it.

## Install on TradingView
1. On tradingview.com (in a browser), open a chart, then click **Pine Editor** at the bottom.
2. Delete the template code. Paste in everything from `tradingview/fvg_tema_ob.pine`.
3. Click **Save**, then **Add to chart**.
4. On your phone it now shows under **Indicators → My scripts**.
5. **Alerts:** open Create alert, set the condition to this indicator, and choose **"Any alert() function call"**. That alert includes the entry, SL and TP prices. You can also pick a single event instead, such as "BUY filled".

### Main settings (gear icon)
| Setting | Default | Notes |
|---|---|---|
| Range source | Swing pivots | Or "Session range" (e.g. 09:30–09:45 New York time) |
| Swing strength | 5 | Candles needed on each side of a swing. Lower it for more, smaller swings |
| Limit entry | FVG edge | Or FVG 50% |
| Stop-loss | Swing (+2 ticks) | Or just beyond the FVG |
| Take-profit (R) | 1.0 | |
| Cancel limit after | 30 candles | |
| TEMA filter | Trend | "Recent cross" also needs a fresh cross. "Off" turns the filter off |
| Order blocks | On, 4 per side | |

The script only acts on **closed** candles, so arrows don't repaint.

---

## Python backtester (optional)
### Setup
```bash
pip install -r requirements.txt
```

### Usage
```bash
# Interactive chart + backtest (saves an HTML file; --open opens it in your browser)
python -m hyperprop_indicator chart --coin BTC --interval 15m --bars 1500 --open

# Save the trade list as well
python -m hyperprop_indicator chart --coin ETH --interval 5m --trades eth_trades.csv

# Futures (MNQ/MYM/MGC): export candles from TradingView (chart menu → Export chart data)
python -m hyperprop_indicator chart --csv MNQ1_2m.csv --open

# Live alerts: checks after every candle close
python -m hyperprop_indicator live --coin BTC --interval 15m
```

### Discord / Telegram alerts
Set these environment variables before running `live`:
```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
export TELEGRAM_BOT_TOKEN="123:abc"  TELEGRAM_CHAT_ID="123456"
```

### Settings
| Flag | Default | Meaning |
|---|---|---|
| `--tema-fast` / `--tema-slow` | 8 / 55 | TEMA lengths |
| `--swing` | 5 | Bars on each side of a candle needed to confirm a swing high/low |
| `--entry` | `edge` | Limit at the gap's near edge (`edge`) or its 50% level (`mid`) |
| `--sl` | `swing` | Stop beyond the impulse leg's extreme (`swing`) or beyond the FVG (`fvg`) |
| `--sl-buffer` | 0 | Extra stop padding in % |
| `--rr` | 1.0 | Take profit = entry ± RR × risk |
| `--expiry` | 30 | Cancel the limit order if it isn't filled within N bars |
| `--ob-search` | 10 | How many candles back from the leg extreme to search for the order-block candle |
| `--filter` | `trend` | `trend`: TEMA 8 must be on the right side of 55. `cross`: a TEMA cross in the trade's direction within `--cross-lookback` bars. `none`: FVG only |

### Rules in detail
- Swings are pivots and only count once confirmed, `--swing` bars later, so there's no repainting or look-ahead (covered by a test).
- Long setup: a close above the last confirmed swing high. The engine takes the most recent bullish FVG (`low[k] > high[k-2]`) in the leg from the lowest point after that swing high up to the breakout candle. Shorts mirror this.
- A new setup in the same direction replaces an older unfilled one. A setup is cancelled if price closes beyond its stop before filling.
- If the stop and target are both touched in the same candle, the trade counts as a loss (conservative).

### Tests
```bash
pip install pytest && python -m pytest -q
```
