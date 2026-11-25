// Referral model (no ticket sales, no markup): the price shown is the partner's price.
// Revenue = affiliate commission paid by the partner after a confirmed booking.
// Aviasales via Travelpayouts pays ~1.1-1.3% of ticket price (check your dashboard). Estimate only.
const CFG = { commissionPct: Number(process.env.COMMISSION_PCT || 0.012), conversion: Number(process.env.CONVERSION || 0.02) };
const r2 = x => Math.round(x * 100) / 100;
function estCommission(price, cfg = CFG) { return r2(price * cfg.commissionPct); }
function dedupeCheapest(offers) {
  const m = new Map();
  for (const o of offers) {
    const k = [o.airlineCode, o.from, o.to, o.date, o.departTime, o.returnTime || ''].join('|');
    if (!m.has(k) || o.price < m.get(k).price) m.set(k, o);
  }
  return [...m.values()];
}
function priceOffers(offers, pax = 1) {
  return dedupeCheapest(offers).map(o => ({ ...o, pax, totalPrice: r2(o.price * pax), estCommission: estCommission(o.price * pax) }))
    .sort((a, b) => a.price - b.price);
}
module.exports = { CFG, estCommission, dedupeCheapest, priceOffers };
