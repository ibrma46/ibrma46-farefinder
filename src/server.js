const http = require('http'), fs = require('fs'), path = require('path');
const svc = require('./service'), AIRPORTS = require('./airports'), store = require('./store');
const PUB = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
const body = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) { req.destroy(); no(new Error('too large')); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { no(Object.assign(new Error('JSON غير صالح'), { status: 400 })); } }); });

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x'), q = Object.fromEntries(u.searchParams);
      if (u.pathname === '/api/airports') return json(res, 200, Object.entries(AIRPORTS).map(([code, a]) => ({ code, city: a[0] })));
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
