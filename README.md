# Key Levels + EMAs [Futures]

Intraday futures indicator, in two versions:

| File | Platform |
|---|---|
| `hyperprop/KeyLevels.js` | **Hyperprop Script** (app.hyperprop.com → Indicators → New script) |
| `KeyLevels.pine` | TradingView Pine v6 |

## What it shows
- **Levels:** PDH/PDL, prior-day close (PDC) and 50% (PD50), VWAP (resets 6pm ET), PWH/PWL, PMH/PML, ATH, overnight high/low (ONH/ONL, 6pm ET → RTH open), opening range (ORH/ORL)
- **Moving averages:** EMA 9, EMA 20, SMA 200 (always used for the trend filters; drawn in Full mode)
- **Colors:** green = price above the level (support), red = price below (resistance).
  Line style = timeframe: day solid, week dashed, month dotted, ATH thick, ON/OR dotted grey.
- **Signals:** three trend-following setups (PB, RT, SW, below), each scored on your own chart data. Closed candles only.
- **One instruction at a time** above price (WAIT / FORMING / GO / MISSED / MANAGE / SIT OUT) and a per-setup stats line below.
- **Chart mode: Minimal** (default) shows only the 2 nearest levels above/below, VWAP, today's signals and the trade plan. **Full** adds every level and EMA 9/20 + SMA 200.

## Hyperprop setup
1. New script → Name `Key Levels` → Pane **Overlay** → paste `hyperprop/KeyLevels.js` over the template → **Save & add to chart**.
2. Hyperprop builds levels from the bars the chart has loaded, so weekly/monthly levels need enough history.
   If PMH/PML don't show on a low timeframe, type them into **PMH/PML manual**.
3. **ATH price:** type the real all-time high. Left at 0, the line shows the highest loaded bar and is labelled `HH`.
4. If labels don't appear to the right of the last candle, set **Label offset** to 0.

## The three setups (all trade WITH the trend)
| Setup | What happens | Trend filter |
|---|---|---|
| **PB** pullback | Price dips to VWAP or EMA 20, then a strong candle closes back with the trend | EMA 9 > EMA 20, EMA 20 rising, price above VWAP (mirror for shorts) |
| **RT** retest | Price breaks a key level, comes back to it, holds, strong close | Same short-term trend as PB |
| **SW** sweep | Price wicks through a key level and closes back (stop run) | 200 SMA rising and price above it (mirror for shorts) |

Every signal also needs a strong close (top/bottom 40% of the candle, in the trade direction) and volume ≥1.2x average.
Evening (6pm–midnight ET) is stricter: top/bottom 30% and volume ≥1.5x. Midnight–9:30am: no signals.

## Each setup has to prove itself
The stats line scores every setup separately on the history your chart has loaded, e.g. `PB ✓+$210/12 · RT test 4/10 · SW ✗-$150/11`:
- **test 4/10** — fewer than 10 trades so far. Signals show grey as **SIM** (practice account only).
- **✓** — 10+ trades and making money → signals show as **GO**.
- **✗** — 10+ trades and losing → that setup is switched **off** automatically.

## How it talks to you (one instruction at a time)
| Label | What you do |
|---|---|
| `WAIT ▸ trend up: wait for a dip to VWAP/EMA` | Nothing yet — you know what you're waiting for |
| `WAIT ▸ no trend, no level: sit on hands` | Nothing |
| `WAIT ▸ outside your hours` | Nothing |
| `FORMING PB long ▸ wait for close 1:42` | **Don't enter.** Wait for the candle to close |
| `GO LONG PB ▸ up to 28240 · SL 28228 · 3 MNQ ($72)` | Enter. Shaded box = valid entry zone (3 candles) |
| `SIM LONG PB ▸ …` | Same, but the setup is still in test — practice account only |
| `MISSED ▸ don't chase` | Price left the zone. Let it go |
| `MANAGE ▸ SL … · TP … · hands off` | In a trade. Let the stop or target do the work |
| `SIT OUT ▸ 2 signals lost this session (choppy)` | The setups are failing in this market. Stop until the next session |

- One trade at a time, max 3 signals per session; after 2 losing signals in a session it says SIT OUT.
  Sessions: NY 9:30am–4pm and evening 6pm–midnight, counted separately.
  **It counts its own signals — it can't see your account.** Keep your own count too: stop after 2 real losses.
- One take profit at 1.5R, full exit. Stop just past the recent wick.
- Size = $75 ÷ (stop points × $ per point), capped at 5 contracts.

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
