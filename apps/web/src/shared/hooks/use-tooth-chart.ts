import { CHART_TYPE } from "@clinic/shared";
import { useSession } from "@web/shared/providers/session";

export function useToothChart(): boolean {
  const { user } = useSession();

  return user?.clinic.chartTypes.includes(CHART_TYPE.TOOTH_FDI) ?? false;
}
