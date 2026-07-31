"use client";

import { useRef } from "react";
import type { SidebarGroup } from "./types";

// The Recent ("Active") tab lists conversations sorted by latest activity. That
// membership and sort are recomputed on every event-stream update, so while the
// user watches the tab rows can disappear, appear, or reshuffle on every turn.
// This hook freezes the row/group membership and order captured at the moment
// the tab becomes active, then overlays any still-present live row data so
// statuses and unread indicators can update without changing the list itself.
// Leaving the tab and returning re-snapshots the list.

type SnapshottedRun = SidebarGroup["runs"][number];

type SnapshottedGroup = {
  group: SidebarGroup;
  runOrder: string[];
  runsById: Map<string, SnapshottedRun>;
};

type OrderSnapshot = {
  groupOrder: string[];
  groupsByPath: Map<string, SnapshottedGroup>;
};

function captureOrder(groups: SidebarGroup[]): OrderSnapshot {
  const groupOrder: string[] = [];
  const groupsByPath = new Map<string, SnapshottedGroup>();

  groups.forEach((group) => {
    groupOrder.push(group.path);
    const runOrder = group.runs.map((run) => run.id);
    const runsById = new Map(group.runs.map((run) => [run.id, run]));
    groupsByPath.set(group.path, {
      group: { ...group, runs: [...group.runs] },
      runOrder,
      runsById,
    });
  });
  return { groupOrder, groupsByPath };
}

function applyOrder(groups: SidebarGroup[], snapshot: OrderSnapshot, liveCatalogGroups: SidebarGroup[] = groups): SidebarGroup[] {
  const liveGroupsByPath = new Map(groups.map((group) => [group.path, group]));
  const liveCatalogGroupsByPath = new Map(liveCatalogGroups.map((group) => [group.path, group]));

  return snapshot.groupOrder.flatMap((groupPath) => {
    const snapshotted = snapshot.groupsByPath.get(groupPath);
    if (!snapshotted) return [];

    const liveGroup = liveGroupsByPath.get(groupPath);
    const liveCatalogGroup = liveCatalogGroupsByPath.get(groupPath);
    const liveRunsById = new Map((liveGroup?.runs ?? []).map((run) => [run.id, run]));
    const liveCatalogRunsById = new Map((liveCatalogGroup?.runs ?? []).map((run) => [run.id, run]));
    const runs = snapshotted.runOrder.flatMap((runId) => {
      const run = liveRunsById.get(runId) ?? liveCatalogRunsById.get(runId) ?? snapshotted.runsById.get(runId);
      return run ? [run] : [];
    });

    if (runs.length === 0) return [];

    return [{
      ...(liveGroup ?? liveCatalogGroup ?? snapshotted.group),
      runs,
    }];
  });
}

export function useFrozenRecentOrder(
  activeProjects: SidebarGroup[],
  isRecentTabActive: boolean,
  liveCatalogProjects: SidebarGroup[] = activeProjects,
): SidebarGroup[] {
  const snapshotRef = useRef<OrderSnapshot | null>(null);
  const wasActiveRef = useRef(false);

  if (!isRecentTabActive) {
    // Tab hidden — drop the snapshot so re-entry sorts fresh by latest activity.
    snapshotRef.current = null;
    wasActiveRef.current = false;
    return activeProjects;
  }

  if (!wasActiveRef.current || snapshotRef.current === null) {
    // Just (re)opened the tab — freeze the current latest-activity order.
    snapshotRef.current = captureOrder(activeProjects);
    wasActiveRef.current = true;
    return applyOrder(activeProjects, snapshotRef.current, liveCatalogProjects);
  }

  return applyOrder(activeProjects, snapshotRef.current, liveCatalogProjects);
}
