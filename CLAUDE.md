# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (incremental builds during development)
npm run build        # Type-check + production build (minified main.js)
npm run lint         # Run ESLint across src/
```

**After every code change, always run `npm run lint` first, then `npm run build`, and fix all errors before considering the task done.**

There is no automated test suite. Manual testing requires copying `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/sidebar-task-hub/`, then reloading Obsidian and enabling the plugin under **Settings → Community plugins**.

## Architecture

This is an Obsidian community plugin. TypeScript source in `src/` is bundled by esbuild into a single `main.js` at the repo root. Obsidian loads `main.js` directly.

### Source files

- **`src/main.ts`** — Plugin entry point. Registers the view type, ribbon icon, and the `open-task-hub-right` command. Should stay minimal; delegate all feature logic to other modules.
- **`src/view.ts`** — Contains `TaskHubView` (extends Obsidian's `ItemView`) and the standalone `scanAllTasks()` function. Handles all state (task list, filter text, show-done toggle, view mode, hiding), vault file watchers, UI rendering, and navigation to task locations.
- **`src/i18n.ts`** — Internationalization module. Exports `t(key)` for translated strings. Auto-detects locale from `navigator.language`. Supports 14 languages.
- **`src/settings.ts`** — `TaskHubSettings` interface and settings tab. Includes `excludedFolders`, `showDone`, `hiddenFiles`, and `hiddenTasks`.

### Data flow

1. Plugin loads → registers `TaskHubView` with ID `"task-hub-view"` → auto-activates it.
2. View opens → registers vault events (`modify`, `create`, `delete`, `rename`) → calls `scanAllTasks()`.
3. `scanAllTasks()` reads every `.md` file and extracts lines matching `^\s*-\s*\[( |x|X)\]\s+(.+)$`, returning `TaskItem[]` (each with `filePath`, `line`, `raw`, `done`).
4. `render()` builds the DOM: filter input, show-done checkbox, and a list of task items.
5. Clicking a task calls `openAtTask()`, which opens the file in the editor and scrolls/positions the cursor to the exact line.
6. Vault changes trigger `refresh()` → rescan → re-render.

### Key conventions

- Use `this.registerEvent(...)`, `this.registerDomEvent(...)`, and `this.registerInterval(...)` for all listeners so they're cleaned up on unload.
- Avoid Node/Electron APIs to preserve mobile compatibility (`isDesktopOnly: false`).
- Keep `main.ts` lifecycle-only; split new features into separate `src/` modules.
- Debounce expensive vault-scan operations triggered by file system events.
- Settings persistence: `this.loadData()` / `this.saveData()`.
- Command IDs are stable API — never rename them after release.

### Release artifacts

Only `main.js`, `manifest.json`, and `styles.css` are needed. Never commit `main.js` or `node_modules/` (both in `.gitignore`). To release: bump version in `manifest.json` and `versions.json` (or run `npm version`), then attach the three artifacts to a GitHub release tagged with the bare version number (no `v` prefix).

### Git conventions

- **NEVER** add `Co-Authored-By` to commit messages.
- Always run `npm run lint` before `npm run build`.

## Development workflow

When the user accepts implemented changes (features, bug fixes, refactors), finalize with these steps **in order**:

1. **Lint & build** — run `npm run lint`, then `npm run build`. Fix any errors.
2. **Bump version** — increment the version in `manifest.json` and add the new entry to `versions.json`. Use semver: patch for fixes, minor for features, major for breaking changes.
3. **Update CHANGELOG.md** — add a new section at the top with the version number and a concise summary of changes.
4. **Update new i18n strings** — if any new user-facing strings were added, add translations to `src/i18n.ts` for all supported languages.
5. **Commit** — stage all changed files and create a single commit with a clear message. **Never** add `Co-Authored-By`.
