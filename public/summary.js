let projects = [];

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

    html += `
      <div class="tech-section">
        <div class="header">
          <span style="color: ${color}">${icon}</span>
          <h2>${tech}</h2>
          <span class="count">${count} projects</span>
        </div>
        <div class="tech-list">
    `;

    for (const project of techProjects) {
        // Find icon/color from project if it happened to be different (it won't normally be)
      html += `
          <a href="${project.path}" class="tech-item" style="border-left: 3px solid ${project.color || color}">
            <span class="icon">${project.icon || icon}</span>
            <span class="name">${project.name}</span>
            <span class="count">View</span>
          </a>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  breakdownContainer.innerHTML = html;
}

init();
