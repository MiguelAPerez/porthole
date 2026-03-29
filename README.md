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
```

The setup script will guide you through configuring your projects directory and Locus synchronization.

## Usage

1. Start the server (this will also open the dashboard in your browser):

```bash
npm start
```

1. Open `http://localhost:3131` in your browser.

2. Access the **Settings** icon (⚙️) from the dashboard to manage your `DEV_DIR` and Locus settings.

3. Click the **Refresh** button (↻) to scan your projects and generate the data.

## Configuration

The application uses a `config.json` file as the single source of truth for your configuration. You can modify this file directly or use the built-in setup:

- **DEV_DIR**: The absolute path to your local development projects.
- **LOCUS_URL**: The URL to your Locus instance for metadata synchronization.
- **LOCUS_SPACE**: The Locus space identifier for your projects.

### Using Locus

[Locus](https://github.com/MiguelAPerez/locus) is used to track and synchronize project metadata. To enable this, ensure your Locus server is running and configured correctly in your `config.json`.

## Global Installation (Optional)

To use `pview` from anywhere on your system:

```bash
npm link
```

This creates a global `pview` command that you can use to start the server or generate projects from any directory.

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
