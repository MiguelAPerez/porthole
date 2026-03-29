#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('Stopping pview server...');

try {
  const result = execSync('lsof -i :3131 | grep LISTEN', { encoding: 'utf8' });
  const lines = result.trim().split('\n');

  for (const line of lines) {
    if (line) {
      const parts = line.split(/\s+/);
      const pid = parts[1];
      if (pid) {
        console.log(`Killing process ${pid}...`);
        execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
      }
    }
  }

  console.log('Server stopped.');
} catch (e) {
  console.log('No process found on port 3131.');
}
