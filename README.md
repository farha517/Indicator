# HyperProp FVG + TEMA Cross Indicator

A Python indicator that combines two strategies for trading Hyperliquid perps (what HyperProp accounts trade):

1. **FVG break-and-retest.** It marks swing highs and lows. When a candle **closes** through one, it finds the Fair Value Gap left by the impulse move and places a **limit order** at the gap. If price comes back and taps it, the trade is filled. Every setup shows its **entry, stop loss and take profit**.
2. **TEMA 8 / 55 filter (the "cross").** A setup is only taken when the TEMA trend agrees: TEMA 8 above TEMA 55 for longs, below for shorts.

## Output
- **BUY / SELL arrows** where a limit order gets filled. Hover over an arrow to see its entry, SL and TP.
- **Background colour.** Green when TEMA 8 is above TEMA 55, red when it's below. Small dots mark each TEMA cross.
- **FVG zones** with dashed SL/TP lines and a dotted entry line.
- **Alerts** in live mode: new setup (place the limit), filled, TP hit, SL hit, setup cancelled, TEMA cross. They print to the console and can also go to Discord or Telegram.
- **Backtest stats** in the chart title: setups, fills, wins/losses, win rate and total R.

## Setup
```bash
pip install -r requirements.txt
```

## Usage
```bash
# Interactive chart + backtest (saves an HTML file; --open opens it in your browser)
python -m hyperprop_indicator chart --coin BTC --interval 15m --bars 1500 --open

# Save the trade list as well
python -m hyperprop_indicator chart --coin ETH --interval 5m --trades eth_trades.csv

# Use a CSV of candles instead (e.g. TradingView "Export chart data")
python -m hyperprop_indicator chart --csv my_candles.csv

# Live alerts: checks after every candle close
python -m hyperprop_indicator live --coin BTC --interval 15m
```

### Discord / Telegram alerts
Set these environment variables before running `live`:
```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
export TELEGRAM_BOT_TOKEN="123:abc"  TELEGRAM_CHAT_ID="123456"
```

## Settings
| Flag | Default | Meaning |
|---|---|---|
| `--tema-fast` / `--tema-slow` | 8 / 55 | TEMA lengths |
| `--swing` | 5 | Bars on each side of a candle needed to confirm a swing high/low |
| `--entry` | `edge` | Limit at the gap's near edge (`edge`) or its 50% level (`mid`) |
| `--sl` | `swing` | Stop beyond the impulse leg's extreme (`swing`) or beyond the FVG (`fvg`) |
| `--sl-buffer` | 0 | Extra stop padding in % |
| `--rr` | 2.0 | Take profit = entry ± RR × risk |
| `--expiry` | 30 | Cancel the limit order if it isn't filled within N bars |
| `--filter` | `trend` | `trend`: TEMA 8 must be on the right side of 55. `cross`: a TEMA cross in the trade's direction within `--cross-lookback` bars. `none`: FVG only |

## Rules in detail
- Swings are pivots and only count once confirmed, `--swing` bars later, so there's no repainting or look-ahead (covered by a test).
- Long setup: a close above the last confirmed swing high. The engine takes the most recent bullish FVG (`low[k] > high[k-2]`) in the leg from the lowest point after that swing high up to the breakout candle. Shorts mirror this.
- A new setup in the same direction replaces an older unfilled one. A setup is cancelled if price closes beyond its stop before filling.
- If the stop and target are both touched in the same candle, the trade counts as a loss (conservative).

## Tests
```bash
pip install pytest && python -m pytest -q
```
