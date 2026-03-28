# Projects View

A local dashboard to view and manage your development projects. Scans a specified directory for projects, detects their tech stacks, and presents them in a clean, searchable UI.

## Features

- Scans local directories for projects.
- Detects tech stacks based on common files (`package.json`, `composer.json`, `go.mod`, etc.).
- Presents a searchable, filterable dashboard of your projects.
- Displays summary statistics of your tech stacks.
- Configurable via a web UI.
- Synchronizes project metadata with a Locus instance.

## Installation

```bash
npm install
```

## Usage

1. Start the server (this will also open the dashboard in your browser):
```bash
npm start
```

2. Open `http://localhost:3131` in your browser.

3. Use the Settings icon in the UI to configure your development directory (`DEV_DIR`) and Locus synchronization settings.

4. Click the Refresh button in the UI to generate the initial index of your projects.

## Project Structure

- `public/`: Frontend assets (HTML, CSS, JS).
- `lib/`: Backend modules (scanner, tech detection, Locus sync).
- `generate-projects.js`: CLI tool to scan projects and generate data.
- `server.js`: Development server and settings manager.
