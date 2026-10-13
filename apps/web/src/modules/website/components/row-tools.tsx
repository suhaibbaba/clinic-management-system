import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@clinic/ui";

export function RowTools({
  id,
  index,
  count,
  onMove,
  onRemove,
}: {
  readonly id: string;
  readonly index: number;
  readonly count: number;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onRemove?: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-1">
      <Button
        variant="quiet"
        size="sm"
        icon={<Icon name="arrow-up" />}
        aria-label={t("website.list.up")}
        data-testid={`${id}-up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      />
      <Button
        variant="quiet"
        size="sm"
        icon={<Icon name="arrow-down" />}
        aria-label={t("website.list.down")}
        data-testid={`${id}-down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      />
      {onRemove && (
        <Button
          variant="quiet"
          size="sm"
          icon={<Icon name="trash" />}
          aria-label={t("website.list.remove")}
          data-testid={`${id}-remove`}
          onClick={onRemove}
        />
      )}
    </span>
  );
}
