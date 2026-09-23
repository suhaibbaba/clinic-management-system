import { createContext, useContext, type ReactNode } from "react";

// A workspace page fills the viewport and places the shell's bar in its own column; everywhere else
// the shell draws the bar above the page and this is null.
const WorkspaceTopBarContext = createContext<ReactNode>(null);

export const WorkspaceTopBarProvider = WorkspaceTopBarContext.Provider;

export const useWorkspaceTopBar = (): ReactNode => useContext(WorkspaceTopBarContext);
