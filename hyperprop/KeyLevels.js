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
const showVW   = input.bool('VWAP (resets 6pm ET)', false);
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

// ── FVG setup: swing break + fair value gap ──
const swingTF  = input.select('Swing timeframe (minutes)', '15', ['15', '5', '30', '60']);
const pivotN   = input.int('Swing strength (candles each side)', 2, { min: 1, max: 10 });
const trendOn  = input.bool('Only trade with the swing-timeframe trend', true);
const fvgLook  = input.int('Bars after the break to find the FVG', 6, { min: 1, max: 30 });
const minGapK  = input.float('Min FVG size (x ATR 14)', 0.15, { min: 0, max: 3, step: 0.05 });
const entryAt  = input.select('Entry in the FVG', '50%', ['Near edge', '50%', 'Far edge']);
const stopTicks = input.int('Stop buffer past FVG candle 1 (ticks)', 2, { min: 0, max: 100 });
const tpR      = input.float('Take profit (R)', 2, { min: 0.5, max: 10, step: 0.25 });
const expireMin = input.int('Cancel unfilled order after (minutes)', 15, { min: 1, max: 600 });
const histDays = input.int('Show past setups from last N days', 1, { min: 1, max: 30 });

// ── Risk ──
const riskUsd  = input.float('Risk per trade ($)', 75, { min: 5, max: 10000, step: 5 });
const contract = input.select('Contract', 'MNQ', ['MNQ', 'NQ', 'MES', 'ES', 'M2K', 'RTY', 'MYM', 'YM', 'MGC', 'GC', 'MCL', 'CL']);
const maxQty   = input.int('Max contracts', 15, { min: 1, max: 100 });

// ── Stats ──
const showStats = input.bool('Stats line', true);
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

  // ════════ FVG ENGINE ════════
  // 1) Build swing-timeframe candles from the chart's bars
  const tfMs = (+swingTF) * 60000;
  const tfKey = tms.map(t => Math.floor(t / tfMs));
  const htf = [];                                    // {h, l, c, i0, i1}
  const htfOf = new Array(n);
  for (let i = 0; i < n; i++) {
    const cur = htf[htf.length - 1];
    if (!cur || tfKey[i] !== tfKey[cur.i0]) htf.push({ h: H[i], l: L[i], c: C[i], i0: i, i1: i });
    else { cur.h = Math.max(cur.h, H[i]); cur.l = Math.min(cur.l, L[i]); cur.c = C[i]; cur.i1 = i; }
    htfOf[i] = htf.length - 1;
  }
  // chart index where the swing candle's extreme printed
  const extIdx = (k, hi) => { let b = htf[k].i0; for (let j = htf[k].i0; j <= htf[k].i1; j++) if (hi ? H[j] >= H[b] : L[j] <= L[b]) b = j; return b; };

  const pv = POINT_VALUE[contract] || 2;
  const roundTick = (v, up) => (up ? Math.ceil(v / tick - 1e-9) : Math.floor(v / tick + 1e-9)) * tick;
  const nyClock = ms => { const d = new Date(ms + nyOffsetHours(ms) * 3600000); let h = d.getUTCHours(); const m = d.getUTCMinutes(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ap; };

  let swH = null, swL = null;          // latest unbroken swings (for the chart-bar break)
  let tH = null, tL = null;            // swings for the trend (broken by swing-TF closes)
  let trend = 0;
  let search = null;                   // { dir, from, to, swing }
  const setups = [];
  const swingLog = [];                 // for drawing: {dir, price, i, brokeAt}

  const makeSetup = (m, dir, swing) => {
    // 3-candle gap: candle 1 = m-1, candle 3 = m+1
    const top = dir > 0 ? L[m + 1] : L[m - 1];
    const bot = dir > 0 ? H[m - 1] : H[m + 1];
    if (!(top > bot) || top - bot < (atr[m] || 0) * minGapK) return false;
    const near = dir > 0 ? top : bot, far = dir > 0 ? bot : top;
    let entry = entryAt === 'Near edge' ? near : entryAt === 'Far edge' ? far : (top + bot) / 2;
    entry = roundTick(entry, dir < 0);
    const stop = dir > 0 ? roundTick(L[m - 1] - stopTicks * tick, false) : roundTick(H[m - 1] + stopTicks * tick, true);
    const risk = Math.abs(entry - stop);
    if (!(risk > 0)) return false;
    const tp = roundTick(entry + dir * risk * tpR, dir > 0);
    const qty = Math.min(maxQty, Math.floor(riskUsd / (risk * pv) + 1e-9));
    setups.push({ dir, m, i: m + 1, top, bot, entry, stop, tp, risk, qty, usd: qty * risk * pv,
      expires: tms[m + 1] + barMs + expireMin * 60000, swing, status: 'pending', fillAt: -1, endAt: -1 });
    return true;
  };
  const isFvg = (m, dir) => m >= 1 && m + 1 < n && (dir > 0 ? L[m + 1] > H[m - 1] : H[m + 1] < L[m - 1]);

  for (let i = 1; i < n; i++) {
    const closed = i < last;           // the live bar can't break or confirm anything yet

    // 2) Update open setups with this bar
    for (const su of setups) {
      if (i <= su.i || su.endAt >= 0) continue;
      const d = su.dir;
      if (su.status === 'pending') {
        if (tms[i] >= su.expires) { su.status = 'cancelled'; su.why = 'expired'; su.endAt = i; continue; }
        const touched = d > 0 ? L[i] <= su.entry : H[i] >= su.entry;
        if (!touched) {
          if (d > 0 ? H[i] >= su.tp : L[i] <= su.tp) { su.status = 'cancelled'; su.why = 'ran to target'; su.endAt = i; }
          continue;
        }
        su.status = 'filled'; su.fillAt = i;
        if (d > 0 ? L[i] <= su.stop : H[i] >= su.stop) { su.status = 'loss'; su.endAt = i; }
        else if (d > 0 ? C[i] >= su.tp : C[i] <= su.tp) { su.status = 'win'; su.endAt = i; }
        continue;
      }
      if (su.status === 'filled') {
        if (d > 0 ? L[i] <= su.stop : H[i] >= su.stop) { su.status = 'loss'; su.endAt = i; }
        else if (d > 0 ? H[i] >= su.tp : L[i] <= su.tp) { su.status = 'win'; su.endAt = i; }
      }
    }
    if (!closed) continue;

    // 3) Chart candle CLOSES past a swing = break → look for an FVG in the same move
    if (swH && C[i] > swH.price) {
      swH.brokeAt = i;
      if (!trendOn || trend > 0) search = { dir: 1, from: Math.max(1, i - 2), to: i + fvgLook, swing: swH };
      swH = null;
    }
    if (swL && C[i] < swL.price) {
      swL.brokeAt = i;
      if (!trendOn || trend < 0) search = { dir: -1, from: Math.max(1, i - 2), to: i + fvgLook, swing: swL };
      swL = null;
    }
    if (search) {
      // gaps whose 3rd candle has closed by now (middle candle m ≤ i-1)
      for (let m = search.from; m <= i - 1 && m <= search.to; m++) {
        if (isFvg(m, search.dir) && makeSetup(m, search.dir, search.swing)) { search = null; break; }
      }
      if (search) { search.from = Math.max(search.from, i); if (i - 1 >= search.to) search = null; }
    }

    // 4) Swing-timeframe candle completed on this bar?
    if (tfKey[i + 1] !== tfKey[i]) {
      const k = htfOf[i];
      // trend: swing-TF close beyond the latest swing
      if (tH && htf[k].c > tH.price) { trend = 1; tH = null; }
      if (tL && htf[k].c < tL.price) { trend = -1; tL = null; }
      // pivot confirmed at k - pivotN
      const p = k - pivotN;
      if (p - pivotN >= 0) {
        let isH = true, isL = true;
        for (let j = 1; j <= pivotN; j++) {
          if (!(htf[p].h > htf[p - j].h && htf[p].h >= htf[p + j].h)) isH = false;
          if (!(htf[p].l < htf[p - j].l && htf[p].l <= htf[p + j].l)) isL = false;
        }
        // only keep it if price hasn't already closed beyond it since
        const after = (lvl, hi) => { for (let j = htf[p].i1 + 1; j <= i; j++) if (hi ? C[j] > lvl : C[j] < lvl) return true; return false; };
        if (isH && !after(htf[p].h, true)) { swH = { dir: 1, price: htf[p].h, i: extIdx(p, true), brokeAt: -1 }; tH = { price: htf[p].h }; swingLog.push(swH); }
        if (isL && !after(htf[p].l, false)) { swL = { dir: -1, price: htf[p].l, i: extIdx(p, false), brokeAt: -1 }; tL = { price: htf[p].l }; swingLog.push(swL); }
      }
    }
  }
  const markers = [];

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
  const tfName = swingTF + 'm';

  // Current unbroken swing high / low
  for (const sw of [swH, swL]) {
    if (!sw) continue;
    const col = sw.dir > 0 ? '#80cbc4' : '#ef9a9a';
    lines.push({ x1: sw.i, y1: sw.price, x2, y2: sw.price, color: col, width: 1, style: 'dashed' });
    labels.push({ x: x2, y: sw.price, text: tfName + (sw.dir > 0 ? ' High ' : ' Low ') + fmt(sw.price, tick), color: rgba(col, 0.85), textColor: '#000000', anchor: 'left' });
  }

  // Setups: past ones as faint boxes, the live one with entry / SL / TP
  const firstDay = dayKeyA[last] - histDays + 1;
  const active = setups.filter(su => su.status === 'pending' || su.status === 'filled');
  const current = active[active.length - 1] || null;
  for (const su of setups) {
    if (dayKeyA[su.i] < firstDay) continue;
    const base = su.dir > 0 ? supCol : resCol;
    const live = su === current;
    const endX = su.endAt >= 0 ? su.endAt : x2;
    const res = su.status === 'win' ? 'WIN +' + tpR + 'R' : su.status === 'loss' ? 'LOSS -1R' : su.status === 'cancelled' ? 'cancelled (' + su.why + ')' : '';
    boxes.push({ x1: su.m - 1, y1: su.top, x2: endX, y2: su.bot,
      bg: rgba(base, live ? 0.28 : su.status === 'cancelled' ? 0.06 : 0.14),
      border: su.status === 'win' ? supCol : su.status === 'loss' ? resCol : rgba(base, 0.6), borderWidth: 1,
      text: live ? 'FVG ' + (su.dir > 0 ? 'BUY' : 'SELL') : res, textColor: '#ffffff' });
    // the swing that was broken
    if (su.swing && live) lines.push({ x1: su.swing.i, y1: su.swing.price, x2: su.i, y2: su.swing.price, color: rgba(base, 0.7), width: 1, style: 'dotted' });
  }
  if (current) {
    const su = current, d = su.dir, a = su.m - 1;
    const pts = v => fmt(Math.abs(v - su.entry), tick);
    const row = (y, col, style, text) => {
      lines.push({ x1: a, y1: y, x2, y2: y, color: col, width: 2, style });
      labels.push({ x: x2, y, text, color: col, textColor: '#ffffff', anchor: 'right' });
    };
    const side = d > 0 ? 'BUY' : 'SELL';
    const head = su.status === 'pending'
      ? side + ' LMT ' + fmt(su.entry, tick) + ' · ' + su.qty + ' ' + contract + ' ($' + Math.round(su.usd) + ') · until ' + nyClock(su.expires)
      : 'FILLED ' + side + ' ' + fmt(su.entry, tick) + ' · ' + su.qty + ' ' + contract + ' · hands off';
    row(su.entry, '#ffd54f', 'solid', head);
    row(su.stop, resCol, 'dashed', 'SL ' + fmt(su.stop, tick) + ' (-' + pts(su.stop) + ')');
    row(su.tp, supCol, 'dashed', 'TP ' + fmt(su.tp, tick) + ' (+' + pts(su.tp) + ', ' + tpR + 'R)');
  }

  // Stats over all loaded history: FVG: 23 filled · 48% win · +$540
  if (on(showStats)) {
    const fin = setups.filter(su => su.status === 'win' || su.status === 'loss');
    const wins = fin.filter(su => su.status === 'win').length;
    const R = wins * tpR - (fin.length - wins);
    const usd = Math.round(R * riskUsd);
    let bot = Infinity;
    for (let i = Math.max(0, last - 20); i <= last; i++) bot = Math.min(bot, L[i]);
    const text = fin.length
      ? 'FVG: ' + fin.length + ' filled · ' + Math.round(100 * wins / fin.length) + '% win · ' + (usd >= 0 ? '+$' : '-$') + Math.abs(usd)
      : 'FVG: no finished trades yet (' + setups.length + ' setups)';
    labels.push({ x: last, y: bot - (atr[last] || 0) * 1.5, text, color: '#37474f', textColor: '#ffffff', anchor: 'up' });
  }

  if (on(debug) || !timeOk) {
    const t0 = bars[last].time;
    labels.push({ x: last, y: L[last] - (atr[last] || 0) * 3, text: 'time=' + JSON.stringify(t0) + ' (' + typeof t0 + ') ms=' + tms[last] + ' days=' + (timeOk ? new Set(dayKeyA).size : 'n/a') + ' setups=' + setups.length + ' trend=' + trend + ' tf=' + swingTF, color: '#424242', textColor: '#ffffff', anchor: 'up' });
  }

  return { plots, lines, labels, markers, boxes };
}
