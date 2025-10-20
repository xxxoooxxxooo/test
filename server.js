const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  const payload = isObj ? JSON.stringify(body) : body;
  res.writeHead(code, Object.assign({
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  }, headers));
  res.end(payload);
}

function serveStatic(req, res) {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/') pathname = '/index.html';

  const safePath = path.normalize(pathname).replace(/^([/\\]*\.\.[/\\])+/, '/');
  const filePath = path.join(ROOT, safePath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

function handleContact(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  let raw = '';
  req.on('data', (chunk) => { raw += chunk; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try {
      const data = JSON.parse(raw || '{}');
      const name = String((data.name || '')).trim();
      const email = String((data.email || '')).trim();
      const message = String((data.message || '')).trim();
      if (!name || !email || !message) {
        return send(res, 400, { ok: false, error: 'Missing fields' }, { 'Access-Control-Allow-Origin': '*' });
      }

      const dir = path.join(ROOT, 'data');
      const file = path.join(dir, 'contacts.json');
      fs.mkdirSync(dir, { recursive: true });

      let arr = [];
      if (fs.existsSync(file)) {
        try { arr = JSON.parse(fs.readFileSync(file, 'utf8') || '[]'); }
        catch (_) { arr = []; }
      }
      arr.push({
        name,
        email,
        message,
        ts: new Date().toISOString(),
        ip: req.socket.remoteAddress || '',
        ua: req.headers['user-agent'] || '',
      });
      fs.writeFileSync(file, JSON.stringify(arr, null, 2));

      return send(res, 200, { ok: true }, { 'Access-Control-Allow-Origin': '*' });
    } catch (e) {
      return send(res, 400, { ok: false, error: 'Bad JSON' }, { 'Access-Control-Allow-Origin': '*' });
    }
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  if (parsed.pathname === '/api/contact') {
    return handleContact(req, res);
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
