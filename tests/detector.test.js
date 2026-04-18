const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectTechStack } = require('../lib/detector');

// detectTechStack(pkg, composer, dirPath) — dirPath is used for file existence checks,
// so we use a non-existent path to avoid false positives from real files.
const EMPTY_DIR = '/tmp/__nonexistent_test_dir__';

test('detects Next.js from package.json deps', () => {
  const pkg = { dependencies: { next: '14.0.0' } };
  assert.equal(detectTechStack(pkg, null, EMPTY_DIR), 'Next.js');
});

test('detects React from package.json deps', () => {
  const pkg = { dependencies: { react: '18.0.0' } };
  assert.equal(detectTechStack(pkg, null, EMPTY_DIR), 'React');
});

test('detects Vue from package.json deps', () => {
  const pkg = { dependencies: { vue: '3.0.0' } };
  assert.equal(detectTechStack(pkg, null, EMPTY_DIR), 'Vue');
});

test('detects Node.js API from express dep', () => {
  const pkg = { dependencies: { express: '4.0.0' } };
  assert.equal(detectTechStack(pkg, null, EMPTY_DIR), 'Node.js API');
});

test('detects TypeScript from devDependencies', () => {
  const pkg = { devDependencies: { typescript: '5.0.0' } };
  assert.equal(detectTechStack(pkg, null, EMPTY_DIR), 'TypeScript');
});

test('falls back to JavaScript/Node.js for unknown package.json', () => {
  const pkg = { dependencies: { lodash: '4.0.0' } };
  assert.equal(detectTechStack(pkg, null, EMPTY_DIR), 'JavaScript/Node.js');
});

test('detects PHP from composer.json when no package.json', () => {
  const composer = { name: 'vendor/pkg' };
  assert.equal(detectTechStack(null, composer, EMPTY_DIR), 'PHP');
});
