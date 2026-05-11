"use client";

import type React from "react";
import { homeUiSetters } from "./HomeUiStateManager";

export function useHomeLayoutController() {
  const {
    setLeftSidebarOpen,
    setIsResizingLeftSidebar,
    setIsResizingRightSidebar,
    setRightSidebarOpen,
    setMobileNavOpen,
    setMobileWorkersOpen,
  } = homeUiSetters;

  const handleLeftSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingLeftSidebar(true);
  };

  const handleRightSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingRightSidebar(true);
  };

  const handleCollapseLeftSidebar = () => {
    setLeftSidebarOpen(false);
  };

  const handleToggleMobileNav = (open: boolean) => {
    setMobileNavOpen(open);
  };

  const handleToggleMobileWorkers = (open: boolean) => {
    setMobileWorkersOpen(open);
  };

  const handleCloseRightSidebar = () => {
    setRightSidebarOpen(false);
  };

  return {
    handleLeftSidebarResizeStart,
    handleRightSidebarResizeStart,
    handleCollapseLeftSidebar,
    handleToggleMobileNav,
    handleToggleMobileWorkers,
    handleCloseRightSidebar,
  };
}
