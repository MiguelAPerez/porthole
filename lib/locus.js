const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeHash(p) {
  return crypto.createHash('md5')
    .update([p.name, p.tech, p.description, p.readme].join('|'))
    .digest('hex');
}

function loadCache(cachePath) {
  try { return JSON.parse(fs.readFileSync(cachePath, 'utf8')); }
  catch { return {}; }
}

function saveCache(cachePath, cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function printProgress(done, total, label) {
  const W = 30;
  const filled = total === 0 ? W : Math.round((done / total) * W);
  const bar = '='.repeat(Math.max(0, filled - 1)) + (filled > 0 ? '>' : '') + ' '.repeat(W - filled);
  process.stdout.write(`\rLocus [${bar}] ${done}/${total} ${label.slice(0, 24).padEnd(24)}`);
}

async function ensureSpace(locusUrl, locusSpace) {
  await fetch(`${locusUrl}/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: locusSpace })
  });
}

async function ingestProject(p, locusUrl, locusSpace) {
  const text = `Project: ${p.name}\nTech: ${p.tech}\nDescription: ${p.description}\n\n${p.readme}`.trim();
  const form = new FormData();
  form.append('text', text);
  form.append('source', p.name);
  const res = await fetch(`${locusUrl}/spaces/${locusSpace}/documents`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.doc_id;
}

async function deleteDoc(docId, locusUrl, locusSpace) {
  await fetch(`${locusUrl}/spaces/${locusSpace}/documents/${docId}`, { method: 'DELETE' });
}

async function syncToLocus(projects, locusUrl, locusSpace, cachePath) {
  const cache = loadCache(cachePath);

  const current = {};
  for (const p of projects) current[p.name] = { project: p, hash: computeHash(p) };

  const toUpsert = projects.filter(p => !cache[p.name] || cache[p.name].hash !== current[p.name].hash);
  const toRemove = Object.keys(cache).filter(name => !current[name]);

  if (toUpsert.length === 0 && toRemove.length === 0) {
    console.log('Locus sync: up to date');
    return;
  }

  try {
    await ensureSpace(locusUrl, locusSpace);

    let done = 0;
    const total = toUpsert.length + toRemove.length;

    for (const name of toRemove) {
      if (cache[name].docId) {
        try { await deleteDoc(cache[name].docId, locusUrl, locusSpace); } catch { /* ignore */ }
      }
      delete cache[name];
      done++;
      printProgress(done, total, `del ${name}`);
    }

    for (const p of toUpsert) {
      const docId = await ingestProject(p, locusUrl, locusSpace);
      cache[p.name] = { hash: current[p.name].hash, docId };
      done++;
      printProgress(done, total, `put ${p.name}`);
    }

    console.log();
    saveCache(cachePath, cache);
  } catch (e) {
    console.error('\nError syncing to Locus:', e.message);
  }
}

module.exports = { syncToLocus };
