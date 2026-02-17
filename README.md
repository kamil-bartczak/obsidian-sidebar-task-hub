# Sidebar Task Hub

An [Obsidian](https://obsidian.md) plugin that collects every checkbox task from your vault into a right-sidebar panel — grouped by file and heading, filterable, and fully interactive.

![screenshot](https://raw.githubusercontent.com/your-github-username/obsidian-sidebar-task-hub/main/docs/screenshot.png)

---

## Features

- **Vault-wide task view** — scans all Markdown files and surfaces every `- [ ]` and `- [x]` item in one place
- **Grouped by file → heading** — tasks are organized under the last heading they appear below, with collapsible sections at both levels
- **Toggle done without leaving the panel** — click the checkbox icon to mark a task complete (or un-complete) directly in the panel; the file is updated instantly
- **Click to navigate** — click the task text to open the file and place the cursor exactly on that line
- **Live filter** — type in the search box to filter by task text, file name, or heading
- **Collapsed state is remembered** — expand/collapse groups and the state survives re-scans
- **Excluded folders** — configure folders to skip (e.g. `Templates`, `Archive`) so the scan stays fast and noise-free
- **Theme-native styling** — uses Obsidian CSS variables; works with any community theme, light or dark
- **Mobile-compatible** — `isDesktopOnly: false`

---

## Usage

Once enabled, the panel opens automatically in the **right sidebar** with the `list-todo` icon. You can also open it via:

- The ribbon icon (top-right of the sidebar)
- Command palette: **Open Task Hub (right sidebar)**

### Panel controls

| Control | Action |
|---|---|
| Search box | Filter tasks by text, file name, or heading |
| Show completed toggle | Include / hide `[x]` tasks |
| ▶ File header | Collapse / expand all tasks from that file |
| ▶ Heading | Collapse / expand tasks under that heading |
| Checkbox icon | Toggle the task done state in-place |
| Task text | Open the file and jump to the exact line |

---

## Settings

Go to **Settings → Community plugins → Sidebar Task Hub**.

| Setting | Description |
|---|---|
| **Excluded folders** | One folder path per line (e.g. `Templates`). Files inside are skipped during scanning. |
| **Show completed by default** | Whether the "Show completed" toggle starts enabled when the panel opens. |

---

## Installation

### Via Community Plugins (recommended)

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search for **Sidebar Task Hub**
3. Click **Install**, then **Enable**

### Via BRAT (beta testing)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, add: `your-github-username/obsidian-sidebar-task-hub`

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/your-github-username/obsidian-sidebar-task-hub/releases/latest)
2. Copy them to `<YourVault>/.obsidian/plugins/sidebar-task-hub/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

---

## Development

```bash
git clone https://github.com/your-github-username/obsidian-sidebar-task-hub
cd obsidian-sidebar-task-hub
npm install
npm run dev      # watch mode
npm run build    # type-check + production build
npm run lint     # ESLint
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder to test.

---

## License

[ISC](LICENSE) © License
