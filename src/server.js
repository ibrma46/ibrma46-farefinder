const http = require('http'), fs = require('fs'), path = require('path');
const svc = require('./service'), AIRPORTS = require('./airports'), store = require('./store');
const PUB = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
const body = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) { req.destroy(); no(new Error('too large')); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { no(Object.assign(new Error('JSON غير صالح'), { status: 400 })); } }); });

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x'), q = Object.fromEntries(u.searchParams);
      if (u.pathname === '/api/airports') {
        const needle = String(q.q || '').trim().toLowerCase();
        const rows = Object.entries(AIRPORTS).map(([code, a]) => ({ code, label: a[0], city: a[3], country: a[4], name: a[5] }));
        const hit = !needle ? rows.slice(0, 40) : rows.map(r => {
          const f = [r.code, r.label, r.city, r.country, r.name].map(x => String(x || '').toLowerCase());
          const score = f[0] === needle ? 0 : f[0].startsWith(needle) ? 1 : f[1].startsWith(needle) || f[2].startsWith(needle) ? 2 : f.some(x => x.includes(needle)) ? 3 : 9;
          return { r, score };
        }).filter(x => x.score < 9).sort((a, b) => a.score - b.score).map(x => x.r);
        return json(res, 200, hit.slice(0, 20));
      }
      if (u.pathname === '/api/search') return json(res, 200, await svc.search(q));
      if (u.pathname === '/api/calendar') return json(res, 200, await svc.calendar(q));
      if (u.pathname === '/go') { const url = await svc.go(q); res.writeHead(302, { Location: url }); return res.end(); }
      if (u.pathname === '/api/admin/stats') {
        if (process.env.ADMIN_KEY && req.headers['x-admin-key'] !== process.env.ADMIN_KEY) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, { ...svc.stats(), recent: store.load().slice(-10).reverse() });
      }
      let f = u.pathname === '/' ? '/index.html' : u.pathname;
      const full = path.normalize(path.join(PUB, f));
      if (!full.startsWith(PUB) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); fs.createReadStream(full).pipe(res);
    } catch (e) { json(res, e.status || 500, { error: e.message }); }
  });
}
if (require.main === module) { const port = process.env.PORT || 3000; createServer().listen(port, () => console.log('FareFinder on http://localhost:' + port)); }
module.exports = { createServer };
