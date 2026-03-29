#!/usr/bin/env node
/**
 * Generate project metadata from configured directory
 * Outputs a JSON file that the web frontend can use
 */

const fs = require('fs');
const path = require('path');
const { scanProjects } = require('./lib/scanner');
const { syncToLocus } = require('./lib/locus');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const PROJECTS_PATH = path.join(__dirname, 'projects.json');
const CACHE_PATH = path.join(__dirname, '.locus-cache.json');

let config = {
  DEV_DIR: '',
  LOCUS_URL: '',
  LOCUS_SPACE: ''
};

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`\x1b[31mError: config.json not found.\x1b[0m`);
  console.error(`\x1b[31mPlease run 'npm run setup' to configure the project.\x1b[0m`);
  process.exit(1);
}

try {
  const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  config = { ...config, ...fileConfig };
  
  if (!config.DEV_DIR) {
    console.error(`\x1b[31mError: DEV_DIR not configured in config.json.\x1b[0m`);
    console.error(`\x1b[31mRun 'npm run setup' or update config.json manually.\x1b[0m`);
    process.exit(1);
  }
} catch (e) {
  console.error('\x1b[31mError reading config.json:\x1b[0m', e.message);
  process.exit(1);
}

async function main() {
  console.log(`Scanning projects in ${config.DEV_DIR}...`);
  const projects = scanProjects(config.DEV_DIR);
  
  console.log(`Found ${projects.length} projects.`);
  
  fs.writeFileSync(PROJECTS_PATH, JSON.stringify(projects, null, 2), 'utf8');
  console.log(`Saved to ${PROJECTS_PATH}`);

  if (config.LOCUS_URL) {
    console.log(`Syncing to Locus at ${config.LOCUS_URL}...`);
    await syncToLocus(projects, config.LOCUS_URL, config.LOCUS_SPACE, CACHE_PATH);
  }
}

main().catch(console.error);
