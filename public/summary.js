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
    document.getElementById('loading').innerHTML = '❌ Failed to load dashboard. Ensure the server is running.';
  }
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "just now";
}

function renderCharts(projects) {
    const canvasTech = document.getElementById('techChart');
    const canvasActivity = document.getElementById('activityChart');
    
    if (!canvasTech || !canvasActivity) return;

    const ctxTech = canvasTech.getContext('2d');
    const ctxActivity = canvasActivity.getContext('2d');

    // 1. Tech Distribution Data
    const techCounts = {};
    projects.forEach(p => techCounts[p.tech] = (techCounts[p.tech] || 0) + 1);
    const sortedTechs = Object.entries(techCounts).sort((a,b) => b[1] - a[1]).slice(0, 7);
    
    const techColors = [
        '#58a6ff', '#3fb950', '#d29922', '#f85149', 
        '#ab7df8', '#ff7b72', '#79c0ff', '#56d364'
    ];
    
    if (window.myTechChart instanceof Chart) {
        window.myTechChart.destroy();
    }
    
    window.myTechChart = new Chart(ctxTech, {
        type: 'doughnut',
        data: {
            labels: sortedTechs.map(t => t[0]),
            datasets: [{
                data: sortedTechs.map(t => t[1]),
                backgroundColor: sortedTechs.map((t, idx) => techColors[idx % techColors.length]),
                borderWidth: 2,
                borderColor: '#0d1117',
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: { 
                    position: 'right', 
                    labels: { 
                        color: '#8b949e', 
                        font: { size: 10 },
                        padding: 20,
                        usePointStyle: true
                    } 
                },
            },
            cutout: '70%',
            layout: {
                padding: { bottom: 10 }
            }
        }
    });

    // 2. Activity Pulse (Last 14 days)
    const days = 14;
    const now = new Date();
    const activityData = Array(days).fill(0);
    const labels = [];
    
    for(let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        
        const startOfDay = new Date(d).setHours(0,0,0,0);
        const endOfDay = new Date(d).setHours(23,59,59,999);
        
        activityData[days - 1 - i] = projects.filter(p => p.lastModified >= startOfDay && p.lastModified <= endOfDay).length;
    }

    if (window.myActivityChart instanceof Chart) {
        window.myActivityChart.destroy();
    }
    
    window.myActivityChart = new Chart(ctxActivity, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Updates',
                data: activityData,
                backgroundColor: 'rgba(88, 166, 255, 0.4)',
                borderColor: '#58a6ff',
                borderWidth: 1.5,
                borderRadius: 4,
                barPercentage: 0.9,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#8b949e', font: { size: 10 }, stepSize: 1 } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { 
                        color: '#8b949e', 
                        font: { size: 9 },
                        maxRotation: 45,
                        minRotation: 45
                    } 
                }
            },
            plugins: { legend: { display: false } },
            layout: {
                padding: { bottom: 10 }
            }
        }
    });
}

function renderSummary() {
  const loadingEl = document.getElementById('loading');
  const dashboardContent = document.getElementById('dashboardContent');
  
  loadingEl.classList.add('hidden');
  dashboardContent.classList.remove('hidden');

  // Metrics
  const totalCount = projects.length;
  const techCounts = {};
  let recentPulseCount = 0;
  let cleanRepos = 0;
  let gitRepos = 0;
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  projects.forEach(p => {
    techCounts[p.tech] = (techCounts[p.tech] || 0) + 1;
    if (p.lastModified > sevenDaysAgo) recentPulseCount++;
    if (p.git) {
        gitRepos++;
        if (!p.git.isDirty) cleanRepos++;
    }
  });

  const gitHealth = gitRepos > 0 ? Math.round((cleanRepos / gitRepos) * 100) : 100;

  document.getElementById('totalProjects').textContent = totalCount;
  document.getElementById('activeStacks').textContent = Object.keys(techCounts).length;
  document.getElementById('recentPulse').textContent = recentPulseCount;
  document.getElementById('gitHealth').textContent = `${gitHealth}%`;

  // Charts
  renderCharts(projects);

  // Recent Activity
  const recentProjects = [...projects].sort((a,b) => b.lastModified - a.lastModified).slice(0, 5);
  document.getElementById('recentActivity').innerHTML = recentProjects.map(p => `
    <a href="index.html?project=${encodeURIComponent(p.name)}" class="activity-item">
      <div class="project-icon" style="color: ${p.color}">${p.icon}</div>
      <div class="details">
        <span class="name">${p.name}</span>
        <span class="time">${timeAgo(new Date(p.lastModified))} • ${p.tech}</span>
      </div>
    </a>
  `).join('');

  // System Pulse Stats
  const dockerCount = projects.filter(p => p.indicators?.isDocker).length;
  const tsCount = projects.filter(p => p.indicators?.isTS).length;
  const readmeCount = projects.filter(p => p.indicators?.hasReadme).length;

  document.getElementById('systemPulseContent').innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="pulse-item">
            <div class="pulse-label">
                <span class="pulse-icon">🐳</span>
                <span>Dockerized</span>
            </div>
            <span class="pulse-value">${dockerCount}</span>
        </div>
        <div class="pulse-item">
            <div class="pulse-label">
                <span class="pulse-icon">🟦</span>
                <span>TypeScript</span>
            </div>
            <span class="pulse-value">${tsCount}</span>
        </div>
        <div class="pulse-item">
            <div class="pulse-label">
                <span class="pulse-icon">📝</span>
                <span>Docs Coverage</span>
            </div>
            <span class="pulse-value">${Math.round((readmeCount/totalCount)*100)}%</span>
        </div>
        <div style="margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
            <p style="font-size: 0.75rem; color: var(--muted); text-align: center; opacity: 0.6;">
                Analyzing ${totalCount} local projects
            </p>
        </div>
    </div>
  `;

  // Project Explorer
  const sortedTechs = Object.keys(techCounts).sort((a,b) => techCounts[b] - techCounts[a]);
  let explorerHtml = '';
  for (const tech of sortedTechs) {
    const techProjects = projects.filter(p => p.tech === tech);
    const p0 = techProjects[0];
    
    explorerHtml += `
      <div class="tech-group">
        <div class="tech-group-header">
          <span style="color: ${p0.color}">${p0.icon}</span>
          <h3>${tech}</h3>
          <span style="margin-left: auto; color: var(--muted); font-size: 0.8rem;">${techProjects.length} items</span>
        </div>
        <div class="tech-projects-grid">
    `;

    for (const p of techProjects) {
      const escapedPath = p.path.replace(/'/g, "\\'");
      explorerHtml += `
          <div class="project-card" style="border-top: 3px solid ${p.color}">
            <div class="top-row">
                <span style="font-size: 1.2rem;">${p.icon}</span>
                <span class="name" title="${p.name}">${p.name}</span>
            </div>
            
            ${p.git ? `
                <div class="git-meta">
                    <span class="branch">
                        <span class="dot ${p.git.isDirty ? 'dirty' : 'clean'}"></span>
                        ${sanitize(p.git.branch)}
                    </span>
                    <span class="commit" title="${sanitize(p.git.lastCommit)}">
                        ${sanitize(p.git.lastCommit || 'no history')}
                    </span>
                </div>
            ` : ''}

            <div class="badge-row">
                ${p.indicators?.isDocker ? '<span class="badge docker">Docker</span>' : ''}
                ${p.indicators?.isTS ? '<span class="badge ts">TS</span>' : ''}
                <span class="badge">${timeAgo(new Date(p.lastModified))}</span>
            </div>

            <div class="project-actions">
                <button class="action-btn-small" onclick="openProjectPath(event, '${escapedPath}', 'finder')">📂 Finder</button>
                <button class="action-btn-small" onclick="openProjectPath(event, '${escapedPath}', 'vscode')">💻 Code</button>
                <a href="index.html?project=${encodeURIComponent(p.name)}" class="action-btn-small" style="text-decoration: none;">🔍 View</a>
            </div>
          </div>
      `;
    }
    explorerHtml += `</div></div>`;
  }
  document.getElementById('explorerContainer').innerHTML = explorerHtml;
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
        const oldContent = btn.innerHTML;
        btn.textContent = '✓';
        setTimeout(() => { btn.innerHTML = oldContent; }, 1000);
    }
  } catch (err) {
    console.error('Failed to open project:', err);
  }
}

init();
