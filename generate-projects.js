#!/usr/bin/env node
/**
 * Generate project metadata from configured directory
 * Outputs a JSON file that the web frontend can use
 */

const fs = require('fs');
const path = require('path');
const { scanProjects } = require('./lib/scanner');
const { syncToLocus } = require('./lib/locus');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const PROJECTS_PATH = path.join(__dirname, 'projects.json');
const CACHE_PATH = path.join(__dirname, '.locus-cache.json');

// Default config if missing
let config = {
  DEV_DIR: '/Users/miguelperez/development',
  LOCUS_URL: 'https://locus.miguelaperez.dev',
  LOCUS_SPACE: 'projects'
};

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...fileConfig };
  }
} catch (e) {
  console.warn('Could not read config.json, using defaults:', e.message);
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
