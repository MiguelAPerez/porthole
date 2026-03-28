#!/usr/bin/env node
/**
 * Generate project metadata from ~/development directory
 * Outputs a JSON file that index.html can use
 */

const fs = require('fs');
const path = require('path');

const DEV_DIR = '/Users/miguelperez/development';

function detectTechStack(pkg) {
  if (!pkg) return 'Unknown';

  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};

  // Check for frontend frameworks
  if (deps.next || devDeps['@next/swc']) return 'Next.js';
  if (deps.react || devDeps['@types/react']) return 'React';
  if (deps.vue || devDeps['@types/vue']) return 'Vue';
  if (deps.svelte || devDeps['@types/svelte']) return 'Svelte';
  if (deps.astro || devDeps['@types/astro']) return 'Astro';
  if (deps.solid || devDeps['@types/solid-js']) return 'SolidJS';
  if (deps.sveltekit) return 'SvelteKit';
  if (deps.nuxt || devDeps['@types/nuxt']) return 'Nuxt';
  if (deps.vue || devDeps['@types/vue']) return 'Vue';

  // Check for backend
  if (deps.express || deps.fastify || deps.koa) return 'Node.js API';
  if (deps.django || deps.flask) return 'Python';
  if (deps.go) return 'Go';
  if (deps.ruby) return 'Ruby';
  if (deps.php) return 'PHP';
  if (deps.dotnet) return '.NET';

  // Check for build tools
  if (deps.typescript || devDeps.typescript) return 'TypeScript';
  if (deps.bun) return 'Bun';
  if (deps.pnpm) return 'pnpm';

  return 'JavaScript/Node.js';
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
    'Ruby': '🔷',
    'PHP': '🐘',
    '.NET': '🟦',
    'TypeScript': '🔷',
    'Bun': '🔵',
    'pnpm': '📦',
    'Unknown': '📁'
  };
  return icons[tech] || '📁';
}

function getTechColor(tech) {
  const colors = {
    'Next.js': '#000000',
    'React': '#61dafb',
    'Vue': '#41b883',
    'Svelte': '#ff3e00',
    'Astro': '#222222',
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
    'Bun': '#000000',
    'pnpm': '#f7e015',
    'Unknown': '#888888'
  };
  return colors[tech] || '#888888';
}

function extractDescription(pkg, readme) {
  if (pkg && pkg.description) {
    return pkg.description;
  }

  if (readme) {
    const lines = readme.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
        return trimmed.substring(0, 100);
      }
    }
  }

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
      const readmePath = path.join(dirPath, 'README.md');

      let pkg = null;
      let readme = null;

      try {
        if (fs.existsSync(pkgPath)) {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        }
      } catch (e) {
        // Ignore JSON parse errors
      }

      try {
        if (fs.existsSync(readmePath)) {
          readme = fs.readFileSync(readmePath, 'utf8');
        }
      } catch (e) {
        // Ignore read errors
      }

      const tech = detectTechStack(pkg);
      const description = extractDescription(pkg, readme);

      projects.push({
        name: entry.name,
        tech,
        icon: getTechIcon(tech),
        color: getTechColor(tech),
        description,
        path: `/${entry.name}`
      });
    }
  } catch (e) {
    console.error('Error scanning projects:', e.message);
  }

  return projects;
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
      max-width: 400px;
      margin: 0 auto 2rem;
      position: relative;
    }

    .search input {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .search input:focus {
      border-color: var(--accent);
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
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .project-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
    <p>Browse through all your development projects</p>
  </div>

  <div class="search">
    <input type="search" id="search" placeholder="Search projects...">
  </div>

  <div class="projects" id="projects"></div>

  <script>
    const projects = ${JSON.stringify(grouped, null, 2)};

    const projectsContainer = document.getElementById('projects');
    const searchInput = document.getElementById('search');

    function renderProjects(filter = '') {
      projectsContainer.innerHTML = '';

      const filteredProjects = [];

      for (const category of Object.values(projects)) {
        const filteredCategoryProjects = category.projects.filter(p =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.tech.toLowerCase().includes(filter.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(filter.toLowerCase()))
        );

        if (filteredCategoryProjects.length > 0) {
          filteredProjects.push({
            ...category,
            projects: filteredCategoryProjects
          });
        }
      }

      if (filteredProjects.length === 0) {
        projectsContainer.innerHTML = '<div class="no-results">No projects found</div>';
        return;
      }

      for (const category of filteredProjects) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = \`
          <span class="icon">\${category.icon}</span>
          <h2>\${category.tech}</h2>
          <span class="count">\${category.projects.length} projects</span>
        \`;

        const grid = document.createElement('div');
        grid.className = 'projects-grid';

        for (const project of category.projects) {
          const card = document.createElement('a');
          card.className = 'project-card';
          card.href = project.path;
          card.innerHTML = \`
            <div class="icon">\${project.icon}</div>
            <div class="name">\${project.name}</div>
            <div class="desc">\${project.description || 'No description'}</div>
            <div class="tech">\${project.tech}</div>
          \`;

          grid.appendChild(card);
        }

        categoryDiv.appendChild(header);
        categoryDiv.appendChild(grid);
        projectsContainer.appendChild(categoryDiv);
      }
    }

    renderProjects();

    searchInput.addEventListener('input', (e) => {
      renderProjects(e.target.value);
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

console.log(`\nGenerated ${outputPath}`);
console.log(`Open it in your browser to browse your projects!`);
