import type { JSX } from "react";
import { SaveBar } from "@clinic/ui";
import { useLeaveGuard } from "@web/shared/hooks/use-leave-guard";

export interface UnsavedChangesProps {
  readonly dirty: boolean;
  readonly saving?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly watchParams?: readonly string[] | undefined;
  readonly "data-testid"?: string | undefined;
}

export function UnsavedChanges({
  dirty,
  saving = false,
  invalid = false,
  onSave,
  onDiscard,
  watchParams = [],
  "data-testid": testId = "unsaved-changes",
}: UnsavedChangesProps): JSX.Element {
  const leaveGuard = useLeaveGuard(dirty, `${testId}-leave`, watchParams);

  return (
    <>
      <SaveBar
        data-testid={`${testId}-bar`}
        visible={dirty}
        saving={saving}
        invalid={invalid}
        onSave={onSave}
        onDiscard={onDiscard}
      />
      {leaveGuard}
    </>
  );
}
