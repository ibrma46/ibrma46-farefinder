const fs = require('fs'), path = require('path');
const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'bookings.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } }
function save(list) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list, null, 2)); }
module.exports = { load, save, add(b) { const l = load(); l.push(b); save(l); return b; } };
