"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, LoaderCircle } from "lucide-react";
import { fileViewerPanelManager } from "@/components/component-state-managers";
import { useManagerSelector } from "@/lib/use-manager-snapshot";
import { useOpenProjectHtml, useProjectFileBrowserUrl } from "@/lib/use-open-project-html";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useOptionalRunnerRegistryContext } from "@/interface/runners/RunnerRegistryProvider";
import { useRuntimeAPIs } from "@/runtime-api/provider";

export function ProjectVideoViewer({ root, relativePath }: { root: string; relativePath: string }) {
  useI18nSnapshot();
  const apis = useRuntimeAPIs();
  const registryContext = useOptionalRunnerRegistryContext();
  const profiles = registryContext?.profileStore.getSnapshot();
  const profile = profiles?.profiles.find((item) => item.id === profiles.activeRunnerId);
  const needsBlob = Boolean(apis.native) || profile?.authTransport === "bearer";
  const getUrl = useProjectFileBrowserUrl();
  const openExternal = useOpenProjectHtml();
  const reference = { root, relativePath };
  // Native surfaces authenticate through their bridge; a media element cannot
  // attach that bearer credential. Web surfaces stream directly with cookies.
  const videoQuery = useQuery({
    queryKey: ["project-file-video", root, relativePath],
    queryFn: ({ signal }) => apis.files.video({ root, file: relativePath }, { signal }),
    enabled: needsBlob,
    gcTime: 0,
  });
  const blob = videoQuery.data;
  const blobUrl = useMemo(() => blob ? URL.createObjectURL(blob) : null, [blob]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  const url = needsBlob ? blobUrl : getUrl(reference);
  const failed = useManagerSelector(fileViewerPanelManager, (state) => Boolean(url && state.videoFailedByKey[url]));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      {videoQuery.isFetching && !url ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />{t("fileViewer.loading")}
        </div>
      ) : failed || videoQuery.error ? (
        <p role="status" className="text-sm text-muted-foreground">{t("fileViewer.video.unsupported")}</p>
      ) : url ? (
        <video
          key={url}
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={t("fileViewer.video.label", { path: relativePath })}
          className="min-h-0 w-full flex-1 bg-black object-contain"
          onError={() => fileViewerPanelManager.markVideoFailed(url)}
        />
      ) : null}
      <div className="flex flex-wrap gap-3 text-xs">
        <button className="inline-flex items-center gap-1 underline" type="button" onClick={() => openExternal(reference)}>
          <ExternalLink className="h-3.5 w-3.5" />{t("projectFile.menu.openInBrowser")}
        </button>
        <a className="inline-flex items-center gap-1 underline" href={blobUrl ?? getUrl(reference, true)} download={relativePath.split(/[\\/]/).pop()}>
          <Download className="h-3.5 w-3.5" />{t("fileViewer.video.download")}
        </a>
      </div>
    </div>
  );
}
