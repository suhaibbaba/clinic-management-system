import type { Can } from "@web/shared/providers/session";

export const seesDashboardLayouts = (can: Can): boolean => can("dashboard.layoutsByRole");

export const canCustomizeDashboard = (can: Can): boolean =>
  can("dashboard.layoutsByRole") && can("dashboard.saveLayouts");
