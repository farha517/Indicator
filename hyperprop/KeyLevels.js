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
const swMinK   = input.float('Sweep min wick past level (x ATR 14)', 0.15, { min: 0, max: 5, step: 0.05 });

// ── Bias label ──
const showInfo = input.bool('Bias / what-to-look-for label', true);
const nearK    = input.float("'At a level' distance (x ATR 14)", 1, { min: 0, max: 10, step: 0.25 });

// ════════════════════════════════════════════════════════════════════════════

const NAMES = ['PDH', 'PDL', 'PWH', 'PWL', 'PMH', 'PML', 'ATH', 'ONH', 'ONL', 'ORH', 'ORL'];
const TYPES = [0, 0, 1, 1, 2, 2, 3, 4, 4, 4, 4]; // 0 day, 1 week, 2 month, 3 ATH, 4 session
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

  // Time in ms (accepts seconds or ms)
  const tms = bars.map(b => (b.time < 1e12 ? b.time * 1000 : b.time));
  const H = bars.map(b => b.h), L = bars.map(b => b.l), C = bars.map(b => b.c), O = bars.map(b => b.o);

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

    if (dk !== dKey) {
      if (dKey !== null) {
        prevDH = curDH; prevDL = curDL;
        if (dCount >= 1) dayRanges.push(curDH - curDL);
        maxBeforeToday = Math.max(maxBeforeToday, maxToday);
      }
      dKey = dk; dCount++; curDH = -Infinity; curDL = Infinity; maxToday = -Infinity;
      onH = NaN; onL = NaN; orH = NaN; orL = NaN;
    }
    if (wk !== wKey) { if (wKey !== null) { prevWH = curWH; prevWL = curWL; } wKey = wk; wCount++; curWH = -Infinity; curWL = Infinity; }
    if (mk !== mKey) { if (mKey !== null) { prevMH = curMH; prevML = curML; } mKey = mk; mCount++; curMH = -Infinity; curML = Infinity; }

    // Sessions (intraday only)
    const inRTH = intraday && minOfDay >= rthO && minOfDay < rthC;
    const inON = intraday && (minOfDay >= 18 * 60 || minOfDay < rthO);
    const inOR = intraday && minOfDay >= rthO && minOfDay < orEnd;
    if (inRTH && !wasRTH) { rthH = H[i]; rthL = L[i]; }
    else if (inRTH) { rthH = Math.max(rthH, H[i]); rthL = Math.min(rthL, L[i]); }
    if (!inRTH && wasRTH) { prevRthH = rthH; prevRthL = rthL; }
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
    return true;
  }

  // ── Signals ──
  const markers = [];
  const lastSig = new Array(NAMES.length).fill(-1e9);
  const state = new Array(NAMES.length).fill(0), stBar = new Array(NAMES.length).fill(0), lastLv = new Array(NAMES.length).fill(NaN);
  const firstSigDay = dayKeyA[last] - sigDays + 1;

  for (let i = 1; i < last; i++) {                    // skip the live (unfinished) bar
    const tol = (atr[i] || 0) * tolK;
    let bull = [], bear = [], bullNm = [], bearNm = [];
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][i];
      if (isNaN(x) || !eligible(k, i)) { state[k] = 0; lastLv[k] = x; continue; }
      if (x !== lastLv[k]) { state[k] = 0; lastLv[k] = x; }
      const nm = nameOf(k);
      const ready = i - lastSig[k] > coolBars;      // one signal per level per cooldown
      const fire = (arr, arrNm, tag) => { if (ready) { arr.push(tag); arrNm.push(nm); lastSig[k] = i; } };
      const up = C[i] > x && C[i - 1] <= x, dn = C[i] < x && C[i - 1] >= x;
      if (up) { state[k] = 1; stBar[k] = i; if (on(showBRK)) fire(bull, bullNm, 'BRK'); }
      else if (dn) { state[k] = -1; stBar[k] = i; if (on(showBRK)) fire(bear, bearNm, 'BRK'); }
      else if (state[k] !== 0 && i - stBar[k] > rtBars) state[k] = 0;
      else if (state[k] === 1 && i - stBar[k] >= 2 && L[i] <= x + tol && C[i] > x) { state[k] = 0; if (on(showRT)) fire(bull, bullNm, 'RT'); }
      else if (state[k] === -1 && i - stBar[k] >= 2 && H[i] >= x - tol && C[i] < x) { state[k] = 0; if (on(showRT)) fire(bear, bearNm, 'RT'); }
      if (on(showSW)) {
        const minWick = (atr[i] || 0) * swMinK;
        if (H[i] - x >= minWick && H[i] > x && C[i] < x && O[i] < x && C[i - 1] < x) fire(bear, bearNm, 'SW');
        if (x - L[i] >= minWick && L[i] < x && C[i] > x && O[i] > x && C[i - 1] > x) fire(bull, bullNm, 'SW');
      }
    }
    if (dayKeyA[i] < firstSigDay) continue;
    const uniq = a => Array.from(new Set(a));
    if (bull.length) markers.push({ x: i, y: L[i], position: 'below', color: supCol, text: uniq(bull).join(' ') + ' ' + uniq(bullNm).join('/'), textColor: supCol });
    if (bear.length) markers.push({ x: i, y: H[i], position: 'above', color: resCol, text: uniq(bear).join(' ') + ' ' + uniq(bearNm).join('/'), textColor: resCol });
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
  const typeCol = t => [dCol, wCol, mCol, athCol, sCol][t];
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
    lines.push({ x1, y1: v.x, x2, y2: v.x, color: colOf(v), width: t === 3 ? 2 : 1, style: typeStyle(t) });
    if (group && Math.abs(group.y - v.x) <= mergeTol) group.names.push(nameOf(v.k));
    else { flush(); group = { y: v.x, names: [nameOf(v.k)], color: colOf(v) }; }
  }
  flush();

  // ── Moving averages (hp helpers) ──
  const e9 = hp.ema(C, 9), e20 = hp.ema(C, 20), s200 = hp.sma(C, 200);
  const plots = [];
  if (on(showE9)) plots.push({ title: 'EMA 9', values: e9, color: e9Col, width: 1 });
  if (on(showE20)) plots.push({ title: 'EMA 20', values: e20, color: e20Col, width: 1 });
  if (on(showS200)) plots.push({ title: 'SMA 200', values: s200, color: s200Col, width: 2 });

  // ── Bias + what to look for ──
  if (on(showInfo)) {
    const a = e9[last], b = e20[last], s = s200[last];
    const pdh = lv[0][last], pdl = lv[1][last], orH = lv[9][last], orL = lv[10][last];
    const emaS = a > b && px > a ? 1 : a < b && px < a ? -1 : 0;
    const smaS = s == null || isNaN(s) ? 0 : px > s ? 1 : -1;
    const pdS = isNaN(pdh) || isNaN(pdl) ? 0 : px > pdh ? 1 : px < pdl ? -1 : 0;
    const orS = orDoneA[last] && !isNaN(orH) ? (px > orH ? 1 : px < orL ? -1 : 0) : 0;
    const score = emaS + smaS + pdS + orS;
    const bias = score >= 2 ? 'BULLISH' : score <= -2 ? 'BEARISH' : 'NEUTRAL';
    const biasCol = score >= 2 ? supCol : score <= -2 ? resCol : '#787b86';

    // nearest levels (all enabled, ignoring distance filter)
    let up = null, dn = null;
    for (let k = 0; k < NAMES.length; k++) {
      const x = lv[k][last];
      if (isNaN(x)) continue;
      if (x > px && (!up || x < up.x)) up = { k, x };
      if (x <= px && (!dn || x > dn.x)) dn = { k, x };
    }
    const near = (atr[last] || 0) * nearK;
    let tip;
    if (up && up.x - px <= near && (!dn || up.x - px <= px - dn.x)) tip = 'At ' + nameOf(up.k) + ' (res): break & hold = long, reject = short';
    else if (dn && px - dn.x <= near) tip = 'At ' + nameOf(dn.k) + ' (sup): hold = long, lose it = short';
    else if (athIsReal && px > lv[6][last]) tip = 'Above ATH: price discovery, buy dips';
    else if (pdS === 1) tip = 'Above PDH: trend up, PDH = support';
    else if (pdS === -1) tip = 'Below PDL: trend down, PDL = resistance';
    else tip = 'Inside PD range: rotation, fade the edges';
    const rs = (up ? '▲ ' + nameOf(up.k) + ' +' + fmt(up.x - px, tick) : '') + (up && dn ? '  ' : '') + (dn ? '▼ ' + nameOf(dn.k) + ' -' + fmt(px - dn.x, tick) : '');

    let top = -Infinity;
    for (let i = Math.max(0, last - 20); i <= last; i++) top = Math.max(top, H[i]);
    labels.push({ x: last, y: top + (atr[last] || 0) * 1.5, text: bias + ' ' + (score > 0 ? '+' : '') + score + ' · ' + tip + (rs ? ' · ' + rs : ''), color: biasCol, textColor: '#ffffff', anchor: 'down' });
  }

  return { plots, lines, labels, markers };
}
