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

// ── Moving averages ──
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

// ── Signals ──
const showRT   = input.bool('Break & retest markers (RT)', true);
const showSW   = input.bool('Sweep markers (SW)', true);
const showBRK  = input.bool('Break markers (BRK)', false);
const rtBars   = input.int('Retest window (bars)', 20, { min: 2, max: 500 });
const tolK     = input.float('Touch tolerance (x ATR 14)', 0.25, { min: 0, max: 5, step: 0.05 });
const sigDays  = input.int('Show signals from last N days', 3, { min: 1, max: 60 });
const coolBars = input.int('Cooldown per level (bars)', 12, { min: 0, max: 500 });
const strict   = input.bool('Strict confirmation (strong close + volume)', true);
const closeK   = input.float('Close in top/bottom part of candle', 0.4, { min: 0.1, max: 0.5, step: 0.05 });
const volK     = input.float('Volume vs 20-bar average (x)', 1.2, { min: 0, max: 5, step: 0.1 });
const swMinK   = input.float('Sweep min wick past level (x ATR 14)', 0.15, { min: 0, max: 5, step: 0.05 });

// ── Trade plan ──
const showPlan = input.bool('Trade plan (entry / stop / targets)', true);
const aOnly    = input.bool('A+ setups only (with bias + min R:R)', true);
const minRR    = input.float('Min reward:risk to TP1', 1.5, { min: 0.5, max: 10, step: 0.25 });
const stopBufK = input.float('Stop buffer past wick (x ATR 14)', 0.1, { min: 0, max: 2, step: 0.05 });
const planBars = input.int('Keep plan on chart (bars)', 48, { min: 5, max: 500 });

// ── Coach label ──
const showInfo = input.bool('Bias / what-to-do label', true);
const nearK    = input.float("'At a level' distance (x ATR 14)", 1, { min: 0, max: 10, step: 0.25 });
const debug    = input.bool('Debug info', false);

// ════════════════════════════════════════════════════════════════════════════

const NAMES = ['PDH', 'PDL', 'PWH', 'PWL', 'PMH', 'PML', 'ATH', 'ONH', 'ONL', 'ORH', 'ORL', 'PDC', 'PD50', 'VWAP'];
const TYPES = [0, 0, 1, 1, 2, 2, 3, 4, 4, 4, 4, 0, 0, 5]; // 0 day, 1 week, 2 month, 3 ATH, 4 session, 5 VWAP
const VW = 13;   // VWAP moves every bar (dynamic level)
const DAY = 86400000;

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

  // Build a trade plan for a signal: stop past the wick, targets = next levels
  const planFor = (i, dir) => {
    const a = atr[i] || 0;
    const entry = C[i];
    let stop = dir > 0 ? L[i] - a * stopBufK : H[i] + a * stopBufK;
    if (Math.abs(entry - stop) < a * 0.2) stop = entry - dir * a * 0.2;
    stop = dir > 0 ? Math.floor(stop / tick + 1e-9) * tick : Math.ceil(stop / tick - 1e-9) * tick;
    const risk = Math.abs(entry - stop);
    const tg = [];
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][i];
      if (isNaN(x)) continue;
      if (dir > 0 ? x > entry + a * 0.1 : x < entry - a * 0.1) tg.push({ x, nm: nameOf(k) });
    }
    tg.sort((p, q) => (dir > 0 ? p.x - q.x : q.x - p.x));
    const uniqT = [];
    for (const t of tg) if (!uniqT.length || Math.abs(t.x - uniqT[uniqT.length - 1].x) > a * 0.25) uniqT.push(t);
    const t1 = uniqT[0] || { x: entry + dir * risk * 2, nm: '2R' };
    const t2 = uniqT[1] || { x: entry + dir * Math.max(risk * 3, Math.abs(t1.x - entry) * 1.5), nm: '3R' };
    const rr = Math.abs(t1.x - entry) / risk;
    const sc = scoreAt(i).score;
    const aligned = dir > 0 ? sc >= 1 : sc <= -1;
    const grade = aligned && rr >= minRR ? 'A+' : rr >= minRR ? 'B' : 'C';
    return { i, dir, entry, stop, t1, t2, rr, grade };
  };

  // Strict confirmation: candle closes strong in the signal direction, on above-average volume
  const confirm = (i, dir) => {
    if (!on(strict)) return true;
    const rng = H[i] - L[i];
    if (rng <= 0) return false;
    const pos = (C[i] - L[i]) / rng;                  // 0 = closed at low, 1 = closed at high
    const strong = dir > 0 ? pos >= 1 - closeK : pos <= closeK;
    const volOk = !hasVol || volK <= 0 || isNaN(avgVol[i]) || V[i] >= avgVol[i] * volK;
    return strong && volOk;
  };

  // ── Signals ──
  const markers = [];
  let plan = null;
  const lastSig = new Array(NAMES.length).fill(-1e9);
  const state = new Array(NAMES.length).fill(0), stBar = new Array(NAMES.length).fill(0), lastLv = new Array(NAMES.length).fill(NaN);
  const firstSigDay = dayKeyA[last] - sigDays + 1;

  for (let i = 1; i < last; i++) {                    // skip the live (unfinished) bar
    const tol = (atr[i] || 0) * tolK;
    let bull = [], bear = [], bullNm = [], bearNm = [];
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][i];
      if (isNaN(x) || !eligible(k, i)) { state[k] = 0; lastLv[k] = x; continue; }
      if (x !== lastLv[k] && k !== VW) { state[k] = 0; }
      lastLv[k] = x;
      const xp = k === VW && !isNaN(lv[k][i - 1]) ? lv[k][i - 1] : x;   // level on the previous bar
      const nm = nameOf(k);
      const ready = i - lastSig[k] > coolBars;      // one signal per level per cooldown
      const fire = (arr, arrNm, tag) => { if (ready) { arr.push(tag); arrNm.push(nm); lastSig[k] = i; } };
      const up = C[i] > x && C[i - 1] <= xp, dn = C[i] < x && C[i - 1] >= xp;
      if (up) { state[k] = 1; stBar[k] = i; if (on(showBRK)) fire(bull, bullNm, 'BRK'); }
      else if (dn) { state[k] = -1; stBar[k] = i; if (on(showBRK)) fire(bear, bearNm, 'BRK'); }
      else if (state[k] !== 0 && i - stBar[k] > rtBars) state[k] = 0;
      else if (state[k] === 1 && i - stBar[k] >= 2 && L[i] <= x + tol && C[i] > x && confirm(i, 1)) { state[k] = 0; if (on(showRT)) fire(bull, bullNm, 'RT'); }
      else if (state[k] === -1 && i - stBar[k] >= 2 && H[i] >= x - tol && C[i] < x && confirm(i, -1)) { state[k] = 0; if (on(showRT)) fire(bear, bearNm, 'RT'); }
      if (on(showSW)) {
        const minWick = (atr[i] || 0) * swMinK;
        if (H[i] - x >= minWick && H[i] > x && C[i] < x && O[i] < x && C[i - 1] < xp && confirm(i, -1)) fire(bear, bearNm, 'SW');
        if (x - L[i] >= minWick && L[i] < x && C[i] > x && O[i] > x && C[i - 1] > xp && confirm(i, 1)) fire(bull, bullNm, 'SW');
      }
    }
    if (dayKeyA[i] < firstSigDay) continue;
    const uniq = a => Array.from(new Set(a));
    for (const [dir, tags, nms] of [[1, bull, bullNm], [-1, bear, bearNm]]) {
      if (!tags.length) continue;
      const onlyBrk = tags.every(t => t === 'BRK');
      const pl = onlyBrk ? null : planFor(i, dir);
      if (pl && aOnly && pl.grade !== 'A+') continue;
      const txt = (dir > 0 ? '▲ ' : '▼ ') + (pl ? pl.grade + ' ' : '') + uniq(tags).join(' ') + ' ' + uniq(nms)[0] + (pl ? ' ' + pl.rr.toFixed(1) + 'R' : '');
      const col = dir > 0 ? supCol : resCol;
      markers.push({ x: i, y: dir > 0 ? L[i] : H[i], position: dir > 0 ? 'below' : 'above', color: col, text: txt, textColor: col });
      if (pl && (pl.grade === 'A+' || !aOnly)) plan = Object.assign(pl, { tag: uniq(tags).join(' '), lvl: uniq(nms)[0] });
    }
  }

  // Track the latest plan: stopped out, TP1 hit, or done
  if (plan) {
    plan.status = 'open';
    for (let j = plan.i + 1; j <= last; j++) {
      const hitStop = plan.dir > 0 ? L[j] <= (plan.status === 'tp1' ? plan.entry : plan.stop) : H[j] >= (plan.status === 'tp1' ? plan.entry : plan.stop);
      if (hitStop) { plan.status = plan.status === 'tp1' ? 'be' : 'stopped'; break; }
      if (plan.dir > 0 ? H[j] >= plan.t2.x : L[j] <= plan.t2.x) { plan.status = 'tp2'; break; }
      if (plan.status === 'open' && (plan.dir > 0 ? H[j] >= plan.t1.x : L[j] <= plan.t1.x)) plan.status = 'tp1';
    }
    if (last - plan.i > planBars || plan.status === 'stopped' || plan.status === 'tp2' || plan.status === 'be') plan = null;
  }

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
  if (on(showE9)) plots.push({ title: 'EMA 9', values: e9, color: e9Col, width: 1 });
  if (on(showE20)) plots.push({ title: 'EMA 20', values: e20, color: e20Col, width: 1 });
  if (on(showS200)) plots.push({ title: 'SMA 200', values: s200, color: s200Col, width: 2 });
  if (on(showVW) && intraday) plots.push({ title: 'VWAP', values: vwap.map((v, i) => (vwBarsA[i] <= 1 ? null : v)), color: vwCol, width: 2 });

  // ── Trade plan lines (latest open A+ setup) ──
  if (on(showPlan) && plan) {
    const d = plan.dir, a = Math.max(1, plan.i), sl = plan.status === 'tp1' ? plan.entry : plan.stop;
    const pts = v => fmt(Math.abs(v - plan.entry), tick);
    const row = (y, col, style, text) => {
      lines.push({ x1: a, y1: y, x2: x2, y2: y, color: col, width: 2, style });
      labels.push({ x: x2, y, text, color: col, textColor: '#ffffff', anchor: 'right' });
    };
    row(plan.entry, '#9e9e9e', 'dashed', (d > 0 ? 'LONG ' : 'SHORT ') + plan.grade + ' ' + fmt(plan.entry, tick));
    row(sl, resCol, 'solid', plan.status === 'tp1' ? 'SL → BE' : 'SL -' + pts(sl));
    if (plan.status !== 'tp1') row(plan.t1.x, supCol, 'solid', 'TP1 +' + pts(plan.t1.x) + ' ' + plan.rr.toFixed(1) + 'R');
    row(plan.t2.x, supCol, 'dotted', 'TP2 +' + pts(plan.t2.x) + ' ' + (Math.abs(plan.t2.x - plan.entry) / Math.abs(plan.entry - plan.stop)).toFixed(1) + 'R');
  }

  // ── Coach label: bias + what to do (or wait) ──
  if (on(showInfo)) {
    const { score } = scoreAt(last);
    const bias = score >= 2 ? 'BULL' : score <= -2 ? 'BEAR' : 'NEUTRAL';
    const biasCol = score >= 2 ? supCol : score <= -2 ? resCol : '#787b86';

    let up = null, dn = null;
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][last];
      if (isNaN(x)) continue;
      if (x > px && (!up || x < up.x)) up = { k, x };
      if (x <= px && (!dn || x > dn.x)) dn = { k, x };
    }
    const near = (atr[last] || 0) * nearK;
    const nearUp = up && up.x - px <= near && (!dn || up.x - px <= px - dn.x);
    const nearDn = !nearUp && dn && px - dn.x <= near;
    let tip;
    if (on(showPlan) && plan) tip = plan.status === 'tp1' ? 'TP1 hit: stop to entry, let it run' : 'In plan: respect SL, no adding';
    else if (nearUp) {
      const nm = nameOf(up.k);
      tip = score >= 2 ? 'At ' + nm + ': wait break + RT → long' : score <= -2 ? 'At ' + nm + ': wait SW → short' : 'At ' + nm + ': wait SW (short) or RT (long)';
    } else if (nearDn) {
      const nm = nameOf(dn.k);
      tip = score <= -2 ? 'At ' + nm + ': wait break + RT → short' : score >= 2 ? 'At ' + nm + ': wait SW/RT → long' : 'At ' + nm + ': wait SW (long) or RT (short)';
    } else tip = 'Mid-range: NO TRADE, wait for a level';

    let top = -Infinity;
    for (let i = Math.max(0, last - 20); i <= last; i++) top = Math.max(top, H[i]);
    labels.push({ x: last, y: top + (atr[last] || 0) * 1.5, text: bias + ' ' + (score > 0 ? '+' : '') + score + ' ▸ ' + tip, color: biasCol, textColor: '#ffffff', anchor: 'down' });
  }

  if (on(debug) || !timeOk) {
    const t0 = bars[last].time;
    labels.push({ x: last, y: L[last] - (atr[last] || 0) * 3, text: 'time=' + JSON.stringify(t0) + ' (' + typeof t0 + ') ms=' + tms[last] + ' days=' + (timeOk ? new Set(dayKeyA).size : 'n/a') + ' BRK=' + JSON.stringify(showBRK), color: '#424242', textColor: '#ffffff', anchor: 'up' });
  }

  return { plots, lines, labels, markers };
}
