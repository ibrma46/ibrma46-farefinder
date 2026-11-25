const AIRPORTS = require('./airports');
const AIRLINES = [['SV','السعودية',1.15],['XY','طيران ناس',0.8],['F3','فلاي أديل',0.78],['EK','طيران الإمارات',1.3],['TK','التركية',1.05],['MS','مصر للطيران',0.9]];

function km(a, b) {
  const [, la1, lo1] = AIRPORTS[a], [, la2, lo2] = AIRPORTS[b], R = 6371, r = x => x * Math.PI / 180;
  const h = Math.sin(r(la2 - la1) / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

// Mock provider: deterministic prices (same query -> same result). Replace with a real supplier adapter.
function mockProvider(name, bias) {
  return {
    name,
    async search({ from, to, date }) {
      const d = km(from, to), out = [];
      AIRLINES.forEach(([code, airline, f], i) => {
        if (hash(name + code + from + to) < 0.25) return; // airline doesn't fly route on this provider
        const dep = Math.floor(hash(code + from + to + date + 'h') * 20) + 2;
        const dur = Math.round(d / 780 * 60 + 25);
        const days = (new Date(date) - new Date('2026-01-01')) / 864e5;
        const dow = new Date(date).getUTCDay();
        const weekend = (dow === 5 || dow === 6) ? 1.12 : 1;
        const base = (60 + d * 0.11 * f) * bias * weekend * (0.9 + hash(code + date + from + to) * 0.3);
        out.push({
          id: `${name}-${code}${100 + Math.floor(hash(code + from + to) * 899)}-${date}-${dep}`,
          provider: name, airline, airlineCode: code, from, to, date,
          departTime: `${String(dep).padStart(2, '0')}:${hash(code + date) > 0.5 ? '30' : '00'}`,
          durationMin: dur, stops: d > 3000 && hash(code + to) > 0.5 ? 1 : 0,
          price: Math.round(base * 100) / 100, currency: 'SAR', demo: true
        });
      });
      return out;
    }
  };
}
// Real adapter stub: needs AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET. Not implemented here (no credentials).
// Real provider: Travelpayouts / Aviasales Data API (cached prices, free with a Travelpayouts token).
// Docs: https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API
// NOT tested against the live API in this build (no token available).
const CUR = (process.env.TP_CURRENCY || 'sar').toLowerCase(); // Data API default is RUB, so currency must be sent
const travelpayouts = {
  name: 'aviasales', native: true, // returns round-trip fares itself
  async search({ from, to, date, ret }) {
    const u = new URL('https://api.travelpayouts.com/aviasales/v3/prices_for_dates');
    Object.entries({ origin: from, destination: to, departure_at: date, currency: CUR, one_way: ret ? 'false' : 'true', ...(ret ? { return_at: ret } : {}), sorting: 'price', limit: 30, ...(process.env.TP_MARKET ? { market: process.env.TP_MARKET } : {}) }).forEach(([k, v]) => u.searchParams.set(k, v));
    const res = await fetch(u, { headers: { 'X-Access-Token': process.env.TP_TOKEN } });
    if (!res.ok) throw new Error('travelpayouts ' + res.status);
    const j = await res.json();
    return (j.data || []).map(t => {
      const dt = String(t.departure_at || '');
      return { id: `tp-${t.airline}${t.flight_number || ''}-${dt}`, provider: 'aviasales', airline: t.airline, airlineCode: t.airline, from, to, date,
        departTime: dt.slice(11, 16), durationMin: t.duration_to || t.duration || 0,
        ret: ret || null, returnTime: t.return_at ? String(t.return_at).slice(11, 16) : null, returnDurationMin: t.duration_back || 0, stops: t.transfers || 0, price: t.price, currency: String(j.currency || CUR).toUpperCase(),
        link: t.link ? 'https://www.aviasales.com' + t.link : null };
    });
  }
};
const live = !!process.env.TP_TOKEN;

module.exports = { providers: live ? [travelpayouts] : [mockProvider('SkyA', 1.0), mockProvider('SkyB', 0.96), mockProvider('SkyC', 1.04)], live, km };
