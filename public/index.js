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

// Initial load
async function init() {
  await loadConfig();
  await loadProjects();
  setupEventListeners();
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

  function rowHTML(p) {
    return `<a class="project-row" href="${p.path}">
      <span class="icon">${p.icon}</span>
      <span class="name">${p.name}</span>
      <span class="desc">${p.description || 'No description'}</span>
      <span class="time">${relativeTime(p.lastModified)}</span>
    </a>`;
  }

  // First batch — synchronous
  const first = filtered.slice(0, BATCH);
  listEl.innerHTML = first.map(rowHTML).join('');
  offset = BATCH;

  function appendNext() {
    if (gen !== renderGen) return; // cancelled
    if (offset >= filtered.length) return;
    const chunk = filtered.slice(offset, offset + BATCH);
    listEl.insertAdjacentHTML('beforeend', chunk.map(rowHTML).join(''));
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
}

init();
