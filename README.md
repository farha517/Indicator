# Key Levels + EMAs [Futures]

Intraday futures indicator, in two versions:

| File | Platform |
|---|---|
| `hyperprop/KeyLevels.js` | **Hyperprop Script** (app.hyperprop.com → Indicators → New script) |
| `KeyLevels.pine` | TradingView Pine v6 |

## What it shows
- **Strategy: swing break + Fair Value Gap (FVG)** — see below. Each setup is drawn as a box with entry, stop and target.
- **Key levels:** the 2 nearest above/below of PDH/PDL, PDC, PD50, ONH/ONL, ORH/ORL, PWH/PWL, PMH/PML, ATH. VWAP optional (off).
- **Stats line:** how every FVG setup on the loaded history played out.
- Colors: green = price above the level (support), red = below (resistance).

## Hyperprop setup
1. New script → Name `Key Levels` → Pane **Overlay** → paste `hyperprop/KeyLevels.js` over the template → **Save & add to chart**.
2. Hyperprop builds levels from the bars the chart has loaded, so weekly/monthly levels need enough history.
   If PMH/PML don't show on a low timeframe, type them into **PMH/PML manual**.
3. **ATH price:** type the real all-time high. Left at 0, the line shows the highest loaded bar and is labelled `HH`.
4. If labels don't appear to the right of the last candle, set **Label offset** to 0.

## The FVG setup (rules)
1. **Swings:** 15m swing highs/lows (a 15m candle higher/lower than the 2 candles on each side), built from your 1–3m chart.
   The current unbroken ones show as dashed `15m High` / `15m Low` lines.
2. **Break:** a candle on your chart **closes** past the swing (a wick alone doesn't count).
3. **Trend filter:** only in the 15m trend direction — the trend is set by the last **15m candle close** past a 15m swing.
4. **FVG:** the first 3-candle gap in that move (within 6 candles of the break), at least 0.15× the average candle size.
   Bullish gap = candle 3's low is above candle 1's high; bearish = candle 3's high is below candle 1's low.
5. **Order:** limit at **50% of the gap**, **stop** 2 ticks past **candle 1**, **take profit 2R** (full exit).
   Size = risk $ ÷ (stop points × $ per point), capped at Max contracts.
6. **Cancel** if not filled within **15 minutes**, or if price reaches the target first.

## Reading the chart
| On the chart | Meaning |
|---|---|
| Box `FVG SELL` + `SELL LMT 29443.50 · 8 MNQ ($68) · until 7:15pm` | Place a sell limit at that price with that size, before that time |
| `SL …` / `TP …` lines | Your stop and target — set them as bracket orders |
| `FILLED SELL … · hands off` | Price came back and filled the order. Let SL or TP close it |
| Faint boxes `WIN +2R` / `LOSS -1R` / `cancelled` | Today's earlier setups and how they ended |
| `FVG: 23 filled · 48% win · +$540` | All setups in the loaded history. With a 2R target you need >33% wins to profit |

The indicator can't see your account; it tracks the setups as if each limit order was placed.
More setups: turn off **Only trade with the swing-timeframe trend**, or set **Swing timeframe** to 5.

## Using the key levels with FVG setups
- An FVG that forms right after breaking **through** a key level (PDH/PDL, ONH/ONL) is usually stronger.
- If the 2R target sits just past a key level in the way, expect a reaction there.

## Decluttering on mobile
- Raise **Merge labels closer than** if labels overlap.
- Set **Hide levels farther than** (e.g. 3) to drop distant levels.
- Keep **Show past setups from last N days** at 1 so only today's boxes show.
- Turn off **Stats line** if you don't need it.
