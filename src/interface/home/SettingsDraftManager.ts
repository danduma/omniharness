import { DEFAULT_SERVER_SETTINGS } from "./constants";
import { StateManager } from "@/lib/state-manager";

export type ServerSettingsValues = Record<string, string>;

export type SettingsDraftState = {
  baseline: ServerSettingsValues;
  draft: ServerSettingsValues;
  dirtyKeys: Set<string>;
  hydrated: boolean;
  fieldRevisions: Record<string, number>;
};

export type SettingsSaveOperation = {
  id: number;
  values: ServerSettingsValues;
  fieldRevisions: Record<string, number>;
};

function normalizeSettings(values: ServerSettingsValues = {}) {
  return {
    ...DEFAULT_SERVER_SETTINGS,
    ...values,
  };
}

function cloneDirtyKeys(dirtyKeys: Set<string>) {
  return new Set(dirtyKeys);
}

export class SettingsDraftManager extends StateManager<SettingsDraftState> {
  private nextRevision = 1;
  private nextOperationId = 1;

  constructor(initialValues: ServerSettingsValues = DEFAULT_SERVER_SETTINGS) {
    const normalized = normalizeSettings(initialValues);
    super({
      baseline: normalized,
      draft: normalized,
      dirtyKeys: new Set(),
      hydrated: false,
      fieldRevisions: {},
    });
  }

  hydrate(values: ServerSettingsValues, notify = true, mode: "refresh" | "replace" = "refresh") {
    const normalized = normalizeSettings(values);
    this.patch((current) => {
      if (!current.hydrated || mode === "replace") {
        return {
          baseline: normalized,
          draft: normalized,
          dirtyKeys: new Set(),
          hydrated: true,
          fieldRevisions: {},
        };
      }

      const draft = { ...current.draft };
      const dirtyKeys = cloneDirtyKeys(current.dirtyKeys);
      for (const key of new Set([...Object.keys(current.baseline), ...Object.keys(normalized)])) {
        if (!dirtyKeys.has(key)) {
          draft[key] = normalized[key] ?? "";
        } else if ((draft[key] ?? "") === (normalized[key] ?? "")) {
          dirtyKeys.delete(key);
        }
      }
      return { baseline: normalized, draft, dirtyKeys, hydrated: true };
    }, notify);
  }

  setField(key: string, value: string) {
    this.patch((current) => {
      const nextDraft = {
        ...current.draft,
        [key]: value,
      };
      const dirtyKeys = cloneDirtyKeys(current.dirtyKeys);

      if ((current.baseline[key] ?? "") === value) {
        dirtyKeys.delete(key);
      } else {
        dirtyKeys.add(key);
      }

      return {
        draft: nextDraft,
        dirtyKeys,
        fieldRevisions: { ...current.fieldRevisions, [key]: this.nextRevision++ },
      };
    });
  }

  patchFields(values: ServerSettingsValues) {
    this.patch((current) => {
      const draft = { ...current.draft, ...values };
      const dirtyKeys = cloneDirtyKeys(current.dirtyKeys);
      const fieldRevisions = { ...current.fieldRevisions };
      for (const [key, value] of Object.entries(values)) {
        if ((current.baseline[key] ?? "") === value) dirtyKeys.delete(key);
        else dirtyKeys.add(key);
        fieldRevisions[key] = this.nextRevision++;
      }
      return { draft, dirtyKeys, fieldRevisions };
    });
  }

  discardDraft() {
    this.patch((current) => ({
      draft: current.baseline,
      dirtyKeys: new Set(),
    }));
  }

  markSaved(values: ServerSettingsValues = this.getSnapshot().draft) {
    this.markFieldsSaved(values);
  }

  markFieldsSaved(values: ServerSettingsValues, submittedFieldRevisions: Record<string, number> = {}) {
    this.patch((current) => {
      const nextBaseline = {
        ...current.baseline,
        ...values,
      };
      const nextDraft = { ...current.draft };
      const dirtyKeys = cloneDirtyKeys(current.dirtyKeys);
      Object.entries(values).forEach(([key, value]) => {
        // The acknowledged value becomes the baseline. A later edit stays
        // dirty only when its current value actually differs from that
        // baseline; revision ordering must never manufacture dirtiness when a
        // user changed away and then back while the request was in flight.
        if ((nextDraft[key] ?? "") === value) {
          dirtyKeys.delete(key);
        } else {
          dirtyKeys.add(key);
        }
      });

      void submittedFieldRevisions;

      return {
        baseline: nextBaseline,
        draft: nextDraft,
        dirtyKeys,
        hydrated: true,
      };
    });
  }

  getSavePayload() {
    const { draft, dirtyKeys } = this.getSnapshot();
    return Object.fromEntries(
      Array.from(dirtyKeys)
        .filter((key) => Object.prototype.hasOwnProperty.call(draft, key))
        .map((key) => [key, draft[key]]),
    );
  }

  beginSave(): SettingsSaveOperation {
    const snapshot = this.getSnapshot();
    const values = this.getSavePayload();
    return {
      id: this.nextOperationId++,
      values,
      fieldRevisions: Object.fromEntries(
        Object.keys(values).map((key) => [key, snapshot.fieldRevisions[key] ?? 0]),
      ),
    };
  }

  acknowledgeSave(operation: SettingsSaveOperation) {
    this.markFieldsSaved(operation.values, operation.fieldRevisions);
  }
}

export const settingsDraftManager = new SettingsDraftManager();
