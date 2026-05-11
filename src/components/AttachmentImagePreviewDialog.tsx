"use client";

import Image from "next/image";
import { Download, X } from "lucide-react";
import { attachmentImagePreviewManager } from "@/components/component-state-managers";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/chat-attachments";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t } from "@/lib/i18n";

export function AttachmentImagePreviewDialog() {
  const { preview } = useManagerSnapshot(attachmentImagePreviewManager);

  return (
    <Dialog
      open={Boolean(preview)}
      onOpenChange={(open) => {
        if (!open) {
          attachmentImagePreviewManager.close();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-[oklch(0.13_0.006_250)] p-0 text-[oklch(0.95_0.006_250)] ring-0 sm:max-w-none"
      >
        {preview ? (
          <>
            <DialogTitle className="sr-only">{preview.name}</DialogTitle>
            <div className="absolute right-4 top-4 z-10 flex items-center gap-3 sm:right-6 sm:top-6">
              <a
                href={preview.url}
                download={preview.name}
                aria-label={`Download ${preview.name}`}
                title={`Download ${preview.name}`}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white shadow-lg shadow-black/25 backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Download className="h-6 w-6" />
              </a>
              <button
                type="button"
                aria-label={t("attachment.preview.closeAria")}
                title="Close"
                onClick={attachmentImagePreviewManager.close}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white shadow-lg shadow-black/25 backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="relative h-full w-full p-4 pt-20 sm:p-8 sm:pt-24">
              <Image
                src={preview.url}
                alt={preview.name}
                fill
                sizes="100vw"
                unoptimized
                className="object-contain p-4 pt-20 sm:p-8 sm:pt-24"
                priority
              />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-5 pt-16 text-sm text-white/90 sm:px-8 sm:pb-7">
              <div className="max-w-[min(52rem,calc(100vw-2.5rem))] truncate font-medium">{preview.name}</div>
              <div className="mt-1 text-xs text-white/60">{formatBytes(preview.size)}</div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
