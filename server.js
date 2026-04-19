#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const net = require('net');

const PORT = 3131;

// Check if port is already in use
function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => {
        resolve(false); // Port is free
      });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        reject(err);
      }
    });
  });
}
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // minimum 5 min between refreshes
let lastRefresh = 0;

const DIR = __dirname;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_PATH = path.join(__dirname, 'config.json');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url.startsWith('/search') && req.method === 'GET') {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const q = params.get('q') || '';
    const mode = params.get('mode') || 'natural';
    if (!q) { res.writeHead(400); res.end('q required'); return; }

    let config = {};
    try { if (fs.existsSync(CONFIG_PATH)) config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {}
    const { LOCUS_URL, LOCUS_SPACE, LOCUS_API_KEY } = config;
    if (!LOCUS_URL || !LOCUS_SPACE) { res.writeHead(503); res.end('Locus not configured'); return; }

    const locusMode = mode === 'regex' ? 'regex' : 'semantic';
    const locusQuery = `${LOCUS_URL}/collections/${LOCUS_SPACE}/search?q=${encodeURIComponent(q)}&k=200&mode=${locusMode}`;
    const locusHeaders = LOCUS_API_KEY ? { Authorization: `Bearer ${LOCUS_API_KEY}` } : {};

    try {
      const locusRes = await fetch(locusQuery, { headers: locusHeaders });
      if (!locusRes.ok) { res.writeHead(locusRes.status); res.end('Locus error'); return; }
      const data = await locusRes.json();

      const projectBest = {};
      const projectFiles = {}; // projectName → Map<filePath, excerpt[]>

      for (const r of data.results) {
        const src = r.metadata?.source;
        if (!src) continue;
        const slash = src.indexOf('/');
        const projectName = slash >= 0 ? src.slice(0, slash) : src;
        const filePath = slash >= 0 ? src.slice(slash + 1) : src;

        if (!projectBest[projectName] || r.score > projectBest[projectName]) projectBest[projectName] = r.score;

        if (!projectFiles[projectName]) projectFiles[projectName] = new Map();
        const fileMap = projectFiles[projectName];
        if (!fileMap.has(filePath)) fileMap.set(filePath, []);
        const excerpts = fileMap.get(filePath);
        if (excerpts.length < 3) {
          let excerpt;
          if (locusMode === 'regex') {
            let re; try { re = new RegExp(q, 'i'); } catch {}
            const m = re && re.exec(r.text);
            if (m) {
              const s = Math.max(0, m.index - 80);
              const e = Math.min(r.text.length, m.index + m[0].length + 80);
              excerpt = (s > 0 ? '…' : '') + r.text.slice(s, e) + (e < r.text.length ? '…' : '');
            } else {
              excerpt = r.text.trim().slice(0, 160);
            }
          } else {
            excerpt = r.text.trim().slice(0, 160);
          }
          excerpts.push(excerpt);
        }
      }

      const ranked = Object.entries(projectBest)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => ({
          name,
          files: Array.from(projectFiles[name].entries())
            .slice(0, 10)
            .map(([file, excerpts]) => ({ file, excerpts }))
        }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results: ranked }));
    } catch {
      res.writeHead(503); res.end('Locus unavailable');
    }
    return;
  }

  if (req.url === '/refresh') {
    const now = Date.now();
    if (now - lastRefresh < REFRESH_COOLDOWN_MS) {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    lastRefresh = now;
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

  if (req.url === '/open' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { path: projectPath, action } = JSON.parse(body);
        const rawPath = projectPath.replace('file://', '');
        
        if (action === 'finder') {
          execSync(`open "${rawPath}"`);
        } else if (action === 'vscode') {
          execSync(`code "${rawPath}"`);
        } else {
          res.writeHead(400);
          res.end('Unsupported action');
          return;
        }
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
    });
    return;
  }

  // Serve JSON data files from root
  if ((req.url === '/projects.json' || req.url === '/activity.json') && req.method === 'GET') {
      const dataPath = path.join(DIR, req.url);
      try {
          if (fs.existsSync(dataPath)) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(fs.readFileSync(dataPath));
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

// Check if port is in use before starting
isPortInUse(PORT).then((isInUse) => {
  if (isInUse) {
    const url = `http://localhost:${PORT}`;
    console.log(`Server is already running at ${url}`);
    try {
      execSync(`open ${url}`);
    } catch (e) {
      console.log(`Please navigate to ${url} manually.`);
    }
    process.exit(0);
  }

  server.listen(PORT, () => {
    console.log(`Projects server running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop.');
    try {
      execSync(`open http://localhost:${PORT}`);
    } catch (e) {
      console.log('Could not open browser automatically, please navigate to the URL manually.');
    }
  });
});
