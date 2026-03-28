#!/usr/bin/env node
/**
 * Generate project metadata from ~/development directory
 * Outputs a JSON file that index.html can use
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEV_DIR = '/Users/miguelperez/development';

const LOCUS_URL = 'https://locus.miguelaperez.dev';
const LOCUS_SPACE = 'projects';
const CACHE_PATH = path.join(__dirname, '.locus-cache.json');

function detectTechStack(pkg, composer, dirPath) {
  const has = (file) => fs.existsSync(path.join(dirPath, file));
  const hasExt = (ext) => {
    try {
      return fs.readdirSync(dirPath).some(f => f.endsWith(ext));
    } catch { return false; }
  };

  // package.json deps take priority
  if (pkg) {
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};

    if (deps.next || devDeps['@next/swc']) return 'Next.js';
    if (deps.react || devDeps['@types/react']) return 'React';
    if (deps.vue || devDeps['@types/vue']) return 'Vue';
    if (deps.svelte || devDeps['@types/svelte']) return 'Svelte';
    if (deps.astro || devDeps['@types/astro']) return 'Astro';
    if (deps.solid || devDeps['@types/solid-js']) return 'SolidJS';
    if (deps.sveltekit) return 'SvelteKit';
    if (deps.nuxt || devDeps['@types/nuxt']) return 'Nuxt';
    if (deps.express || deps.fastify || deps.koa) return 'Node.js API';
    if (deps.typescript || devDeps.typescript) return 'TypeScript';
    if (deps.bun) return 'Bun';
    return 'JavaScript/Node.js';
  }

  // File-based detection for non-JS projects
  if (composer) return 'PHP';
  if (has('go.mod')) return 'Go';
  if (has('Cargo.toml')) return 'Rust';
  if (has('Gemfile')) return 'Ruby';
  if (has('requirements.txt') || has('pyproject.toml') || has('setup.py') || hasExt('.py')) return 'Python';
  if (hasExt('.tf') || has('terraform.tfstate')) return 'Terraform';
  if (has('CMakeLists.txt')) return 'C++';
  if (has('playbook.yml') || has('ansible.cfg') || has('site.yml')) return 'Ansible';
  if (has('docker-compose.yml') || has('Dockerfile')) return 'Docker';

  // Check one level deep — collect all found techs, pick highest priority
  const priority = ['PHP', 'Go', 'Rust', 'TypeScript', 'JavaScript/Node.js', 'Python', 'Ansible', 'Docker'];
  const found = new Set();
  try {
    for (const sub of fs.readdirSync(dirPath)) {
      const subPath = path.join(dirPath, sub);
      if (!fs.statSync(subPath).isDirectory()) continue;
      if (fs.existsSync(path.join(subPath, 'composer.json'))) found.add('PHP');
      if (fs.existsSync(path.join(subPath, 'package.json'))) found.add('JavaScript/Node.js');
      if (fs.existsSync(path.join(subPath, 'go.mod'))) found.add('Go');
      if (fs.existsSync(path.join(subPath, 'Cargo.toml'))) found.add('Rust');
      if (fs.existsSync(path.join(subPath, 'requirements.txt')) || fs.existsSync(path.join(subPath, 'pyproject.toml'))) found.add('Python');
      if (fs.existsSync(path.join(subPath, 'playbook.yml')) || fs.existsSync(path.join(subPath, 'ansible.cfg'))) found.add('Ansible');
      if (fs.existsSync(path.join(subPath, 'docker-compose.yml')) || fs.existsSync(path.join(subPath, 'Dockerfile'))) found.add('Docker');
    }
  } catch { /* ignore */ }
  for (const p of priority) {
    if (found.has(p)) return p;
  }

  return 'Unknown';
}

function getTechIcon(tech) {
  const icons = {
    'Next.js': '⚡',
    'React': '⚛️',
    'Vue': '🟣',
    'Svelte': '🔴',
    'Astro': '🌟',
    'SolidJS': '💎',
    'SvelteKit': '🔴',
    'Nuxt': '🟣',
    'Node.js API': '🟢',
    'Python': '🐍',
    'Go': '🐹',
    'Ruby': '💎',
    'PHP': '🐘',
    '.NET': '🟦',
    'TypeScript': '🔷',
    'Bun': '🔵',
    'Rust': '🦀',
    'Terraform': '🏗️',
    'C++': '⚙️',
    'Docker': '🐳',
    'Unknown': '📁'
  };
  return icons[tech] || '📁';
}

function getTechColor(tech) {
  const colors = {
    'Next.js': '#888888',
    'React': '#61dafb',
    'Vue': '#41b883',
    'Svelte': '#ff3e00',
    'Astro': '#a78bfa',
    'SolidJS': '#2e45f0',
    'SvelteKit': '#ff3e00',
    'Nuxt': '#41b883',
    'Node.js API': '#68a063',
    'Python': '#3776ab',
    'Go': '#00add8',
    'Ruby': '#cc342d',
    'PHP': '#777bb4',
    '.NET': '#512bd4',
    'TypeScript': '#3178c6',
    'Bun': '#fbf0df',
    'Rust': '#ce4a00',
    'Terraform': '#7b42bc',
    'C++': '#00599c',
    'Docker': '#2496ed',
    'Unknown': '#888888'
  };
  return colors[tech] || '#888888';
}

function extractDescription(pkg, composer) {
  if (pkg && pkg.description) return pkg.description;
  if (composer && composer.description) return composer.description;
  return '';
}

function getLastModified(dirPath) {
  let newest = 0;
  try {
    newest = fs.statSync(dirPath).mtimeMs;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      try {
        const s = fs.statSync(path.join(dirPath, entry.name));
        if (s.mtimeMs > newest) newest = s.mtimeMs;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return newest;
}

function scanProjects() {
  const projects = [];

  try {
    const entries = fs.readdirSync(DEV_DIR, { withFileTypes: true });

    for (const entry of entries) {
      const dirPath = path.join(DEV_DIR, entry.name);

      // Skip if not a directory
      if (!entry.isDirectory()) continue;

      // Skip hidden directories and special folders
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === '.git') continue;

      const pkgPath = path.join(dirPath, 'package.json');
      const composerPath = path.join(dirPath, 'composer.json');

      let pkg = null;
      let composer = null;

      try {
        if (fs.existsSync(pkgPath)) {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        }
      } catch (e) { /* ignore */ }

      try {
        if (fs.existsSync(composerPath)) {
          composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
        }
      } catch (e) { /* ignore */ }

      const tech = detectTechStack(pkg, composer, dirPath);
      const description = extractDescription(pkg, composer);

      let readme = '';
      const readmePath = path.join(dirPath, 'README.md');
      try {
        if (fs.existsSync(readmePath)) {
          readme = fs.readFileSync(readmePath, 'utf8').slice(0, 2000);
        }
      } catch { /* ignore */ }

      projects.push({
        name: entry.name,
        tech,
        icon: getTechIcon(tech),
        color: getTechColor(tech),
        description,
        readme,
        path: `file://${path.join(DEV_DIR, entry.name)}`,
        lastModified: getLastModified(dirPath)
      });
    }
  } catch (e) {
    console.error('Error scanning projects:', e.message);
  }

  projects.sort((a, b) => b.lastModified - a.lastModified);

  return projects;
}

function generateSummaryHTML(projects) {
  const totalProjects = projects.length;
  const techCounts = {};
  const techList = [];

  // Count projects by tech
  for (const project of projects) {
    const tech = project.tech;
    if (!techCounts[tech]) {
      techCounts[tech] = 0;
      techList.push(tech);
    }
    techCounts[tech]++;
  }

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects Summary</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --text: #c9d1d9;
      --muted: #8b949e;
      --border: #30363d;
      --accent: #58a6ff;
      --hover: #1f242c;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.5;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .header p {
      color: var(--muted);
    }

    .stats {
      max-width: 800px;
      margin: 0 auto 2rem;
    }

    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      text-align: center;
    }

    .stat-card .number {
      font-size: 3rem;
      font-weight: 700;
      color: var(--accent);
    }

    .stat-card .label {
      color: var(--muted);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .tech-breakdown {
      max-width: 800px;
      margin: 0 auto;
    }

    .tech-section {
      margin-bottom: 2rem;
    }

    .tech-section .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .tech-section h2 {
      font-size: 1.25rem;
      color: var(--text);
    }

    .tech-section .count {
      margin-left: auto;
      color: var(--muted);
      font-size: 0.875rem;
    }

    .tech-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 0.75rem;
    }

    .tech-item {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .tech-item .icon {
      font-size: 1.5rem;
    }

    .tech-item .name {
      font-weight: 600;
      flex: 1;
    }

    .tech-item .count {
      color: var(--muted);
      font-size: 0.875rem;
    }

    .nav-links {
      text-align: center;
      margin-top: 2rem;
    }

    .nav-links a {
      display: inline-block;
      margin: 0 1rem;
      color: var(--accent);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      transition: background 0.2s;
    }

    .nav-links a:hover {
      background: var(--hover);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Projects Summary</h1>
    <p>Overview of your development projects</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="number">${totalProjects}</div>
      <div class="label">Total Projects</div>
    </div>
  </div>

  <div class="tech-breakdown">
`;

  for (const tech of techList) {
    const count = techCounts[tech];
    const icon = getTechIcon(tech);
    const color = getTechColor(tech);

    html += `
    <div class="tech-section">
      <div class="header">
        <span style="color: ${color}">${icon}</span>
        <h2>${tech}</h2>
        <span class="count">${count} projects</span>
      </div>
      <div class="tech-list">
`;

    // Get projects for this tech
    const techProjects = projects.filter(p => p.tech === tech);

    for (const project of techProjects) {
      html += `
        <a href="${project.path}" class="tech-item" style="border-left: 3px solid ${color}">
          <span class="icon">${icon}</span>
          <span class="name">${project.name}</span>
          <span class="count">View</span>
        </a>
      `;
    }

    html += `
      </div>
    </div>
  `;
  }

  html += `
  </div>

  <div class="nav-links">
    <a href="index.html">📁 Browse All Projects</a>
  </div>
</body>
</html>`;

  return html;
}

function generateHTML(projects) {
  // Build unique tech list in order of first appearance (already sorted by recency)
  const techs = [];
  for (const p of projects) {
    if (!techs.includes(p.tech)) techs.push(p.tech);
  }

  const pillsHTML = techs.map(t =>
    `<button class="pill" data-tech="${t}">${getTechIcon(t)} ${t}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects View</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --text: #c9d1d9;
      --muted: #8b949e;
      --border: #30363d;
      --accent: #58a6ff;
      --hover: #1f242c;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.5;
    }

    .header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .header h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    .header p { color: var(--muted); }

    .controls {
      max-width: 760px;
      margin: 0 auto 1.5rem;
    }

    .search-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .search-row input {
      flex: 1;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      outline: none;
    }

    .search-row input:focus { border-color: var(--accent); }

    .refresh-btn {
      padding: 0.65rem 0.875rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      cursor: pointer;
      flex-shrink: 0;
      line-height: 1;
    }

    .refresh-btn:hover { border-color: var(--accent); color: var(--accent); }

    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .pill {
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .pill:hover { border-color: var(--accent); color: var(--text); }
    .pill.active { background: var(--card-bg); border-color: var(--accent); color: var(--accent); }

    .list {
      max-width: 760px;
      margin: 0 auto;
    }

    .project-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
    }

    body:not(.scrolling) .project-row:hover { background: var(--hover); }

    .project-row .icon { font-size: 1.1rem; flex-shrink: 0; width: 1.5rem; text-align: center; }

    .project-row .name {
      font-weight: 600;
      font-size: 0.95rem;
      white-space: nowrap;
      min-width: 160px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-row .desc {
      flex: 1;
      color: var(--muted);
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .project-row .time {
      color: var(--muted);
      font-size: 0.8rem;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .no-results {
      text-align: center;
      padding: 3rem;
      color: var(--muted);
    }

    @media (max-width: 640px) {
      body { padding: 1rem; }
      .project-row .desc { display: none; }
      .project-row .name { max-width: none; flex: 1; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📁 Projects</h1>
    <p>Browse through all your development projects &mdash; <a href="summary.html" style="color: var(--accent); text-decoration: none;">view summary</a></p>
  </div>

  <div class="controls">
    <div class="search-row">
      <input type="search" id="search" placeholder="Search projects...">
      <button id="refresh" class="refresh-btn" title="Regenerate projects (requires: node server.js)">&#x21BB;</button>
    </div>
    <div class="pills" id="pills">
      <button class="pill active" data-tech="">All</button>
      ${pillsHTML}
    </div>
  </div>

  <div class="list" id="list"></div>

  <script>
    const projects = ${JSON.stringify(projects)};

    function relativeTime(ms) {
      const diff = Date.now() - ms;
      const min = 60 * 1000;
      const hour = 60 * min;
      const day = 24 * hour;
      const week = 7 * day;
      const month = 30 * day;
      if (diff < min) return 'just now';
      if (diff < hour) return Math.floor(diff / min) + 'm ago';
      if (diff < day) return Math.floor(diff / hour) + 'h ago';
      if (diff < week) return Math.floor(diff / day) + 'd ago';
      if (diff < month) return Math.floor(diff / week) + 'w ago';
      return Math.floor(diff / month) + 'mo ago';
    }

    const listEl = document.getElementById('list');
    const searchEl = document.getElementById('search');
    const pillsEl = document.getElementById('pills');

    let activeTech = '';
    let renderGen = 0;

    function getFiltered() {
      const q = searchEl.value.toLowerCase();
      return projects.filter(p => {
        if (activeTech && p.tech !== activeTech) return false;
        if (!q) return true;
        return p.name.toLowerCase().includes(q) ||
               p.tech.toLowerCase().includes(q) ||
               (p.description && p.description.toLowerCase().includes(q));
      });
    }

    function renderProjects() {
      const gen = ++renderGen;
      const filtered = getFiltered();

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="no-results">No projects found</div>';
        return;
      }

      const BATCH = 30;
      let offset = 0;

      function rowHTML(p) {
        return \`<a class="project-row" href="\${p.path}">
          <span class="icon">\${p.icon}</span>
          <span class="name">\${p.name}</span>
          <span class="desc">\${p.description || 'No description'}</span>
          <span class="time">\${relativeTime(p.lastModified)}</span>
        </a>\`;
      }

      // First batch — synchronous
      const first = filtered.slice(0, BATCH);
      listEl.innerHTML = first.map(rowHTML).join('');
      offset = BATCH;

      function appendNext() {
        if (gen !== renderGen) return; // cancelled
        if (offset >= filtered.length) return;
        const chunk = filtered.slice(offset, offset + BATCH);
        listEl.insertAdjacentHTML('beforeend', chunk.map(rowHTML).join(''));
        offset += BATCH;
        requestAnimationFrame(appendNext);
      }

      if (offset < filtered.length) requestAnimationFrame(appendNext);
    }

    renderProjects();

    let debounce;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(renderProjects, 150);
    });

    pillsEl.addEventListener('click', e => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      pillsEl.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeTech = pill.dataset.tech;
      renderProjects();
    });

    let scrollTimer;
    window.addEventListener('scroll', () => {
      document.body.classList.add('scrolling');
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => document.body.classList.remove('scrolling'), 150);
    }, { passive: true });

    document.getElementById('refresh').addEventListener('click', async () => {
      const btn = document.getElementById('refresh');
      btn.textContent = '⏳';
      try {
        const res = await fetch('http://localhost:3131/refresh');
        if (res.ok) { btn.textContent = '✓'; setTimeout(() => location.reload(), 300); }
        else { btn.textContent = '✗'; setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000); }
      } catch {
        btn.textContent = '✗';
        setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000);
      }
    });
  </script>
</body>
</html>`;
}

// ── Locus sync ────────────────────────────────────────────────────────────────

function computeHash(p) {
  return crypto.createHash('md5')
    .update([p.name, p.tech, p.description, p.readme].join('|'))
    .digest('hex');
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function printProgress(done, total, label) {
  const W = 30;
  const filled = total === 0 ? W : Math.round((done / total) * W);
  const bar = '='.repeat(Math.max(0, filled - 1)) + (filled > 0 ? '>' : '') + ' '.repeat(W - filled);
  process.stdout.write(`\rLocus [${bar}] ${done}/${total} ${label.slice(0, 24).padEnd(24)}`);
}

async function ensureSpace() {
  await fetch(`${LOCUS_URL}/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: LOCUS_SPACE })
  });
}

async function ingestProject(p) {
  const text = `Project: ${p.name}\nTech: ${p.tech}\nDescription: ${p.description}\n\n${p.readme}`.trim();
  const form = new FormData();
  form.append('text', text);
  form.append('source', p.name);
  const res = await fetch(`${LOCUS_URL}/spaces/${LOCUS_SPACE}/documents`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.doc_id;
}

async function deleteDoc(docId) {
  await fetch(`${LOCUS_URL}/spaces/${LOCUS_SPACE}/documents/${docId}`, { method: 'DELETE' });
}

async function syncToLocus(projects) {
  const cache = loadCache();

  const current = {};
  for (const p of projects) current[p.name] = { project: p, hash: computeHash(p) };

  const toUpsert = projects.filter(p => !cache[p.name] || cache[p.name].hash !== current[p.name].hash);
  const toRemove = Object.keys(cache).filter(name => !current[name]);
  const total = toUpsert.length + toRemove.length;

  if (total === 0) {
    console.log('\nLocus: 0 changes, skipping sync.');
    return;
  }

  console.log(`\nSyncing ${total} change(s) to Locus...`);

  try {
    await ensureSpace();
  } catch (e) {
    console.warn(`\nLocus unreachable, skipping sync: ${e.message}`);
    return;
  }

  let done = 0;

  for (const name of toRemove) {
    printProgress(done, total, `remove ${name}`);
    try {
      await deleteDoc(cache[name].docId);
      delete cache[name];
    } catch (e) {
      process.stdout.write(`\nWarning: could not delete ${name}: ${e.message}\n`);
    }
    done++;
  }

  for (const p of toUpsert) {
    printProgress(done, total, p.name);
    try {
      if (cache[p.name]?.docId) await deleteDoc(cache[p.name].docId);
      const docId = await ingestProject(p);
      cache[p.name] = { docId, hash: current[p.name].hash };
    } catch (e) {
      process.stdout.write(`\nWarning: could not index ${p.name}: ${e.message}\n`);
    }
    done++;
  }

  printProgress(total, total, 'done');
  process.stdout.write('\n');
  saveCache(cache);
}

// Main execution
async function main() {
  const projects = scanProjects();
  console.log(`Found ${projects.length} projects:`);
  for (const p of projects) {
    console.log(`  - ${p.name} (${p.tech})`);
  }

  const html = generateHTML(projects);
  const outputPath = path.join(__dirname, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  const summaryHTML = generateSummaryHTML(projects);
  const summaryOutputPath = path.join(__dirname, 'summary.html');
  fs.writeFileSync(summaryOutputPath, summaryHTML, 'utf8');

  console.log(`\nGenerated ${outputPath}`);
  console.log(`Generated ${summaryOutputPath}`);
  console.log(`Open index.html in your browser to browse your projects!`);

  await syncToLocus(projects);
}

main().catch(console.error);
