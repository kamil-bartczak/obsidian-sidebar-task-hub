# Sidebar Task Hub

An [Obsidian](https://obsidian.md) plugin that collects every checkbox task from your vault into a right-sidebar panel — grouped by folder, file, and heading, with three view modes, subtask support, and full interactivity.

---

## Views

### List view

The default view groups tasks by **folder → file → heading** with collapsible sections at every level. Subtasks are nested under their parent with a chevron toggle.

![List view](https://raw.githubusercontent.com/kamil-bartczak/obsidian-sidebar-task-hub/master/docs/list-view.png)

### Focus view

Shows only tasks from the **folder of the currently open file**. The view updates automatically when you switch to a file in a different folder. No folder grouping — just files and headings.

![Focus view](https://raw.githubusercontent.com/kamil-bartczak/obsidian-sidebar-task-hub/master/docs/folder-view.png)

### Tag view

Groups all tasks by their `#tags`. Tasks with multiple tags appear under each tag. Untagged tasks are collected in a separate group.

![Tag view](https://raw.githubusercontent.com/kamil-bartczak/obsidian-sidebar-task-hub/master/docs/tag-view.png)

---

## Features

- **Vault-wide task scanning** — finds every checkbox task (`- [ ]`, `* [ ]`, `+ [ ]`) across all Markdown files
- **Three view modes** — list (folder → file → heading), focus (active folder), and tag grouping
- **Subtask support** — indented tasks are displayed as collapsible subtasks with correct hierarchy
- **Tag pills** — `#tags` in task text are rendered as styled pill badges
- **Toggle done in-place** — click the checkbox to mark a task complete or incomplete; the file updates instantly
- **Click to navigate** — click any task text to open the file and jump to the exact line
- **Live search** — filter by task text, file name, heading, or tag
- **Hide tasks, files, and folders** — right-click to hide items; hidden items are collected in a collapsible section at the bottom with unhide support
- **Collapsed state is remembered** — expand/collapse groups and the state survives re-scans
- **Smart done filtering** — done parent tasks with undone subtasks stay visible when "show completed" is off
- **Internationalization** — 14 languages auto-detected from browser locale (EN, PL, DE, FR, ES, PT, IT, RU, UK, ZH, JA, KO, AR, TR)
- **Theme-native styling** — uses Obsidian CSS variables; works with any community theme, light or dark
- **Mobile-compatible** — works on both desktop and mobile

---

## Usage

Once enabled, the panel opens automatically in the **right sidebar**. You can also open it via:

- The ribbon icon (left sidebar, `list-todo` icon)
- Command palette: **Open Task Hub (right sidebar)**

### Navbar

| Button | Action |
|---|---|
| List icon | Switch to list view (folder → file → heading) |
| Folder icon | Switch to focus view (active folder only) |
| Tag icon | Switch to tag view (grouped by #tags) |
| Search icon | Toggle the search/filter input |
| Check-circle icon | Toggle visibility of completed tasks |

### Interactions

| Action | Result |
|---|---|
| Click checkbox | Toggle the task done/undone in the source file |
| Click task text | Open the file and jump to the exact line |
| Click chevron (▶) | Collapse/expand a group or parent task |
| Right-click task | Hide/unhide the task |
| Right-click file header | Hide/unhide the file |
| Right-click folder header | Hide/unhide the folder |

---

## Installation

### Via Community Plugins (recommended)

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search for **Sidebar Task Hub**
3. Click **Install**, then **Enable**

### Via BRAT (beta testing)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, add: `kamil-bartczak/obsidian-sidebar-task-hub`

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/kamil-bartczak/obsidian-sidebar-task-hub/releases/latest)
2. Copy them to `<YourVault>/.obsidian/plugins/sidebar-task-hub/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

---

## Development

```bash
git clone https://github.com/kamil-bartczak/obsidian-sidebar-task-hub
cd obsidian-sidebar-task-hub
npm install
npm run dev      # watch mode
npm run lint     # ESLint (always run before build)
npm run build    # type-check + production build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder to test.

---

## License

[ISC](LICENSE) © License
