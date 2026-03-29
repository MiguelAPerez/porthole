const fs = require('fs');
const path = require('path');
const os = require('os');
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

function getAntigravityUsage() {
  const usageMap = {};
  const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  
  if (!fs.existsSync(brainDir)) return usageMap;

  try {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const brainPath = path.join(brainDir, entry.name);
      const filesToTry = ['task.md.resolved.0', 'task.md', 'implementation_plan.md.resolved', 'implementation_plan.md'];
      const foundProjects = new Set();
      
      for (const fileName of filesToTry) {
        const filePath = path.join(brainPath, fileName);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const matches = content.matchAll(/file:\/\/\/Users\/miguelperez\/development\/([^/\s)\]'"]+)/g);
            for (const match of matches) {
              foundProjects.add(match[1]);
            }
          } catch (e) { /* ignore */ }
        }
      }

      for (const projectName of foundProjects) {
        usageMap[projectName] = (usageMap[projectName] || 0) + 1;
      }
    }
  } catch (e) {
    console.error('Error scanning Antigravity brain:', e.message);
  }
  return usageMap;
}

function getClaudeCLIUsage(projectNames) {
  const projectMap = {};
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');

  // Initialize all projects with 0
  for (const name of projectNames) {
    projectMap[name] = { sessions: 0, inputTokens: 0, outputTokens: 0, cacheHits: 0 };
  }

  if (!fs.existsSync(claudeDir)) return projectMap;

  // Sort project names by length (longest first) for better prefix matching
  const sortedNames = [...projectNames].sort((a, b) => b.length - a.length);

  try {
    const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true });
    for (const entry of projectDirs) {
      if (!entry.isDirectory()) continue;
      
      // Match pattern -Users-miguelperez-development-
      const prefix = '-Users-miguelperez-development-';
      if (!entry.name.startsWith(prefix)) continue;

      const fullFolderSuffix = entry.name.substring(prefix.length);
      
      // Find the best matching project name
      // We look for a project name that is a prefix of the Claude folder suffix
      let matchedProject = null;
      for (const name of sortedNames) {
        // Match either exact name or name followed by a hyphen (sub-folder/worktree)
        if (fullFolderSuffix === name || fullFolderSuffix.startsWith(name + '-')) {
          matchedProject = name;
          break;
        }
      }

      if (!matchedProject) continue;

      const projectPath = path.join(claudeDir, entry.name);
      
      try {
        const sessionFiles = fs.readdirSync(projectPath);
        for (const file of sessionFiles) {
          if (file.endsWith('.jsonl')) {
            projectMap[matchedProject].sessions++;
            try {
              const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
              const lines = content.split('\n');
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const obj = JSON.parse(line);
                  if (obj.type === 'assistant' && obj.message?.usage) {
                    const usage = obj.message.usage;
                    projectMap[matchedProject].inputTokens += usage.input_tokens || 0;
                    projectMap[matchedProject].outputTokens += usage.output_tokens || 0;
                    projectMap[matchedProject].cacheHits += usage.cache_read_input_tokens || 0;
                  }
                } catch (e) { /* ignore malformed line */ }
              }
            } catch (e) { /* ignore file read error */ }
          }
        }
      } catch (e) { /* ignore project dir read error */ }
    }
  } catch (e) {
    console.error('Error scanning Claude CLI projects:', e.message);
  }
  return projectMap;
}

function scanProjects(devDir) {
  const projects = [];
  const entries = fs.readdirSync(devDir, { withFileTypes: true });
  const projectNames = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.git')
    .map(e => e.name);

  const antigravityUsageMap = getAntigravityUsage();
  const claudeCLIUsageMap = getClaudeCLIUsage(projectNames);

  try {
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
      
      const agUsage = antigravityUsageMap[entry.name] || 0;
      const cUsage = claudeCLIUsageMap[entry.name] || { sessions: 0, inputTokens: 0, outputTokens: 0, cacheHits: 0 };

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
        antigravityUsage: agUsage,
        claudeSessions: cUsage.sessions,
        claudeInputTokens: cUsage.inputTokens,
        claudeOutputTokens: cUsage.outputTokens,
        claudeCacheHits: cUsage.cacheHits,
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
