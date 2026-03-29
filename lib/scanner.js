const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { detectTechStack, getTechIcon, getTechColor } = require('./detector');

function extractDescription(pkg, composer, dirPath, readme) {
  // 1. package.json (Node/JS)
  if (pkg && pkg.description) return pkg.description;
  
  // 2. composer.json (PHP)
  if (composer && composer.description) return composer.description;
  
  // 3. Cargo.toml (Rust)
  const cargoPath = path.join(dirPath, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf8');
      const match = content.match(/^description\s*=\s*"(.*?)"/m);
      if (match) return match[1];
    } catch { /* ignore */ }
  }

  // 4. pyproject.toml (Python)
  const pyPath = path.join(dirPath, 'pyproject.toml');
  if (fs.existsSync(pyPath)) {
    try {
      const content = fs.readFileSync(pyPath, 'utf8');
      const match = content.match(/^description\s*=\s*"(.*?)"/m);
      if (match) return match[1];
    } catch { /* ignore */ }
  }

  // 5. README.md fallback
  if (readme) {
    // Strip # Header and find first real text line
    const lines = readme.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.length > 5) return firstLine; // Avoid tiny snippets
    }
  }

  return '';
}

function getGitInfo(dirPath) {
    const gitDir = path.join(dirPath, '.git');
    if (!fs.existsSync(gitDir)) return null;

    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const status = execSync('git status --short', { cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const lastCommit = execSync('git log -1 --format=%s', { cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        
        return {
            branch,
            isDirty: status.length > 0,
            lastCommit: lastCommit.slice(0, 50) + (lastCommit.length > 50 ? '...' : '')
        };
    } catch (e) {
        return null;
    }
}

function getLastModified(dirPath) {
  let newest = 0;
  try {
    const s = fs.statSync(dirPath);
    newest = s.mtimeMs;
    // Check top level files only for speed
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      try {
        const stat = fs.statSync(path.join(dirPath, entry.name));
        if (stat.mtimeMs > newest) newest = stat.mtimeMs;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return newest;
}

function scanProjects(devDir) {
  const projects = [];

  try {
    const entries = fs.readdirSync(devDir, { withFileTypes: true });

    for (const entry of entries) {
      const dirPath = path.join(devDir, entry.name);

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

      const readmePath = path.join(dirPath, 'README.md');
      let readme = '';
      try {
        if (fs.existsSync(readmePath)) {
          readme = fs.readFileSync(readmePath, 'utf8').slice(0, 2000);
        }
      } catch { /* ignore */ }

      const tech = detectTechStack(pkg, composer, dirPath);
      const description = extractDescription(pkg, composer, dirPath, readme);
      const git = getGitInfo(dirPath);

      projects.push({
        name: entry.name,
        tech,
        icon: getTechIcon(tech),
        color: getTechColor(tech),
        description,
        readme,
        path: `file://${path.join(devDir, entry.name)}`,
        lastModified: getLastModified(dirPath),
        git,
        indicators: {
            isDocker: fs.existsSync(path.join(dirPath, 'Dockerfile')) || fs.existsSync(path.join(dirPath, 'docker-compose.yml')),
            isTS: fs.existsSync(path.join(dirPath, 'tsconfig.json')),
            hasReadme: readme.length > 0
        }
      });
    }
  } catch (e) {
    console.error('Error scanning projects:', e.message);
  }

  projects.sort((a, b) => b.lastModified - a.lastModified);

  return projects;
}

module.exports = { scanProjects };
