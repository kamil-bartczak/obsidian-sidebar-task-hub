import { App, PluginSettingTab, Setting } from "obsidian";
import type SidebarTaskHubPlugin from "./main";
import { t } from "./i18n";

export interface TaskHubSettings {
  /** Folder paths (relative to vault root) to skip during scanning. One per entry. */
  excludedFolders: string[];
  /** Default state of the "Show completed" toggle when the view opens. */
  showDone: boolean;
  /** File paths hidden from the main task list via context menu. */
  hiddenFiles: string[];
  /** Task identifiers hidden via context menu. Format: "filePath::taskText" */
  hiddenTasks: string[];
}

export const DEFAULT_SETTINGS: TaskHubSettings = {
  excludedFolders: [],
  showDone: false,
  hiddenFiles: [],
  hiddenTasks: [],
};

export class TaskHubSettingTab extends PluginSettingTab {
  private plugin: SidebarTaskHubPlugin;

  constructor(app: App, plugin: SidebarTaskHubPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: t("settingsTitle") });

    new Setting(containerEl)
      .setName(t("excludedFolders"))
      .setDesc(t("excludedFoldersDesc"))
      .addTextArea((ta) => {
        ta.setPlaceholder(t("excludedFoldersPlaceholder"))
          .setValue(this.plugin.settings.excludedFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          });
        ta.inputEl.rows = 6;
        ta.inputEl.style.width = "100%";
        ta.inputEl.style.resize = "vertical";
      });

    new Setting(containerEl)
      .setName(t("showDoneDefault"))
      .setDesc(t("showDoneDefaultDesc"))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showDone)
          .onChange(async (value) => {
            this.plugin.settings.showDone = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
