import { beforeEach, describe, expect, it } from "vitest";
import { folderPickerManager } from "@/components/component-state-managers";

describe("folder picker manager", () => {
  beforeEach(() => {
    folderPickerManager.navigate("");
  });

  it("owns the inline new-folder draft", () => {
    const creationOperationId = folderPickerManager.startDirectoryCreation("/projects");
    folderPickerManager.setNewFolderName("new-project");

    expect(folderPickerManager.getSnapshot()).toMatchObject({
      isCreatingDirectory: true,
      creationParentPath: "/projects",
      creationOperationId,
      newFolderName: "new-project",
    });
  });

  it("navigates into a created folder only while the matching request owns the draft", () => {
    const creationOperationId = folderPickerManager.startDirectoryCreation("/projects");
    folderPickerManager.completeDirectoryCreation(
      creationOperationId,
      "/somewhere-else",
      "/somewhere-else/new-project",
    );

    expect(folderPickerManager.getSnapshot().currentPath).toBe("");

    folderPickerManager.completeDirectoryCreation(
      creationOperationId,
      "/projects",
      "/projects/new-project",
    );

    expect(folderPickerManager.getSnapshot()).toMatchObject({
      currentPath: "/projects/new-project",
      search: "",
      isCreatingDirectory: false,
      creationParentPath: null,
      creationOperationId: null,
      newFolderName: "",
    });
  });

  it("ignores an older completion after the draft is reopened in the same parent", () => {
    const firstOperationId = folderPickerManager.startDirectoryCreation("/projects");
    folderPickerManager.cancelDirectoryCreation();
    const secondOperationId = folderPickerManager.startDirectoryCreation("/projects");
    folderPickerManager.setNewFolderName("second-project");

    folderPickerManager.completeDirectoryCreation(
      firstOperationId,
      "/projects",
      "/projects/first-project",
    );

    expect(folderPickerManager.getSnapshot()).toMatchObject({
      currentPath: "",
      isCreatingDirectory: true,
      creationOperationId: secondOperationId,
      newFolderName: "second-project",
    });
  });
});
