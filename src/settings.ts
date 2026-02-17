import { App, PluginSettingTab, Setting } from "obsidian";
import type SidebarTaskHubPlugin from "./main";

export interface TaskHubSettings {
  /** Folder paths (relative to vault root) to skip during scanning. One per entry. */
  excludedFolders: string[];
  /** Default state of the "Show completed" toggle when the view opens. */
  showDone: boolean;
}

export const DEFAULT_SETTINGS: TaskHubSettings = {
  excludedFolders: [],
  showDone: false,
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
    containerEl.createEl("h2", { text: "Sidebar Task Hub" });

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc(
        "One folder path per line (relative to vault root). " +
          "Files inside these folders are skipped when scanning for tasks."
      )
      .addTextArea((ta) => {
        ta.setPlaceholder("Templates\nArchive\nDaily Notes")
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
      .setName("Show completed tasks by default")
      .setDesc("Whether the 'Show completed' toggle is on when the panel first opens.")
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
