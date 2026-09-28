import { createContext, useContext, type ReactNode } from "react";

const WorkspaceTopBarContext = createContext<ReactNode>(null);

export const WorkspaceTopBarProvider = WorkspaceTopBarContext.Provider;

export const useWorkspaceTopBar = (): ReactNode => useContext(WorkspaceTopBarContext);
