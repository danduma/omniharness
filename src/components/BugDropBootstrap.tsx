"use client";

import { useEffect } from "react";

const BUGDROP_OPEN_EVENT = "omni:open-bugdrop";
const BUG_REPORT_URL = "https://github.com/danduma/omniharness/issues/new";

export function requestBugDropOpen() {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(new Event(BUGDROP_OPEN_EVENT));
}

export function BugDropBootstrap() {
  useEffect(() => {
    const handleOpenRequest = () => {
      window.open(BUG_REPORT_URL, "_blank", "noopener,noreferrer");
    };

    document.addEventListener(BUGDROP_OPEN_EVENT, handleOpenRequest);

    return () => {
      document.removeEventListener(BUGDROP_OPEN_EVENT, handleOpenRequest);
    };
  }, []);

  return null;
}
