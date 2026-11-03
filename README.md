# Key Levels + EMAs [Futures]

Intraday futures indicator, in two versions:

| File | Platform |
|---|---|
| `hyperprop/KeyLevels.js` | **Hyperprop Script** (app.hyperprop.com → Indicators → New script) |
| `KeyLevels.pine` | TradingView Pine v6 |

## What it shows
- **Levels:** PDH/PDL, prior-day close (PDC) and 50% (PD50), VWAP (resets 6pm ET), PWH/PWL, PMH/PML, ATH, overnight high/low (ONH/ONL, 6pm ET → RTH open), opening range (ORH/ORL)
- **Moving averages:** EMA 9, EMA 20, SMA 200
- **Colors:** green = price above the level (support), red = price below (resistance).
  Line style = timeframe: day solid, week dashed, month dotted, ATH thick, ON/OR dotted grey.
- **Signals** (closed bars only):
  - `RT` = break & retest (old resistance holding as support, or the reverse)
  - `SW` = sweep: wick through the level, close back (stop run / failed breakout)
  - Below the bar = bullish, above = bearish. The text names the level, e.g. `SW PDH`.
- **Bias label:** BULLISH / BEARISH / NEUTRAL score (−5…+5) from the EMA 9/20 stack, 200 SMA, VWAP, prior-day range and opening range,
  plus "what to look for" right now and the nearest level above and below.

## Hyperprop setup
1. New script → Name `Key Levels` → Pane **Overlay** → paste `hyperprop/KeyLevels.js` over the template → **Save & add to chart**.
2. Hyperprop builds levels from the bars the chart has loaded, so weekly/monthly levels need enough history.
   If PMH/PML don't show on a low timeframe, type them into **PMH/PML manual**.
3. **ATH price:** type the real all-time high. Left at 0, the line shows the highest loaded bar and is labelled `HH`.
4. If labels don't appear to the right of the last candle, set **Label offset** to 0.

## How it talks to you (one instruction at a time)
| Label | Meaning |
|---|---|
| `WAIT ▸ no level nearby` | Mid-range. Do nothing. |
| `WAIT ▸ at PDH, watching for a setup` | Price is at a level. Still do nothing. |
| `SETUP FORMING ▸ wait for close 1:42` | A setup may be building. **Don't enter**, wait for the candle to close. |
| `GO LONG ▸ up to 28240 · SL 28228 · 3 MNQ ($72)` | Valid entry. Shaded box = entry zone. Valid for 3 candles. |
| `MISSED ▸ don't chase` | Price left the entry zone. Let it go. |
| `MANAGE ▸ SL … · TP1 … · no new entries` | In a trade. Hold, no adding. |
| `TP1 HIT ▸ stop to entry, hold for TP2` | Take partials, move stop to break-even. |
| `DONE FOR TODAY ▸ 2 losses` | Stop trading until the next session (6pm ET). |

- Stop goes 0.25 ATR past the signal wick (min 0.5 ATR). **TP1 = 1R: take half, stop to entry. TP2 = next key level.**
- Only **A+** setups: agree with the bias, ≥1.5R of room to the next level, strong close + above-average volume, and the stop fits your risk.
- One trade at a time. Size = $75 ÷ (stop in points × $ per point), capped at 5 contracts. Set **Contract** (MNQ, NQ, MES, ES …).
- The daily stop counts the indicator's own setups (stopped out before TP1), not your account fills.
- **Stats line** (bottom): how the A+ setups did on the loaded history: count, % that hit TP1, average R and total R in $ (half off at TP1, rest at TP2 or break-even).
- **Chart mode: Minimal** (default) shows the 2 nearest levels above/below, VWAP, today's signals and the plan.
  **Full** shows every level, EMA 9/20 and SMA 200.

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
