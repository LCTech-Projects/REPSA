import { createContext, useContext } from "react";

export const SIDEBAR_WIDTH_COLLAPSED = 85;
export const SIDEBAR_WIDTH_EXPANDED = 257;

type SidebarContextValue = {
  expanded: boolean;
  width: number;
};

export const SidebarContext = createContext<SidebarContextValue>({
  expanded: false,
  width: SIDEBAR_WIDTH_COLLAPSED,
});

export const useSidebar = () => useContext(SidebarContext);
