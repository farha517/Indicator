# Key Levels + EMAs [Futures]

Intraday futures indicator, in two versions:

| File | Platform |
|---|---|
| `hyperprop/KeyLevels.js` | **Hyperprop Script** (app.hyperprop.com → Indicators → New script) |
| `KeyLevels.pine` | TradingView Pine v6 |

## What it shows
- **Levels:** PDH/PDL, PWH/PWL, PMH/PML, ATH, overnight high/low (ONH/ONL, 6pm ET → RTH open), opening range (ORH/ORL)
- **Moving averages:** EMA 9, EMA 20, SMA 200
- **Colors:** green = price above the level (support), red = price below (resistance).
  Line style = timeframe: day solid, week dashed, month dotted, ATH thick, ON/OR dotted grey.
- **Signals** (closed bars only):
  - `RT` = break & retest (old resistance holding as support, or the reverse)
  - `SW` = sweep: wick through the level, close back (stop run / failed breakout)
  - Below the bar = bullish, above = bearish. The text names the level, e.g. `SW PDH`.
- **Bias label:** BULLISH / BEARISH / NEUTRAL score (−4…+4) from the EMA 9/20 stack, 200 SMA, prior-day range and opening range,
  plus "what to look for" right now and the nearest level above and below.

## Hyperprop setup
1. New script → Name `Key Levels` → Pane **Overlay** → paste `hyperprop/KeyLevels.js` over the template → **Save & add to chart**.
2. Hyperprop builds levels from the bars the chart has loaded, so weekly/monthly levels need enough history.
   If PMH/PML don't show on a low timeframe, type them into **PMH/PML manual**.
3. **ATH price:** type the real all-time high. Left at 0, the line shows the highest loaded bar and is labelled `HH`.
4. If labels don't appear to the right of the last candle, set **Label offset** to 0.

## Trade plan & patience (built in)
- **A+ setups only** (default): a signal is shown only if it agrees with the bias score **and** TP1 is at least **1.5R** away.
  Marker text: `A+ SW PDL 2.1R` = grade, setup, level, reward:risk to TP1.
- When an A+ setup fires, the chart draws **LONG/SHORT entry**, **SL** (just past the signal candle's wick) and **TP1/TP2** (the next key levels).
  After TP1 is hit the label changes to **SL → BE** (move stop to entry). The plan disappears when stopped out, TP2 hits, or after 48 bars.
- The coach label tells you what to do right now: `Mid-range: NO TRADE, wait for a level`, `At PDH: wait SW → short`, `In plan: respect SL, no adding`.

## Playbook (what to look for)
| Situation | Bullish | Bearish |
|---|---|---|
| Price below a level (resistance) | Break, close & hold above, then retest (`RT`) → long | Rejection / wick through and close back below (`SW`) → short, stop above wick |
| Price above a level (support) | Pullback holds / retest (`RT`) → long, stop below | Close back below = failed breakout → short toward next level |
| Inside prior-day range | Fade PDL toward PDH | Fade PDH toward PDL |
| Outside prior-day range | Above PDH = trend up, buy pullbacks to PDH/EMAs | Below PDL = trend down, sell rallies to PDL/EMAs |
| ONH / ONL | Sweeps of the overnight extremes in the first hour are common reversal spots | |
| Opening range | OR break often sets the day's direction; a failed OR break often runs to the other side | |
| ATH | Above = price discovery, no overhead supply; buy retests | Failed break back below ATH often reverses hard |

## Decluttering on mobile
- Raise **Merge labels closer than** if labels overlap.
- Set **Hide levels farther than** (e.g. 3) to drop distant levels.
- Turn off the bias label, or reduce **Show signals from last N days** / raise **Cooldown per level**.
