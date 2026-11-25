const { providers, live } = require('./providers');
const { priceOffers } = require('./pricing');
const AIRPORTS = require('./airports');
const store = require('./store');

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
function err(m, status = 400) { const e = new Error(m); e.status = status; return e; }
function validate({ from, to, date, pax, ret }) {
  if (!AIRPORTS[from]) throw err('مطار المغادرة غير معروف');
  if (!AIRPORTS[to]) throw err('مطار الوصول غير معروف');
  if (from === to) throw err('المغادرة والوصول متطابقان');
  if (!isDate(date)) throw err('تاريخ غير صالح');
  if (ret && (!isDate(ret) || ret < date)) throw err('تاريخ العودة يجب أن يكون بعد تاريخ الذهاب');
  const p = Number(pax || 1); if (!Number.isInteger(p) || p < 1 || p > 9) throw err('عدد المسافرين من 1 إلى 9');
  return p;
}
// Partner link with our affiliate marker. Use the link format your Travelpayouts dashboard gives you.
function partnerLink(o, q) {
  const marker = process.env.TP_MARKER || 'DEMO_MARKER';
  const cur = (process.env.TP_CURRENCY || 'sar').toLowerCase();
  // Links from the Data API already carry expected_price_currency (the currency we requested).
  // Aviasales documents no currency URL parameter for search links; currency=sar is best-effort (unverified).
  const add = u => { u.searchParams.set('marker', marker); if (!u.searchParams.has('currency')) u.searchParams.set('currency', cur); return u.toString(); };
  if (o.link) return add(new URL(o.link));
  const [, m, d] = q.date.split('-');
  const back = q.ret ? q.ret.split('-').slice(1).reverse().join('') : '';
  return add(new URL(`https://www.aviasales.com/search/${q.from}${d}${m}${q.to}${back}${q.pax || 1}`));
}
async function search(q) {
  const pax = validate(q);
  const run = (query) => Promise.allSettled(providers.map(async p => ({ native: !!p.native, offers: await p.search(query) })));
  const out = await run({ ...q, ret: q.ret });
  let offers = [];
  for (const r of out) {
    if (r.status !== 'fulfilled') continue;
    const { native, offers: o } = r.value;
    if (!q.ret || native) { offers.push(...o); continue; }
    // Demo provider has no round trips: pair outbound with the return flight of the same airline.
    const back = await providers.find(p => !p.native).search({ from: q.to, to: q.from, date: q.ret });
    for (const a of o) {
      const b = back.filter(x => x.airlineCode === a.airlineCode && x.provider === a.provider).sort((x, y) => x.price - y.price)[0];
      if (!b) continue;
      offers.push({ ...a, id: a.id + '~' + b.id, ret: q.ret, returnTime: b.departTime, returnDurationMin: b.durationMin, price: Math.round((a.price + b.price) * 100) / 100 });
    }
  }
  return priceOffers(offers, pax).map(o => ({ ...o, partnerLink: partnerLink(o, { ...q, pax }) }));
}
function addDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
async function calendar(q) {
  validate(q); const days = [];
  for (let i = -3; i <= 3; i++) { const date = addDays(q.date, i); const r = await search({ ...q, date, ...(q.ret ? { ret: addDays(q.ret, i) } : {}) }); days.push({ date, cheapest: r.length ? r[0].price : null }); }
  return days;
}
// Outbound click: log it and return the partner URL to redirect to. We never take payment or issue tickets.
async function go(q) {
  validate(q);
  const o = (await search(q)).find(x => x.id === q.offerId);
  if (!o) throw err('العرض لم يعد متاحاً', 409);
  store.add({ at: new Date().toISOString(), offerId: o.id, route: o.from + '-' + o.to, date: o.date, ret: o.ret || null, price: o.totalPrice, estCommission: o.estCommission, demo: !!o.demo });
  return o.partnerLink;
}
function stats() {
  const l = store.load(), r2 = x => Math.round(x * 100) / 100;
  return { mode: live ? 'live-prices' : 'demo-prices', clicks: l.length, valueClicked: r2(l.reduce((s, b) => s + b.price, 0)),
    estCommissionIfAllBooked: r2(l.reduce((s, b) => s + b.estCommission, 0)) };
}
module.exports = { search, calendar, go, stats, validate };
