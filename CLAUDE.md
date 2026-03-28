# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A project browser/dashboard that scans `~/development` (`/Users/miguelperez/development`) and generates HTML files displaying all projects grouped by technology stack.

## Commands

```bash
# Generate/regenerate the dashboard (outputs index.html and summary.html)
node generate-projects.js

# Run the local server (enables the refresh button in the UI)
node server.js
# Server runs at http://localhost:3131
# GET /refresh → re-runs generate-projects.js and serves updated files
```

## Architecture

Three files make up the entire project:

**`generate-projects.js`** — Scans `~/development`, detects tech stacks, and writes two output files:
- `index.html` — main project browser with search and project cards grouped by tech
- `summary.html` — stats overview with per-tech project counts

Tech detection priority: `package.json` deps → file-based detection (go.mod, Cargo.toml, etc.) → one-level-deep subdirectory scan. Description comes from `package.json` or `composer.json`.

**`server.js`** — Minimal HTTP server on port 3131. Serves static files and exposes `GET /refresh` which re-runs the generator synchronously. This enables the refresh button (↻) in the UI to regenerate without opening a terminal.

**`index.html` / `summary.html`** — Generated output, not hand-edited. Project data is embedded as JSON inside a `<script>` tag. Search filters client-side. The refresh button calls `http://localhost:3131/refresh` and reloads on success.

## Notes

- The hardcoded scan path is `/Users/miguelperez/development` — update `DEV_DIR` in `generate-projects.js` to change it
- Hover effects on project cards are suppressed during scroll (`.scrolling` class) to eliminate scroll lag
- `summary.html` is linked from `index.html` as "view summary"
