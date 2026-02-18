# Changelog

## 1.2.0

### New features

- **Folder grouping** — in file view, tasks are now grouped by top-level folder first, then by file and heading. Files in the vault root appear under a translated "Root" group. Only the first folder level is used (nested subfolders are flattened to the top-level parent).
- **Hide/unhide folders** — right-click a folder group to hide or unhide it via context menu. Hidden folders move to the "Hidden" section.
- **Hidden item indicators** — directly hidden items (folders, files, tasks) show an eye-off icon. Only directly hidden items offer "Unhide" in context menu — parent containers that appear in the hidden section due to their children don't show misleading unhide options.

## 1.1.1

- Fix all ESLint errors (floating promises, unsafe assignments, direct style manipulation, detachLeaves, manual HTML headings in settings).
- Use CSS classes instead of inline `style.display` and `style.paddingLeft`.
- Remove `onunload` detachLeaves per Obsidian guidelines.

## 1.1.0

### New features

- **Tag pill badges** — `#tags` in task text are rendered as styled pill badges for quick visual scanning.
- **Subtask support** — indented tasks are displayed as subtasks with visual hierarchy. When a parent task is completed, children are shown with strikethrough styling.
- **Hide tasks & files** — right-click any task or file group to hide it. Hidden items are collected in a collapsible "Hidden" section at the bottom. Right-click to unhide.
- **Tag view** — new view mode groups all tasks by their `#tag` instead of by file/heading. Switch between views using the navbar icons.
- **Navbar** — icon toolbar at the top of the panel (like other Obsidian sidebars) with buttons for: files view, tags view, search toggle, and show-completed toggle.
- **Internationalization (i18n)** — all UI strings are translated into 14 languages: English, Polish, German, French, Spanish, Portuguese, Italian, Russian, Ukrainian, Chinese (Simplified), Japanese, Korean, Arabic, and Turkish. Language is auto-detected from the browser locale.

## 1.0.1

- Support `*` and `+` bullet markers in task detection.

## 1.0.0

- Initial release.
