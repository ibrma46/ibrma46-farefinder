const os = require('os'), path = require('path'), fs = require('fs');
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ff-')), 'b.json');
process.env.TP_MARKER = 'TESTMARK'; delete process.env.TP_TOKEN;
const test = require('node:test'), assert = require('node:assert');
const { createServer } = require('../src/server');
let srv, base;
test.before(async () => { srv = createServer(); await new Promise(r => srv.listen(0, r)); base = 'http://localhost:' + srv.address().port; });
test.after(() => srv.close());
const get = async p => { const r = await fetch(base + p); return [r.status, await r.json().catch(() => null)]; };
const Q = 'from=RUH&to=JED&date=2026-12-20&pax=2';
test('search sorted, has partner link with marker', async () => { const [s, r] = await get('/api/search?' + Q); assert.strictEqual(s, 200); assert.ok(r.length); for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].price <= r[i].price); assert.match(r[0].partnerLink, /marker=TESTMARK/); });
test('deterministic', async () => { assert.deepStrictEqual(await get('/api/search?' + Q), await get('/api/search?' + Q)); });
test('validation', async () => {
  for (const q of ['from=RUH&to=RUH&date=2026-12-20', 'from=XXX&to=JED&date=2026-12-20', 'from=RUH&to=JED&date=bad', 'from=RUH&to=JED&date=2026-12-20&pax=20'])
    assert.strictEqual((await get('/api/search?' + q))[0], 400);
});
test('calendar 7 days', async () => assert.strictEqual((await get('/api/calendar?' + Q))[1].length, 7));
test('click-out redirects to partner and is logged', async () => {
  const [, r] = await get('/api/search?' + Q);
  const res = await fetch(`${base}/go?${Q}&offerId=${encodeURIComponent(r[0].id)}`, { redirect: 'manual' });
  assert.strictEqual(res.status, 302); assert.match(res.headers.get('location'), /^https:\/\/www\.aviasales\.com\/.*marker=TESTMARK/);
  const [, st] = await get('/api/admin/stats'); assert.strictEqual(st.clicks, 1); assert.ok(st.estCommissionIfAllBooked > 0);
  assert.strictEqual((await fetch(`${base}/go?${Q}&offerId=nope`, { redirect: 'manual' })).status, 409);
});
test('page has disclosure; no booking endpoint; traversal blocked', async () => {
  const html = await (await fetch(base + '/')).text(); assert.ok(html.includes('لسنا وكالة سفر'));
  assert.strictEqual((await fetch(base + '/api/book', { method: 'POST' })).status, 404);
  assert.strictEqual((await fetch(base + '/..%2fpackage.json')).status, 404);
});
