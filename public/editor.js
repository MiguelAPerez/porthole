const EDITORS = {
  cursor: { action: 'cursor', icon: '◈', label: 'Cursor', title: 'Open in Cursor', btnClass: 'btn-cursor' },
  antigravity: { action: 'antigravity', icon: '✦', label: 'Antigravity', title: 'Open in Antigravity', btnClass: 'btn-antigravity' },
  vscode: { action: 'vscode', icon: '💻', label: 'VS Code', title: 'Open in VS Code', btnClass: 'btn-vscode' },
  claude: { action: 'claude', icon: '✳', label: 'Claude Code', title: 'Open in Claude Code (Desktop)', btnClass: 'btn-claude' }
};

const STORAGE_KEY = 'pview-editor-overrides';

let defaultEditor = 'cursor';
let editorOverrides = {};

function normalizeEditor(value) {
  return EDITORS[value] ? value : 'cursor';
}

function normPath(path) {
  return path.replace('file://', '');
}

function escPathJs(path) {
  return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escPathAttr(path) {
  return path.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function loadEditorOverrides() {
  try {
    editorOverrides = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    editorOverrides = {};
  }
}

function saveEditorOverrides() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(editorOverrides));
}

function getEditorOverride(path) {
  const key = editorOverrides[normPath(path)];
  return key && EDITORS[key] ? key : null;
}

function hasEditorOverride(path) {
  return !!getEditorOverride(path);
}

function getDefaultEditor() {
  return EDITORS[defaultEditor] || EDITORS.cursor;
}

function getEditorForPath(path) {
  const override = getEditorOverride(path);
  return override ? EDITORS[override] : getDefaultEditor();
}

function setEditorOverride(path, editorKey) {
  const p = normPath(path);
  if (editorKey && EDITORS[editorKey]) {
    editorOverrides[p] = editorKey;
  } else {
    delete editorOverrides[p];
  }
  saveEditorOverrides();
}

async function loadEditorConfig() {
  loadEditorOverrides();
  try {
    const res = await fetch('/settings');
    if (res.ok) {
      const config = await res.json();
      defaultEditor = normalizeEditor(config.DEFAULT_EDITOR);
    }
  } catch {}
  updateEditorUI();
}

function setDefaultEditor(value) {
  defaultEditor = normalizeEditor(value);
  updateEditorUI();
}

function editorMenuHTML(path) {
  const current = getEditorForPath(path);
  const epJs = escPathJs(path);
  let html = Object.entries(EDITORS).map(([key, ed]) =>
    `<button type="button" class="${ed.action === current.action ? 'active' : ''}" onclick="pickEditor(event, '${epJs}', '${key}')">${ed.icon} ${ed.label}</button>`
  ).join('');
  if (hasEditorOverride(path)) {
    html += `<button type="button" class="editor-menu-reset" onclick="resetEditorOverride(event, '${epJs}')">↩ Use default (${getDefaultEditor().label})</button>`;
  }
  return html;
}

function editorSplitHTML(path, { compact = false } = {}) {
  const editor = getEditorForPath(path);
  const epJs = escPathJs(path);
  const epAttr = escPathAttr(path);
  const overrideClass = hasEditorOverride(path) ? ' has-override' : '';
  const openClass = compact ? 'action-btn-small editor-open-btn' : 'action-btn editor-open-btn';
  const openLabel = compact ? `${editor.icon} ${editor.label}` : editor.icon;

  return `
    <div class="editor-split${compact ? ' editor-split--compact' : ''}${overrideClass}" data-path="${epAttr}">
      <button type="button" class="${openClass}" title="${editor.title}" onclick="openProjectPath(event, '${epJs}', '${editor.action}')">${openLabel}</button>
      <button type="button" class="editor-pick-btn${compact ? ' editor-pick-btn--compact' : ''}" title="Choose editor for this project" onclick="toggleEditorMenu(event, '${epJs}')">▾</button>
      <div class="editor-menu split-btn__menu">${editorMenuHTML(path)}</div>
    </div>`;
}

function closeAllEditorMenus() {
  document.querySelectorAll('.editor-split.open').forEach(el => el.classList.remove('open'));
}

function updateEditorSplit(path) {
  const p = normPath(path);
  document.querySelectorAll('.editor-split').forEach(el => {
    if (normPath(el.dataset.path) === p) {
      el.outerHTML = editorSplitHTML(path, { compact: el.classList.contains('editor-split--compact') });
    }
  });
}

function updateDetailsEditorUI(path) {
  const split = document.getElementById('detailEditorSplit');
  if (!split) return;
  if (split.dataset.path && normPath(split.dataset.path) !== normPath(path)) return;

  const editor = getEditorForPath(path);
  const btn = document.getElementById('openEditor');
  if (btn) {
    btn.textContent = `${editor.icon} Open in ${editor.label}`;
    btn.className = editor.btnClass;
  }

  split.classList.toggle('has-override', hasEditorOverride(path));

  const menu = document.getElementById('detailEditorMenu');
  if (menu) menu.innerHTML = editorMenuHTML(path);
}

function refreshEditorUI(path) {
  updateEditorSplit(path);
  updateDetailsEditorUI(path);
}

function updateEditorUI() {
  const editor = getDefaultEditor();
  const split = document.getElementById('detailEditorSplit');
  const btn = document.getElementById('openEditor');
  if (btn && split && (!split.dataset.path || !hasEditorOverride(split.dataset.path))) {
    btn.textContent = `${editor.icon} Open in ${editor.label}`;
    btn.className = editor.btnClass;
  }
  const select = document.getElementById('defaultEditor');
  if (select) select.value = defaultEditor;
  if (split?.dataset.path) updateDetailsEditorUI(split.dataset.path);
}

window.toggleEditorMenu = function(event, path) {
  event.stopPropagation();
  const split = event.currentTarget.closest('.editor-split');
  const wasOpen = split.classList.contains('open');
  closeAllEditorMenus();
  if (!wasOpen) {
    const menu = split.querySelector('.editor-menu');
    if (menu) menu.innerHTML = editorMenuHTML(path);
    split.classList.add('open');
  }
};

window.pickEditor = function(event, path, editorKey) {
  event.stopPropagation();
  setEditorOverride(path, editorKey);
  closeAllEditorMenus();
  refreshEditorUI(path);
};

window.resetEditorOverride = function(event, path) {
  event.stopPropagation();
  setEditorOverride(path, null);
  closeAllEditorMenus();
  refreshEditorUI(path);
};

document.addEventListener('click', closeAllEditorMenus);

window.escPathJs = escPathJs;
window.escPathAttr = escPathAttr;
