import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownView,
  Notice,
  setIcon,
  debounce,
  Menu,
} from "obsidian";
import type SidebarTaskHubPlugin from "./main";
import { t as tr } from "./i18n";

export const VIEW_TYPE_TASK_HUB = "task-hub-view";

type ViewMode = "focus" | "files" | "tags";

interface TaskItem {
  filePath: string;
  fileName: string;
  line: number;
  textCh: number;
  text: string;
  done: boolean;
  heading: string | null;
  indent: number;
  parentLine: number | null;
  children: TaskItem[];
  /** Tags extracted from task text */
  tags: string[];
}

export class TaskHubView extends ItemView {
  private plugin: SidebarTaskHubPlugin;
  private tasks: TaskItem[] = [];
  private filterText = "";
  private showDone: boolean;
  private searchVisible = false;
  private viewMode: ViewMode = "files";
  private activeFolder: string | null = null;
  private listEl!: HTMLElement;
  private searchWrapper!: HTMLElement;
  private collapsed = new Set<string>();

  // Navbar button references for toggling active state
  private btnFocus!: HTMLElement;
  private btnFiles!: HTMLElement;
  private btnTags!: HTMLElement;
  private btnSearch!: HTMLElement;
  private btnDone!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: SidebarTaskHubPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.showDone = plugin.settings.showDone;
  }

  getViewType() {
    return VIEW_TYPE_TASK_HUB;
  }

  getDisplayText() {
    return tr("taskHub");
  }

  getIcon() {
    return "list-todo";
  }

  async onOpen() {
    const container = this.contentEl;
    container.addClass("task-hub-root");

    // ── Navbar ────────────────────────────────────────────────────────────
    const nav = container.createDiv({ cls: "task-hub-nav" });

    const navLeft = nav.createDiv({ cls: "task-hub-nav-group" });
    this.btnFiles = this.createNavBtn(navLeft, "list", tr("filesView"), () => {
      this.viewMode = "files";
      this.updateNavState();
      this.renderTaskList();
    });
    this.btnFocus = this.createNavBtn(navLeft, "folder-open", tr("focusView"), () => {
      this.viewMode = "focus";
      this.updateNavState();
      this.renderTaskList();
    });
    this.btnTags = this.createNavBtn(navLeft, "tag", tr("tagsView"), () => {
      this.viewMode = "tags";
      this.updateNavState();
      this.renderTaskList();
    });

    const navRight = nav.createDiv({ cls: "task-hub-nav-group" });
    this.btnSearch = this.createNavBtn(navRight, "search", tr("toggleSearch"), () => {
      this.searchVisible = !this.searchVisible;
      this.searchWrapper.toggleClass("is-hidden", !this.searchVisible);
      this.updateNavState();
      if (this.searchVisible) {
        const input = this.searchWrapper.querySelector<HTMLInputElement>("input");
        if (input) input.focus();
      } else {
        this.filterText = "";
        const input = this.searchWrapper.querySelector<HTMLInputElement>("input");
        if (input) input.value = "";
        this.renderTaskList();
      }
    });
    this.btnDone = this.createNavBtn(
      navRight,
      "check-circle",
      tr("toggleCompleted"),
      () => {
        this.showDone = !this.showDone;
        this.updateNavState();
        this.renderTaskList();
      }
    );

    this.updateNavState();

    // ── Search (hidden by default) ────────────────────────────────────────
    this.searchWrapper = container.createDiv({
      cls: "task-hub-controls",
    });
    this.searchWrapper.addClass("is-hidden");

    const searchContainer = this.searchWrapper.createDiv({
      cls: "search-input-container",
    });
    const filterInput = searchContainer.createEl("input", {
      cls: "search-input",
      attr: { type: "search", placeholder: tr("filterPlaceholder") },
    });
    const clearBtn = searchContainer.createDiv({
      cls: "search-input-clear-button",
    });
    clearBtn.addClass("is-hidden");

    filterInput.addEventListener("input", () => {
      this.filterText = filterInput.value;
      clearBtn.toggleClass("is-hidden", !this.filterText);
      this.renderTaskList();
    });

    clearBtn.addEventListener("click", () => {
      this.filterText = "";
      filterInput.value = "";
      clearBtn.addClass("is-hidden");
      this.renderTaskList();
    });

    // ── Scrollable task list ──────────────────────────────────────────────
    this.listEl = container.createDiv({ cls: "task-hub-list" });

    // ── Vault events ──────────────────────────────────────────────────────
    const debouncedRefresh = debounce(this.refresh.bind(this), 500, true);
    this.registerEvent(this.app.vault.on("modify", debouncedRefresh));
    this.registerEvent(this.app.vault.on("create", debouncedRefresh));
    this.registerEvent(this.app.vault.on("delete", debouncedRefresh));
    this.registerEvent(this.app.vault.on("rename", debouncedRefresh));

    // Track active file for focus view
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const file = this.app.workspace.getActiveFile();
        const folder = file ? this.topLevelFolder(file.path) : null;
        if (folder !== this.activeFolder) {
          this.activeFolder = folder;
          if (this.viewMode === "focus") this.renderTaskList();
        }
      })
    );
    this.activeFolder = this.app.workspace.getActiveFile()
      ? this.topLevelFolder(this.app.workspace.getActiveFile()!.path)
      : null;

    await this.refresh();
  }

  private createNavBtn(
    parent: HTMLElement,
    icon: string,
    tooltip: string,
    onClick: () => void,
  ): HTMLElement {
    const btn = parent.createDiv({ cls: "task-hub-nav-btn" });
    btn.ariaLabel = tooltip;
    btn.setAttribute("data-tooltip-position", "bottom");
    setIcon(btn, icon);
    btn.addEventListener("click", onClick);
    return btn;
  }

  private updateNavState() {
    this.btnFocus.toggleClass("is-active", this.viewMode === "focus");
    this.btnFiles.toggleClass("is-active", this.viewMode === "files");
    this.btnTags.toggleClass("is-active", this.viewMode === "tags");
    this.btnSearch.toggleClass("is-active", this.searchVisible);
    this.btnDone.toggleClass("is-active", this.showDone);
  }

  async refresh() {
    this.tasks = await scanAllTasks(this.plugin);
    this.renderTaskList();
  }

  private taskKey(t: TaskItem): string {
    return `${t.filePath}::${t.text}`;
  }

  private filterChildren(children: TaskItem[], parentDone: boolean): TaskItem[] {
    if (this.showDone || parentDone) return children;
    return children.filter((c) => !c.done);
  }

  /**
   * Collect top-level task "shells" that contain only hidden descendants.
   * Preserves the parent hierarchy so the hidden section shows
   * File → Parent Task → Hidden Subtask instead of File → Hidden Subtask.
   */
  private collectHiddenSubtaskTrees(tasks: TaskItem[], hiddenSet: Set<string>): TaskItem[] {
    const pruneToHidden = (list: TaskItem[]): TaskItem[] => {
      const result: TaskItem[] = [];
      for (const t of list) {
        if (hiddenSet.has(this.taskKey(t))) {
          // This task is directly hidden — include it (no children needed)
          result.push({ ...t, children: [], parentLine: t.parentLine });
        } else {
          // Check if any descendants are hidden
          const hiddenChildren = pruneToHidden(t.children);
          if (hiddenChildren.length > 0) {
            result.push({ ...t, children: hiddenChildren, parentLine: t.parentLine });
          }
        }
      }
      return result;
    };

    const result: TaskItem[] = [];
    for (const t of tasks) {
      const hiddenChildren = pruneToHidden(t.children);
      if (hiddenChildren.length > 0) {
        // Create a shell of the top-level task with only hidden descendant branches
        result.push({ ...t, children: hiddenChildren, parentLine: null });
      }
    }
    return result;
  }

  /** Remove hidden subtasks from children arrays (recursive) */
  private stripHiddenSubtasks(tasks: TaskItem[]): TaskItem[] {
    const hiddenTaskSet = new Set(this.plugin.settings.hiddenTasks);
    const strip = (list: TaskItem[]): TaskItem[] =>
      list
        .filter((t) => !hiddenTaskSet.has(this.taskKey(t)))
        .map((t) => {
          if (t.children.length === 0) return t;
          const cleaned = strip(t.children);
          if (cleaned.length === t.children.length) return t;
          return { ...t, children: cleaned };
        });
    return strip(tasks);
  }

  // ── Main render dispatcher ──────────────────────────────────────────────
  private renderTaskList() {
    this.listEl.empty();

    const { hiddenFiles, hiddenTasks, hiddenFolders } = this.plugin.settings;
    const hiddenFileSet = new Set(hiddenFiles);
    const hiddenTaskSet = new Set(hiddenTasks);
    const hiddenFolderSet = new Set(hiddenFolders);

    // Separate top-level tasks into visible vs hidden
    const visible: TaskItem[] = [];
    const hidden: TaskItem[] = [];

    for (const t of this.tasks) {
      if (t.parentLine !== null) continue;

      if (
        hiddenFolderSet.has(this.topLevelFolder(t.filePath)) ||
        hiddenFileSet.has(t.filePath) ||
        hiddenTaskSet.has(this.taskKey(t))
      ) {
        hidden.push(t);
        continue;
      }
      if (!this.showDone && t.done) continue;
      visible.push(t);
    }

    // Apply text filter
    const filtered = visible.filter((t) => {
      if (!this.filterText.trim()) return true;
      const q = this.filterText.toLowerCase();
      return (
        t.text.toLowerCase().includes(q) ||
        t.filePath.toLowerCase().includes(q) ||
        (t.heading ?? "").toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        this.subtreeMatchesFilter(t, q)
      );
    });

    if (filtered.length === 0 && hidden.length === 0) {
      this.renderEmpty();
      return;
    }

    // In focus mode, filter to the active folder only
    const displayed = this.viewMode === "focus"
      ? filtered.filter((t) => this.topLevelFolder(t.filePath) === (this.activeFolder ?? ""))
      : filtered;

    if (displayed.length > 0) {
      if (this.viewMode === "tags") {
        this.renderTagView(displayed);
      } else if (this.viewMode === "focus") {
        this.renderFocusView(displayed);
      } else {
        this.renderFileView(displayed, false);
      }
    } else if (hidden.length === 0) {
      this.renderEmpty();
    }

    // Collect parent shells containing hidden subtasks (preserves hierarchy)
    const hiddenSubtaskTrees = this.collectHiddenSubtaskTrees(visible, hiddenTaskSet);
    const allHidden = [...hidden, ...hiddenSubtaskTrees];

    // Hidden section
    if (allHidden.length > 0) {
      this.renderHiddenSection(allHidden);
    }
  }

  private renderEmpty() {
    const empty = this.listEl.createDiv({ cls: "task-hub-empty" });
    setIcon(empty.createSpan(), "inbox");
    empty.createSpan({ text: ` ${tr("noTasksFound")}` });
  }

  private subtreeMatchesFilter(t: TaskItem, q: string): boolean {
    for (const child of t.children) {
      if (
        child.text.toLowerCase().includes(q) ||
        child.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        this.subtreeMatchesFilter(child, q)
      ) {
        return true;
      }
    }
    return false;
  }

  private countSubtree(t: TaskItem): { total: number; done: number } {
    let total = 1;
    let done = t.done ? 1 : 0;
    for (const child of t.children) {
      const c = this.countSubtree(child);
      total += c.total;
      done += c.done;
    }
    return { total, done };
  }

  /** Extract the top-level folder from a file path, or "" for vault root */
  private topLevelFolder(filePath: string): string {
    const idx = filePath.indexOf("/");
    return idx === -1 ? "" : filePath.slice(0, idx);
  }

  // ── Focus view (active folder, no folder grouping) ─────────────────────
  private renderFocusView(tasks: TaskItem[]) {
    // Group by file directly (skip folder layer)
    const fileOrder: string[] = [];
    const byFile = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (!byFile.has(t.filePath)) {
        fileOrder.push(t.filePath);
        byFile.set(t.filePath, []);
      }
      byFile.get(t.filePath)!.push(t);
    }
    fileOrder.sort((a, b) => a.localeCompare(b));

    for (const filePath of fileOrder) {
      this.renderFileGroup(this.listEl, filePath, byFile.get(filePath)!, false);
    }
  }

  // ── File view (default) ─────────────────────────────────────────────────
  private renderFileView(
    tasks: TaskItem[],
    isHidden: boolean,
    parentEl?: HTMLElement,
  ) {
    const container = parentEl ?? this.listEl;

    // Group tasks by top-level folder
    const folderOrder: string[] = [];
    const byFolder = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      const folder = this.topLevelFolder(t.filePath);
      if (!byFolder.has(folder)) {
        folderOrder.push(folder);
        byFolder.set(folder, []);
      }
      byFolder.get(folder)!.push(t);
    }
    folderOrder.sort((a, b) => a.localeCompare(b));

    for (const folder of folderOrder) {
      const folderTasks = byFolder.get(folder)!;
      this.renderFolderGroup(container, folder, folderTasks, isHidden);
    }
  }

  // ── Folder-level collapsible ────────────────────────────────────────────
  private renderFolderGroup(
    container: HTMLElement,
    folder: string,
    tasks: TaskItem[],
    isHidden: boolean,
  ) {
    const collapseKey = (isHidden ? "hidden:folder:" : "folder:") + (folder || "__root__");
    const details = container.createEl("details", {
      cls: "task-hub-folder-group",
    });
    if (!this.collapsed.has(collapseKey)) details.setAttr("open", "");

    details.addEventListener("toggle", () => {
      if (details.open) this.collapsed.delete(collapseKey);
      else this.collapsed.add(collapseKey);
    });

    const summary = details.createEl("summary", {
      cls: "task-hub-folder-summary",
    });
    setIcon(summary.createSpan({ cls: "task-hub-chevron" }), "chevron-right");
    setIcon(summary.createSpan({ cls: "task-hub-folder-icon" }), "folder");

    const folderName = folder || tr("rootFolder");
    summary.createSpan({ cls: "task-hub-folder-name", text: folderName });

    let totalCount = 0;
    let doneCount = 0;
    for (const t of tasks) {
      const c = this.countSubtree(t);
      totalCount += c.total;
      doneCount += c.done;
    }
    const badge = summary.createSpan({ cls: "task-hub-badge" });
    badge.setText(
      doneCount > 0 ? `${doneCount}/${totalCount}` : String(totalCount)
    );

    // Eye-off indicator + context menu for directly hidden folders
    const folderDirectlyHidden = isHidden &&
      this.plugin.settings.hiddenFolders.includes(folder);

    if (folderDirectlyHidden) {
      setIcon(summary.createSpan({ cls: "task-hub-hidden-indicator" }), "eye-off");
    }

    summary.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new Menu();
      if (folderDirectlyHidden) {
        menu.addItem((item) =>
          item.setTitle(tr("unhideFolder")).setIcon("eye").onClick(async () => {
            this.plugin.settings.hiddenFolders =
              this.plugin.settings.hiddenFolders.filter((f) => f !== folder);
            await this.plugin.saveSettings();
          })
        );
      } else if (!isHidden) {
        menu.addItem((item) =>
          item.setTitle(tr("hideFolder")).setIcon("eye-off").onClick(async () => {
            if (!this.plugin.settings.hiddenFolders.includes(folder)) {
              this.plugin.settings.hiddenFolders.push(folder);
            }
            await this.plugin.saveSettings();
          })
        );
      }
      menu.showAtMouseEvent(e);
    });

    const body = details.createDiv({ cls: "task-hub-folder-body" });

    // Group files within this folder
    const fileOrder: string[] = [];
    const byFile = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (!byFile.has(t.filePath)) {
        fileOrder.push(t.filePath);
        byFile.set(t.filePath, []);
      }
      byFile.get(t.filePath)!.push(t);
    }
    fileOrder.sort((a, b) => a.localeCompare(b));

    for (const filePath of fileOrder) {
      this.renderFileGroup(body, filePath, byFile.get(filePath)!, isHidden);
    }
  }

  private renderFileGroup(
    container: HTMLElement,
    filePath: string,
    tasks: TaskItem[],
    isHidden: boolean,
  ) {
    const collapseKey = (isHidden ? "hidden:" : "") + filePath;
    const details = container.createEl("details", {
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

    let totalCount = 0;
    let doneCount = 0;
    for (const t of tasks) {
      const c = this.countSubtree(t);
      totalCount += c.total;
      doneCount += c.done;
    }
    const badge = summary.createSpan({ cls: "task-hub-badge" });
    badge.setText(
      doneCount > 0 ? `${doneCount}/${totalCount}` : String(totalCount)
    );

    // Eye-off indicator + context menu for files
    const fileDirectlyHidden = isHidden &&
      this.plugin.settings.hiddenFiles.includes(filePath);

    if (fileDirectlyHidden) {
      setIcon(summary.createSpan({ cls: "task-hub-hidden-indicator" }), "eye-off");
    }

    this.addFileSummaryContextMenu(summary, filePath, isHidden, fileDirectlyHidden);

    // Group by heading
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
        this.renderFlatTaskList(body, headingTasks, isHidden);
      } else {
        this.renderHeadingGroup(body, filePath, heading, headingTasks, isHidden);
      }
    }
  }

  private renderHeadingGroup(
    parent: HTMLElement,
    filePath: string,
    heading: string,
    tasks: TaskItem[],
    isHidden: boolean,
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

    let totalCount = 0;
    let doneCount = 0;
    for (const t of tasks) {
      const c = this.countSubtree(t);
      totalCount += c.total;
      doneCount += c.done;
    }
    const badge = summary.createSpan({ cls: "task-hub-badge" });
    badge.setText(
      doneCount > 0 ? `${doneCount}/${totalCount}` : String(totalCount)
    );

    this.renderFlatTaskList(details, tasks, isHidden);
  }

  // ── Tag view ────────────────────────────────────────────────────────────
  private renderTagView(tasks: TaskItem[]) {
    // Collect all tasks (including subtrees) with their tags
    const allFlat = this.collectAllTasks(tasks);

    const byTag = new Map<string, TaskItem[]>();
    const untagged: TaskItem[] = [];

    for (const t of allFlat) {
      if (t.tags.length === 0) {
        untagged.push(t);
      } else {
        for (const tag of t.tags) {
          if (!byTag.has(tag)) byTag.set(tag, []);
          byTag.get(tag)!.push(t);
        }
      }
    }

    const tagOrder = [...byTag.keys()].sort((a, b) => a.localeCompare(b));

    for (const tag of tagOrder) {
      this.renderTagGroup(tag, byTag.get(tag)!);
    }

    if (untagged.length > 0) {
      this.renderTagGroup(tr("untagged"), untagged);
    }
  }

  /** Collect all tasks from tree into flat array (top-level + visible children) */
  private collectAllTasks(tasks: TaskItem[]): TaskItem[] {
    const result: TaskItem[] = [];
    for (const t of tasks) {
      result.push(t);
      if (t.children.length > 0) {
        const children = this.filterChildren(t.children, t.done);
        result.push(...this.collectAllTasks(children));
      }
    }
    return result;
  }

  private renderTagGroup(tag: string, tasks: TaskItem[]) {
    const collapseKey = `tag:${tag}`;
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
    setIcon(summary.createSpan({ cls: "task-hub-file-icon" }), "tag");

    summary.createSpan({ cls: "task-hub-file-name", text: tag });

    const doneCount = tasks.filter((t) => t.done).length;
    const badge = summary.createSpan({ cls: "task-hub-badge" });
    badge.setText(
      doneCount > 0 ? `${doneCount}/${tasks.length}` : String(tasks.length)
    );

    const body = details.createDiv({ cls: "task-hub-file-body" });

    // In tag view, render flat (no subtask nesting — tasks are already flattened)
    const ul = body.createEl("ul", { cls: "task-hub-items" });
    for (const t of tasks) {
      this.renderTaskLi(ul, t, 0, false, false);
    }
  }

  // ── Recursive task list (subtasks collapsible under parents) ─────────────
  private renderFlatTaskList(
    parent: HTMLElement,
    tasks: TaskItem[],
    isHidden: boolean,
  ) {
    // Don't strip hidden subtasks in the hidden section — we want to show them there
    const effective = isHidden ? tasks : this.stripHiddenSubtasks(tasks);
    const ul = parent.createEl("ul", { cls: "task-hub-items" });
    this.renderTasksRecursive(ul, effective, 0, false, isHidden);
  }

  private renderTasksRecursive(
    ul: HTMLElement,
    tasks: TaskItem[],
    depth: number,
    parentDone: boolean,
    isHidden: boolean,
  ) {
    for (const t of tasks) {
      const visibleChildren = this.filterChildren(t.children, t.done || parentDone);
      if (visibleChildren.length > 0) {
        // Collapsible parent task
        const collapseKey = `task:${t.filePath}:${t.line}`;
        const li = ul.createEl("li", {
          cls: "task-hub-item task-hub-parent" +
            (t.done ? " is-done" : "") +
            (parentDone && !t.done ? " is-parent-done" : ""),
        });
        const details = li.createEl("details", { cls: "task-hub-subtask-group" });
        if (!this.collapsed.has(collapseKey)) details.setAttr("open", "");
        details.addEventListener("toggle", () => {
          if (details.open) this.collapsed.delete(collapseKey);
          else this.collapsed.add(collapseKey);
        });

        const summary = details.createEl("summary", { cls: "task-hub-subtask-summary" });
        setIcon(summary.createSpan({ cls: "task-hub-chevron" }), "chevron-right");

        // Checkbox
        const checkEl = summary.createSpan({ cls: "task-hub-check" });
        setIcon(checkEl, t.done ? "check-square" : "square");
        checkEl.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.toggleTask(t);
        });

        // Task text
        const textEl = summary.createSpan({ cls: "task-hub-text" });
        this.renderTextWithTags(textEl, t.text);
        textEl.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.openAtTask(t);
        });

        // Subtask count badge
        const counts = this.countSubtree(t);
        const childCount = counts.total - 1;
        const childDone = counts.done - (t.done ? 1 : 0);
        if (childCount > 0) {
          const badge = summary.createSpan({ cls: "task-hub-badge" });
          badge.setText(childDone > 0 ? `${childDone}/${childCount}` : String(childCount));
        }

        this.addTaskContextMenu(li, t, isHidden);

        // Render children
        const childUl = details.createEl("ul", { cls: "task-hub-items" });
        this.renderTasksRecursive(childUl, visibleChildren, depth + 1, t.done || parentDone, isHidden);
      } else {
        this.renderTaskLi(ul, t, depth, parentDone, isHidden);
      }
    }
  }

  private renderTaskLi(
    ul: HTMLElement,
    t: TaskItem,
    depth: number,
    parentDone: boolean,
    isHidden: boolean,
  ) {
    const li = ul.createEl("li", {
      cls:
        "task-hub-item" +
        (t.done ? " is-done" : "") +
        (parentDone && !t.done ? " is-parent-done" : ""),
    });

    // Checkbox
    const checkEl = li.createSpan({ cls: "task-hub-check" });
    setIcon(checkEl, t.done ? "check-square" : "square");
    checkEl.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.toggleTask(t);
    });

    // Task text with tag pills
    const textEl = li.createSpan({ cls: "task-hub-text" });
    this.renderTextWithTags(textEl, t.text);
    textEl.addEventListener("click", () => { void this.openAtTask(t); });

    this.addTaskContextMenu(li, t, isHidden);
  }

  private addTaskContextMenu(el: HTMLElement, t: TaskItem, isHidden: boolean) {
    const taskDirectlyHidden = isHidden &&
      this.plugin.settings.hiddenTasks.includes(this.taskKey(t));

    if (taskDirectlyHidden) {
      setIcon(el.createSpan({ cls: "task-hub-hidden-indicator" }), "eye-off");
    }

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menu = new Menu();
      if (taskDirectlyHidden) {
        menu.addItem((item) =>
          item.setTitle(tr("unhideTask")).setIcon("eye").onClick(async () => {
            const key = this.taskKey(t);
            this.plugin.settings.hiddenTasks =
              this.plugin.settings.hiddenTasks.filter((k) => k !== key);
            await this.plugin.saveSettings();
          })
        );
      } else if (!isHidden) {
        menu.addItem((item) =>
          item.setTitle(tr("hideTask")).setIcon("eye-off").onClick(async () => {
            const key = this.taskKey(t);
            if (!this.plugin.settings.hiddenTasks.includes(key)) {
              this.plugin.settings.hiddenTasks.push(key);
            }
            await this.plugin.saveSettings();
          })
        );
      }
      menu.showAtMouseEvent(e);
    });
  }

  // ── Hidden section ──────────────────────────────────────────────────────
  private renderHiddenSection(hidden: TaskItem[]) {
    const details = this.listEl.createEl("details", {
      cls: "task-hub-hidden-section",
    });
    const summary = details.createEl("summary", {
      cls: "task-hub-hidden-summary",
    });
    setIcon(summary.createSpan({ cls: "task-hub-chevron" }), "chevron-right");
    setIcon(summary.createSpan({ cls: "task-hub-hidden-icon" }), "eye-off");
    summary.createSpan({ text: `${tr("hidden")} (${hidden.length})` });

    const hiddenBody = details.createDiv({ cls: "task-hub-hidden-body" });
    this.renderFileView(hidden, true, hiddenBody);
  }

  private addFileSummaryContextMenu(
    summary: HTMLElement,
    filePath: string,
    isHidden: boolean,
    directlyHidden: boolean,
  ) {
    summary.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new Menu();
      if (directlyHidden) {
        menu.addItem((item) =>
          item.setTitle(tr("unhideFile")).setIcon("eye").onClick(async () => {
            this.plugin.settings.hiddenFiles =
              this.plugin.settings.hiddenFiles.filter((f) => f !== filePath);
            this.plugin.settings.hiddenTasks =
              this.plugin.settings.hiddenTasks.filter(
                (k) => !k.startsWith(filePath + "::")
              );
            await this.plugin.saveSettings();
          })
        );
      } else if (!isHidden) {
        menu.addItem((item) =>
          item.setTitle(tr("hideFile")).setIcon("eye-off").onClick(async () => {
            if (!this.plugin.settings.hiddenFiles.includes(filePath)) {
              this.plugin.settings.hiddenFiles.push(filePath);
            }
            await this.plugin.saveSettings();
          })
        );
      }
      menu.showAtMouseEvent(e);
    });
  }

  // ── Tag pill rendering ──────────────────────────────────────────────────
  private renderTextWithTags(el: HTMLElement, text: string) {
    const tagRe = /#[\w/-]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRe.exec(text)) !== null) {
      if (match.index > lastIndex) {
        el.appendText(text.slice(lastIndex, match.index));
      }
      el.createSpan({ cls: "task-hub-tag", text: match[0] });
      lastIndex = tagRe.lastIndex;
    }

    if (lastIndex < text.length) {
      el.appendText(text.slice(lastIndex));
    }
  }

  // ── Toggle done ─────────────────────────────────────────────────────────
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
  }

  // ── Navigate to task ───────────────────────────────────────────────────
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
      new Notice(tr("cannotNavigate"));
      return;
    }

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
  const tagRe = /#[\w/-]+/g;

  for (const f of files) {
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
    const fileTasks: TaskItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";

      const hm = /^(#{1,6})\s+(.+)$/.exec(line);
      if (hm) {
        currentHeading = (hm[2] ?? "").trim();
        continue;
      }

      const tm = /^(\s*)[-*+]\s*\[([ xX])\]\s+(.+)$/.exec(line);
      if (!tm) continue;

      const indent = (tm[1] ?? "").length;
      const prefixMatch = /^\s*[-*+]\s*\[[ xX]\]\s+/.exec(line);
      const textCh = prefixMatch ? prefixMatch[0].length : 0;
      const text = (tm[3] ?? "").trim();

      // Extract tags
      const tags: string[] = [];
      let tagMatch: RegExpExecArray | null;
      tagRe.lastIndex = 0;
      while ((tagMatch = tagRe.exec(text)) !== null) {
        tags.push(tagMatch[0]);
      }

      fileTasks.push({
        filePath: f.path,
        fileName: f.basename,
        line: i,
        textCh,
        text,
        done: (tm[2] ?? "").toLowerCase() === "x",
        heading: currentHeading,
        indent,
        parentLine: null,
        children: [],
        tags,
      });
    }

    // Build parent-child relationships
    const stack: TaskItem[] = [];
    for (const task of fileTasks) {
      while (stack.length > 0 && stack[stack.length - 1]!.indent >= task.indent) {
        stack.pop();
      }
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!;
        task.parentLine = parent.line;
        parent.children.push(task);
      }
      stack.push(task);
    }

    out.push(...fileTasks);
  }

  return out;
}
