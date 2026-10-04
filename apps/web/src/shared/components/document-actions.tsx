import type { JSX } from "react";
import {
  Button,
  Icon,
  Menu,
  MenuContent,
  MenuTrigger,
  type ButtonVariant,
  type IconName,
} from "@clinic/ui";
import { DocumentMenuItems } from "@web/shared/components/document-menu-items";
import { useDocumentActions } from "@web/shared/hooks/use-document-actions";
import type { DocumentSource } from "@web/shared/lib/document-source";

export function DocumentActions({
  source,
  label,
  icon = "print",
  variant = "secondary",
  "data-testid": testId,
}: {
  readonly source: DocumentSource | undefined;
  readonly label: string;
  readonly icon?: IconName | undefined;
  readonly variant?: ButtonVariant | undefined;
  readonly "data-testid": string;
}): JSX.Element {
  const actions = useDocumentActions(testId);

  if (!source) {
    return (
      <Button variant={variant} icon={<Icon name={icon} />} data-testid={testId} aria-disabled>
        {label}
      </Button>
    );
  }

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button
            variant={variant}
            icon={<Icon name={icon} />}
            isLoading={actions.busy}
            data-testid={testId}
          >
            {label}
            <Icon name="chevron-down" className="text-ink-subtle" />
          </Button>
        </MenuTrigger>
        <MenuContent data-testid={`${testId}-menu`}>
          <DocumentMenuItems actions={actions} source={source} data-testid={testId} />
        </MenuContent>
      </Menu>
      {actions.dialog}
    </>
  );
}
