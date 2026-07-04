const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { extractDescription, parseGitRemoteUrl, classifyGitHost } = require('../lib/scanner');

test('extractDescription returns package.json description first', () => {
  const pkg = { description: 'My package desc' };
  assert.equal(extractDescription(pkg, null, '/tmp', null), 'My package desc');
});

test('extractDescription falls back to composer.json', () => {
  const composer = { description: 'PHP project' };
  assert.equal(extractDescription(null, composer, '/tmp', null), 'PHP project');
});

test('extractDescription falls back to README when no pkg/composer/cargo', () => {
  const readme = '# My Project\n\nThis is the project description.';
  assert.equal(extractDescription(null, null, '/tmp', readme), 'This is the project description.');
});

test('extractDescription returns empty string when first README line is too short', () => {
  // The function only checks the first non-heading line; "Hi" is ≤5 chars so it returns ''
  const readme = '# Title\n\nHi\n\nLonger description here.';
  assert.equal(extractDescription(null, null, '/tmp', readme), '');
});

test('extractDescription returns empty string when nothing found', () => {
  assert.equal(extractDescription(null, null, '/tmp', ''), '');
});

test('extractDescription prefers pkg over composer', () => {
  const pkg = { description: 'from pkg' };
  const composer = { description: 'from composer' };
  assert.equal(extractDescription(pkg, composer, '/tmp', null), 'from pkg');
});

test('parseGitRemoteUrl handles GitHub SSH remotes', () => {
  const result = parseGitRemoteUrl('git@github.com:MiguelAPerez/project-viewer.git');
  assert.deepEqual(result, {
    webUrl: 'https://github.com/MiguelAPerez/project-viewer',
    host: 'GitHub',
  });
});

test('parseGitRemoteUrl handles Gitea HTTPS remotes', () => {
  const result = parseGitRemoteUrl('https://gitea.example.com/mperez/docs-mcp.git');
  assert.deepEqual(result, {
    webUrl: 'https://gitea.example.com/mperez/docs-mcp',
    host: 'Gitea',
  });
});

test('parseGitRemoteUrl handles SCP-style self-hosted remotes', () => {
  const result = parseGitRemoteUrl('git@git.example.com:acme/project-viewer.git');
  assert.deepEqual(result, {
    webUrl: 'https://git.example.com/acme/project-viewer',
    host: 'Git server',
  });
});

test('parseGitRemoteUrl applies GIT_HOST_MAP overrides', () => {
  const hostMap = { 'git.example.com': 'gitea.example.com' };
  const result = parseGitRemoteUrl('git@git.example.com:acme/project-viewer.git', hostMap);
  assert.deepEqual(result, {
    webUrl: 'https://gitea.example.com/acme/project-viewer',
    host: 'Gitea',
  });
});

test('parseGitRemoteUrl handles host:path remotes without user prefix', () => {
  const result = parseGitRemoteUrl('git.example.com:acme/project-viewer.git');
  assert.deepEqual(result, {
    webUrl: 'https://git.example.com/acme/project-viewer',
    host: 'Git server',
  });
});

test('parseGitRemoteUrl returns null for invalid remotes', () => {
  assert.equal(parseGitRemoteUrl(''), null);
  assert.equal(parseGitRemoteUrl('not-a-remote'), null);
});

test('classifyGitHost identifies common hosts', () => {
  assert.equal(classifyGitHost('github.com'), 'GitHub');
  assert.equal(classifyGitHost('gitea.example.com'), 'Gitea');
  assert.equal(classifyGitHost('gitlab.com'), 'GitLab');
});
