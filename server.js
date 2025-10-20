const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
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

function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return xff[0] || req.socket.remoteAddress || '';
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

    // For static assets (non-HTML), enable long cache; keep HTML no-cache for fresh content
    const isHtml = ext === '.html';
    const headers = { 'Content-Type': type };
    if (!isHtml) headers['Cache-Control'] = 'public, max-age=31536000, immutable';

    res.writeHead(200, headers);
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

  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, error: 'Method Not Allowed' }, { 'Access-Control-Allow-Origin': '*' });
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
        ip: getClientIp(req),
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
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  if (pathname === '/api/contact') {
    return handleContact(req, res);
  }
  if (pathname === '/healthz' || pathname === '/api/healthz' || pathname === '/api/health') {
    return send(res, 200, { ok: true });
  }

  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
