let projects = [];

function sanitize(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

async function init() {
  try {
    const res = await fetch('/projects.json');
    if (!res.ok) throw new Error('Data not found');
    projects = await res.json();
    renderSummary();
  } catch (err) {
    console.error('Failed to load projects:', err);
    document.getElementById('loading').innerHTML = 'Failed to load summary. Ensure the server is running and projects.json exists.';
  }
}

function renderSummary() {
  const totalCountEl = document.getElementById('totalCount');
  const breakdownContainer = document.getElementById('breakdownContainer');
  const statsContainer = document.getElementById('statsContainer');
  const loadingEl = document.getElementById('loading');
  
  loadingEl.style.display = 'none';
  statsContainer.style.display = 'block';
  breakdownContainer.style.display = 'block';

  totalCountEl.textContent = projects.length;

  const techCounts = {};
  const techList = [];

  // Count projects by tech
  for (const project of projects) {
    const tech = project.tech;
    if (!techCounts[tech]) {
      techCounts[tech] = 0;
      techList.push(tech);
    }
    techCounts[tech]++;
  }

  let html = '';

  for (const tech of techList) {
    const count = techCounts[tech];
    const techProjects = projects.filter(p => p.tech === tech);
    const p = techProjects[0];
    const icon = p ? p.icon : '📁';
    const color = p ? p.color : '#888888';

    const sTech = sanitize(tech);
    html += `
      <div class="tech-section">
        <div class="header">
          <span style="color: ${color}">${icon}</span>
          <h2>${sTech}</h2>
          <span class="count">${count} projects</span>
        </div>
        <div class="tech-list">
    `;

    for (const project of techProjects) {
      const escapedPath = project.path.replace(/'/g, "\\'");
      const sName = sanitize(project.name);
      html += `
          <div class="tech-item-container">
            <a href="index.html?project=${encodeURIComponent(project.name)}" class="tech-item" style="border-left: 3px solid ${project.color || color}">
              <span class="icon">${project.icon || icon}</span>
              <span class="name">${sName}</span>
            </a>
            <div class="row-actions">
              <button class="action-btn" title="Open in Finder" onclick="openProjectPath(event, '${escapedPath}', 'finder')">📂</button>
              <button class="action-btn" title="Open in VS Code" onclick="openProjectPath(event, '${escapedPath}', 'vscode')">💻</button>
            </div>
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  breakdownContainer.innerHTML = html;
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

init();
