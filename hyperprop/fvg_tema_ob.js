// FVG Breakaway + TEMA 8/55 + Order Blocks — Hyperprop Script
// Set "Pane" to **Overlay** (draws on the price chart), not "Separate pane".
//
// Every feature can be switched On/Off independently:
//   • FVG strategy  – most recent swing high/low break -> FVG limit entry, SL, TP (1R), BUY/SELL arrows
//   • TEMA 8 / 55   – lines, cross dots, trend background, and (optionally) a filter for FVG trades
//   • Order blocks  – last opposite candle before each break of a swing, kept until price closes through
//   • Swing levels  – the most recent swing high / swing low

// ── Features ─────────────────────────────────────────────────────────────────
const showFvg    = input.select('FVG strategy', 'On', ['On', 'Off']);
const showOb     = input.select('Order blocks', 'On', ['On', 'Off']);
const showTema   = input.select('TEMA lines', 'On', ['On', 'Off']);
const showBg     = input.select('TEMA trend background', 'On', ['On', 'Off']);
const showSwings = input.select('Swing high / low lines', 'On', ['On', 'Off']);
const showPast   = input.select('Show past FVG trades', 'Off', ['On', 'Off']);
const showObOld  = input.select('Show broken order blocks', 'Off', ['On', 'Off']);

// ── Structure ────────────────────────────────────────────────────────────────
const swingLen = input.int('Swing strength (candles each side)', 5, { min: 1, max: 50 });

// ── FVG trade ────────────────────────────────────────────────────────────────
const entryMode  = input.select('Limit entry', 'FVG 50%', ['FVG 50%', 'FVG edge']);
const slMode     = input.select('Stop-loss at', 'Swing', ['Swing', 'FVG']);
const slTicks    = input.int('Stop buffer (ticks)', 2, { min: 0, max: 200 });
const tickSize   = input.float('Tick size (MNQ 0.25, MYM 1, MGC 0.1)', 0.25, { min: 0.0001, max: 100 });
const rr         = input.float('Take-profit (R)', 1, { min: 0.1, max: 20 });
const expiry     = input.int('Cancel limit after N candles', 30, { min: 1, max: 500 });
const fvgWait    = input.int('Candles after break to wait for the FVG', 2, { min: 0, max: 10 });
const filterMode = input.select('TEMA filter for FVG trades', 'Trend', ['Trend', 'Recent cross', 'Off']);
const crossLook  = input.int('Recent cross lookback (candles)', 20, { min: 1, max: 500 });

// ── TEMA ─────────────────────────────────────────────────────────────────────
const temaFastLen = input.int('TEMA fast', 8, { min: 1, max: 500 });
const temaSlowLen = input.int('TEMA slow', 55, { min: 2, max: 500 });

// ── Order blocks ─────────────────────────────────────────────────────────────
const obMax    = input.int('Max active OBs per side', 3, { min: 1, max: 20 });
const obSearch = input.int('Candles to search for OB candle', 10, { min: 1, max: 50 });

// ── Colours ──────────────────────────────────────────────────────────────────
const colBuy      = input.color('BUY arrow / bullish FVG', '#26A69A');
const colSell     = input.color('SELL arrow / bearish FVG', '#EF5350');
const colEntry    = input.color('Entry line', '#FFEB3B');
const colSl       = input.color('Stop-loss line', '#EF5350');
const colTp       = input.color('Take-profit line', '#4CAF50');
const colTemaFast = input.color('TEMA fast', '#FFFFFF');
const colTemaSlow = input.color('TEMA slow', '#7E57C2');
const colBgBull   = input.color('Background bullish', '#26A69A');
const colBgBear   = input.color('Background bearish', '#EF5350');
const colObBull   = input.color('Bullish order block', '#26A69A');
const colObBear   = input.color('Bearish order block', '#EF5350');
const colSwingHi  = input.color('Swing high line', '#4CAF50');
const colSwingLo  = input.color('Swing low line', '#EF5350');

// ═════════════════════════════════════════════════════════════════════════════
// Settings: read each value from `inputs` by label, falling back to the const above.
// ═════════════════════════════════════════════════════════════════════════════
function readSettings(inputs) {
  const v = (label, key, fallback) => {
    if (inputs && typeof inputs === 'object') {
      if (label in inputs) return inputs[label];
      if (key in inputs) return inputs[key];
    }
    if (fallback && typeof fallback === 'object' && 'value' in fallback) return fallback.value;
    return fallback;
  };
  const on = (x) => x === true || x === 'On' || x === 'on' || x === 1;
  return {
    showFvg: on(v('FVG strategy', 'showFvg', showFvg)),
    showOb: on(v('Order blocks', 'showOb', showOb)),
    showTema: on(v('TEMA lines', 'showTema', showTema)),
    showBg: on(v('TEMA trend background', 'showBg', showBg)),
    showSwings: on(v('Swing high / low lines', 'showSwings', showSwings)),
    showPast: on(v('Show past FVG trades', 'showPast', showPast)),
    showObOld: on(v('Show broken order blocks', 'showObOld', showObOld)),
    swingLen: Number(v('Swing strength (candles each side)', 'swingLen', swingLen)),
    entryMode: v('Limit entry', 'entryMode', entryMode),
    slMode: v('Stop-loss at', 'slMode', slMode),
    slTicks: Number(v('Stop buffer (ticks)', 'slTicks', slTicks)),
    tickSize: Number(v('Tick size (MNQ 0.25, MYM 1, MGC 0.1)', 'tickSize', tickSize)),
    rr: Number(v('Take-profit (R)', 'rr', rr)),
    expiry: Number(v('Cancel limit after N candles', 'expiry', expiry)),
    fvgWait: Number(v('Candles after break to wait for the FVG', 'fvgWait', fvgWait)),
    filterMode: v('TEMA filter for FVG trades', 'filterMode', filterMode),
    crossLook: Number(v('Recent cross lookback (candles)', 'crossLook', crossLook)),
    temaFastLen: Number(v('TEMA fast', 'temaFastLen', temaFastLen)),
    temaSlowLen: Number(v('TEMA slow', 'temaSlowLen', temaSlowLen)),
    obMax: Number(v('Max active OBs per side', 'obMax', obMax)),
    obSearch: Number(v('Candles to search for OB candle', 'obSearch', obSearch)),
    col: {
      buy: v('BUY arrow / bullish FVG', 'colBuy', colBuy),
      sell: v('SELL arrow / bearish FVG', 'colSell', colSell),
      entry: v('Entry line', 'colEntry', colEntry),
      sl: v('Stop-loss line', 'colSl', colSl),
      tp: v('Take-profit line', 'colTp', colTp),
      temaFast: v('TEMA fast', 'colTemaFast', colTemaFast),
      temaSlow: v('TEMA slow', 'colTemaSlow', colTemaSlow),
      bgBull: v('Background bullish', 'colBgBull', colBgBull),
      bgBear: v('Background bearish', 'colBgBear', colBgBear),
      obBull: v('Bullish order block', 'colObBull', colObBull),
      obBear: v('Bearish order block', 'colObBear', colObBear),
      swingHi: v('Swing high line', 'colSwingHi', colSwingHi),
      swingLo: v('Swing low line', 'colSwingLo', colSwingLo),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Indicator maths (self-contained, no platform helpers needed)
// ═════════════════════════════════════════════════════════════════════════════
function emaArr(src, len) {
  const out = new Array(src.length);
  const k = 2 / (len + 1);
  let prev = src[0];
  for (let i = 0; i < src.length; i++) {
    prev = i === 0 ? src[0] : src[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function temaArr(src, len) {
  const e1 = emaArr(src, len);
  const e2 = emaArr(e1, len);
  const e3 = emaArr(e2, len);
  return e1.map((x, i) => 3 * x - 3 * e2[i] + e3[i]);
}

// Swing high at bar i: highest high of the `len` candles on each side (known at bar i + len)
function isPivotHigh(h, i, len) {
  if (i - len < 0 || i + len >= h.length) return false;
  for (let j = i - len; j <= i + len; j++) if (j !== i && h[j] > h[i]) return false;
  return true;
}
function isPivotLow(l, i, len) {
  if (i - len < 0 || i + len >= l.length) return false;
  for (let j = i - len; j <= i + len; j++) if (j !== i && l[j] < l[i]) return false;
  return true;
}

// Runs the whole indicator over the candles. Pure function: easy to test.
function analyse(bars, s) {
  const n = bars.length;
  const o = bars.map((b) => b.o), h = bars.map((b) => b.h), l = bars.map((b) => b.l), c = bars.map((b) => b.c);
  const last = n - 1;

  const temaF = temaArr(c, s.temaFastLen);
  const temaS = temaArr(c, s.temaSlowLen);
  const warm = (i) => i >= s.temaSlowLen;
  const bull = temaF.map((x, i) => x > temaS[i]);
  const bullX = [], bearX = [];
  for (let i = 1; i < n; i++) {
    if (!warm(i)) continue;
    if (bull[i] && !bull[i - 1]) bullX.push(i);
    if (!bull[i] && bull[i - 1]) bearX.push(i);
  }
  let lastBullX = -Infinity, lastBearX = -Infinity, bxi = 0, sxi = 0;

  const trades = [];
  const obs = [];
  const events = [];
  let pend = { long: null, short: null };
  let open = { long: null, short: null };
  let swingHi = null, swingLo = null; // {bar, price, used}
  // After a break, keep watching a few candles for the breakout FVG to complete
  const armed = { long: null, short: null }; // {leg, until}

  const makeSetup = (side, t, k, leg) => {
    const isL = side === 'long';
    if (open[side] || !filterOk(side, t)) return false;
    const top = isL ? l[k] : l[k - 2];
    const bot = isL ? h[k - 2] : h[k];
    const entry = s.entryMode === 'FVG edge' ? (isL ? top : bot) : (top + bot) / 2;
    const stop = isL ? (s.slMode === 'Swing' ? l[leg] : bot) - s.slTicks * s.tickSize
                     : (s.slMode === 'Swing' ? h[leg] : top) + s.slTicks * s.tickSize;
    if (isL ? entry <= stop : stop <= entry) return false;
    if (pend[side]) { pend[side].status = 'cancelled'; pend[side].exit = t; }
    const tp = isL ? entry + s.rr * (entry - stop) : entry - s.rr * (stop - entry);
    const tr = { side, setup: t, fvgBar: k - 2, top, bot, entry, stop, tp, fill: null, exit: null, status: 'pending' };
    trades.push(tr);
    pend[side] = tr;
    events.push({ bar: t, type: isL ? 'longSetup' : 'shortSetup', trade: tr });
    return true;
  };
  const isGap = (side, i) => i >= 2 && (side === 'long' ? l[i] > h[i - 2] : h[i] < l[i - 2]);
  let wins = 0, losses = 0, streak = 0;

  const filterOk = (side, t) => {
    if (s.filterMode === 'Off') return true;
    if (!warm(t)) return false;
    const trendOk = side === 'long' ? bull[t] : !bull[t];
    if (s.filterMode === 'Trend') return trendOk;
    const lastX = side === 'long' ? lastBullX : lastBearX;
    return trendOk && t - lastX < s.crossLook;
  };

  for (let t = 0; t < n; t++) {
    while (bxi < bullX.length && bullX[bxi] <= t) lastBullX = bullX[bxi++];
    while (sxi < bearX.length && bearX[sxi] <= t) lastBearX = bearX[sxi++];

    // 1) Order blocks: close through = broken, first touch = tapped
    for (const ob of obs) {
      if (ob.end !== null || t <= ob.created) continue;
      if ((ob.bull && c[t] < ob.bot) || (!ob.bull && c[t] > ob.top)) ob.end = t;
      else if (ob.tapped === null && (ob.bull ? l[t] <= ob.top : h[t] >= ob.bot)) {
        ob.tapped = t;
        events.push({ bar: t, type: ob.bull ? 'bullObTap' : 'bearObTap' });
      }
    }

    // 2) Open trades (stop checked first = conservative)
    for (const side of ['long', 'short']) {
      const tr = open[side];
      if (!tr || t <= tr.fill) continue;
      const isL = side === 'long';
      const hitSl = isL ? l[t] <= tr.stop : h[t] >= tr.stop;
      const hitTp = isL ? h[t] >= tr.tp : l[t] <= tr.tp;
      if (hitSl || hitTp) {
        tr.exit = t;
        tr.status = hitSl ? 'loss' : 'win';
        if (hitSl) { losses++; streak = 0; } else { wins++; streak++; }
        tr.streak = streak;
        events.push({ bar: t, type: hitSl ? 'stopLoss' : 'takeProfit', trade: tr });
        open[side] = null;
      }
    }

    // 3) Pending limit orders
    for (const side of ['long', 'short']) {
      const tr = pend[side];
      if (!tr || t <= tr.setup) continue;
      const isL = side === 'long';
      if (isL ? l[t] <= tr.entry : h[t] >= tr.entry) {
        tr.fill = t;
        tr.status = 'open';
        pend[side] = null;
        events.push({ bar: t, type: isL ? 'buy' : 'sell', trade: tr });
        if (isL ? l[t] <= tr.stop : h[t] >= tr.stop) {
          tr.exit = t; tr.status = 'loss'; losses++; streak = 0; tr.streak = 0;
          events.push({ bar: t, type: 'stopLoss', trade: tr });
        } else open[side] = tr;
      } else if ((isL ? c[t] < tr.stop : c[t] > tr.stop) || t - tr.setup >= s.expiry) {
        tr.status = 'cancelled';
        tr.exit = t;
        pend[side] = null;
      }
    }

    // 4) Swings that get confirmed on this candle (most recent wins)
    const p = t - s.swingLen;
    if (p >= 0) {
      if (isPivotHigh(h, p, s.swingLen)) swingHi = { bar: p, price: h[p], used: false };
      if (isPivotLow(l, p, s.swingLen)) swingLo = { bar: p, price: l[p], used: false };
    }

    // 5) Armed breaks: the breakout FVG completes on a candle after the break
    for (const side of ['long', 'short']) {
      const a = armed[side];
      if (!a || a.since === t) continue;
      if (t > a.until) { armed[side] = null; continue; }
      if (isGap(side, t) && t - 2 >= a.leg) {
        makeSetup(side, t, t, a.leg);
        armed[side] = null;
      }
    }

    // 6) Bullish break of the most recent swing high
    if (swingHi && !swingHi.used && c[t] > swingHi.price) {
      swingHi.used = true;
      let leg = swingHi.bar;
      for (let i = swingHi.bar; i <= t; i++) if (l[i] < l[leg]) leg = i;
      for (let j = leg; j >= Math.max(leg - s.obSearch, 0); j--) {
        if (c[j] < o[j]) { addOb(obs, true, j, t, h[j], l[j], s.obMax); events.push({ bar: t, type: 'bullOb' }); break; }
      }
      let k = -1;
      for (let i = t; i >= Math.max(leg + 2, 2); i--) if (isGap('long', i)) { k = i; break; }
      if (k >= 0) makeSetup('long', t, k, leg);
      if (s.fvgWait > 0) armed.long = { leg, since: t, until: t + s.fvgWait }; // a fresher gap may still form
      armed.short = null;
    }

    // 7) Bearish break of the most recent swing low
    if (swingLo && !swingLo.used && c[t] < swingLo.price) {
      swingLo.used = true;
      let leg = swingLo.bar;
      for (let i = swingLo.bar; i <= t; i++) if (h[i] > h[leg]) leg = i;
      for (let j = leg; j >= Math.max(leg - s.obSearch, 0); j--) {
        if (c[j] > o[j]) { addOb(obs, false, j, t, h[j], l[j], s.obMax); events.push({ bar: t, type: 'bearOb' }); break; }
      }
      let k = -1;
      for (let i = t; i >= Math.max(leg + 2, 2); i--) if (isGap('short', i)) { k = i; break; }
      if (k >= 0) makeSetup('short', t, k, leg);
      if (s.fvgWait > 0) armed.short = { leg, since: t, until: t + s.fvgWait };
      armed.long = null;
    }
  }

  return { last, temaF, temaS, bull, bullX, bearX, trades, obs, events, swingHi, swingLo, wins, losses, streak };
}

function addOb(obs, bull, bar, created, top, bot, max) {
  obs.push({ bull, bar, created, top, bot, end: null, tapped: null });
  const active = obs.filter((x) => x.bull === bull && x.end === null);
  if (active.length > max) active[0].end = created; // retire the oldest
}

// ═════════════════════════════════════════════════════════════════════════════
// Drawing. ⚠ This is the only part tied to Hyperprop's output format.
// x = bar index, y = price, as described in the editor's header comment.
// ═════════════════════════════════════════════════════════════════════════════
function withAlpha(hex, alpha) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Hyperprop's exact field names for box / line colours aren't documented to us,
// so each shape carries the common aliases. Unused keys are simply ignored.
function box(x1, y1, x2, y2, hex, alpha, text) {
  const rgba = withAlpha(hex, alpha);
  return { x1, y1, x2, y2, color: hex, opacity: alpha, fillOpacity: alpha, fillColor: rgba, fill: rgba,
    backgroundColor: rgba, bgColor: rgba, background: rgba, bg: rgba,
    borderColor: hex, border: hex, lineColor: hex, stroke: hex, text, textColor: hex };
}
function line(x1, y1, x2, y2, color, style, width, text) {
  return { x1, y1, x2, y2, color, lineColor: color, stroke: color, style, lineStyle: style, width, lineWidth: width, text };
}

function render(r, s) {
  const plots = [], boxes = [], lines = [], markers = [], bgBands = [];
  const C = s.col;

  if (s.showTema) {
    plots.push({ title: `TEMA ${s.temaFastLen}`, values: r.temaF, color: C.temaFast, lineWidth: 2 });
    plots.push({ title: `TEMA ${s.temaSlowLen}`, values: r.temaS, color: C.temaSlow, lineWidth: 2 });
    for (const x of r.bullX) markers.push({ x, y: r.temaF[x], shape: 'circle', color: C.buy, size: 'tiny' });
    for (const x of r.bearX) markers.push({ x, y: r.temaF[x], shape: 'circle', color: C.sell, size: 'tiny' });
  }

  if (s.showBg) {
    let start = s.temaSlowLen;
    for (let i = start + 1; i <= r.last + 1; i++) {
      if (i > r.last || r.bull[i] !== r.bull[start]) {
        bgBands.push({ x1: start, x2: i - 1, color: withAlpha(r.bull[start] ? C.bgBull : C.bgBear, 0.08) });
        start = i;
      }
    }
  }

  if (s.showSwings) {
    if (r.swingHi) lines.push(line(r.swingHi.bar, r.swingHi.price, r.last, r.swingHi.price, C.swingHi, 'dashed', 1, 'Swing High'));
    if (r.swingLo) lines.push(line(r.swingLo.bar, r.swingLo.price, r.last, r.swingLo.price, C.swingLo, 'dashed', 1, 'Swing Low'));
  }

  if (s.showOb) {
    for (const ob of r.obs) {
      if (ob.end !== null && ob.end <= ob.created) continue; // retired right away
      const col = ob.bull ? C.obBull : C.obBear;
      if (ob.end !== null && !s.showObOld) continue; // only live (unbroken) OBs
      boxes.push(box(ob.bar, ob.top, ob.end ?? r.last, ob.bot, col, 0.2, ob.bull ? 'Bull OB' : 'Bear OB'));
    }
  }

  if (s.showFvg) {
    const dec = (String(s.tickSize).split('.')[1] || '').length; // MNQ 0.25 -> 2, MYM 1 -> 0, MGC 0.1 -> 1
    const fmt = (p) => (Math.round(p / s.tickSize) * s.tickSize).toFixed(dec);
    for (const tr of r.trades) {
      const live = tr.status === 'pending' || tr.status === 'open';
      if (!live && !s.showPast) continue;
      if (tr.status === 'cancelled') continue;
      const col = tr.side === 'long' ? C.buy : C.sell;
      const x2 = live ? r.last : tr.exit;
      // Setup zone (the FVG) + entry / stop / target
      boxes.push(box(tr.fvgBar, tr.top, x2, tr.bot, col, 0.3, ''));
      lines.push(line(tr.fvgBar, tr.entry, x2, tr.entry, C.entry, 'solid', 2));
      lines.push(line(tr.fvgBar, tr.stop, x2, tr.stop, C.sl, 'dotted', 2));
      lines.push(line(tr.fvgBar, tr.tp, x2, tr.tp, C.tp, 'dotted', 2));
      if (live) {
        // Price tags at the right edge so the levels are readable
        const tag = tr.status === 'pending' ? (tr.side === 'long' ? 'BUY LIMIT' : 'SELL LIMIT') : (tr.side === 'long' ? 'LONG' : 'SHORT');
        const isL = tr.side === 'long';
        markers.push({ x: r.last, y: tr.entry, shape: 'label', position: isL ? 'above' : 'below', color: C.entry, text: `${tag} ${fmt(tr.entry)}` });
        markers.push({ x: r.last, y: tr.stop, shape: 'label', position: isL ? 'below' : 'above', color: C.sl, text: `SL ${fmt(tr.stop)}` });
        markers.push({ x: r.last, y: tr.tp, shape: 'label', position: isL ? 'above' : 'below', color: C.tp, text: `TP ${fmt(tr.tp)}` });
      }
    }
    for (const e of r.events) {
      const tr = e.trade;
      const drawn = s.showPast || (tr && (tr.status === 'pending' || tr.status === 'open'));
      if (e.type === 'buy' && drawn) markers.push({ x: e.bar, y: tr.entry, shape: 'arrowUp', position: 'below', color: C.buy });
      if (e.type === 'sell' && drawn) markers.push({ x: e.bar, y: tr.entry, shape: 'arrowDown', position: 'above', color: C.sell });
      if (e.type === 'takeProfit') markers.push({ x: e.bar, y: tr.tp, shape: 'label', position: tr.side === 'long' ? 'above' : 'below', color: C.tp, text: `WIN 🔥${tr.streak}` });
      if (e.type === 'stopLoss') markers.push({ x: e.bar, y: tr.stop, shape: 'label', position: tr.side === 'long' ? 'below' : 'above', color: C.sl, text: 'SL' });
    }
  }

  return { plots, boxes, lines, markers, bgBands };
}

// ═════════════════════════════════════════════════════════════════════════════
function compute(bars, inputs, hp) {
  const s = readSettings(inputs);
  if (!bars || bars.length < 3) return { plots: [] };
  return render(analyse(bars, s), s);
}

// For offline testing in Node (ignored by Hyperprop)
if (typeof module !== 'undefined' && module.exports) module.exports = { analyse, render, compute, readSettings };
