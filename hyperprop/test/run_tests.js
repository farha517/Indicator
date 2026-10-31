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
const base = (over) => Object.assign(readSettings({}), { swingLen: 3, slTicks: 0 }, over);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('defaults read from inputs', () => {
  const s = readSettings({});
  assert.strictEqual(s.temaFastLen, 8); assert.strictEqual(s.temaSlowLen, 55);
  assert.strictEqual(s.rr, 1); assert.strictEqual(s.showFvg, true); assert.strictEqual(s.swingLen, 5);
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
  const off = compute(bars, { 'FVG strategy': 'Off', 'Order blocks': 'Off', 'TEMA lines': 'Off', 'TEMA trend background': 'Off', 'Swing high / low lines': 'Off' });
  for (const k of ['plots', 'boxes', 'lines', 'markers', 'bgBands']) assert.strictEqual(off[k].length, 0, k);
});

test('custom colours are used', () => {
  const out = compute(breakAndRetest(), { 'Bullish order block': '#123456' });
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

console.log(`\n${passed} tests passed`);
