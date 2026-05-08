import { DEFAULT_SERVER_SETTINGS } from "./constants";
import { StateManager } from "@/lib/state-manager";

export type ServerSettingsValues = Record<string, string>;

export type SettingsDraftState = {
  baseline: ServerSettingsValues;
  draft: ServerSettingsValues;
  dirtyKeys: Set<string>;
  hydrated: boolean;
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
  constructor(initialValues: ServerSettingsValues = DEFAULT_SERVER_SETTINGS) {
    const normalized = normalizeSettings(initialValues);
    super({
      baseline: normalized,
      draft: normalized,
      dirtyKeys: new Set(),
      hydrated: false,
    });
  }

  hydrate(values: ServerSettingsValues) {
    const normalized = normalizeSettings(values);
    this.patch({
      baseline: normalized,
      draft: normalized,
      dirtyKeys: new Set(),
      hydrated: true,
    });
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
      };
    });
  }

  patchFields(values: ServerSettingsValues) {
    Object.entries(values).forEach(([key, value]) => this.setField(key, value));
  }

  discardDraft() {
    this.patch((current) => ({
      draft: current.baseline,
      dirtyKeys: new Set(),
    }));
  }

  markSaved(values: ServerSettingsValues = this.getSnapshot().draft) {
    const normalized = normalizeSettings(values);
    this.patch({
      baseline: normalized,
      draft: normalized,
      dirtyKeys: new Set(),
      hydrated: true,
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
}

export const settingsDraftManager = new SettingsDraftManager();
