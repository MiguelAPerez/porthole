let projects = [];
let renderGen = 0;
let activeTech = '';
let searchMode = 'regex';
let locusResults = null;
let locusAvailable = true;
let searchAbort = null;

const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const pillsEl = document.getElementById('pills');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const detailsModal = document.getElementById('detailsModal');
const closeDetailsBtn = document.getElementById('closeDetails');

function sanitize(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

let selectedProject = null;
async function init() {
  await loadConfig();
  await loadProjects();
  setupEventListeners();

  // Check for project in URL
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project');
  if (projectName) {
    openDetailsByName(projectName);
  }
}

async function loadProjects() {
  try {
    const res = await fetch('/projects.json');
    if (!res.ok) throw new Error('Data not found');
    projects = await res.json();
    renderPills();
    renderProjects();
  } catch (err) {
    console.error('Failed to load projects:', err);
    listEl.innerHTML = '<div class="no-results">Failed to load projects. Ensure the server is running and you have run generate-projects.js.</div>';
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/settings');
    if (res.ok) {
      const config = await res.json();
      if (document.getElementById('devDir')) document.getElementById('devDir').value = config.DEV_DIR || '';
      document.getElementById('locusUrl').value = config.LOCUS_URL || '';
      document.getElementById('locusApiKey').value = config.LOCUS_API_KEY || '';
      document.getElementById('locusSpace').value = config.LOCUS_SPACE || '';
      document.getElementById('maxFileKb').value = config.MAX_FILE_KB || 50;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

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

function sanitizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
}

function getFiltered() {
  const q = searchEl.value;

  if (q && locusResults !== null) {
    const rankMap = new Map(locusResults.map((r, i) => [r.name, i]));
    return projects
      .filter(p => (!activeTech || p.tech === activeTech) && rankMap.has(sanitizeName(p.name)))
      .sort((a, b) => rankMap.get(sanitizeName(a.name)) - rankMap.get(sanitizeName(b.name)));
  }

  if (searchMode === 'regex' && q) {
    let re;
    try {
      re = new RegExp(q, 'i');
      searchEl.classList.remove('regex-error');
    } catch {
      searchEl.classList.add('regex-error');
      return [];
    }
    return projects.filter(p =>
      (!activeTech || p.tech === activeTech) &&
      (re.test(p.name) || re.test(p.tech) || (p.description && re.test(p.description)))
    );
  }

  const lq = q.toLowerCase();
  return projects.filter(p =>
    (!activeTech || p.tech === activeTech) &&
    (!lq || p.name.toLowerCase().includes(lq) ||
      p.tech.toLowerCase().includes(lq) ||
      (p.description && p.description.toLowerCase().includes(lq)))
  );
}

async function triggerSearch() {
  const q = searchEl.value;
  searchEl.classList.remove('regex-error');
  if (searchAbort) searchAbort.abort();
  locusResults = null;

  if (!q) { renderProjects(); return; }

  searchAbort = new AbortController();
  try {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}&mode=${searchMode}`, { signal: searchAbort.signal });
    if (res.ok) {
      const raw = (await res.json()).results || [];
      // normalize: server may return strings (old format) or { name, snippets } objects
      locusResults = raw.length
        ? raw.map(r => typeof r === 'string' ? { name: r, files: [] } : r)
        : null; // null → fall through to text/regex fallback
      locusAvailable = true;
    } else if (res.status === 400) {
      searchEl.classList.add('regex-error');
      locusResults = null;
    } else {
      locusAvailable = false;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    locusAvailable = false;
  }

  updateLocusIndicator();
  renderProjects();
}

function updateLocusIndicator() {
  const el = document.getElementById('locusStatus');
  if (el) el.style.display = (!locusAvailable && searchMode === 'natural') ? 'inline' : 'none';
}

function renderPills() {
  const techs = [];
  for (const p of projects) {
    if (!techs.includes(p.tech)) techs.push(p.tech);
  }
  
  // Re-build all pills except the static "All" button
  const allBtnHTML = `<button class="pill ${!activeTech ? 'active' : ''}" data-tech="">All</button>`;
  
  const pillsHTML = techs.map(t => {
      // Very simple find icon from array, technically the generator could pass tech uniqueness.
      // Easiest is to grab icon from first project matching tech
      const p = projects.find(proj => proj.tech === t);
      const icon = p ? p.icon : '📁';
      const isActive = activeTech === t ? 'active' : '';
      return `<button class="pill ${isActive}" data-tech="${t}">${icon} ${t}</button>`;
  }).join('');

  pillsEl.innerHTML = allBtnHTML + pillsHTML;
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

  function rowHTML(p, index) {
    const rawPath = p.path.replace('file://', '').replace(/'/g, "\\'");
    const escapedPath = p.path.replace(/'/g, "\\'");
    const escapedName = p.name.replace(/'/g, "\\'");
    const name = sanitize(p.name);
    const desc = p.description ? marked.parseInline(sanitize(p.description)) : 'No description';
    const searching = !!searchEl.value;

    return `
    <div class="project-row-container">
      <div class="project-row-main">
        <a class="project-row" href="#" onclick="event.preventDefault(); openDetails(${index})">
          <span class="icon">${p.icon}</span>
          <span class="name">${name}</span>
          <span class="desc">${desc}</span>
          <span class="time">${relativeTime(p.lastModified)}</span>
        </a>
        <div class="row-actions">
          <button class="action-btn" title="Open in Finder" onclick="openProjectPath(event, '${escapedPath}', 'finder')">📂</button>
          <button class="action-btn" title="Open in VS Code" onclick="openProjectPath(event, '${escapedPath}', 'vscode')">💻</button>
          <button class="copy-btn" title="Copy directory path" onclick="copyToClipboard(event, '${rawPath}')">📋</button>
          ${searching ? `<button class="expand-btn" title="Show file matches" onclick="toggleFileMatches(event, '${escapedName}', '${escapedPath}', ${index})">▶</button>` : ''}
        </div>
      </div>
      <div class="match-list" id="matches-${index}" style="display:none"></div>
    </div>`;
  }

  // First batch — synchronous
  const first = filtered.slice(0, BATCH);
  listEl.innerHTML = first.map((p, i) => rowHTML(p, i)).join('');
  offset = BATCH;

  function appendNext() {
    if (gen !== renderGen) return; // cancelled
    if (offset >= filtered.length) return;
    const chunk = filtered.slice(offset, offset + BATCH);
    listEl.insertAdjacentHTML('beforeend', chunk.map((p, i) => rowHTML(p, offset + i)).join(''));
    offset += BATCH;
    requestAnimationFrame(appendNext);
  }

  if (offset < filtered.length) requestAnimationFrame(appendNext);
}

function setupEventListeners() {
  let debounce;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(triggerSearch, 300);
  });

  document.getElementById('searchModeBtn').addEventListener('click', () => {
    searchMode = searchMode === 'natural' ? 'regex' : 'natural';
    const modeBtn = document.getElementById('searchModeBtn');
    modeBtn.classList.toggle('active', searchMode === 'regex');
    modeBtn.title = searchMode === 'regex' ? 'Switch to language search' : 'Switch to regex search';
    searchEl.placeholder = searchMode === 'regex' ? 'Regex search... (⌘K)' : 'Search projects... (⌘K)';
    searchEl.classList.remove('regex-error');
    locusResults = null;
    locusAvailable = true;
    updateLocusIndicator();
    triggerSearch();
  });

  pillsEl.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    pillsEl.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeTech = pill.dataset.tech;
    renderProjects();
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (document.activeElement === searchEl) {
        document.getElementById('searchModeBtn').click();
      } else {
        searchEl.focus();
        searchEl.select();
      }
    }
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
      const res = await fetch('/refresh?force=true');
      if (res.ok) {
          btn.textContent = '✓';
          await loadProjects(); // Dynamically reload
          setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000);
      } else { 
          btn.textContent = '✗'; 
          setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000); 
      }
    } catch {
      btn.textContent = '✗';
      setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000);
    }
  });

  // Settings Modal logic
  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('active');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    saveSettingsBtn.textContent = 'Saving...';
    saveSettingsBtn.disabled = true;

    const payload = {
      DEV_DIR: document.getElementById('devDir').value,
      LOCUS_URL: document.getElementById('locusUrl').value,
      LOCUS_API_KEY: document.getElementById('locusApiKey').value,
      LOCUS_SPACE: document.getElementById('locusSpace').value,
      MAX_FILE_KB: parseInt(document.getElementById('maxFileKb').value, 10) || 50
    };

    try {
      const res = await fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        settingsModal.classList.remove('active');
      } else {
        alert('Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving settings.');
    } finally {
      saveSettingsBtn.textContent = 'Save';
      saveSettingsBtn.disabled = false;
    }
  });

  // Details Modal logic
  closeDetailsBtn.addEventListener('click', () => {
    detailsModal.classList.remove('active');
  });

  document.getElementById('openFinder').addEventListener('click', () => openProject('finder'));
  document.getElementById('openCode').addEventListener('click', () => openProject('vscode'));
}

window.openDetails = function(index) {
  const filtered = getFiltered();
  const p = filtered[index];
  if (!p) return;

  selectedProject = p;
  document.getElementById('detailIcon').textContent = p.icon;
  document.getElementById('detailName').textContent = p.name;
  document.getElementById('detailTech').textContent = p.tech;
  document.getElementById('detailDesc').innerHTML = p.description ? marked.parseInline(sanitize(p.description)) : 'No description provided.';
  document.getElementById('detailReadme').innerHTML = p.readme ? marked.parse(sanitize(p.readme)) : 'No README.md found.';
  
  detailsModal.classList.add('active');
}

window.openDetailsByName = function(name) {
  const p = projects.find(proj => proj.name === name);
  if (!p) return;

  selectedProject = p;
  document.getElementById('detailIcon').textContent = p.icon;
  document.getElementById('detailName').textContent = p.name;
  document.getElementById('detailTech').textContent = p.tech;
  document.getElementById('detailDesc').innerHTML = p.description ? marked.parseInline(sanitize(p.description)) : 'No description provided.';
  document.getElementById('detailReadme').innerHTML = p.readme ? marked.parse(sanitize(p.readme)) : 'No README.md found.';
  
  detailsModal.classList.add('active');
}

window.openProjectPath = async function(event, path, action) {
  if (event) event.stopPropagation();
  try {
    const res = await fetch('/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, action })
    });
    if (res.ok && event) {
        const btn = event.currentTarget ?? event.target;
        const oldContent = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = oldContent; }, 1000);
    }
  } catch (err) {
    console.error('Failed to open project:', err);
  }
}

async function openProject(action) {
  if (!selectedProject) return;
  await openProjectPath(null, selectedProject.path, action);
}

window.copyToClipboard = async function(event, text) {
  const btn = event.currentTarget ?? event.target;
  try {
    await navigator.clipboard.writeText(text);
    const oldIcon = btn.textContent;
    btn.textContent = '✅';
    btn.classList.add('success');
    setTimeout(() => {
      btn.textContent = oldIcon;
      btn.classList.remove('success');
    }, 1000);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
}

function highlight(raw, pattern) {
  let re;
  try { re = new RegExp(pattern, 'gi'); } catch { return sanitize(raw); }
  const out = [];
  let last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    out.push(sanitize(raw.slice(last, m.index)));
    out.push(`<mark>${sanitize(m[0])}</mark>`);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  out.push(sanitize(raw.slice(last)));
  return out.join('');
}

function renderFileGroups(files, pattern) {
  return files.map(({ file, excerpts }) => {
    const rows = excerpts.map(excerpt => {
      const lines = excerpt.lines.map((line, i) => {
        const lineNum = excerpt.lineNum + i;
        const isMatch = i === excerpt.matchLineOffset;
        const content = isMatch ? highlight(line, pattern) : sanitize(line);
        return `<div class="match-line${isMatch ? ' match-line-target' : ''}"><span class="match-line-num">${lineNum}</span><span class="match-line-text">${content}</span></div>`;
      }).join('');
      return `<div class="match-excerpt">${lines}</div>`;
    }).join('');
    return `<div class="match-file-group">
      <div class="match-file-header">${sanitize(file)}</div>
      ${rows}
    </div>`;
  }).join('');
}

window.toggleFileMatches = function(event, projectName, projectPath, index) {
  event.stopPropagation();
  const matchList = document.getElementById(`matches-${index}`);
  const btn = event.currentTarget;

  if (matchList.style.display !== 'none') {
    matchList.style.display = 'none';
    btn.textContent = '▶';
    return;
  }

  matchList.style.display = 'block';
  btn.textContent = '▼';

  if (matchList.dataset.loaded) return;
  matchList.dataset.loaded = '1';

  const entry = locusResults && locusResults.find(r => r.name === sanitizeName(projectName));
  const proj = projects.find(p => p.name === projectName);

  const metaFields = proj ? [
    `name: ${proj.name}`,
    proj.tech && `tech: ${proj.tech}`,
    proj.description && `description: ${proj.description.slice(0, 100)}`,
  ].filter(Boolean).join('  ·  ') : '';
  const metaHTML = metaFields
    ? `<div class="match-meta"><span class="match-meta-label">metadata</span><span class="match-meta-text">{ ${sanitize(metaFields)} }</span></div>`
    : '';

  const files = entry ? entry.files : [];
  const filesHTML = files.length ? renderFileGroups(files, searchEl.value) : '';
  const inner = metaHTML + filesHTML;

  matchList.innerHTML = inner || '<div class="match-empty">No details available.</div>';
};

init();

setInterval(async () => {
  try {
    const res = await fetch('/refresh');
    if (res.ok) await loadProjects();
  } catch {}
}, 300000);
