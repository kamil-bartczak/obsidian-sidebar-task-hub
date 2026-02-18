import { Plugin } from "obsidian";
import { TaskHubView, VIEW_TYPE_TASK_HUB } from "./view";
import {
  TaskHubSettings,
  DEFAULT_SETTINGS,
  TaskHubSettingTab,
} from "./settings";
import { t } from "./i18n";

export default class SidebarTaskHubPlugin extends Plugin {
  settings!: TaskHubSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_TASK_HUB,
      (leaf) => new TaskHubView(leaf, this)
    );

    this.addRibbonIcon("list-todo", t("taskHub"), () => this.activateView());

    this.addCommand({
      id: "open-task-hub-right",
      name: t("openTaskHub"),
      callback: () => this.activateView(),
    });

    this.addSettingTab(new TaskHubSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.activateView());
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASK_HUB);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh all open Task Hub views so new settings take effect immediately
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_HUB)) {
      if (leaf.view instanceof TaskHubView) {
        await leaf.view.refresh();
      }
    }
  }

  private async activateView() {
    const existingLeaf =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_HUB)[0];
    if (existingLeaf) {
      this.app.workspace.revealLeaf(existingLeaf);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({ type: VIEW_TYPE_TASK_HUB, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
