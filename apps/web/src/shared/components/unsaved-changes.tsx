import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog, SaveBar } from "@clinic/ui";
import { DISCARD_CONFIRM_FROM } from "@web/shared/constants/forms";
import { useLeaveGuard } from "@web/shared/hooks/use-leave-guard";

export interface UnsavedChangesProps {
  readonly dirty: boolean;
  readonly count?: number | undefined;
  readonly saving?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly watchParams?: readonly string[] | undefined;
  readonly "data-testid"?: string | undefined;
}

export function UnsavedChanges({
  dirty,
  count,
  saving = false,
  invalid = false,
  onSave,
  onDiscard,
  watchParams = [],
  "data-testid": testId = "unsaved-changes",
}: UnsavedChangesProps): JSX.Element {
  const { t } = useTranslation();
  const leaveGuard = useLeaveGuard(dirty, `${testId}-leave`, watchParams);
  const [confirming, setConfirming] = useState(false);
  const counted = count !== undefined && count > 0;

  return (
    <>
      <SaveBar
        data-testid={`${testId}-bar`}
        className="rail:ps-[266px]"
        visible={dirty}
        saving={saving}
        invalid={invalid}
        message={counted ? t("common.unsavedCount", { count }) : undefined}
        onSave={onSave}
        onDiscard={() => {
          if (counted && count >= DISCARD_CONFIRM_FROM) {
            setConfirming(true);
          } else {
            onDiscard();
          }
        }}
      />
      <ConfirmDialog
        data-testid={`${testId}-discard`}
        open={confirming}
        onOpenChange={setConfirming}
        title="common.discardChanges"
        titleValues={{ count: count ?? 0 }}
        consequences={[t("common.discardChangesBody")]}
        confirmLabel="common.discard"
        onConfirm={async () => {
          onDiscard();
          setConfirming(false);
        }}
      />
      {leaveGuard}
    </>
  );
}
