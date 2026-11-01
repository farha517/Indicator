// Offline tests: node hyperprop/test/run_tests.js
const assert = require('assert');
// Stand-in for Hyperprop's input API: returns the default value
global.input = new Proxy({}, { get: () => (label, def) => def });
const { analyse, compute, readSettings } = require('../fvg_tema_ob.js');

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
function frame(closes, spread = 0.5) {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    return { time: 1767225600000 + i * 120000, o, h: Math.max(o, c) + spread, l: Math.min(o, c) - spread, c, v: 1 };
  });
}
const breakAndRetest = () => frame([...linspace(80, 110, 70), ...linspace(109, 103, 8), 104, 106, 112, 114, 111, 108, 106, ...linspace(107, 130, 25)]);
const base = (over) => Object.assign(readSettings({}), { swingLen: 3, slTicks: 0, entryMode: 'FVG edge', fvgWait: 0, filterMode: 'Trend', minFvgAtr: 0, oneAtATime: false }, over);

// The quality filters off, for tests that check drawing rather than filtering
const LOOSE = { 'Min FVG size (x ATR, 0 = off)': 0, 'One setup at a time': 'Off' };
const loose = (o) => Object.assign({}, LOOSE, o);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('defaults read from inputs', () => {
  const s = readSettings({});
  assert.strictEqual(s.temaFastLen, 8); assert.strictEqual(s.temaSlowLen, 55);
  assert.strictEqual(s.rr, 1); assert.strictEqual(s.showFvg, true); assert.strictEqual(s.swingLen, 3);
  assert.strictEqual(s.filterMode, 'Trend');
});

test('inputs object overrides defaults (by label)', () => {
  const s = readSettings({ 'FVG strategy': 'Off', 'TEMA fast': 10 });
  assert.strictEqual(s.showFvg, false); assert.strictEqual(s.temaFastLen, 10);
});

test('bullish break -> FVG limit at 105.5, SL at leg low 102.5, 1R TP, filled and wins', () => {
  const r = analyse(breakAndRetest(), base({ filterMode: 'Off' }));
  const tr = r.trades[0];
  assert.strictEqual(tr.side, 'long'); assert.strictEqual(tr.setup, 80);
  assert.strictEqual(tr.entry, 105.5); assert.strictEqual(tr.stop, 102.5); assert.strictEqual(tr.tp, 108.5);
  assert.ok(tr.fill !== null); assert.strictEqual(tr.status, 'win');
});

test('stop buffer in ticks', () => {
  const r = analyse(breakAndRetest(), base({ filterMode: 'Off', slTicks: 2, tickSize: 0.25 }));
  assert.strictEqual(r.trades[0].stop, 102);
});

test('TEMA trend filter blocks the counter-trend long', () => {
  const r = analyse(breakAndRetest(), base({ filterMode: 'Trend' }));
  assert.ok(r.trades.every((t) => t.setup !== 80));
});

test('bullish order block = last bearish candle at the leg low', () => {
  const bars = breakAndRetest();
  const r = analyse(bars, base({ filterMode: 'Off' }));
  const ob = r.obs.find((x) => x.bull);
  assert.strictEqual(ob.created, 80); assert.strictEqual(ob.bar, 77);
  assert.ok(bars[77].c < bars[77].o);
});

test('toggles: FVG off still draws OBs and TEMA; everything off draws nothing', () => {
  const bars = breakAndRetest();
  const a = compute(bars, { 'FVG strategy': 'Off' });
  assert.ok(a.boxes.some((b) => b.text === 'Bull OB'));
  assert.strictEqual(a.plots.length, 2);
  assert.ok(!a.markers.some((m) => m.text === 'BUY' || m.text === 'SELL'));
  const off = compute(bars, { 'FVG strategy': 'Off', 'Order blocks': 'Off', 'TEMA lines': 'Off', 'TEMA trend background': 'Off', 'Range High / Low lines': 'Off' });
  for (const k of ['plots', 'boxes', 'lines', 'markers', 'bgBands']) assert.strictEqual(off[k].length, 0, k);
});

test('custom colours are used', () => {
  const out = compute(breakAndRetest(), { 'Bullish order block': '#123456', 'Show broken order blocks': 'On' });
  assert.ok(out.boxes.some((b) => b.borderColor === '#123456'));
});

test('no look-ahead: signals on the first 400 candles match a run on all 600', () => {
  let x = 100, seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const closes = Array.from({ length: 600 }, () => (x += rand() * 2));
  const bars = frame(closes, 0.8);
  const key = (r, upto) => JSON.stringify(r.events.filter((e) => e.bar < upto).map((e) => [e.bar, e.type]));
  assert.strictEqual(key(analyse(bars, base({})), 400), key(analyse(bars.slice(0, 400), base({})), 400));
});

test('live setup can show price tags; past trades can be hidden', () => {
  // cut the data right after the setup so it is still pending
  const bars = breakAndRetest().slice(0, 82);
  const out = compute(bars, loose({ 'TEMA filter for FVG trades': 'Off', 'Swing strength (candles each side)': 3, 'Limit entry': 'FVG edge', 'Candles after break to wait for the FVG': 0, 'Price tags on live trade': 'On' }));
  assert.ok(out.markers.some((m) => m.text === 'Entry 105.50'), JSON.stringify(out.markers.map((m) => m.text)));
  assert.ok(out.markers.some((m) => m.text === 'SL 102.00'));
  assert.ok(out.markers.some((m) => m.text === 'TP 109.00'));
  // finished trades are hidden unless "Show past FVG trades" is On
  const done = compute(breakAndRetest(), loose({ 'TEMA filter for FVG trades': 'Off', 'Swing strength (candles each side)': 3, 'Candles after break to wait for the FVG': 0, 'Limit entry': 'FVG edge', 'Show past FVG trades': 'Off' }));
  assert.ok(!done.boxes.some((b) => b.text === '' && b.y1 === 105.5));
  const past = compute(breakAndRetest(), loose({ 'TEMA filter for FVG trades': 'Off', 'Swing strength (candles each side)': 3, 'Show past FVG trades': 'On', 'Candles after break to wait for the FVG': 0, 'Limit entry': 'FVG edge' }));
  assert.ok(past.boxes.some((b) => b.y1 === 105.5));
});

test('broken order blocks are hidden by default', () => {
  let x = 100, seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const bars = frame(Array.from({ length: 800 }, () => (x += rand() * 2)), 0.8);
  const out = compute(bars, { 'Max active OBs per side': 1 });
  const obBoxes = out.boxes.filter((b) => /OB$/.test(b.text));
  assert.ok(obBoxes.length <= 2, obBoxes.length);
});

test('entry: near edge by default (matches TradingView), 50% optional', () => {
  const r = analyse(breakAndRetest(), Object.assign(readSettings({}), { swingLen: 3, slTicks: 0, filterMode: 'Off', fvgWait: 0 }));
  assert.strictEqual(r.trades[0].entry, 105.5);
  const m = analyse(breakAndRetest(), Object.assign(readSettings({}), { swingLen: 3, slTicks: 0, filterMode: 'Off', fvgWait: 0, entryMode: 'FVG 50%' }));
  assert.strictEqual(m.trades[0].entry, 105);
});

test("breakout candle's own gap (completes next candle) replaces the earlier one", () => {
  const r = analyse(breakAndRetest(), base({ filterMode: 'Off', fvgWait: 2 }));
  const live = r.trades.filter((x) => x.status !== 'cancelled');
  assert.strictEqual(live[0].setup, 81); assert.strictEqual(live[0].fvgBar, 79);
  assert.strictEqual(live[0].top, 111.5); assert.strictEqual(live[0].bot, 106.5);
});

test('FVG completed one candle after the break still becomes a setup', () => {
  // break candle closes above the swing high, but its gap only completes on the next candle
  const bars = frame([...linspace(80, 110, 70), ...linspace(109, 103, 8), 104, 111, 116, 117, 115, 113, 112.5, ...linspace(113, 130, 20)]);
  // candle 79 closes above the swing high; its gap completes on candle 80
  const tr = analyse(bars, base({ filterMode: 'Off', fvgWait: 2 })).trades.find((x) => x.side === 'long');
  assert.ok(tr, 'no long setup');
  assert.strictEqual(tr.setup, 80); assert.strictEqual(tr.fvgBar, 78);
  // without waiting, that gap is missed
  assert.ok(!analyse(bars, base({ filterMode: 'Off', fvgWait: 0 })).trades.some((x) => x.side === 'long' && x.setup === 80));
});

test('TradingView-style drawing: zone box, dotted SL/TP, Buy Filled / TP Hit labels, no arrows or emojis', () => {
  const out = compute(breakAndRetest(), loose({ 'TEMA filter for FVG trades': 'Off', 'Swing strength (candles each side)': 3, 'Candles after break to wait for the FVG': 0 }));
  const texts = out.markers.map((m) => m.text).filter(Boolean);
  assert.ok(texts.includes('Buy Filled'), texts); assert.ok(texts.includes('TP Hit'), texts);
  assert.ok(!out.markers.some((m) => /arrow/.test(m.shape)));
  assert.ok(!texts.some((t) => /[\u{1F300}-\u{1FAFF}]/u.test(t)));
  const zone = out.boxes.find((b) => b.y1 === 105.5 && b.y2 === 104.5);
  assert.ok(zone && zone.borderColor === '#4CAF50');
  assert.ok(out.lines.some((l) => l.y1 === 102 && l.style === 'dotted' && l.color === '#F23645'));
  assert.ok(out.lines.some((l) => l.y1 === 109 && l.style === 'dotted' && l.color === '#4CAF50'));
  // Range High / Low: solid, across the chart
  assert.ok(out.lines.some((l) => l.style === 'solid' && l.x1 === 0));
});

test('a trending day produces visible setups with default settings', () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const drift = [...Array(30).fill(2), ...Array(150).fill(-4), ...Array(60).fill(6), ...Array(60).fill(0)];
  let x = 28750;
  const bars = drift.map((d) => { const o = x; x += d + rand() * 30; return { o, h: Math.max(o, x) + Math.abs(rand()) * 12, l: Math.min(o, x) - Math.abs(rand()) * 12, c: x }; });
  const out = compute(bars, loose({ 'TEMA filter for FVG trades': 'Off', 'Show setups that never filled': 'On' }));
  const zones = out.boxes.filter((b) => b.text === '');
  assert.ok(zones.length >= 10, zones.length);
  // default quality filters keep fewer setups than the loose settings
  const strict = compute(bars, {}).boxes.filter((b) => b.text === '').length;
  assert.ok(strict < zones.length, `${strict} vs ${zones.length}`);
  assert.ok(out.markers.filter((m) => /Filled/.test(m.text || '')).length >= 5);
});

test('trading hours filter uses New York time', () => {
  const at = (h, mi) => ({ time: Date.UTC(2026, 9, 5, h + 4, mi), o: 1, h: 1, l: 1, c: 1 }); // EDT = UTC-4
  const bars = [at(9, 0), at(10, 0), at(12, 0), at(14, 0)];
  const { sessionCheck } = require('../fvg_tema_ob.js');
  const am = sessionCheck('09:30-11:30');
  assert.deepStrictEqual(bars.map((b) => am(b.time)), [false, true, false, false]);
  const both = sessionCheck('09:30-11:30 + 13:30-15:30');
  assert.deepStrictEqual(bars.map((b) => both(b.time / 1000)), [false, true, false, true]); // seconds also work
});

test('max stop distance skips wide-stop setups', () => {
  const wide = analyse(breakAndRetest(), base({ filterMode: 'Off', maxRiskPts: 1 }));
  assert.strictEqual(wide.trades.length, 0);
});

test('win rate shown on chart', () => {
  const out = compute(breakAndRetest(), loose({ 'TEMA filter for FVG trades': 'Off', 'Swing strength (candles each side)': 3, 'Candles after break to wait for the FVG': 0 }));
  assert.ok(out.markers.some((m) => /^Wins 1  Losses 0  Win rate 100%/.test(m.text || '')));
});

console.log(`\n${passed} tests passed`);
