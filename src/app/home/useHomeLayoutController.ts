"use client";

import type React from "react";
import { homeUiSetters } from "./HomeUiStateManager";

export function useHomeLayoutController() {
  const {
    setLeftSidebarOpen,
    setIsResizingLeftSidebar,
    setIsResizingRightSidebar,
    setIsResizingTerminalPanel,
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

  const handleTerminalPanelResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingTerminalPanel(true);
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
    handleTerminalPanelResizeStart,
    handleCollapseLeftSidebar,
    handleToggleMobileNav,
    handleToggleMobileWorkers,
    handleCloseRightSidebar,
  };
}
