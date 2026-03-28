#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3131;
const DIR = __dirname;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_PATH = path.join(__dirname, 'config.json');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/refresh') {
    try {
      execSync(`node ${path.join(DIR, 'generate-projects.js')}`, { cwd: DIR, stdio: 'inherit' });
      res.writeHead(200);
      res.end('ok');
    } catch (e) {
      res.writeHead(500);
      res.end(e.message);
    }
    return;
  }

  if (req.url === '/settings' && req.method === 'GET') {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fs.readFileSync(CONFIG_PATH));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (e) {
      res.writeHead(500);
      res.end(e.message);
    }
    return;
  }

  if (req.url === '/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        let config = {};
        if (fs.existsSync(CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
        config = { ...config, ...payload };
        
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
    });
    return;
  }

  // Serve projects.json from root explicitly
  if (req.url === '/projects.json' && req.method === 'GET') {
      const projectsPath = path.join(DIR, 'projects.json');
      try {
          if (fs.existsSync(projectsPath)) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(fs.readFileSync(projectsPath));
          } else {
              res.writeHead(404);
              res.end('Not found');
          }
      } catch (e) {
          res.writeHead(500);
          res.end(e.message);
      }
      return;
  }

  const file = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, file);

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

  // Auto-launch the browser
  try {
      execSync(`open http://localhost:${PORT}`);
  } catch (e) {
      console.log('Could not open browser automatically, please navigate to the URL manually.');
  }
});
