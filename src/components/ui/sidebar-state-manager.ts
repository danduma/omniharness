import { StateManager } from "@/lib/state-manager";

export class SidebarStateManager extends StateManager<{
  open: boolean;
  openMobile: boolean;
}> {
  constructor() {
    super({ open: true, openMobile: false });
  }

  setOpen = (open: boolean | ((current: boolean) => boolean)) =>
    this.setKey("open", open);

  setOpenMobile = (openMobile: boolean | ((current: boolean) => boolean)) =>
    this.setKey("openMobile", openMobile);
}

export const sidebarStateManager = new SidebarStateManager();
