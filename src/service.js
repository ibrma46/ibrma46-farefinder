const { providers, live } = require('./providers');
const { priceOffers } = require('./pricing');
const AIRPORTS = require('./airports');
const store = require('./store');

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
function err(m, status = 400) { const e = new Error(m); e.status = status; return e; }
function validate({ from, to, date, pax }) {
  if (!AIRPORTS[from]) throw err('مطار المغادرة غير معروف');
  if (!AIRPORTS[to]) throw err('مطار الوصول غير معروف');
  if (from === to) throw err('المغادرة والوصول متطابقان');
  if (!isDate(date)) throw err('تاريخ غير صالح');
  const p = Number(pax || 1); if (!Number.isInteger(p) || p < 1 || p > 9) throw err('عدد المسافرين من 1 إلى 9');
  return p;
}
// Partner link with our affiliate marker. Use the link format your Travelpayouts dashboard gives you.
function partnerLink(o, q) {
  const marker = process.env.TP_MARKER || 'DEMO_MARKER';
  if (o.link) return o.link + (o.link.includes('?') ? '&' : '?') + 'marker=' + encodeURIComponent(marker);
  const [, m, d] = q.date.split('-');
  return `https://www.aviasales.com/search/${q.from}${d}${m}${q.to}${q.pax || 1}?marker=${encodeURIComponent(marker)}`;
}
async function search(q) {
  const pax = validate(q);
  const results = await Promise.allSettled(providers.map(p => p.search(q)));
  const offers = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  return priceOffers(offers, pax).map(o => ({ ...o, partnerLink: partnerLink(o, { ...q, pax }) }));
}
function addDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
async function calendar(q) {
  validate(q); const days = [];
  for (let i = -3; i <= 3; i++) { const date = addDays(q.date, i); const r = await search({ ...q, date }); days.push({ date, cheapest: r.length ? r[0].price : null }); }
  return days;
}
// Outbound click: log it and return the partner URL to redirect to. We never take payment or issue tickets.
async function go(q) {
  validate(q);
  const o = (await search(q)).find(x => x.id === q.offerId);
  if (!o) throw err('العرض لم يعد متاحاً', 409);
  store.add({ at: new Date().toISOString(), offerId: o.id, route: o.from + '-' + o.to, date: o.date, price: o.totalPrice, estCommission: o.estCommission, demo: !!o.demo });
  return o.partnerLink;
}
function stats() {
  const l = store.load(), r2 = x => Math.round(x * 100) / 100;
  return { mode: live ? 'live-prices' : 'demo-prices', clicks: l.length, valueClicked: r2(l.reduce((s, b) => s + b.price, 0)),
    estCommissionIfAllBooked: r2(l.reduce((s, b) => s + b.estCommission, 0)) };
}
module.exports = { search, calendar, go, stats, validate };
