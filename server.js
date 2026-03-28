#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3131;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/refresh') {
    try {
      execSync(`node ${path.join(DIR, 'generate-projects.js')}`, { cwd: DIR });
      res.writeHead(200);
      res.end('ok');
    } catch (e) {
      res.writeHead(500);
      res.end(e.message);
    }
    return;
  }

  const file = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(DIR, file);

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

server.listen(PORT, () => {
  console.log(`Projects server running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
