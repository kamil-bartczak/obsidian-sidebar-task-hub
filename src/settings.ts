export interface TaskHubSettings {
  /** Folder paths (relative to vault root) to skip during scanning. One per entry. */
  excludedFolders: string[];
  /** Default state of the "Show completed" toggle when the view opens. */
  showDone: boolean;
  /** File paths hidden from the main task list via context menu. */
  hiddenFiles: string[];
  /** Task identifiers hidden via context menu. Format: "filePath::taskText" */
  hiddenTasks: string[];
  /** Top-level folder names hidden via context menu. "" for vault root. */
  hiddenFolders: string[];
}

export const DEFAULT_SETTINGS: TaskHubSettings = {
  excludedFolders: [],
  showDone: false,
  hiddenFiles: [],
  hiddenTasks: [],
  hiddenFolders: [],
};
