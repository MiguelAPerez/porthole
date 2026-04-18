let projects = [];
let renderGen = 0;
let activeTech = '';

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
      document.getElementById('locusSpace').value = config.LOCUS_SPACE || '';
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
    const name = sanitize(p.name);
    const desc = p.description ? marked.parseInline(sanitize(p.description)) : 'No description';
    
    return `
    <div class="project-row-container">
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
      </div>
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
      const res = await fetch('/refresh');
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
      LOCUS_SPACE: document.getElementById('locusSpace').value
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

init();

setInterval(async () => {
  try {
    const res = await fetch('/refresh');
    if (res.ok) await loadProjects();
  } catch {}
}, 300000);
