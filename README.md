# Projects View

A local dashboard to view and manage your development projects. Scans a specified directory for projects, detects their tech stacks, and presents them in a clean, searchable UI.

## Features

- Scans local directories for projects.
- Detects tech stacks based on common files (`package.json`, `composer.json`, `go.mod`, etc.).
- Presents a searchable, filterable dashboard of your projects.
- Displays summary statistics of your tech stacks.
- Configurable via a web UI.
- Synchronizes project metadata with a [Locus](https://github.com/MiguelAPerez/locus) instance.
- Track Claude and Antigravity usage across projects.

## Installation

```bash
npm install
npm run setup
npm link
```

The setup script will guide you through configuring your projects directory and Locus synchronization. `npm link` installs the global `pview` command so you can launch the dashboard from anywhere.

## Usage

```bash
pview
```

Opens the dashboard at `http://localhost:3131`. If the server is already running, it prints the URL instead of starting a new instance.

From the dashboard:

- Access the **Settings** icon (⚙️) to manage your `DEV_DIR` and Locus settings.
- Click the **Refresh** button (↻) to rescan your projects.

## Configuration

The application uses a `config.json` file as the single source of truth for your configuration. You can modify this file directly or use the built-in setup:

- **DEV_DIR**: The absolute path to your local development projects.
- **LOCUS_URL**: The URL to your Locus instance for metadata synchronization.
- **LOCUS_SPACE**: The Locus space identifier for your projects.

### Using Locus

[Locus](https://github.com/MiguelAPerez/locus) is used to track and synchronize project metadata. To enable this, ensure your Locus server is running and configured correctly in your `config.json`.

## AI Usage Tracking

The dashboard tracks how much you use **Claude Code** and **Antigravity** (Gemini) across your projects, automatically — no manual logging needed.

### Claude Code

Reads session files from `~/.claude/projects/`. For each project it extracts:

- **Sessions** — number of `.jsonl` session files
- **Input / output tokens** — summed from `assistant` message usage entries
- **Cache hits** — `cache_read_input_tokens` across all sessions

### Antigravity (Gemini)

Reads from `~/.gemini/antigravity/brain/` and `~/.gemini/antigravity/conversations/`. For each session folder it extracts:

- **Sessions** — one per brain folder; project is identified by `file://` URLs found in `task.md` or `implementation_plan.md`
- **Token estimate** — derived from the size of the matching `.pb` conversation file (`bytes ÷ 4`)

### Daily Activity Grid

The dashboard merges Claude sessions, Antigravity sessions, and git commits into a heatmap grid. Each day shows activity counts for all three sources, color-coded:

- **Claude** — orange (`#d29922`)
- **Antigravity** — purple (`#ab7df8`)
- **Commits** — shown separately in the grid

Usage metrics appear on project cards and in the Summary page (top projects by sessions/tokens, consumption charts).

## Notes

- If the server is already running, `pview` will display the URL to visit instead of starting a new instance.
- Use `pview-stop` to stop the server (finds and kills the process on port 3131).
- Use `pview-unlink` to remove the global link.
- Use `lsof -i :3131` to find the process using port 3131, or `kill -9 <PID>` to stop it manually.

## Project Structure

- `public/`: Frontend assets (HTML, CSS, JS).
- `lib/`: Backend modules (scanner, tech detection, Locus sync).
- `generate-projects.js`: CLI tool to scan projects and generate data.
- `server.js`: Development server and settings manager.
