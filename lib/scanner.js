const fs = require('fs');
const path = require('path');
const { detectTechStack, getTechIcon, getTechColor } = require('./detector');

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
        path: `file://${path.join(devDir, entry.name)}`,
        lastModified: getLastModified(dirPath)
      });
    }
  } catch (e) {
    console.error('Error scanning projects:', e.message);
  }

  projects.sort((a, b) => b.lastModified - a.lastModified);

  return projects;
}

module.exports = { scanProjects };
