const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'vendor',
  '__pycache__', '.next', 'target', 'venv', '.venv', 'env', '.env', 'coverage', '.nyc_output',
  'out', '.turbo', '.svelte-kit', 'site-packages']);
const TEXT_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.rb', '.php',
  '.java', '.c', '.cpp', '.h', '.cs', '.swift', '.kt', '.md', '.txt', '.json', '.yaml', '.yml',
  '.toml', '.sh', '.bash', '.zsh', '.css', '.scss', '.html', '.vue', '.svelte', '.sql',
  '.graphql', '.tf', '.proto', '.env', '.ini', '.cfg', '.conf']);

function computeHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function loadCache(cachePath) {
  try { return JSON.parse(fs.readFileSync(cachePath, 'utf8')); }
  catch { return {}; }
}

function saveCache(cachePath, cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function authHeaders(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function sanitizeSpaceName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
}

async function ensureSpace(locusUrl, spaceName, apiKey) {
  const res = await fetch(`${locusUrl}/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
    body: JSON.stringify({ name: spaceName })
  });
  // 201 = created, 400 = already exists — both are fine
  if (!res.ok && res.status !== 400) {
    const text = await res.text().catch(() => '');
    throw new Error(`ensureSpace '${spaceName}' failed: HTTP ${res.status} ${text}`);
  }
}

async function ensureCollection(locusUrl, collectionName, apiKey) {
  const res = await fetch(`${locusUrl}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
    body: JSON.stringify({ name: collectionName })
  });
  if (!res.ok && res.status !== 400) {
    const text = await res.text().catch(() => '');
    throw new Error(`ensureCollection '${collectionName}' failed: HTTP ${res.status} ${text}`);
  }
}

async function addSpaceToCollection(locusUrl, collectionName, spaceName, apiKey) {
  await fetch(`${locusUrl}/collections/${collectionName}/spaces/${spaceName}`, {
    method: 'POST',
    headers: authHeaders(apiKey)
  });
}

async function ingestFile(content, source, locusUrl, spaceName, apiKey) {
  const form = new FormData();
  form.append('text', content);
  form.append('source', source);
  const res = await fetch(`${locusUrl}/spaces/${spaceName}/documents`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: form
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).doc_id;
}

async function deleteDoc(docId, locusUrl, spaceName, apiKey) {
  await fetch(`${locusUrl}/spaces/${spaceName}/documents/${docId}`, {
    method: 'DELETE',
    headers: authHeaders(apiKey)
  });
}

function walkProject(projectDir) {
  const files = {}; // relPath → { hash, fullPath } — no content stored

  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full, depth + 1);
      } else if (entry.isFile() && TEXT_EXTS.has(path.extname(entry.name).toLowerCase())) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        if (content.includes('\0')) continue;
        const relPath = path.relative(projectDir, full);
        files[relPath] = { hash: computeHash(content), fullPath: full };
        // content is not retained — GC can reclaim it
      }
    }
  }

  walk(projectDir, 0);
  return files;
}

async function syncToLocus(projects, locusUrl, locusSpace, cachePath, apiKey = '') {
  const cache = loadCache(cachePath);

  await ensureCollection(locusUrl, locusSpace, apiKey);

  for (const p of projects) {
    const spaceName = sanitizeSpaceName(p.name);

    // Migrate old single-blob cache format
    if (cache[p.name] && typeof cache[p.name].hash === 'string') {
      if (cache[p.name].docId) {
        try { await deleteDoc(cache[p.name].docId, locusUrl, locusSpace, apiKey); } catch {}
      }
      delete cache[p.name];
    }

    const projectDir = p.path.replace('file://', '');
    if (!fs.existsSync(projectDir)) continue;

    try {
      await ensureSpace(locusUrl, spaceName, apiKey);
      await addSpaceToCollection(locusUrl, locusSpace, spaceName, apiKey);
    } catch (e) {
      console.error(`\n  Skipping ${p.name}: ${e.message}`);
      continue;
    }

    const fileCache = cache[p.name] || {};
    const currentFiles = walkProject(projectDir);

    // Delete removed or changed files from Locus
    for (const relPath of Object.keys(fileCache)) {
      if (!currentFiles[relPath] || currentFiles[relPath].hash !== fileCache[relPath].hash) {
        if (fileCache[relPath].docId) {
          try { await deleteDoc(fileCache[relPath].docId, locusUrl, spaceName, apiKey); } catch {}
        }
        delete fileCache[relPath];
      }
    }

    // Ingest new/changed files
    const toIngest = Object.entries(currentFiles).filter(([relPath]) => !fileCache[relPath]);
    const total = toIngest.length;
    if (total) {
      const BAR = 20;
      const errors = [];
      let done = 0;

      const printBar = () => {
        const filled = Math.round((done / total) * BAR);
        const bar = '█'.repeat(filled) + '░'.repeat(BAR - filled);
        process.stdout.write(`\r${p.name}: [${done}/${total}] ${bar}`);
      };

      printBar();
      for (const [relPath, { hash, fullPath }] of toIngest) {
        let content;
        try { content = fs.readFileSync(fullPath, 'utf8'); } catch { done++; printBar(); continue; }
        try {
          const source = `${spaceName}/${relPath}`;
          const docId = await ingestFile(content, source, locusUrl, spaceName, apiKey);
          fileCache[relPath] = { hash, docId };
        } catch (e) {
          errors.push(`  ✗ ${relPath}: ${e.message}`);
        }
        done++;
        printBar();
        content = null;
      }
      process.stdout.write('\n');
      if (errors.length) console.log(errors.join('\n'));
    }

    cache[p.name] = fileCache;
    saveCache(cachePath, cache);
  }

  console.log('\nLocus sync complete');
}

module.exports = { syncToLocus };
