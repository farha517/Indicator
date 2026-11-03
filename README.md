# Key Levels + EMAs [Futures]

TradingView Pine Script v6 indicator for intraday futures (`KeyLevels.pine`).

## What it shows
- **Levels:** PDH/PDL, PWH/PWL, PMH/PML, ATH, overnight high/low (ONH/ONL), opening range (ORH/ORL)
- **Moving averages:** EMA 9, EMA 20, SMA 200
- **Colors:** green = price above the level (support), red = price below it (resistance). Line style shows the timeframe: day solid, week dashed, month dotted, ATH thick, ON/OR dotted.
- **Signals:** `RT` = break and retest, `SW` = sweep/rejection (wick through the level, close back). Green markers below the bar are bullish; red markers above are bearish. Tap a marker for details.
- **Table:** overall bias (EMA stack, 200 SMA, prior-day range, opening range), nearest resistance and support with distance, and a short "what to look for" line. Tap any cell or label for the full playbook.

## Install
1. TradingView → Pine Editor → New → paste `KeyLevels.pine` → Add to chart.
2. Settings → Levels → **ATH symbol**: set `CME_MINI:ES1!` / `CME_MINI:NQ1!` (etc.) when charting a dated contract.
3. Alerts: Create alert → condition "Key Levels + EMAs" → **Any alert() function call**.

## Decluttering for mobile
- Raise *Merge labels closer than* if labels overlap.
- Set *Hide levels farther than* (e.g. 3) to drop distant levels.
- Table → *Bias only*, or text size *tiny*.
