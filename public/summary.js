let projects = [];
let activityData = {};

function sanitize(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

async function init() {
  try {
    const [projRes, actRes] = await Promise.all([
      fetch('/projects.json'),
      fetch('/activity.json')
    ]);
    if (!projRes.ok) throw new Error('Projects data not found');
    projects = await projRes.json();
    if (actRes.ok) activityData = await actRes.json();
    renderSummary();
  } catch (err) {
    console.error('Failed to load data:', err);
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
                padding: { top: 10, bottom: 20, left: 10, right: 10 }
            }
        }
    });
}

function renderAIChart(projects) {
    const canvas = document.getElementById('aiChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Get top projects by total AI interaction (sessions/tasks)
    const topProjects = [...projects]
        .map(p => ({
            name: p.name,
            ag: p.antigravityUsage || 0,
            claude: p.claudeSessions || 0,
            total: (p.antigravityUsage || 0) + (p.claudeSessions || 0)
        }))
        .filter(p => p.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 7);

    if (window.myAIChart instanceof Chart) {
        window.myAIChart.destroy();
    }

    if (topProjects.length === 0) {
        ctx.fillStyle = '#8b949e';
        ctx.textAlign = 'center';
        ctx.fillText('No AI activity recorded yet', canvas.width/2, canvas.height/2);
        return;
    }

    window.myAIChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topProjects.map(p => p.name.length > 12 ? p.name.slice(0, 10) + '...' : p.name),
            datasets: [
                {
                    label: 'Antigravity',
                    data: topProjects.map(p => p.ag),
                    backgroundColor: 'rgba(171, 125, 248, 0.6)',
                    borderColor: '#ab7df8',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Claude CLI',
                    data: topProjects.map(p => p.claude),
                    backgroundColor: 'rgba(210, 153, 34, 0.6)',
                    borderColor: '#d29922',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar chart
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8b949e', font: { size: 10 } }
                },
                y: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#8b949e', font: { size: 10 } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top', /* Changed from bottom */
                    labels: { color: '#8b949e', font: { size: 9 }, usePointStyle: true }
                }
            },
            layout: {
                padding: { top: 10, bottom: 20, left: 10, right: 10 }
            }
        }
    });
}

function renderAISplitChart(projects) {
    const canvas = document.getElementById('aiSplitChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let totalAg = 0;
    let totalClaude = 0;

    projects.forEach(p => {
        totalAg += (p.antigravityUsage || 0);
        totalClaude += (p.claudeSessions || 0);
    });

    if (window.myAISplitChart instanceof Chart) {
        window.myAISplitChart.destroy();
    }

    if (totalAg === 0 && totalClaude === 0) return;

    window.myAISplitChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Antigravity', 'Claude CLI'],
            datasets: [{
                data: [totalAg, totalClaude],
                backgroundColor: ['rgba(171, 125, 248, 0.7)', 'rgba(210, 153, 34, 0.7)'],
                borderColor: '#0d1117',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#8b949e', font: { size: 10 }, usePointStyle: true }
                }
            },
            cutout: '65%'
        }
    });
}

function renderTokenChart(projects) {
    const canvas = document.getElementById('tokenChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const topTokenProjects = [...projects]
        .map(p => ({
            name: p.name,
            claude: (p.claudeInputTokens || 0) + (p.claudeOutputTokens || 0),
            ag: p.antigravityTokens || 0,
            total: ((p.claudeInputTokens || 0) + (p.claudeOutputTokens || 0)) + (p.antigravityTokens || 0)
        }))
        .filter(p => p.total > 0)
        .sort((a,b) => b.total - a.total)
        .slice(0, 7);

    if (window.myTokenChart instanceof Chart) {
        window.myTokenChart.destroy();
    }

    if (topTokenProjects.length === 0) return;

    window.myTokenChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topTokenProjects.map(p => p.name.length > 12 ? p.name.slice(0, 10) + '...' : p.name),
            datasets: [
                {
                    label: 'Antigravity',
                    data: topTokenProjects.map(p => p.ag),
                    backgroundColor: 'rgba(171, 125, 248, 0.6)',
                    borderColor: '#ab7df8',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Claude CLI',
                    data: topTokenProjects.map(p => p.claude),
                    backgroundColor: 'rgba(210, 153, 34, 0.6)',
                    borderColor: '#d29922',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    stacked: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#8b949e',
                        font: { size: 10 },
                        callback: val => formatNumber(val)
                    }
                },
                y: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#8b949e', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { 
                    display: true, 
                    position: 'bottom', 
                    labels: { color: '#8b949e', font: { size: 9 }, usePointStyle: true } 
                }
            },
            layout: {
                padding: { top: 10, bottom: 20, left: 10, right: 10 }
            }
        }
    });
}

function renderCacheChart(projects) {
    const canvas = document.getElementById('cacheChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let totalTokens = 0;
    let totalCacheRead = 0;

    projects.forEach(p => {
        totalTokens += (p.claudeInputTokens || 0) + (p.claudeOutputTokens || 0);
        totalCacheRead += (p.claudeCacheHits || 0);
    });

    if (window.myCacheChart instanceof Chart) {
        window.myCacheChart.destroy();
    }

    const totalInteractive = totalTokens + totalCacheRead;
    if (totalInteractive === 0) return;

    window.myCacheChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Direct Tokens', 'Cached Hits'],
            datasets: [{
                data: [totalTokens, totalCacheRead],
                backgroundColor: ['rgba(210, 153, 34, 0.7)', 'rgba(63, 185, 80, 0.7)'],
                borderColor: '#0d1117',
                borderWidth: 2,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top', /* Changed from bottom */
                    labels: { color: '#8b949e', font: { size: 10 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatNumber(ctx.raw)} (${Math.round(ctx.raw/totalInteractive*100)}%)`
                    }
                }
            },
            layout: {
                padding: { top: 10, bottom: 20, left: 10, right: 10 }
            },
            cutout: '70%'
        }
    });
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
}

function renderActivityGrid(activity) {
  const container = document.getElementById('activityGridContainer');
  if (!container) return;

  const WEEKS = 26;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Align to the most recent Sunday
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - startDate.getDay() - (WEEKS - 1) * 7);

  // Find max total for intensity scaling
  let maxTotal = 1;
  for (const d of Object.values(activity)) {
    const t = (d.claude || 0) + (d.antigravity || 0) + (d.commits || 0);
    if (t > maxTotal) maxTotal = t;
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build month labels spanning across week columns
  const monthLabels = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + w * 7);
    if (d.getMonth() !== lastMonth) {
      monthLabels.push({ col: w + 1, label: d.toLocaleString('default', { month: 'short' }) });
      lastMonth = d.getMonth();
    }
  }

  let html = `<div class="ag-grid-wrap">
    <div class="ag-month-row">
      <div class="ag-day-labels"></div>`;
  for (const { col, label } of monthLabels) {
    html += `<span class="ag-month-label" style="grid-column:${col}">${label}</span>`;
  }
  html += `</div><div class="ag-grid-body"><div class="ag-day-labels">`;
  for (let d = 0; d < 7; d++) {
    html += `<span class="ag-day-label">${d % 2 === 1 ? DAYS[d] : ''}</span>`;
  }
  html += `</div>`;

  for (let w = 0; w < WEEKS; w++) {
    html += `<div class="ag-week">`;
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      const entry = activity[key] || { claude: 0, antigravity: 0 };
      const total = (entry.claude || 0) + (entry.antigravity || 0) + (entry.commits || 0);
      const level = total === 0 ? 0 : Math.ceil((total / maxTotal) * 4);
      const isFuture = date > today;
      html += `<div class="ag-cell level-${isFuture ? 'future' : level}" data-date="${key}" data-claude="${entry.claude}" data-ag="${entry.antigravity}" data-commits="${entry.commits || 0}"></div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;

  // Legend
  html += `<div class="ag-legend">
    <span class="ag-legend-label">Less</span>
    ${[0,1,2,3,4].map(l => `<div class="ag-cell level-${l}"></div>`).join('')}
    <span class="ag-legend-label">More</span>
    <span class="ag-legend-sep">·</span>
    <div class="ag-cell level-1" style="background:var(--ag-claude)"></div><span class="ag-legend-label">Claude</span>
    <div class="ag-cell level-1" style="background:var(--ag-antigravity)"></div><span class="ag-legend-label">Antigravity</span>
  </div>`;

  html += `</div>`;
  container.innerHTML = html;

  // Floating tooltip
  const tip = document.createElement('div');
  tip.className = 'ag-tooltip';
  document.body.appendChild(tip);

  container.querySelectorAll('.ag-cell[data-date]').forEach(cell => {
    cell.addEventListener('mouseenter', e => {
      const date = cell.dataset.date;
      const claude = parseInt(cell.dataset.claude) || 0;
      const ag = parseInt(cell.dataset.ag) || 0;
      const commits = parseInt(cell.dataset.commits) || 0;
      const total = claude + ag;
      const d = new Date(date + 'T12:00:00');
      const label = d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const hasAny = total > 0 || commits > 0;
      tip.innerHTML = `
        <div class="ag-tip-date">${label}</div>
        ${!hasAny ? '<div class="ag-tip-empty">No activity</div>' : `
          ${claude > 0 ? `<div class="ag-tip-row"><span class="ag-tip-dot claude"></span> ${claude} Claude session${claude !== 1 ? 's' : ''}</div>` : ''}
          ${ag > 0 ? `<div class="ag-tip-row"><span class="ag-tip-dot ag"></span> ${ag} Antigravity task${ag !== 1 ? 's' : ''}</div>` : ''}
          ${commits > 0 ? `<div class="ag-tip-row"><span class="ag-tip-dot commits"></span> ${commits} commit${commits !== 1 ? 's' : ''}</div>` : ''}
        `}
      `;
      tip.classList.add('visible');
    });
    cell.addEventListener('mousemove', e => {
      const x = e.clientX + 12;
      const y = e.clientY - 10;
      tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 16) + 'px';
      tip.style.top = (y < 0 ? e.clientY + 16 : y) + 'px';
    });
    cell.addEventListener('mouseleave', () => tip.classList.remove('visible'));
  });
}

function renderSummary() {
  const dashboardContent = document.getElementById('dashboardContent');
  dashboardContent.classList.remove('hidden');

  // Metrics
  const totalCount = projects.length;
  const techCounts = {};
  let recentPulseCount = 0;
  let cleanRepos = 0;
  let gitRepos = 0;
  
  let totalAgSessions = 0;
  let totalAgTokens = 0;
  let totalClaudeSessions = 0;
  let totalClaudeTokens = 0;

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  projects.forEach(p => {
    techCounts[p.tech] = (techCounts[p.tech] || 0) + 1;
    if (p.lastModified > sevenDaysAgo) recentPulseCount++;
    if (p.git) {
        gitRepos++;
        if (!p.git.isDirty) cleanRepos++;
    }
    
    totalAgSessions += (p.antigravityUsage || 0);
    totalAgTokens += (p.antigravityTokens || 0);
    totalClaudeSessions += (p.claudeSessions || 0);
    totalClaudeTokens += (p.claudeInputTokens || 0) + (p.claudeOutputTokens || 0);
  });

  const gitHealth = gitRepos > 0 ? Math.round((cleanRepos / gitRepos) * 100) : 100;

  document.getElementById('totalProjects').textContent = totalCount;
  document.getElementById('activeStacks').textContent = Object.keys(techCounts).length;
  document.getElementById('recentPulse').textContent = recentPulseCount;
  document.getElementById('gitHealth').textContent = `${gitHealth}%`;
  
  document.getElementById('agSessions').textContent = totalAgSessions;
  document.getElementById('agTokens').textContent = `${formatNumber(totalAgTokens)} tokens`;
  document.getElementById('claudeSessions').textContent = totalClaudeSessions;
  document.getElementById('claudeTokens').textContent = `${formatNumber(totalClaudeTokens)} tokens`;

  // Activity Grid
  renderActivityGrid(activityData);

  // Charts
  renderCharts(projects);
  renderAIChart(projects);
  renderAISplitChart(projects);
  renderTokenChart(projects);
  renderCacheChart(projects);

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
      const totalTokens = (p.claudeInputTokens || 0) + (p.claudeOutputTokens || 0);
      
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
            
            <div class="ai-usage-row">
                ${p.antigravityUsage > 0 ? `
                  <div class="ai-badge antigravity" title="Antigravity sessions">
                    <span>🪐</span>
                    <div class="ag-info">
                      <span class="count">${p.antigravityUsage}</span>
                      <span class="tokens">${formatNumber(p.antigravityTokens || 0)}</span>
                    </div>
                  </div>
                ` : ''}
                ${p.claudeSessions > 0 ? `
                  <div class="ai-badge claude" title="Claude CLI sessions">
                    <span>🤖</span>
                    <div class="claude-info">
                      <span class="count">${p.claudeSessions}</span>
                      <span class="tokens">${formatNumber(totalTokens)}</span>
                    </div>
                  </div>
                ` : ''}
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
