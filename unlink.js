#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('Unlinking pview globally. ..');

try {
  execSync('npm unlink', { stdio: 'inherit' });
  console.log('Done.');
} catch (e) {
  console.log('Unlink failed:', e.message);
}
