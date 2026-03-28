# Locus Semantic Search Integration

**Date:** 2026-03-28
**Status:** Approved

## Overview

Replace the current substring search in the Projects View dashboard with semantic search powered by a Locus instance at `https://locus.miguelaperez.dev/`. Indexing runs automatically as part of `generate-projects.js` using a hash-based cache to skip unchanged projects.

## Architecture

### Indexing (generate-projects.js)

After the project list is built, an async `syncToLocus()` function runs:

1. Load `.locus-cache.json` from the project root (maps `projectName → { docId, hash }`)
2. For each scanned project, compute an MD5 hash of `name + tech + description + readme` (README truncated to 2000 chars)
3. Compare hash against cache:
   - **New or changed** → POST document to Locus, store returned `doc_id` and new hash
   - **Unchanged** → skip
   - **Removed** (in cache but not scanned) → DELETE doc from Locus, remove cache entry
4. Show a terminal progress bar covering only the projects actually being synced
5. Write updated `.locus-cache.json`

**Document format per project:**
```
Project: <name>
Tech: <tech>
Description: <description>
Path: <path>

<README content, max 2000 chars>
```

**Skipped files:** Only `package.json` and `README.md` are read — same directories already skipped by the scanner (node_modules, .git, hidden dirs, etc.) apply here too.

**Locus space:** `projects`

**Locus endpoint:** `https://locus.miguelaperez.dev`

### Search (index.html)

- Search input sends `GET /spaces/projects/search?q=<query>&k=10` to Locus
- A thin animated progress bar appears under the search input while the request is in flight
- On success: render results returned by Locus (matched project names are looked up in the local project data for display)
- On any network error or timeout (3s): silently fall back to local substring match on `name + tech + description`
- Debounce: 300ms (increased from 150ms to reduce Locus API calls while typing)

## Cache File

- Location: `projects-view/.locus-cache.json`
- Added to `.gitignore`
- Format:
```json
{
  "my-app": { "docId": "abc123", "hash": "d41d8cd9..." },
  ...
}
```

## Error Handling

- If Locus is unreachable during indexing: print a warning, skip sync, continue generating HTML normally
- If Locus returns an error for a specific project: print a warning, skip that project, continue
- If Locus is unreachable during search: fall back to local substring match silently

## Out of Scope

- Indexing file contents beyond README.md
- Authentication on the Locus endpoint
- Per-project Locus spaces
