# FVG Breakaway + TEMA 8/55 + Order Blocks — Hyperprop Script

A custom indicator for **Hyperprop** (app.hyperprop.com) charts, built for MNQ, MYM and MGC on the 2m and 15s timeframes.

**File to paste into Hyperprop:** [`hyperprop/fvg_tema_ob.js`](hyperprop/fvg_tema_ob.js)

## Features (each one can be switched On/Off)
| Feature | What it shows |
|---|---|
| **FVG strategy** | When a candle closes through the **most recent swing high/low**, it boxes the Fair Value Gap left by that breakout move (it waits up to 2 more candles for the breakout candle's own gap to complete). The limit entry is the middle (50%) of the gap and the stop goes past the swing. It draws a yellow entry line, a red dotted stop-loss and a green dotted 1R take-profit, with price tags (`BUY LIMIT 28517.25`, `SL …`, `TP …`) at the right edge. A small arrow marks the fill, and a WIN 🔥 or SL label when the trade ends. Only the live setup is drawn unless **Show past FVG trades** is On. |
| **Order blocks** | The last opposite-colour candle before each break of a swing (a bullish OB is the last red candle before the push up). Up to 3 unbroken OBs per side are shown by default. Raise **Max active OBs per side** for more, or turn on **Show broken order blocks**. |
| **TEMA lines** | TEMA 8 and TEMA 55, with dots where they cross |
| **TEMA trend background** | Green when TEMA 8 > TEMA 55, red when it's below |
| **Swing high / low lines** | The most recent swing high and swing low |

The **TEMA filter for FVG trades** (Trend / Recent cross / Off) controls whether FVG setups must agree with the TEMA trend. Every colour can be changed in the settings.

## Add it in Hyperprop
1. Open the script editor (**New script**).
2. Name it. Set **Pane** to **Overlay** (not "Separate pane").
3. Replace all of the template source with the contents of `hyperprop/fvg_tema_ob.js`.
4. Tap **Save & add to chart**. All settings show up in the indicator's settings dialog.

Set **Tick size** to match the contract you trade: MNQ 0.25, MYM 1, MGC 0.1. It's used for the stop buffer.

## Tests
```bash
node hyperprop/test/run_tests.js
```

---

## Python backtester (optional, for exported candle CSVs)
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
