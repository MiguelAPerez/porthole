const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { extractDescription } = require('../lib/scanner');

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
