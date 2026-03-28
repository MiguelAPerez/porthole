# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Projects View** tool - a simple project browser/dashboard that scans the `~/development` directory and generates an `index.html` file displaying all projects grouped by technology stack.

## Architecture

The project consists of two main files:

1. **`generate-projects.js`** - The main script that:
   - Scans `~/development` for project directories
   - Reads `package.json` and `README.md` from each project
   - Detects technology stack (React, Next.js, TypeScript, Node.js, etc.)
   - Extracts descriptions from package.json or README.md
   - Generates an HTML dashboard with search functionality

2. **`index.html`** - The generated HTML dashboard containing:
   - Dark theme UI with project cards
   - Search/filter functionality
   - Projects grouped by technology category
   - Icons and colors based on tech stack

## How to Use

### Generate the dashboard

```bash
node generate-projects.js
```

This will:
1. Scan `~/development` for all project directories
2. Skip hidden directories and special folders (node_modules, .git)
3. Read package.json and README.md from each project
4. Detect tech stack and generate descriptions
5. Output a new `index.html` file

### View the dashboard

Open `index.html` in a web browser to browse all projects.

### Search projects

Use the search box in the dashboard to filter projects by:
- Project name
- Technology stack
- Description

## Tech Stack Detection

The script automatically detects these technologies:
- Frontend: Next.js, React, Vue, Svelte, Astro, SolidJS, SvelteKit, Nuxt
- Backend: Node.js API, Python, Go, Ruby, PHP, .NET
- Build tools: TypeScript, Bun, pnpm

## File Structure

```
projects-view/
├── generate-projects.js  # Main generation script
└── index.html            # Generated dashboard
```

## Common Development Tasks

- **Run the generator**: `node generate-projects.js`
- **View the dashboard**: Open `index.html` in a browser
- **Add a new project**: Add a directory to `~/development` with a `package.json` file

## Notes

- The script runs synchronously and generates the HTML file in-place
- Projects are automatically discovered from `~/development` directory
- The generated HTML is self-contained with embedded CSS and JavaScript
