import { useCallback } from "react";
import { useOptionalRunnerRegistryContext } from "@/interface/runners/RunnerRegistryProvider";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { buildProjectHtmlBrowserUrl, buildProjectVideoBrowserUrl, type ProjectFileReference } from "./project-file-links";

import { isVideoPath } from "./file-media";

export function useProjectFileBrowserUrl() {
  const context = useOptionalRunnerRegistryContext();
  return useCallback((reference: ProjectFileReference, download = false) => {
    const snapshot = context?.profileStore.getSnapshot();
    const profile = snapshot?.profiles.find((item) => item.id === snapshot.activeRunnerId);
    const origin = profile?.baseUrl ?? window.location.origin;
    return isVideoPath(reference.relativePath)
      ? buildProjectVideoBrowserUrl(reference, origin, download)
      : buildProjectHtmlBrowserUrl(reference, origin);
  }, [context]);
}

export function useOpenProjectHtml() {
  const getUrl = useProjectFileBrowserUrl();
  const runtimeApis = useRuntimeAPIs();
  return useCallback((reference: ProjectFileReference, download = false) => {
    const url = getUrl(reference, download);
    if (runtimeApis.native) {
      void runtimeApis.native.openExternal({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [getUrl, runtimeApis]);
}
