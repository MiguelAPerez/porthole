const fs = require('fs');
const path = require('path');

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

module.exports = { detectTechStack, getTechIcon, getTechColor };
