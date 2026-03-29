'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT           = process.env.PORT || 3000;
const HOST           = process.env.HOST || '127.0.0.1';
const ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || `http://localhost:${PORT}`;
const DATA_DIR       = path.join(__dirname, 'data');
const DATA_FILE      = path.join(DATA_DIR, 'session.json');
const HTML_FILE      = path.join(__dirname, 'whitetip-sharks-v5.html');
const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

// Ensure data/ directory and session.json exist
if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCORS(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

function sendJSON(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(Object.assign(new Error('Request body too large'), { code: 413 }));
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // GET / — serve the HTML app
  if (method === 'GET' && url === '/') {
    try {
      const html = await fs.promises.readFile(HTML_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading HTML file');
    }
    return;
  }

  // GET /api/data — return session.json
  if (method === 'GET' && url === '/api/data') {
    try {
      const raw  = await fs.promises.readFile(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      sendJSON(res, 200, data);
    } catch (e) {
      sendJSON(res, 500, { error: 'Failed to read or parse data' });
    }
    return;
  }

  // POST /api/data — validate and write JSON body to session.json
  if (method === 'POST' && url === '/api/data') {
    try {
      const body   = await readBody(req);
      const parsed = JSON.parse(body);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        sendJSON(res, 400, { error: 'Body must be a JSON object' });
        return;
      }
      await fs.promises.writeFile(DATA_FILE, body, 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      if (e.code === 413) {
        sendJSON(res, 413, { error: 'Request body too large' });
      } else {
        sendJSON(res, 400, { error: 'Invalid JSON body' });
      }
    }
    return;
  }

  // DELETE /api/data — reset session.json to {}
  if (method === 'DELETE' && url === '/api/data') {
    try {
      await fs.promises.writeFile(DATA_FILE, '{}', 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      sendJSON(res, 500, { error: 'Failed to reset data' });
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

