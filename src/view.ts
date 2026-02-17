import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownView,
  Notice,
  setIcon,
  debounce,
} from "obsidian";
import type SidebarTaskHubPlugin from "./main";

export const VIEW_TYPE_TASK_HUB = "task-hub-view";

interface TaskItem {
  filePath: string;
  fileName: string;
  line: number;
  /** Column where the task text starts (after "- [ ] "), used for cursor placement */
  textCh: number;
  /** Plain task text, stripped of the markdown checkbox prefix */
  text: string;
  done: boolean;
  /** Last heading (text only) that precedes this task; null if none */
  heading: string | null;
}

export class TaskHubView extends ItemView {
  private plugin: SidebarTaskHubPlugin;
  private tasks: TaskItem[] = [];
  private filterText = "";
  private showDone: boolean;
  private listEl!: HTMLElement;
  /**
   * Tracks collapsed state for both file groups and heading groups.
   * Keys: filePath for file-level, `${filePath}\n${heading}` for heading-level.
   */
  private collapsed = new Set<string>();

  constructor(leaf: WorkspaceLeaf, plugin: SidebarTaskHubPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.showDone = plugin.settings.showDone;
  }

  getViewType() {
    return VIEW_TYPE_TASK_HUB;
  }

  getDisplayText() {
    return "Task Hub";
  }

  getIcon() {
    return "list-todo";
  }

  async onOpen() {
    const container = this.contentEl;
    container.addClass("task-hub-root");

    // ── Controls (rendered once, not recreated on filter changes) ──────────
    const controls = container.createDiv({ cls: "task-hub-controls" });

    // Search box – uses Obsidian's own search-input styling classes
    const searchWrapper = controls.createDiv({ cls: "search-input-container" });
    const filterInput = searchWrapper.createEl("input", {
      cls: "search-input",
      attr: { type: "search", placeholder: "Filter tasks…" },
    });
    const clearBtn = searchWrapper.createDiv({
      cls: "search-input-clear-button",
    });
    clearBtn.style.display = "none";

    filterInput.addEventListener("input", () => {
      this.filterText = filterInput.value;
      clearBtn.style.display = this.filterText ? "" : "none";
      this.renderTaskList();
    });

    clearBtn.addEventListener("click", () => {
      this.filterText = "";
      filterInput.value = "";
      clearBtn.style.display = "none";
      this.renderTaskList();
    });

    // Show-completed toggle
    const toggleRow = controls.createDiv({ cls: "task-hub-toggle-row" });
    const toggleLabel = toggleRow.createEl("label");
    const toggleCheck = toggleLabel.createEl("input", {
      attr: { type: "checkbox" },
    });
    toggleCheck.checked = this.showDone;
    toggleLabel.appendText(" Show completed");
    toggleCheck.addEventListener("change", () => {
      this.showDone = toggleCheck.checked;
      this.renderTaskList();
    });

    // ── Scrollable task list ───────────────────────────────────────────────
    this.listEl = container.createDiv({ cls: "task-hub-list" });

    // ── Vault events (debounced to avoid thrashing on batch saves) ─────────
    const debouncedRefresh = debounce(this.refresh.bind(this), 500, true);
    this.registerEvent(this.app.vault.on("modify", debouncedRefresh));
    this.registerEvent(this.app.vault.on("create", debouncedRefresh));
    this.registerEvent(this.app.vault.on("delete", debouncedRefresh));
    this.registerEvent(this.app.vault.on("rename", debouncedRefresh));

    await this.refresh();
  }

  async refresh() {
    this.tasks = await scanAllTasks(this.plugin);
    this.renderTaskList();
  }

  // ── Task list renderer (called on filter changes / data refresh) ─────────
  private renderTaskList() {
    this.listEl.empty();

    const filtered = this.tasks.filter((t) => {
      if (!this.showDone && t.done) return false;
      if (!this.filterText.trim()) return true;
      const q = this.filterText.toLowerCase();
      return (
        t.text.toLowerCase().includes(q) ||
        t.filePath.toLowerCase().includes(q) ||
        (t.heading ?? "").toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      const empty = this.listEl.createDiv({ cls: "task-hub-empty" });
      setIcon(empty.createSpan(), "inbox");
      empty.createSpan({ text: " No tasks found" });
      return;
    }

    // Group by file (alphabetical)
    const fileOrder: string[] = [];
    const byFile = new Map<string, TaskItem[]>();
    for (const t of filtered) {
      if (!byFile.has(t.filePath)) {
        fileOrder.push(t.filePath);
        byFile.set(t.filePath, []);
      }
      byFile.get(t.filePath)!.push(t);
    }
    fileOrder.sort((a, b) => a.localeCompare(b));

    for (const filePath of fileOrder) {
      this.renderFileGroup(filePath, byFile.get(filePath)!);
    }
  }

  // ── File-level collapsible ───────────────────────────────────────────────
  private renderFileGroup(filePath: string, tasks: TaskItem[]) {
    const collapseKey = filePath;
    const details = this.listEl.createEl("details", {
      cls: "task-hub-file-group",
    });
    if (!this.collapsed.has(collapseKey)) details.setAttr("open", "");

    details.addEventListener("toggle", () => {
      if (details.open) this.collapsed.delete(collapseKey);
      else this.collapsed.add(collapseKey);
    });

    const summary = details.createEl("summary", {
      cls: "task-hub-file-summary",
    });
    setIcon(summary.createSpan({ cls: "task-hub-chevron" }), "chevron-right");
    setIcon(summary.createSpan({ cls: "task-hub-file-icon" }), "file-text");

    const fileName =
      filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
    summary.createSpan({ cls: "task-hub-file-name", text: fileName });

    const doneCount = tasks.filter((t) => t.done).length;
    const badge = summary.createSpan({ cls: "task-hub-badge" });
    badge.setText(
      doneCount > 0 ? `${doneCount}/${tasks.length}` : String(tasks.length)
    );

    // Group tasks within this file by heading (preserving document order)
    const headingOrder: Array<string | null> = [];
    const byHeading = new Map<string | null, TaskItem[]>();
    for (const t of tasks) {
      if (!byHeading.has(t.heading)) {
        headingOrder.push(t.heading);
        byHeading.set(t.heading, []);
      }
      byHeading.get(t.heading)!.push(t);
    }

    const body = details.createDiv({ cls: "task-hub-file-body" });

    for (const heading of headingOrder) {
      const headingTasks = byHeading.get(heading)!;
      if (heading === null) {
        this.renderTaskItems(body, headingTasks);
      } else {
        this.renderHeadingGroup(body, filePath, heading, headingTasks);
      }
    }
  }

  // ── Heading-level collapsible ────────────────────────────────────────────
  private renderHeadingGroup(
    parent: HTMLElement,
    filePath: string,
    heading: string,
    tasks: TaskItem[]
  ) {
    const collapseKey = `${filePath}\n${heading}`;
    const details = parent.createEl("details", {
      cls: "task-hub-heading-group",
    });
    if (!this.collapsed.has(collapseKey)) details.setAttr("open", "");

    details.addEventListener("toggle", () => {
      if (details.open) this.collapsed.delete(collapseKey);
      else this.collapsed.add(collapseKey);
    });

    const summary = details.createEl("summary", {
      cls: "task-hub-heading-summary",
    });
    setIcon(summary.createSpan({ cls: "task-hub-chevron" }), "chevron-right");
    setIcon(summary.createSpan({ cls: "task-hub-heading-icon" }), "hash");
    summary.createSpan({ cls: "task-hub-heading-name", text: heading });

    const doneCount = tasks.filter((t) => t.done).length;
    const badge = summary.createSpan({ cls: "task-hub-badge" });
    badge.setText(
      doneCount > 0 ? `${doneCount}/${tasks.length}` : String(tasks.length)
    );

    this.renderTaskItems(details, tasks);
  }

  // ── Task <ul> ────────────────────────────────────────────────────────────
  private renderTaskItems(parent: HTMLElement, tasks: TaskItem[]) {
    const ul = parent.createEl("ul", { cls: "task-hub-items" });

    for (const t of tasks) {
      const li = ul.createEl("li", {
        cls: "task-hub-item" + (t.done ? " is-done" : ""),
      });

      // Checkbox icon – click toggles done state without navigating
      const checkEl = li.createSpan({ cls: "task-hub-check" });
      setIcon(checkEl, t.done ? "check-square" : "square");
      checkEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleTask(t);
      });

      // Task text – click navigates to the line in the editor
      const textEl = li.createSpan({ cls: "task-hub-text", text: t.text });
      textEl.addEventListener("click", () => this.openAtTask(t));
    }
  }

  // ── Toggle done state directly in the file ───────────────────────────────
  private async toggleTask(t: TaskItem) {
    const af = this.app.vault.getAbstractFileByPath(t.filePath);
    if (!(af instanceof TFile)) return;

    await this.app.vault.process(af, (content) => {
      const lines = content.split("\n");
      const line = lines[t.line] ?? "";
      lines[t.line] = t.done
        ? line.replace(/\[x\]/i, "[ ]")
        : line.replace(/\[ \]/, "[x]");
      return lines.join("\n");
    });
    // vault "modify" event triggers the debounced refresh automatically
  }

  // ── Navigate to task line ────────────────────────────────────────────────
  private async openAtTask(t: TaskItem) {
    const af = this.app.vault.getAbstractFileByPath(t.filePath);
    if (!(af instanceof TFile)) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(af, { active: true });

    const mdView =
      leaf.view instanceof MarkdownView
        ? leaf.view
        : this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView) {
      new Notice("Cannot navigate: open the file in editing view first.");
      return;
    }

    // Place cursor at the start of the task text (after "- [ ] "),
    // not at column 0 which would land on the checkbox and select it.
    mdView.editor.setCursor({ line: t.line, ch: t.textCh });
    mdView.editor.scrollIntoView(
      { from: { line: t.line, ch: t.textCh }, to: { line: t.line, ch: t.textCh } },
      true
    );
    mdView.editor.focus();
  }
}

// ── Vault scanner ────────────────────────────────────────────────────────────
async function scanAllTasks(plugin: SidebarTaskHubPlugin): Promise<TaskItem[]> {
  const app = plugin.app;
  const excluded = plugin.settings.excludedFolders;
  const files = app.vault.getMarkdownFiles();
  const out: TaskItem[] = [];

  for (const f of files) {
    // Skip files inside excluded folders
    if (
      excluded.some((folder) => {
        const prefix = folder.endsWith("/") ? folder : folder + "/";
        return f.path.startsWith(prefix);
      })
    ) {
      continue;
    }

    const content = await app.vault.cachedRead(f);
    const lines = content.split("\n");
    let currentHeading: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";

      // Track the most recent heading
      const hm = /^(#{1,6})\s+(.+)$/.exec(line);
      if (hm) {
        currentHeading = (hm[2] ?? "").trim();
        continue;
      }

      const tm = /^\s*-\s*\[([ xX])\]\s+(.+)$/.exec(line);
      if (!tm) continue;

      // Column where the task text starts (after "- [ ] " prefix)
      const prefixMatch = /^\s*-\s*\[[ xX]\]\s+/.exec(line);
      const textCh = prefixMatch ? prefixMatch[0].length : 0;

      out.push({
        filePath: f.path,
        fileName: f.basename,
        line: i,
        textCh,
        text: (tm[2] ?? "").trim(),
        done: (tm[1] ?? "").toLowerCase() === "x",
        heading: currentHeading,
      });
    }
  }

  return out;
}
