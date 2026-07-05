#!/usr/bin/env node
/**
 * Minimal static server for e2e tests. Serves public/ assets and fixture JSON
 * without requiring config.json, a real DEV_DIR scan, or port 3131.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const PORT = Number(process.env.PVIEW_TEST_PORT || 4173);
const HOST = process.env.PVIEW_TEST_HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/projects.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(readFixture('projects.json'));
    return;
  }

  if (url.pathname === '/activity.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(readFixture('activity.json'));
    return;
  }

  if (url.pathname === '/settings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(readFixture('config.json'));
    return;
  }

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(PUBLIC_DIR, file);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`E2E test server listening on http://${HOST}:${PORT}\n`);
});
