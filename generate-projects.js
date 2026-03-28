#!/usr/bin/env node
/**
 * Generate project metadata from ~/development directory
 * Outputs a JSON file that index.html can use
 */

const fs = require('fs');
const path = require('path');

const DEV_DIR = '/Users/miguelperez/development';

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

      projects.push({
        name: entry.name,
        tech,
        icon: getTechIcon(tech),
        color: getTechColor(tech),
        description,
        path: `file://${path.join(DEV_DIR, entry.name)}`
      });
    }
  } catch (e) {
    console.error('Error scanning projects:', e.message);
  }

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
  const grouped = {};

  for (const project of projects) {
    const key = project.tech;
    if (!grouped[key]) {
      grouped[key] = {
        tech: key,
        icon: project.icon,
        color: project.color,
        projects: []
      };
    }
    grouped[key].projects.push(project);
  }

  const categories = Object.keys(grouped).sort();

  let html = `<!DOCTYPE html>
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

    .search {
      max-width: 440px;
      margin: 0 auto 2rem;
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .search input {
      flex: 1;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      outline: none;
    }

    .search input:focus {
      border-color: var(--accent);
    }

    .refresh-btn {
      padding: 0.75rem 0.875rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      cursor: pointer;
      line-height: 1;
      flex-shrink: 0;
    }

    .refresh-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .projects {
      max-width: 1200px;
      margin: 0 auto;
    }

    .category {
      margin-bottom: 2rem;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .category-header h2 {
      font-size: 1.25rem;
      color: var(--text);
    }

    .category-header .icon {
      font-size: 1.5rem;
    }

    .category-header .count {
      margin-left: auto;
      color: var(--muted);
      font-size: 0.875rem;
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .project-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    body:not(.scrolling) .project-card:hover {
      border-color: var(--accent);
    }

    .project-card .icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .project-card .name {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
    }

    .project-card .desc {
      color: var(--muted);
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .project-card .tech {
      font-size: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .no-results {
      text-align: center;
      padding: 3rem;
      color: var(--muted);
      grid-column: 1 / -1;
    }

    @media (max-width: 640px) {
      body {
        padding: 1rem;
      }

      .projects-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📁 Projects</h1>
    <p>Browse through all your development projects &mdash; <a href="summary.html" style="color: var(--accent); text-decoration: none;">view summary</a></p>
  </div>

  <div class="search">
    <input type="search" id="search" placeholder="Search projects...">
    <button id="refresh" class="refresh-btn" title="Regenerate projects (requires: node server.js)">&#x21BB;</button>
  </div>

  <div class="projects" id="projects"></div>

  <script>
    const projects = ${JSON.stringify(grouped, null, 2)};

    const projectsContainer = document.getElementById('projects');
    const searchInput = document.getElementById('search');

    function renderProjects(filter = '') {
      const lc = filter.toLowerCase();
      let html = '';

      for (const category of Object.values(projects)) {
        const matched = filter
          ? category.projects.filter(p =>
              p.name.toLowerCase().includes(lc) ||
              p.tech.toLowerCase().includes(lc) ||
              (p.description && p.description.toLowerCase().includes(lc))
            )
          : category.projects;

        if (matched.length === 0) continue;

        html += \`<div class="category">
          <div class="category-header">
            <span class="icon">\${category.icon}</span>
            <h2>\${category.tech}</h2>
            <span class="count">\${matched.length} projects</span>
          </div>
          <div class="projects-grid">\`;

        for (const p of matched) {
          html += \`<a class="project-card" href="\${p.path}">
            <div class="icon">\${p.icon}</div>
            <div class="name">\${p.name}</div>
            <div class="desc">\${p.description || 'No description'}</div>
            <div class="tech">\${p.tech}</div>
          </a>\`;
        }

        html += '</div></div>';
      }

      projectsContainer.innerHTML = html || '<div class="no-results">No projects found</div>';
    }

    renderProjects();

    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderProjects(e.target.value), 150);
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

  return html;
}

// Main execution
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
