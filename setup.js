#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askWithDefault = (question, defaultValue) => {
  return new Promise((resolve) => {
    rl.question(`${question} [${defaultValue}]: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
};

async function setup() {
  const isAuto = process.argv.includes('--if-missing');
  
  if (isAuto && fs.existsSync(CONFIG_PATH)) {
    console.log('Configuration already exists, skipping interactive setup.');
    process.exit(0);
  }

  console.log('\n--- Project Viewer Configuration Setup ---\n');

  // Load existing config if available
  let existingConfig = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.warn('Could not read existing config.json, using defaults.');
    }
  }

  // Define defaults
  const defaults = {
    DEV_DIR: existingConfig.DEV_DIR || path.join(os.homedir(), 'development'),
    LOCUS_URL: existingConfig.LOCUS_URL || 'http://localhost:8000',
    LOCUS_SPACE: existingConfig.LOCUS_SPACE || 'projects'
  };

  // Ask questions
  const config = {
    DEV_DIR: await askWithDefault('Development projects directory', defaults.DEV_DIR),
    LOCUS_URL: await askWithDefault('Locus URL (e.g., http://localhost:8000)', defaults.LOCUS_URL),
    LOCUS_SPACE: await askWithDefault('Locus space name', defaults.LOCUS_SPACE)
  };

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  console.log(`\nConfig saved to ${CONFIG_PATH}`);
  console.log('\nSetup complete!\n');
  
  rl.close();
}

setup().catch((e) => {
  console.error('\nSetup failed:', e.message);
  process.exit(1);
});
