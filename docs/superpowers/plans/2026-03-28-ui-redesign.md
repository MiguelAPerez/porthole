# UI Redesign & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the projects dashboard into a flat sorted list with tech filter pills, last-modified timestamps, and batched rendering to eliminate lag.

**Architecture:** All changes are confined to `generate-projects.js`. `scanProjects()` gains a `lastModified` field and sorts by it. `generateHTML()` is fully replaced with a flat list layout. No new files; no changes to `server.js` or `summary.html`.

**Tech Stack:** Node.js (generation), vanilla JS/HTML/CSS (generated output)

---

### Task 1: Add `lastModified` to `scanProjects()`

**Files:**
- Modify: `generate-projects.js` (lines 1–185)

This task adds a `getLastModified(dirPath)` helper and wires it into `scanProjects()`, then sorts results by `lastModified` descending. No test framework exists in this project — verification is by running the generator and inspecting console output.

- [ ] **Step 1: Add `getLastModified` helper after `extractDescription` (line ~136)**

Insert this function between `extractDescription` and `scanProjects`:

```js
function getLastModified(dirPath) {
  let newest = 0;
  try {
    newest = fs.statSync(dirPath).mtimeMs;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      try {
        const s = fs.statSync(path.join(dirPath, entry.name));
        if (s.mtimeMs > newest) newest = s.mtimeMs;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return newest;
}
```

- [ ] **Step 2: Add `lastModified` to the `projects.push(...)` call in `scanProjects()`**

Find the `projects.push({` block (currently around line 184). Add `lastModified` as the last field:

```js
projects.push({
  name: entry.name,
  tech,
  icon: getTechIcon(tech),
  color: getTechColor(tech),
  description,
  readme,
  path: `file://${path.join(DEV_DIR, entry.name)}`,
  lastModified: getLastModified(dirPath)
});
```

- [ ] **Step 3: Sort projects by `lastModified` descending before returning**

Find the closing of `scanProjects()` — just before the `return projects;` line. Add:

```js
projects.sort((a, b) => b.lastModified - a.lastModified);
```

- [ ] **Step 4: Verify by running the generator**

```bash
node generate-projects.js
```

Expected: same output as before (lists project names and techs), no errors. The `lastModified` field is embedded in the HTML but not yet visible — that's fine, it will be used in Task 2.

- [ ] **Step 5: Commit**

```bash
git add generate-projects.js
git commit -m "feat: add lastModified field to project scan, sort by recency"
```

---

### Task 2: Replace `generateHTML()` with flat list UI

**Files:**
- Modify: `generate-projects.js` (the `generateHTML` function, currently lines ~416–709)

Full replacement of `generateHTML`. The new version produces a flat sorted list with a search bar, tech filter pills, and batched rendering. `generateSummaryHTML` and all other functions are untouched.

- [ ] **Step 1: Replace the entire `generateHTML(projects)` function**

Remove everything from `function generateHTML(projects) {` through its closing `}` and replace with the following. The function takes the `projects` array (already sorted by `lastModified` from Task 1).

```js
function generateHTML(projects) {
  // Build unique tech list in order of first appearance (already sorted by recency)
  const techs = [];
  for (const p of projects) {
    if (!techs.includes(p.tech)) techs.push(p.tech);
  }

  const pillsHTML = techs.map(t =>
    `<button class="pill" data-tech="${t}">${getTechIcon(t)} ${t}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects View</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --text: #c9d1d9;
      --muted: #8b949e;
      --border: #30363d;
      --accent: #58a6ff;
      --hover: #1f242c;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.5;
    }

    .header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .header h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    .header p { color: var(--muted); }

    .controls {
      max-width: 760px;
      margin: 0 auto 1.5rem;
    }

    .search-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .search-row input {
      flex: 1;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      outline: none;
    }

    .search-row input:focus { border-color: var(--accent); }

    .refresh-btn {
      padding: 0.65rem 0.875rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 1rem;
      cursor: pointer;
      flex-shrink: 0;
      line-height: 1;
    }

    .refresh-btn:hover { border-color: var(--accent); color: var(--accent); }

    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .pill {
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .pill:hover { border-color: var(--accent); color: var(--text); }
    .pill.active { background: var(--card-bg); border-color: var(--accent); color: var(--accent); }

    .list {
      max-width: 760px;
      margin: 0 auto;
    }

    .project-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
    }

    body:not(.scrolling) .project-row:hover { background: var(--hover); }

    .project-row .icon { font-size: 1.1rem; flex-shrink: 0; width: 1.5rem; text-align: center; }

    .project-row .name {
      font-weight: 600;
      font-size: 0.95rem;
      white-space: nowrap;
      min-width: 160px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-row .desc {
      flex: 1;
      color: var(--muted);
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .project-row .time {
      color: var(--muted);
      font-size: 0.8rem;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .no-results {
      text-align: center;
      padding: 3rem;
      color: var(--muted);
    }

    @media (max-width: 640px) {
      body { padding: 1rem; }
      .project-row .desc { display: none; }
      .project-row .name { max-width: none; flex: 1; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📁 Projects</h1>
    <p>Browse through all your development projects &mdash; <a href="summary.html" style="color: var(--accent); text-decoration: none;">view summary</a></p>
  </div>

  <div class="controls">
    <div class="search-row">
      <input type="search" id="search" placeholder="Search projects...">
      <button id="refresh" class="refresh-btn" title="Regenerate projects (requires: node server.js)">&#x21BB;</button>
    </div>
    <div class="pills" id="pills">
      <button class="pill active" data-tech="">All</button>
      ${pillsHTML}
    </div>
  </div>

  <div class="list" id="list"></div>

  <script>
    const projects = ${JSON.stringify(projects)};

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

    const listEl = document.getElementById('list');
    const searchEl = document.getElementById('search');
    const pillsEl = document.getElementById('pills');

    let activeTech = '';
    let renderGen = 0;

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
        return \`<a class="project-row" href="\${p.path}">
          <span class="icon">\${p.icon}</span>
          <span class="name">\${p.name}</span>
          <span class="desc">\${p.description || 'No description'}</span>
          <span class="time">\${relativeTime(p.lastModified)}</span>
        </a>\`;
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

    renderProjects();

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
        const res = await fetch('http://localhost:3131/refresh');
        if (res.ok) { btn.textContent = '✓'; setTimeout(() => location.reload(), 300); }
        else { btn.textContent = '✗'; setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000); }
      } catch {
        btn.textContent = '✗';
        setTimeout(() => { btn.innerHTML = '&#x21BB;'; }, 2000);
      }
    });
  </script>
</body>
</html>`;
}
```

- [ ] **Step 2: Run the generator and verify output**

```bash
node generate-projects.js
```

Expected output: lists all projects with their tech, no errors. Then open `index.html` in a browser and confirm:
- Projects appear as a flat list (not grouped by tech)
- Rows show icon, name, description, and a relative time (e.g. "2d ago")
- Filter pills appear at top (one per detected tech + "All")
- Clicking a pill filters the list
- Typing in search filters the list
- Refresh button still works (if server is running)
- Page loads quickly with no visible lag

- [ ] **Step 3: Commit**

```bash
git add generate-projects.js index.html
git commit -m "feat: redesign dashboard — flat list, tech pills, batched rendering, last-modified timestamps"
```
