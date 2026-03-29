'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE= path.join(DATA_DIR, 'session.json');
const HTML_FILE= path.join(__dirname, 'whitetip-sharks-v5.html');

// Ensure data/ directory and session.json exist
if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
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
    req.on('data', chunk => { data += chunk; });
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
      const html = fs.readFileSync(HTML_FILE, 'utf8');
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
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(raw);
    } catch (e) {
      sendJSON(res, 500, { error: 'Failed to read data' });
    }
    return;
  }

  // POST /api/data — validate and write JSON body to session.json
  if (method === 'POST' && url === '/api/data') {
    try {
      const body = await readBody(req);
      // Validate: must be valid JSON and a plain object
      const parsed = JSON.parse(body);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        sendJSON(res, 400, { error: 'Body must be a JSON object' });
        return;
      }
      fs.writeFileSync(DATA_FILE, body, 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      sendJSON(res, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  // DELETE /api/data — reset session.json to {}
  if (method === 'DELETE' && url === '/api/data') {
    try {
      fs.writeFileSync(DATA_FILE, '{}', 'utf8');
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

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
