#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('Linking pview globally...');

try {
  execSync('npm link', { stdio: 'inherit', cwd: __dirname });
  console.log('Done. Run pview to start the server.');
} catch (e) {
  console.log('Link failed:', e.message);
}
