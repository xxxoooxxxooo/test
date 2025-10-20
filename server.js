const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const ENABLED_VIDEO_PROVIDERS = (process.env.ENABLED_VIDEO_PROVIDERS || 'mock').split(',').map(s => s.trim()).filter(Boolean);
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || process.env.VIDEO_REPLICATE_API_TOKEN || '';

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
    'Access-Control-Allow-Origin': '*',
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

    const isHtml = ext === '.html';
    const headers = { 'Content-Type': type };
    if (!isHtml) headers['Cache-Control'] = 'public, max-age=31536000, immutable';

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

// Simple JSON HTTP client (Node 16+ compatible)
function httpJson(method, urlString, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const isHttps = u.protocol === 'https:';
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: headers || {},
    };
    const lib = isHttps ? https : http;
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        const contentType = String(res.headers['content-type'] || '');
        const isJson = contentType.includes('application/json');
        try {
          const data = isJson ? JSON.parse(raw || '{}') : raw;
          resolve({ status: res.statusCode || 0, headers: res.headers, data });
        } catch (e) {
          resolve({ status: res.statusCode || 0, headers: res.headers, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (body !== undefined) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (!opts.headers['Content-Type']) req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

// In-memory mock jobs store
const mockJobs = new Map();

function createMockJob(payload) {
  const id = 'mock_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const job = {
    id,
    provider: 'mock',
    status: 'starting',
    input: payload || {},
    created_at: new Date().toISOString(),
    output: null,
    error: null,
  };
  mockJobs.set(id, job);
  setTimeout(() => {
    const j = mockJobs.get(id);
    if (!j) return;
    j.status = 'processing';
  }, 800);
  setTimeout(() => {
    const j = mockJobs.get(id);
    if (!j) return;
    j.status = 'succeeded';
    j.completed_at = new Date().toISOString();
    j.output = {
      message: 'Mock video generated successfully. Integrate a real provider to get actual video output.',
      url: '',
      thumbnail: '',
    };
  }, 2200);
  return job;
}

async function replicateCreatePrediction(body) {
  if (!REPLICATE_API_TOKEN) {
    const err = new Error('REPLICATE_API_TOKEN is not set');
    err.code = 'NO_TOKEN';
    throw err;
  }
  const { version, deployment, input } = body || {};
  const headers = {
    'Authorization': `Token ${REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
  if (deployment) {
    const url = `https://api.replicate.com/v1/deployments/${deployment}/predictions`;
    return httpJson('POST', url, headers, { input: input || {} });
  }
  if (version) {
    const url = 'https://api.replicate.com/v1/predictions';
    return httpJson('POST', url, headers, { version, input: input || {} });
  }
  const err = new Error('Missing deployment or version for Replicate');
  err.code = 'BAD_REQUEST';
  throw err;
}

async function replicateGetPrediction(id) {
  if (!REPLICATE_API_TOKEN) {
    const err = new Error('REPLICATE_API_TOKEN is not set');
    err.code = 'NO_TOKEN';
    throw err;
  }
  const headers = { 'Authorization': `Token ${REPLICATE_API_TOKEN}` };
  const url = `https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`;
  return httpJson('GET', url, headers);
}

function listVideoProviders() {
  const providers = [];
  if (ENABLED_VIDEO_PROVIDERS.includes('mock')) {
    providers.push({
      key: 'mock',
      name: 'Mock Provider',
      capabilities: { text_to_video: true, image_to_video: true },
      auth: 'none',
    });
  }
  if (ENABLED_VIDEO_PROVIDERS.includes('replicate')) {
    providers.push({
      key: 'replicate',
      name: 'Replicate',
      capabilities: { text_to_video: true, image_to_video: true },
      auth: REPLICATE_API_TOKEN ? 'configured' : 'missing',
      docs: 'https://replicate.com/docs/reference/http#predictions.create',
      notes: 'Use either deployment (owner/name) or version (model version ID) and provide input JSON per model.'
    });
  }
  return providers;
}

function parseJsonBody(req, res) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { send(res, 400, { ok: false, error: 'Bad JSON' }); reject(e); }
    });
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
    return send(res, 405, { ok: false, error: 'Method Not Allowed' });
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
        return send(res, 400, { ok: false, error: 'Missing fields' });
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

      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 400, { ok: false, error: 'Bad JSON' });
    }
  });
}

async function handleVideoProviders(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method Not Allowed' });
  return send(res, 200, { ok: true, providers: listVideoProviders() });
}

async function handleVideoGenerate(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method Not Allowed' });
  const body = await parseJsonBody(req, res).catch(() => null);
  if (!body) return; // parseJsonBody already responded

  const provider = String(body.provider || '').trim();
  if (!provider || !ENABLED_VIDEO_PROVIDERS.includes(provider)) {
    return send(res, 400, { ok: false, error: 'Provider not enabled or missing' });
  }

  try {
    if (provider === 'mock') {
      const job = createMockJob({ prompt: body.prompt || '', options: body.options || {} });
      return send(res, 200, { ok: true, provider, id: job.id, status: job.status });
    }

    if (provider === 'replicate') {
      const { version, deployment, input } = body;
      const resp = await replicateCreatePrediction({ version, deployment, input });
      if (resp.status >= 400) {
        return send(res, resp.status, { ok: false, error: 'Replicate API error', detail: resp.data });
      }
      const data = resp.data || {};
      return send(res, 200, { ok: true, provider, id: data.id, status: data.status || 'starting', raw: data });
    }

    return send(res, 400, { ok: false, error: 'Unknown provider' });
  } catch (e) {
    const code = e && e.code === 'NO_TOKEN' ? 400 : 500;
    return send(res, code, { ok: false, error: e.message || 'Internal Error' });
  }
}

async function handleVideoJobStatus(req, res, provider, id) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method Not Allowed' });
  if (!provider || !id) return send(res, 400, { ok: false, error: 'Missing provider or id' });
  if (!ENABLED_VIDEO_PROVIDERS.includes(provider)) return send(res, 400, { ok: false, error: 'Provider not enabled' });

  try {
    if (provider === 'mock') {
      const job = mockJobs.get(id);
      if (!job) return send(res, 404, { ok: false, error: 'Job not found' });
      return send(res, 200, { ok: true, provider, id: job.id, status: job.status, output: job.output || null, error: job.error || null });
    }
    if (provider === 'replicate') {
      const resp = await replicateGetPrediction(id);
      if (resp.status >= 400) return send(res, resp.status, { ok: false, error: 'Replicate API error', detail: resp.data });
      const data = resp.data || {};
      // Normalize status to a simpler set
      let status = data.status || '';
      if (status === 'succeeded') status = 'succeeded';
      else if (status === 'failed' || status === 'canceled') status = 'failed';
      else status = 'processing';
      return send(res, 200, { ok: true, provider, id: data.id, status, output: data.output || null, raw: data });
    }
    return send(res, 400, { ok: false, error: 'Unknown provider' });
  } catch (e) {
    const code = e && e.code === 'NO_TOKEN' ? 400 : 500;
    return send(res, code, { ok: false, error: e.message || 'Internal Error' });
  }
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

  // Video API routes
  if (pathname === '/api/video/providers') {
    return handleVideoProviders(req, res);
  }
  if (pathname === '/api/video/generate') {
    return handleVideoGenerate(req, res);
  }
  const jobsMatch = pathname.match(/^\/api\/video\/jobs\/([^/]+)\/([^/]+)$/);
  if (jobsMatch) {
    const provider = jobsMatch[1];
    const id = jobsMatch[2];
    return handleVideoJobStatus(req, res, provider, id);
  }

  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
