// Key Levels + EMAs [Futures] — Hyperprop Script
// PDH/PDL · PWH/PWL · PMH/PML · ATH · Overnight H/L · Opening Range H/L
// EMA 9 · EMA 20 · SMA 200 · Bias label · Break & retest (RT) · Sweeps (SW)
//
// Clean by design: level lines only for the current period, labels at the
// right edge, labels merge when levels are close, signals limited to recent days.
// Colors: green = price above the level (support), red = price below (resistance).
// Line style = timeframe: day solid, week dashed, month dotted, ATH thick, ON/OR dotted grey.
//
// All levels are built from the chart's own bars (times converted to New York,
// futures trading day starts 6pm ET). Load enough history for weekly/monthly
// levels, or type them in the manual fields below.

// ── Levels ──
const showPD   = input.bool('Prior Day H/L (PDH/PDL)', true);
const pdSrc    = input.select('Prior day based on', 'Full session', ['Full session', 'RTH only']);
const showPW   = input.bool('Prior Week H/L (PWH/PWL)', true);
const showPM   = input.bool('Prior Month H/L (PMH/PML)', true);
const showATH  = input.bool('All-Time High', true);
const athManual = input.float('ATH price (0 = highest loaded bar)', 0, { min: 0 });
const pmhManual = input.float('PMH manual (0 = auto)', 0, { min: 0 });
const pmlManual = input.float('PML manual (0 = auto)', 0, { min: 0 });
const showPDC  = input.bool('Prior Day Close (PDC)', true);
const showPD50 = input.bool('Prior Day 50% (PD50)', true);
const showVW   = input.bool('VWAP (resets 6pm ET)', true);
const vwCol    = input.color('VWAP color', '#ffeb3b');
const showON   = input.bool('Overnight H/L (ONH/ONL)', true);
const showOR   = input.bool('Opening Range H/L (ORH/ORL)', true);
const orMins   = input.int('Opening range minutes', 15, { min: 1, max: 120 });
const rthOpen  = input.select('RTH open (NY time)', '09:30', ['09:30', '08:30', '09:00', '10:00']);
const rthClose = input.select('RTH close (NY time)', '16:00', ['16:00', '16:15', '15:00', '17:00']);

// ── Chart mode ──
const chartMode = input.select('Chart mode', 'Minimal', ['Minimal', 'Full']);
const nearestN = input.int('Minimal: levels shown above/below', 2, { min: 1, max: 5 });

// ── Moving averages (shown in Full mode) ──
const showE9   = input.bool('EMA 9', true);
const e9Col    = input.color('EMA 9 color', '#00bcd4');
const showE20  = input.bool('EMA 20', true);
const e20Col   = input.color('EMA 20 color', '#ff9800');
const showS200 = input.bool('SMA 200', true);
const s200Col  = input.color('SMA 200 color', '#e91e63');

// ── Style ──
const colorMode = input.select('Level colors', 'Support/Resistance', ['Support/Resistance', 'Level type']);
const supCol   = input.color('Support color', '#26a69a');
const resCol   = input.color('Resistance color', '#ef5350');
const dCol     = input.color('Day color', '#42a5f5');
const wCol     = input.color('Week color', '#ab47bc');
const mCol     = input.color('Month color', '#ffa726');
const athCol   = input.color('ATH color', '#ffd600');
const sCol     = input.color('ON/OR color', '#90a4ae');
const lineLen  = input.int('Line length (bars back)', 40, { min: 5, max: 500 });
const rOffset  = input.int('Label offset (bars right)', 4, { min: 0, max: 50 });
const showPx   = input.bool('Prices on labels', true);
const mergeK   = input.float('Merge labels closer than (x daily ATR)', 0.04, { min: 0, max: 1, step: 0.01 });
const maxDistK = input.float('Hide levels farther than (x daily ATR, 0 = off)', 0, { min: 0, max: 50, step: 0.5 });

// ── Setups (all of them trade WITH the trend) ──
const usePB    = input.bool('PB: trend pullback to VWAP / EMA 20', true);
const useRT    = input.bool('RT: break & retest of a level, with trend', true);
const useSW    = input.bool('SW: sweep reversal at a level, with 200 SMA trend', true);
const hours    = input.select('Signal hours (NY time)', 'NY + evening', ['NY + evening', 'NY only', 'All sessions']);
const minN     = input.int('Trades needed before a setup can go LIVE', 10, { min: 3, max: 100 });
const rtBars   = input.int('Retest window (bars)', 20, { min: 2, max: 500 });
const tolK     = input.float('Touch tolerance (x ATR 14)', 0.25, { min: 0, max: 5, step: 0.05 });
const sigDays  = input.int('Full mode: show signals from last N days', 3, { min: 1, max: 60 });
const coolBars = input.int('Cooldown per setup/level (bars)', 12, { min: 0, max: 500 });
const closeK   = input.float('NY: close in top/bottom part of candle', 0.4, { min: 0.1, max: 0.5, step: 0.05 });
const volK     = input.float('NY: volume vs 20-bar average (x)', 1.2, { min: 0, max: 5, step: 0.1 });
const eveCloseK = input.float('Evening: close in top/bottom part', 0.3, { min: 0.1, max: 0.5, step: 0.05 });
const eveVolK  = input.float('Evening: volume vs 20-bar average (x)', 1.5, { min: 0, max: 5, step: 0.1 });
const swMinK   = input.float('Sweep min wick past level (x ATR 14)', 0.15, { min: 0, max: 5, step: 0.05 });

// ── Trade plan ──
const showPlan = input.bool('Trade plan (entry / stop / target)', true);
const minRR    = input.float('Min room to next level (R)', 1.5, { min: 0.5, max: 10, step: 0.25 });
const tpR      = input.float('Take profit at (R) — full exit', 1.5, { min: 0.5, max: 5, step: 0.25 });
const stopBufK = input.float('Stop buffer past wick (x ATR 14)', 0.25, { min: 0, max: 2, step: 0.05 });
const minStopK = input.float('Minimum stop (x ATR 14)', 0.5, { min: 0.1, max: 3, step: 0.1 });
const planBars = input.int('Max bars in a trade', 48, { min: 5, max: 500 });

// ── Risk (prop account) ──
const riskUsd  = input.float('Risk per trade ($)', 75, { min: 5, max: 10000, step: 5 });
const contract = input.select('Contract', 'MNQ', ['MNQ', 'NQ', 'MES', 'ES', 'M2K', 'RTY', 'MYM', 'YM', 'MGC', 'GC', 'MCL', 'CL']);
const maxQty   = input.int('Max contracts', 5, { min: 1, max: 100 });
const maxTrades = input.int('Daily cap: trades', 3, { min: 1, max: 20 });
const maxLoss  = input.int('Daily stop: losses', 2, { min: 1, max: 10 });
const entryBars = input.int('Entry valid for (bars after signal)', 3, { min: 1, max: 20 });
const zoneR    = input.float('Entry zone (x risk past entry)', 0.3, { min: 0.05, max: 1, step: 0.05 });

// ── Coach / stats ──
const showInfo = input.bool('What-to-do label', true);
const nearK    = input.float("'At a level' distance (x ATR 14)", 1, { min: 0, max: 10, step: 0.25 });
const showStats = input.bool('Stats line per setup', true);
const debug    = input.bool('Debug info', false);

// ════════════════════════════════════════════════════════════════════════════

const NAMES = ['PDH', 'PDL', 'PWH', 'PWL', 'PMH', 'PML', 'ATH', 'ONH', 'ONL', 'ORH', 'ORL', 'PDC', 'PD50', 'VWAP'];
const TYPES = [0, 0, 1, 1, 2, 2, 3, 4, 4, 4, 4, 0, 0, 5]; // 0 day, 1 week, 2 month, 3 ATH, 4 session, 5 VWAP
const VW = 13;   // VWAP moves every bar (dynamic level)
const DAY = 86400000;
const POINT_VALUE = { MNQ: 2, NQ: 20, MES: 5, ES: 50, M2K: 5, RTY: 50, MYM: 0.5, YM: 5, MGC: 10, GC: 100, MCL: 100, CL: 1000 };

function on(v) { return v === true || v === 'On'; }
function hhmm(s) { const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
function fmt(p, tick) {
  if (p == null || !isFinite(p)) return '';
  const dec = tick >= 1 ? 0 : Math.min(6, (tick.toFixed(6).replace(/0+$/, '').split('.')[1] || '').length);
  return p.toFixed(dec);
}

// New York local time with US DST rules (no Intl dependency)
function nyOffsetHours(ms) {
  const y = new Date(ms).getUTCFullYear();
  const marDow = new Date(Date.UTC(y, 2, 1)).getUTCDay();
  const dstStart = Date.UTC(y, 2, 1 + ((7 - marDow) % 7) + 7, 7);   // 2nd Sun Mar, 2am ET
  const novDow = new Date(Date.UTC(y, 10, 1)).getUTCDay();
  const dstEnd = Date.UTC(y, 10, 1 + ((7 - novDow) % 7), 6);        // 1st Sun Nov, 2am ET
  return ms >= dstStart && ms < dstEnd ? -4 : -5;
}

function compute(bars, inputs, hp) {
  const n = bars ? bars.length : 0;
  const empty = { plots: [] };
  if (n < 2) return empty;

  // Time in ms — accepts seconds, ms, µs, ns, Date objects or date strings
  const toMs = t => {
    if (t instanceof Date) return t.getTime();
    if (typeof t === 'string') { const num = Number(t); t = isNaN(num) ? Date.parse(t) : num; }
    if (typeof t !== 'number' || !isFinite(t)) return NaN;
    while (t > 1e14) t /= 1000;
    if (t < 1e11) t *= 1000;
    return t;
  };
  const tms = bars.map(b => toMs(b.time != null ? b.time : b.t));
  const timeOk = isFinite(tms[n - 1]) && isFinite(tms[0]);
  const H = bars.map(b => b.h), L = bars.map(b => b.l), C = bars.map(b => b.c), O = bars.map(b => b.o);
  const V = bars.map(b => (isFinite(b.v) ? +b.v : 0));
  const hasVol = V.some(v => v > 0);
  const avgVol = new Array(n).fill(NaN);              // average of the previous 20 bars
  { let sum = 0; for (let i = 0; i < n; i++) { if (i >= 20) { avgVol[i] = sum / 20; sum -= V[i - 20]; } sum += V[i]; } }

  // Tick size estimate (smallest non-zero price step in recent closes)
  let tick = Infinity;
  for (let i = Math.max(1, n - 300); i < n; i++) {
    const d = Math.abs(C[i] - C[i - 1]);
    if (d > 1e-9 && d < tick) tick = d;
  }
  if (!isFinite(tick)) tick = 0.01;

  // Bar spacing → intraday?
  const gaps = [];
  for (let i = Math.max(1, n - 50); i < n; i++) gaps.push(tms[i] - tms[i - 1]);
  gaps.sort((a, b) => a - b);
  const barMs = gaps[Math.floor(gaps.length / 2)] || DAY;
  const intraday = barMs < DAY * 0.9;

  // ATR 14 (Wilder)
  const atr = new Array(n).fill(NaN);
  {
    let a = NaN;
    for (let i = 0; i < n; i++) {
      const tr = i === 0 ? H[i] - L[i] : Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1]));
      if (i < 14) { a = isNaN(a) ? tr : a + tr; if (i === 13) a /= 14; }
      else a = (a * 13 + tr) / 14;
      atr[i] = i >= 13 ? a : NaN;
    }
  }

  const rthO = hhmm(rthOpen), rthC = hhmm(rthClose), orEnd = rthO + orMins;

  // Per-bar level series
  const lv = NAMES.map(() => new Array(n).fill(NaN));
  const inRTHa = new Array(n).fill(false), inONa = new Array(n).fill(false), orDoneA = new Array(n).fill(false);
  const dayKeyA = new Array(n);
  const minA = new Array(n).fill(0);

  let dKey = null, wKey = null, mKey = null;
  let dCount = 0, wCount = 0, mCount = 0;
  let curDH = -Infinity, curDL = Infinity, prevDH = NaN, prevDL = NaN;
  let curWH = -Infinity, curWL = Infinity, prevWH = NaN, prevWL = NaN;
  let curMH = -Infinity, curML = Infinity, prevMH = NaN, prevML = NaN;
  let rthH = -Infinity, rthL = Infinity, prevRthH = NaN, prevRthL = NaN, wasRTH = false;
  let prevDC = NaN, rthLastC = NaN, prevRthC = NaN, vwPV = 0, vwV = 0, vwBars = 0;
  const vwap = new Array(n).fill(null);
  const vwBarsA = new Array(n).fill(0);
  let onH = NaN, onL = NaN, orH = NaN, orL = NaN;
  let maxBeforeToday = -Infinity, maxToday = -Infinity;
  const dayRanges = [];

  for (let i = 0; i < n; i++) {
    const local = tms[i] + nyOffsetHours(tms[i]) * 3600000;
    const lt = new Date(local);
    const minOfDay = lt.getUTCHours() * 60 + lt.getUTCMinutes();
    const tdMs = local + 6 * 3600000;                 // 6pm ET → next trading day
    const td = new Date(tdMs);
    const dk = Math.floor(tdMs / DAY);
    const wk = Math.floor((dk + 3) / 7);              // weeks start Monday (Sun evening → Mon)
    const mk = td.getUTCFullYear() * 12 + td.getUTCMonth();
    dayKeyA[i] = dk;
    if (!timeOk) continue;

    if (dk !== dKey) {
      if (dKey !== null) {
        prevDH = curDH; prevDL = curDL; prevDC = C[i - 1];
        if (dCount >= 1) dayRanges.push(curDH - curDL);
        maxBeforeToday = Math.max(maxBeforeToday, maxToday);
      }
      dKey = dk; dCount++; curDH = -Infinity; curDL = Infinity; maxToday = -Infinity;
      onH = NaN; onL = NaN; orH = NaN; orL = NaN;
      vwPV = 0; vwV = 0; vwBars = 0;
    }
    // VWAP (typical price; equal weight if the feed has no volume)
    { const w = hasVol ? V[i] : 1; vwPV += (H[i] + L[i] + C[i]) / 3 * w; vwV += w; vwBars++;
      vwap[i] = vwV > 0 ? vwPV / vwV : null; vwBarsA[i] = vwBars; }
    if (wk !== wKey) { if (wKey !== null) { prevWH = curWH; prevWL = curWL; } wKey = wk; wCount++; curWH = -Infinity; curWL = Infinity; }
    if (mk !== mKey) { if (mKey !== null) { prevMH = curMH; prevML = curML; } mKey = mk; mCount++; curMH = -Infinity; curML = Infinity; }

    // Sessions (intraday only)
    const inRTH = intraday && minOfDay >= rthO && minOfDay < rthC;
    const inON = intraday && (minOfDay >= 18 * 60 || minOfDay < rthO);
    const inOR = intraday && minOfDay >= rthO && minOfDay < orEnd;
    if (inRTH && !wasRTH) { rthH = H[i]; rthL = L[i]; }
    else if (inRTH) { rthH = Math.max(rthH, H[i]); rthL = Math.min(rthL, L[i]); }
    if (!inRTH && wasRTH) { prevRthH = rthH; prevRthL = rthL; prevRthC = rthLastC; }
    if (inRTH) rthLastC = C[i];
    wasRTH = inRTH;
    if (inON) { onH = isNaN(onH) ? H[i] : Math.max(onH, H[i]); onL = isNaN(onL) ? L[i] : Math.min(onL, L[i]); }
    if (inOR) { orH = isNaN(orH) ? H[i] : Math.max(orH, H[i]); orL = isNaN(orL) ? L[i] : Math.min(orL, L[i]); }
    minA[i] = minOfDay;
    inRTHa[i] = inRTH; inONa[i] = inON; orDoneA[i] = inRTH && !inOR && !isNaN(orH);

    // Levels for this bar (prior periods only count when fully loaded)
    // first loaded day is usually partial, so prior-day levels start on the 3rd day seen
    const pdh = pdSrc === 'RTH only' ? prevRthH : prevDH;
    const pdl = pdSrc === 'RTH only' ? prevRthL : prevDL;
    lv[0][i] = on(showPD) && dCount >= 3 ? pdh : NaN;
    lv[1][i] = on(showPD) && dCount >= 3 ? pdl : NaN;
    lv[2][i] = on(showPW) && wCount >= 3 ? prevWH : NaN;   // first week seen is usually partial
    lv[3][i] = on(showPW) && wCount >= 3 ? prevWL : NaN;
    lv[4][i] = on(showPM) ? (pmhManual > 0 ? pmhManual : (mCount >= 3 ? prevMH : NaN)) : NaN;
    lv[5][i] = on(showPM) ? (pmlManual > 0 ? pmlManual : (mCount >= 3 ? prevML : NaN)) : NaN;
    const athAuto = maxBeforeToday > -Infinity ? maxBeforeToday : NaN;
    lv[6][i] = on(showATH) ? (athManual > 0 ? Math.max(athManual, isNaN(athAuto) ? 0 : athAuto) : athAuto) : NaN;
    lv[7][i] = on(showON) && intraday && dCount >= 2 ? onH : NaN;
    lv[8][i] = on(showON) && intraday && dCount >= 2 ? onL : NaN;
    lv[9][i] = on(showOR) && inRTH ? orH : NaN;
    lv[10][i] = on(showOR) && inRTH ? orL : NaN;
    const pdc = pdSrc === 'RTH only' ? prevRthC : prevDC;
    lv[11][i] = on(showPDC) && dCount >= 3 ? pdc : NaN;
    lv[12][i] = on(showPD50) && dCount >= 3 && !isNaN(pdh) && !isNaN(pdl) ? (pdh + pdl) / 2 : NaN;
    lv[VW][i] = on(showVW) && intraday && vwap[i] != null ? vwap[i] : NaN;

    curDH = Math.max(curDH, H[i]); curDL = Math.min(curDL, L[i]);
    curWH = Math.max(curWH, H[i]); curWL = Math.min(curWL, L[i]);
    curMH = Math.max(curMH, H[i]); curML = Math.min(curML, L[i]);
    maxToday = Math.max(maxToday, H[i]);
  }

  const last = n - 1;
  const recentR = dayRanges.slice(-14);
  const dAtr = recentR.length ? recentR.reduce((a, b) => a + b, 0) / recentR.length : (atr[last] || 0) * 20;
  const athIsReal = athManual > 0;
  const nameOf = k => (k === 6 && !athIsReal ? 'HH' : NAMES[k]);   // HH = highest loaded bar

  // Signal eligibility: level must be final, not still forming
  function eligible(k, i) {
    if (k === 7 || k === 8) return !inONa[i];
    if (k === 9 || k === 10) return orDoneA[i];
    if (k === VW) return vwBarsA[i] >= 6;
    return true;
  }

  // ── Moving averages + per-bar bias score (−5…+5) ──
  const e9 = hp.ema(C, 9), e20 = hp.ema(C, 20), s200 = hp.sma(C, 200);
  const num = v => (v == null || isNaN(v) ? NaN : v);
  const scoreAt = i => {
    const a = num(e9[i]), b = num(e20[i]), s = num(s200[i]), c = C[i];
    const emaS = a > b && c > a ? 1 : a < b && c < a ? -1 : 0;
    const smaS = isNaN(s) ? 0 : c > s ? 1 : -1;
    const ph = lv[0][i], pl = lv[1][i];
    const pdS = isNaN(ph) || isNaN(pl) ? 0 : c > ph ? 1 : c < pl ? -1 : 0;
    const oh = lv[9][i], ol = lv[10][i];
    const orS = orDoneA[i] && !isNaN(oh) ? (c > oh ? 1 : c < ol ? -1 : 0) : 0;
    const vw = vwap[i];
    const vwS = vw == null || vwBarsA[i] < 6 ? 0 : c > vw ? 1 : c < vw ? -1 : 0;
    return { score: emaS + smaS + pdS + orS + vwS, pdS };
  };

  // ── Trend filters ──
  // short-term: EMA 9 above/below EMA 20, EMA 20 sloping, price on the right side of VWAP
  const trendAt = i => {
    if (i < 3) return 0;
    const a = num(e9[i]), b = num(e20[i]), b3 = num(e20[i - 3]), vw = vwap[i];
    if (isNaN(a) || isNaN(b) || isNaN(b3)) return 0;
    const vwOk = d => vw == null || vwBarsA[i] < 6 || (d > 0 ? C[i] > vw : C[i] < vw);
    if (a > b && b > b3 && vwOk(1)) return 1;
    if (a < b && b < b3 && vwOk(-1)) return -1;
    return 0;
  };
  // bigger trend: 200 SMA rising/falling with price on that side
  const bigTrendAt = i => {
    if (i < 10) return 0;
    const sv = num(s200[i]), s10 = num(s200[i - 10]);
    if (isNaN(sv) || isNaN(s10)) return 0;
    return sv > s10 && C[i] > sv ? 1 : sv < s10 && C[i] < sv ? -1 : 0;
  };
  const sessionOf = i => (inRTHa[i] ? 'ny' : minA[i] >= 18 * 60 ? 'eve' : 'off');
  const allowed = i => (hours === 'All sessions' ? true : hours === 'NY only' ? sessionOf(i) === 'ny' : sessionOf(i) !== 'off');

  // Confirmation: strong close in the trade direction on above-average volume (stricter outside NY hours)
  const confirm = (i, dir, live) => {
    const ny = sessionOf(i) === 'ny';
    const ck = ny ? closeK : eveCloseK, vk = ny ? volK : eveVolK;
    const rng = H[i] - L[i];
    if (rng <= 0) return false;
    const pos = (C[i] - L[i]) / rng;
    const strong = (dir > 0 ? pos >= 1 - ck : pos <= ck) && (dir > 0 ? C[i] > O[i] : C[i] < O[i]);
    const volOk = live || !hasVol || vk <= 0 || isNaN(avgVol[i]) || V[i] >= avgVol[i] * vk;
    return strong && volOk;
  };

  // Trade plan: stop past the recent wick, one target at tpR, needs room to the next level
  const planFor = (i, dir, look) => {
    const a = atr[i] || 0;
    const entry = C[i];
    let ext = dir > 0 ? Infinity : -Infinity;
    for (let j = Math.max(0, i - look + 1); j <= i; j++) ext = dir > 0 ? Math.min(ext, L[j]) : Math.max(ext, H[j]);
    let stop = ext - dir * a * stopBufK;
    if (Math.abs(entry - stop) < a * minStopK) stop = entry - dir * a * minStopK;
    stop = dir > 0 ? Math.floor(stop / tick + 1e-9) * tick : Math.ceil(stop / tick - 1e-9) * tick;
    const risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    let room = Infinity;
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][i];
      if (isNaN(x)) continue;
      const d = (x - entry) * dir;
      if (d > a * 0.1) room = Math.min(room, d / risk);
    }
    let tpx = entry + dir * risk * tpR;
    tpx = dir > 0 ? Math.ceil(tpx / tick - 1e-9) * tick : Math.floor(tpx / tick + 1e-9) * tick;
    const pv = POINT_VALUE[contract] || 2;
    const qty = Math.min(maxQty, Math.floor(riskUsd / (risk * pv) + 1e-9));
    if (qty < 1 || room < Math.max(minRR, tpR)) return null;
    return { i, dir, entry, stop, t1: { x: tpx }, risk, room, qty, usd: qty * risk * pv };
  };

  // Outcome of a plan using bars up to `upto` (stop checked first = conservative)
  const resolve = (p, upto) => {
    for (let j = p.i + 1; j <= upto; j++) {
      if (j - p.i > planBars) return 'expired';
      if (p.dir > 0 ? L[j] <= p.stop : H[j] >= p.stop) return 'loss';
      if (p.dir > 0 ? H[j] >= p.t1.x : L[j] <= p.t1.x) return 'win';
    }
    return 'open';
  };
  const resultR = p => {
    const st = resolve(p, last);
    if (st === 'open') return null;
    if (st === 'win') return { r: Math.abs(p.t1.x - p.entry) / p.risk, win: true };
    if (st === 'loss') return { r: -1, win: false };
    const j = Math.min(last, p.i + planBars);
    return { r: (C[j] - p.entry) * p.dir / p.risk, win: false };
  };

  // ── Detect setups on every bar (the live bar only counts as "forming") ──
  const cands = [];
  const lastSig = new Array(NAMES.length).fill(-1e9);
  const state = new Array(NAMES.length).fill(0), stBar = new Array(NAMES.length).fill(0), lastLv = new Array(NAMES.length).fill(NaN);
  let lastPB = -1e9;

  for (let i = 1; i <= last; i++) {
    const live = i === last;
    const tol = (atr[i] || 0) * tolK;
    const tr = trendAt(i), big = bigTrendAt(i);
    const add = (setup, dir, lvl, look) => {
      const pl = planFor(i, dir, look);
      if (pl) cands.push(Object.assign(pl, { setup, lvl, live }));
    };

    // RT + SW at key levels
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][i];
      if (isNaN(x) || !eligible(k, i)) { state[k] = 0; lastLv[k] = x; continue; }
      if (x !== lastLv[k] && k !== VW) state[k] = 0;
      lastLv[k] = x;
      const xp = k === VW && !isNaN(lv[k][i - 1]) ? lv[k][i - 1] : x;
      const ready = i - lastSig[k] > coolBars;
      const fire = (setup, dir) => { if (ready) { add(setup, dir, nameOf(k), 1); if (!live) lastSig[k] = i; } };
      const up = C[i] > x && C[i - 1] <= xp, dn = C[i] < x && C[i - 1] >= xp;
      if (up) { if (!live) { state[k] = 1; stBar[k] = i; } }
      else if (dn) { if (!live) { state[k] = -1; stBar[k] = i; } }
      else if (state[k] !== 0 && i - stBar[k] > rtBars) state[k] = 0;
      else if (useRT && state[k] === 1 && tr === 1 && i - stBar[k] >= 2 && L[i] <= x + tol && C[i] > x && confirm(i, 1, live)) { if (!live) state[k] = 0; fire('RT', 1); }
      else if (useRT && state[k] === -1 && tr === -1 && i - stBar[k] >= 2 && H[i] >= x - tol && C[i] < x && confirm(i, -1, live)) { if (!live) state[k] = 0; fire('RT', -1); }
      if (useSW) {
        const minWick = (atr[i] || 0) * swMinK;
        if (big === -1 && H[i] - x >= minWick && C[i] < x && O[i] < x && C[i - 1] < xp && confirm(i, -1, live)) fire('SW', -1);
        if (big === 1 && x - L[i] >= minWick && C[i] > x && O[i] > x && C[i - 1] > xp && confirm(i, 1, live)) fire('SW', 1);
      }
    }

    // PB: pullback to VWAP / EMA 20 in a trend, then a strong candle back with the trend
    if (usePB && tr !== 0 && i - lastPB > coolBars) {
      const refs = [];
      const ev = num(e20[i]);
      if (!isNaN(ev)) refs.push({ x: ev, nm: 'EMA20' });
      if (vwap[i] != null && vwBarsA[i] >= 6) refs.push({ x: vwap[i], nm: 'VWAP' });
      const hit = refs.find(r => (tr > 0 ? L[i] <= r.x + tol && C[i] > r.x : H[i] >= r.x - tol && C[i] < r.x));
      if (hit && confirm(i, tr, live)) { add('PB', tr, hit.nm, 3); if (!live) lastPB = i; }
    }
  }

  // ── Score each setup on its own (every signal in your hours, one trade at a time) ──
  const SETUPS = [['PB', usePB], ['RT', useRT], ['SW', useSW]].filter(x => on(x[1])).map(x => x[0]);
  const stats = {};
  for (const su of SETUPS) {
    let open = null; const rs = [];
    for (const c of cands) {
      if (c.live || c.setup !== su || !allowed(c.i)) continue;
      if (open && resolve(open, c.i) === 'open') continue;
      open = c;
      const r = resultR(c);
      if (r) rs.push(r);
    }
    const nT = rs.length, wins = rs.filter(r => r.win).length, R = rs.reduce((a, r) => a + r.r, 0);
    stats[su] = { n: nT, wins, R, status: nT < minN ? 'TEST' : R > 0 ? 'LIVE' : 'OFF' };
  }

  // ── Pick the trades you would actually take: your hours, LIVE/TEST setups, caps ──
  const plans = [];
  const tradesOn = day => plans.filter(p => dayKeyA[p.i] === day).length;
  const lossesOn = (day, upto) => plans.filter(p => dayKeyA[p.i] === day && resolve(p, upto) === 'loss').length;
  const blockedAt = i => {
    if (!allowed(i)) return 'hours';
    const prev = plans[plans.length - 1];
    if (prev && resolve(prev, i) === 'open') return 'open';
    if (lossesOn(dayKeyA[i], i) >= maxLoss) return 'losses';
    if (tradesOn(dayKeyA[i]) >= maxTrades) return 'trades';
    return '';
  };
  let forming = null;
  for (const c of cands) {
    const st = stats[c.setup];
    if (!st || st.status === 'OFF') continue;
    if (blockedAt(c.i)) continue;
    c.status = st.status;
    if (c.live) { forming = forming || c; continue; }
    if (plans.length && plans[plans.length - 1].i === c.i) continue;   // one trade per bar
    plans.push(c);
  }

  const minimal = chartMode === 'Minimal';
  const firstSigDay = dayKeyA[last] - (minimal ? 1 : sigDays) + 1;
  const markers = [];
  for (const p of plans) {
    if (dayKeyA[p.i] < firstSigDay) continue;
    const col = p.status === 'TEST' ? '#9e9e9e' : p.dir > 0 ? supCol : resCol;
    markers.push({ x: p.i, y: p.dir > 0 ? L[p.i] : H[p.i], position: p.dir > 0 ? 'below' : 'above', color: col, text: (p.dir > 0 ? '▲ ' : '▼ ') + p.setup + ' ' + p.lvl + (p.status === 'TEST' ? ' (test)' : ''), textColor: col });
  }

  let plan = plans[plans.length - 1] || null;
  if (plan) { plan.state = resolve(plan, last); if (plan.state !== 'open') plan = null; }
  const lossesToday = lossesOn(dayKeyA[last], last);
  const tradesToday = tradesOn(dayKeyA[last]);

  // ── Level lines + merged labels (current values only) ──
  const lines = [], labels = [];
  const px = C[last];
  const vis = [];
  for (let k = 0; k < NAMES.length; k++) {
    const x = lv[k][last];
    if (isNaN(x)) continue;
    if (maxDistK > 0 && dAtr > 0 && Math.abs(x - px) > maxDistK * dAtr) continue;
    vis.push({ k, x });
  }
  vis.sort((a, b) => b.x - a.x);
  if (chartMode === 'Minimal') {
    const tolM = mergeK * dAtr;
    const pick = side => {
      const arr = vis.filter(v => v.k !== VW && (side > 0 ? v.x > px : v.x <= px)).sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px));
      const keep = [];
      for (const v of arr) {
        const groups = new Set(keep.map(q => q.g));
        const g = keep.find(q => Math.abs(q.x - v.x) <= tolM);
        if (g) keep.push({ ...v, g: g.g });
        else if (groups.size < nearestN) keep.push({ ...v, g: keep.length });
      }
      return keep;
    };
    const keepSet = new Set([...pick(1), ...pick(-1)].map(v => v.k));
    for (let j = vis.length - 1; j >= 0; j--) if (vis[j].k !== VW && !keepSet.has(vis[j].k)) vis.splice(j, 1);
  }
  const x1 = Math.max(0, last - lineLen), x2 = last + rOffset;
  const typeCol = t => [dCol, wCol, mCol, athCol, sCol, vwCol][t];
  const typeStyle = t => (t === 1 ? 'dashed' : t === 2 || t === 4 ? 'dotted' : 'solid');
  const colOf = v => (colorMode === 'Support/Resistance' ? (px >= v.x ? supCol : resCol) : typeCol(TYPES[v.k]));

  const mergeTol = mergeK * dAtr;
  let group = null;
  const flush = () => {
    if (!group) return;
    labels.push({ x: x2, y: group.y, text: group.names.join(' · ') + (on(showPx) ? '  ' + fmt(group.y, tick) : ''), color: group.color, textColor: '#ffffff', anchor: 'left' });
  };
  for (const v of vis) {
    const t = TYPES[v.k];
    if (v.k !== VW) lines.push({ x1, y1: v.x, x2, y2: v.x, color: colOf(v), width: t === 3 ? 2 : 1, style: v.k === 12 ? 'dotted' : v.k === 11 ? 'dashed' : typeStyle(t) });
    if (group && Math.abs(group.y - v.x) <= mergeTol) group.names.push(nameOf(v.k));
    else { flush(); group = { y: v.x, names: [nameOf(v.k)], color: colOf(v) }; }
  }
  flush();

  // ── Moving averages (hp helpers) ──
  const plots = [];
  const full = chartMode === 'Full';
  if (full && on(showE9)) plots.push({ title: 'EMA 9', values: e9, color: e9Col, width: 1 });
  if (full && on(showE20)) plots.push({ title: 'EMA 20', values: e20, color: e20Col, width: 1 });
  if (full && on(showS200)) plots.push({ title: 'SMA 200', values: s200, color: s200Col, width: 2 });
  if (on(showVW) && intraday) plots.push({ title: 'VWAP', values: vwap.map((v, i) => (vwBarsA[i] <= 1 ? null : v)), color: vwCol, width: 2 });

  const rgba = (hex, a) => {
    const h = String(hex).replace('#', '');
    if (h.length < 6) return hex;
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  };
  const boxes = [];
  const sizeTxt = p => p.qty + ' ' + contract + ' ($' + Math.round(p.usd) + ')';

  // ── Trade plan: entry zone, stop, targets ──
  let zoneEdge = NaN, inZone = false, age = 0;
  if (on(showPlan) && plan) {
    const d = plan.dir, a = Math.max(1, plan.i), sl = plan.stop;
    age = last - plan.i;
    zoneEdge = plan.entry + d * plan.risk * zoneR;
    zoneEdge = d > 0 ? Math.ceil(zoneEdge / tick - 1e-9) * tick : Math.floor(zoneEdge / tick + 1e-9) * tick;
    inZone = d > 0 ? px <= zoneEdge && px > plan.stop : px >= zoneEdge && px < plan.stop;
    if (age <= entryBars) {
      boxes.push({ x1: a, y1: plan.entry - d * plan.risk * 0.05, x2: x2, y2: zoneEdge, bg: rgba(d > 0 ? supCol : resCol, 0.18), border: rgba(d > 0 ? supCol : resCol, 0.5), borderWidth: 1 });
    }
    const pts = v => fmt(Math.abs(v - plan.entry), tick);
    const row = (y, col, style, text) => {
      lines.push({ x1: a, y1: y, x2: x2, y2: y, color: col, width: 2, style });
      labels.push({ x: x2, y, text, color: col, textColor: '#ffffff', anchor: 'right' });
    };
    row(plan.entry, '#9e9e9e', 'dashed', (plan.status === 'TEST' ? 'SIM ' : '') + (d > 0 ? 'LONG ' : 'SHORT ') + plan.setup + ' ' + fmt(plan.entry, tick) + ' · ' + sizeTxt(plan));
    row(sl, resCol, 'solid', 'SL ' + fmt(sl, tick) + ' (-' + pts(sl) + ')');
    row(plan.t1.x, supCol, 'solid', 'TP ' + fmt(plan.t1.x, tick) + ' (+' + pts(plan.t1.x) + ')');
  }

  // ── Coach: ONE clear instruction ──
  if (on(showInfo)) {
    let up = null, dn = null;
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][last];
      if (isNaN(x)) continue;
      if (x > px && (!up || x < up.x)) up = { k, x };
      if (x <= px && (!dn || x > dn.x)) dn = { k, x };
    }
    const near = (atr[last] || 0) * nearK;
    const atLvl = up && up.x - px <= near && (!dn || up.x - px <= px - dn.x) ? up : dn && px - dn.x <= near ? dn : null;
    const tr = trendAt(last);
    const trTxt = tr > 0 ? 'trend up' : tr < 0 ? 'trend down' : 'no trend';

    let countdown = '';
    try {
      const rem = Math.round((tms[last] + barMs - Date.now()) / 1000);
      if (rem > 0 && rem <= barMs / 1000) countdown = ' ' + Math.floor(rem / 60) + ':' + String(rem % 60).padStart(2, '0');
    } catch (e) { /* no clock available */ }

    const GREY = '#616161', AMBER = '#ff8f00';
    let text, col;
    if (plan && on(showPlan)) {
      const side = plan.dir > 0 ? 'LONG' : 'SHORT', sc = plan.status === 'TEST' ? '#757575' : plan.dir > 0 ? supCol : resCol;
      const go = plan.status === 'TEST' ? 'SIM ' : 'GO ';
      if (age <= entryBars && inZone) { text = go + side + ' ' + plan.setup + ' ▸ ' + (plan.dir > 0 ? 'up to ' : 'down to ') + fmt(zoneEdge, tick) + ' · SL ' + fmt(plan.stop, tick) + ' · ' + sizeTxt(plan); col = sc; }
      else if (age <= entryBars) { text = 'MISSED ▸ don\'t chase'; col = GREY; }
      else { text = 'MANAGE ▸ SL ' + fmt(plan.stop, tick) + ' · TP ' + fmt(plan.t1.x, tick) + ' · hands off'; col = GREY; }
    }
    else if (lossesToday >= maxLoss) { text = 'DONE FOR TODAY ▸ ' + lossesToday + ' losses. Close the chart.'; col = resCol; }
    else if (tradesToday >= maxTrades) { text = 'DONE FOR TODAY ▸ ' + tradesToday + ' trades taken.'; col = resCol; }
    else if (!allowed(last)) { text = 'WAIT ▸ outside your hours'; col = GREY; }
    else if (forming) { text = 'FORMING ' + forming.setup + ' ' + (forming.dir > 0 ? 'long' : 'short') + ' ▸ wait for close' + countdown; col = AMBER; }
    else if (atLvl) { text = 'WAIT ▸ at ' + nameOf(atLvl.k) + ' · ' + trTxt; col = GREY; }
    else if (tr > 0) { text = 'WAIT ▸ trend up: wait for a dip to VWAP/EMA'; col = GREY; }
    else if (tr < 0) { text = 'WAIT ▸ trend down: wait for a pop to VWAP/EMA'; col = GREY; }
    else { text = 'WAIT ▸ no trend, no level: sit on hands'; col = GREY; }

    let top = -Infinity;
    for (let i = Math.max(0, last - 20); i <= last; i++) top = Math.max(top, H[i]);
    labels.push({ x: last, y: top + (atr[last] || 0) * 1.5, text, color: col, textColor: '#ffffff', anchor: 'down' });
  }

  // ── Stats per setup: PB ✓+$210/12 · RT test 4/10 · SW ✗-$150/11 ──
  if (on(showStats) && SETUPS.length) {
    let bot = Infinity;
    for (let i = Math.max(0, last - 20); i <= last; i++) bot = Math.min(bot, L[i]);
    const money = R => { const u = Math.round(R * riskUsd); return (u >= 0 ? '+$' : '-$') + Math.abs(u); };
    const text = SETUPS.map(su => {
      const st = stats[su];
      if (st.status === 'TEST') return su + ' test ' + st.n + '/' + minN;
      return su + (st.status === 'LIVE' ? ' ✓' : ' ✗') + money(st.R) + '/' + st.n;
    }).join(' · ');
    labels.push({ x: last, y: bot - (atr[last] || 0) * 1.5, text, color: '#37474f', textColor: '#ffffff', anchor: 'up' });
  }

  if (on(debug) || !timeOk) {
    const t0 = bars[last].time;
    labels.push({ x: last, y: L[last] - (atr[last] || 0) * 3, text: 'time=' + JSON.stringify(t0) + ' (' + typeof t0 + ') ms=' + tms[last] + ' days=' + (timeOk ? new Set(dayKeyA).size : 'n/a') + ' cands=' + cands.length, color: '#424242', textColor: '#ffffff', anchor: 'up' });
  }

  return { plots, lines, labels, markers, boxes };
}
