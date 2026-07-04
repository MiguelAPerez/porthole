function gitRemoteIcon(host) {
  if (host === 'GitHub') return '🐙';
  if (host === 'Gitea') return '🍵';
  return '⎇';
}

function gitRemoteLinkHTML(git, { compact = false } = {}) {
  if (!git?.webUrl) return '';
  const label = git.host || 'Git server';
  const cls = compact ? 'action-btn-small git-remote-link' : 'action-btn git-remote-link';
  const icon = gitRemoteIcon(label);
  const href = git.webUrl.replace(/"/g, '&quot;');
  return `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer" title="Open on ${label}" onclick="event.stopPropagation()">${icon}</a>`;
}

function gitRemoteButtonHTML(git) {
  if (!git?.webUrl) return '';
  const label = git.host || 'Git server';
  const icon = gitRemoteIcon(label);
  const href = git.webUrl.replace(/"/g, '&quot;');
  return `<a class="btn-git-remote" href="${href}" target="_blank" rel="noopener noreferrer">${icon} Open on ${label}</a>`;
}
