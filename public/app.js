const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let last = null, picked = null;
async function api(url, opt) { const r = await fetch(url, opt); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'خطأ'); return j; }
const msg = (t, e) => { $('msg').textContent = t; $('msg').className = e ? 'err' : ''; };
(async () => {
  const a = await api('/api/airports');
  for (const id of ['from', 'to']) $(id).innerHTML = a.map(x => `<option value="${x.code}">${esc(x.city)} (${x.code})</option>`).join('');
  $('from').value = 'RUH'; $('to').value = 'JED';
  const d = new Date(); d.setDate(d.getDate() + 14); $('date').value = d.toISOString().slice(0, 10);
})();
function q() { return { from: $('from').value, to: $('to').value, date: $('date').value, pax: $('pax').value }; }
async function run() {
  msg('جارٍ البحث...'); $('res').innerHTML = ''; $('cal').innerHTML = '';
  try {
    last = q(); const qs = new URLSearchParams(last);
    const [r, c] = await Promise.all([api('/api/search?' + qs), api('/api/calendar?' + qs)]);
    msg(r.length ? `${r.length} رحلة` : 'لا توجد رحلات');
    const min = Math.min(...c.filter(x => x.cheapest != null).map(x => x.cheapest));
    $('cal').className = 'cal';
    $('cal').innerHTML = c.map(x => `<div class="day ${x.cheapest === min ? 'min' : ''}" data-d="${x.date}">${x.date}<br><b>${x.cheapest ?? '-'}</b></div>`).join('');
    $('res').innerHTML = r.map((o, i) => `<div class="card ${i ? '' : 'best'}"><div>${i ? '' : '<span class="badge">الأرخص</span> '}<b>${esc(o.airline)}</b> ${esc(o.from)}→${esc(o.to)}<br>${esc(o.departTime)} · ${Math.floor(o.durationMin / 60)}س ${o.durationMin % 60}د · ${o.stops ? 'توقف' : 'مباشر'}</div>
      <div><div class="price">${o.totalPrice} ${esc(o.currency)}</div><a class="btn" target="_blank" rel="noopener sponsored" href="/go?${new URLSearchParams({ ...last, offerId: o.id })}">اذهب للحجز ←</a></div></div>`).join('');
    $('res').dataset.r = JSON.stringify(r);
  } catch (e) { msg(e.message, true); }
}
$('f').onsubmit = e => { e.preventDefault(); run(); };
$('cal').onclick = e => { const d = e.target.closest('.day'); if (d) { $('date').value = d.dataset.d; run(); } };
