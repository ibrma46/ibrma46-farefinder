const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = {
  ar: { oneway: 'ذهاب فقط', round: 'ذهاب وعودة', ret: 'تاريخ العودة', wl: '· بحث متقدم (حجز بالعربي والريال)', retbad: 'اختر تاريخ العودة (بعد تاريخ الذهاب)', back: 'العودة', tagline: 'قارن أسعار الطيران واعثر على أرخص سعر', from: 'من', to: 'إلى', date: 'تاريخ الذهاب', pax: 'المسافرون', search: 'ابحث',
    country: 'الدولة: المملكة العربية السعودية · العملة: ريال سعودي (ر.س)', ph: 'اكتب المدينة أو المطار أو الرمز',
    disc: 'REMCO موقع مقارنة أسعار فقط، لسنا وكالة سفر ولا نبيع تذاكر ولا نستلم مدفوعات. الحجز يتم لدى الشريك المعروض. قد نحصل على عمولة من الشريك دون أي زيادة على سعرك. الأسعار استرشادية وقد تختلف عند الحجز.',
    searching: 'جارٍ البحث...', flights: n => `${n} رحلة`, none: 'لا توجد رحلات', cheapest: 'الأرخص', direct: 'مباشر', stop: 'توقف',
    book: 'اذهب للحجز ←', h: 'س', m: 'د', bad: 'اختر المطار من القائمة (اكتب الاسم أو الرمز)', err: 'خطأ' },
  en: { oneway: 'One way', round: 'Round trip', ret: 'Return date', wl: '· Advanced search (Arabic and SAR booking)', retbad: 'Pick a return date (after the departure date)', back: 'Return', tagline: 'Compare flight prices and find the cheapest fare', from: 'From', to: 'To', date: 'Departure date', pax: 'Passengers', search: 'Search',
    country: 'Country: Saudi Arabia · Currency: Saudi riyal (SAR)', ph: 'Type a city, airport or code',
    disc: 'REMCO is a price comparison site only. We are not a travel agency, we do not sell tickets and we do not take payments. You book with the partner shown. We may earn a commission from the partner at no extra cost to you. Prices are indicative and may change at booking.',
    searching: 'Searching...', flights: n => `${n} flights`, none: 'No flights found', cheapest: 'Cheapest', direct: 'Direct', stop: 'Stop',
    book: 'Go to booking →', h: 'h', m: 'm', bad: 'Pick an airport from the list (type a name or code)', err: 'Error' }
};
let lang = localStorage.getItem('lang') || 'ar', last = null;
const t = k => T[lang][k];
const cur = c => (lang === 'ar' && c === 'SAR') ? 'ر.س' : c;
function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
  $('lang').textContent = lang === 'ar' ? 'EN' : 'عربي';
  $('from').placeholder = $('to').placeholder = t('ph');
}
$('lang').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('lang', lang); applyLang(); };
async function api(url) { const r = await fetch(url); const j = await r.json(); if (!r.ok) throw new Error(j.error || t('err')); return j; }
const msg = (x, e) => { $('msg').textContent = x; $('msg').className = e ? 'err' : ''; };
const names = {}; // code -> display text
const show = a => `${a.label} (${a.code})`;
const full = a => [a.city, a.country, a.name].filter(Boolean).join(' · ');
function suggest(inputId, listId) {
  let tm; $(inputId).addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(async () => {
    const v = $(inputId).value.trim(); if (v.length < 1) return;
    try { const r = await api('/api/airports?q=' + encodeURIComponent(v)); $(listId).innerHTML = r.map(a => { names[a.code] = show(a); return `<option value="${esc(show(a))}" label="${esc(full(a))}"></option>`; }).join(''); } catch {}
  }, 150); });
}
suggest('from', 'dl-from'); suggest('to', 'dl-to');
function code(v) { const m = String(v).match(/\(([A-Z]{3})\)/) || String(v).trim().toUpperCase().match(/^([A-Z]{3})$/); return m ? m[1] : null; }
(async () => {
  applyLang();
  const a = await api('/api/airports?q=RUH'), b = await api('/api/airports?q=JED');
  $('from').value = show(a[0]); $('to').value = show(b[0]);
  const d = new Date(); d.setDate(d.getDate() + 14); $('date').value = d.toISOString().slice(0, 10);
})();
const isRound = () => document.querySelector('input[name=trip]:checked').value === 'round';
document.querySelectorAll('input[name=trip]').forEach(r => r.onchange = () => { $('retwrap').hidden = !isRound(); if (isRound() && !$('ret').value) { const d = new Date($('date').value || Date.now()); d.setDate(d.getDate() + 7); $('ret').value = d.toISOString().slice(0, 10); } });
function q() { const o = { from: code($('from').value), to: code($('to').value), date: $('date').value, pax: $('pax').value }; if (isRound()) o.ret = $('ret').value; return o; }
async function run() {
  last = q(); if (!last.from || !last.to) return msg(t('bad'), true);
  if (isRound() && (!last.ret || last.ret < last.date)) return msg(t('retbad'), true);
  msg(t('searching')); $('res').innerHTML = ''; $('cal').innerHTML = '';
  try {
    const qs = new URLSearchParams(last);
    const [r, c] = await Promise.all([api('/api/search?' + qs), api('/api/calendar?' + qs)]);
    msg(r.length ? t('flights')(r.length) : t('none'));
    const min = Math.min(...c.filter(x => x.cheapest != null).map(x => x.cheapest));
    $('cal').className = 'cal';
    $('cal').innerHTML = c.map(x => `<div class="day ${x.cheapest === min ? 'min' : ''}" data-d="${x.date}">${x.date}<br><b>${x.cheapest ?? '-'}</b></div>`).join('');
    $('res').innerHTML = r.map((o, i) => `<div class="card ${i ? '' : 'best'}"><div>${i ? '' : `<span class="badge">${t('cheapest')}</span> `}<b>${esc(o.airline)}</b> ${esc(o.from)}→${esc(o.to)}<br>${esc(o.departTime)} · ${Math.floor(o.durationMin / 60)}${t('h')} ${o.durationMin % 60}${t('m')} · ${o.stops ? t('stop') : t('direct')}${o.ret ? `<br>${t('back')} ${esc(o.ret)} ${esc(o.returnTime || '')}${o.returnDurationMin ? ' · ' + Math.floor(o.returnDurationMin / 60) + t('h') + ' ' + o.returnDurationMin % 60 + t('m') : ''}` : ''}</div>
      <div><div class="price">${o.totalPrice} ${esc(cur(o.currency))}</div><a class="btn" target="_blank" rel="noopener sponsored" href="/go?${new URLSearchParams({ ...last, offerId: o.id })}">${t('book')}</a></div></div>`).join('');
  } catch (e) { msg(e.message, true); }
}
$('f').onsubmit = e => { e.preventDefault(); run(); };
$('cal').onclick = e => { const d = e.target.closest('.day'); if (d) { $('date').value = d.dataset.d; run(); } };

fetch('/search.html').then(r => r.text()).then(x => { if (x.includes('WL_ENABLED=true')) $('wl').hidden = false; }).catch(() => {});
if (location.hash === '#go') setTimeout(run, 800);
if (location.hash === '#round') setTimeout(() => { document.querySelector('input[name=trip][value=round]').click(); run(); }, 800);
