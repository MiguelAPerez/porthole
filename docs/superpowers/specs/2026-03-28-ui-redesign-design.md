# UI Redesign & Performance Design

**Date:** 2026-03-28
**Status:** Approved

## Problem

The current dashboard groups projects by technology, which the user doesn't prioritize. The page feels laggy due to synchronous bulk rendering. The card UI feels dated and wastes space.

## Goals

- Flat list sorted by last-modified (serves both search and rediscovery workflows)
- Each row shows: tech icon, name, description, relative timestamp
- Tech filter pills for quick narrowing
- Eliminate render lag via batched rendering

## Out of Scope

- `summary.html` — no changes
- `server.js` — no changes
- Splitting data from template (adds server dependency, not worth it)

---

## Design

### `scanProjects()` — last-modified detection

Add a `lastModified` field (Unix timestamp, ms) to each project object.

**How:** Check `mtime` of every entry 1 level deep inside the project directory (plus the directory itself). Take the newest value. No deep recursion — fast enough for typical project counts.

Sort the returned projects array by `lastModified` descending before returning.

### `generateHTML()` — flat list UI

Replace the grouped card grid with a flat sorted list.

**Layout:**
```
[ search input                    ] [ ↻ ]
[ All ] [ React ] [ Go ] [ Python ] ...   ← tech filter pills

[⚛️]  my-app          A React dashboard for analytics       2h ago
[🐹]  go-api           REST backend service                  yesterday
[🐍]  ml-experiments   No description                        1w ago
...
```

**Search bar:** existing behavior (filters by name, tech, description).

**Tech filter pills:** dynamically generated from the project list. Single-select. "All" is the default. Clicking a tech pill filters the list to that tech only. Active pill highlighted in accent color. Search and pill filter compose (both apply simultaneously).

**Rows:** each row is an `<a>` tag linking to the project path. Contains:
- Tech icon (emoji)
- Project name (bold)
- Description (muted, truncated to 1 line with ellipsis)
- Relative timestamp (muted, right-aligned)

Hover: highlight background. No hover effect while scrolling (existing `.scrolling` class behavior retained).

**Relative timestamps:** inline JS function, no library:
- < 1 min → "just now"
- < 1 hour → "Xm ago"
- < 24 hours → "Xh ago"
- < 7 days → "X days ago"
- < 30 days → "X weeks ago"
- otherwise → "X months ago"

### Performance — batched rendering

On initial render and after each search/filter change:

1. Render first 30 rows synchronously (visible above the fold immediately).
2. Schedule remaining rows in batches of 30 using `requestAnimationFrame`.
3. When search or filter changes: cancel any pending batch (via a generation counter), re-render from scratch with the new filtered list using the same batching approach.

This prevents the browser from blocking on a large DOM insert and eliminates scroll lag on first load.

### `generate-projects.js` — structural changes

- `scanProjects()`: add last-modified scan, sort by `lastModified` desc
- `generateHTML(projects)`: full replacement — flat list, pills, batched render
- `generateSummaryHTML()`: unchanged
- All other functions (`detectTechStack`, `getTechIcon`, `getTechColor`, `extractDescription`): unchanged

---

## Data Shape (per project object)

```js
{
  name: string,
  tech: string,
  icon: string,       // emoji
  color: string,      // hex
  description: string,
  path: string,       // file:// URL
  lastModified: number  // NEW — Unix ms timestamp
}
```
