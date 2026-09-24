import {
  COLOURED_LOOKUP_LISTS,
  LOOKUP_LIST_KEYS,
  lookupLabel,
  type LookupListKey,
  type LookupOption,
} from "@clinic/shared";
import { useMemo, useState, type DragEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  PageHeader,
  RowMenu,
  Select,
  Switch,
  useToast,
} from "@clinic/ui";
import { LookupOptionModal } from "@web/features/lookups/lookup-option-modal";
import { ToothSwatch } from "@web/features/patients/chart/tooth-swatch";
import { useToothStates } from "@web/features/patients/chart/tooth-state";
import {
  useDeleteLookupOption,
  useLookupList,
  useReorderLookupOptions,
  useUpdateLookupOption,
} from "@web/features/lookups/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";

export function LookupsPage(): JSX.Element {
  const { t } = useTranslation();
  // The list is an address, so a reload or a shared link opens the same one.
  const [params, setParams] = useSearchParams();
  const requested = params.get("list");
  const listKey =
    LOOKUP_LIST_KEYS.find((key) => key === requested) ?? (LOOKUP_LIST_KEYS[0] as LookupListKey);
  const setListKey = (key: LookupListKey): void => setParams({ list: key }, { replace: true });

  return (
    <div data-testid="lookups-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="lookups-header"
        title={t("lookups.title")}
        subtitle={t("lookups.subtitle")}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:hidden">
          <Select
            data-testid="lookups-picker"
            aria-label={t("lookups.pickList")}
            value={listKey}
            options={LOOKUP_LIST_KEYS.map((key) => ({
              value: key,
              label: t(`lookups.lists.${key}`),
            }))}
            onChange={(event) => setListKey(event.target.value as LookupListKey)}
          />
        </div>

        <nav
          data-testid="lookups-nav"
          aria-label={t("lookups.pickList")}
          className="hidden w-64 shrink-0 flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-card lg:flex"
        >
          {LOOKUP_LIST_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              data-testid={`lookups-list-${key}`}
              aria-current={key === listKey ? "true" : undefined}
              onClick={() => setListKey(key)}
              className={cn(
                "flex min-h-(--control-h-sm) shrink-0 items-center rounded-control px-3 py-2",
                "text-start text-value transition-colors",
                key === listKey
                  ? "bg-primary-50 font-medium text-primary-700"
                  : "text-ink-muted hover:bg-sunken hover:text-ink",
              )}
            >
              {t(`lookups.lists.${key}`)}
            </button>
          ))}
        </nav>

        <LookupList listKey={listKey} />
      </div>
    </div>
  );
}

function LookupList({ listKey }: { readonly listKey: LookupListKey }): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const options = useLookupList(listKey, true);
  const reorder = useReorderLookupOptions();
  const update = useUpdateLookupOption();
  const remove = useDeleteLookupOption();

  const [editing, setEditing] = useState<LookupOption | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const coloured = useMemo(
    () => (COLOURED_LOOKUP_LISTS as readonly string[]).includes(listKey),
    [listKey],
  );

  const states = useToothStates();

  const fail = (error: unknown): void => toast.error(errorMessageKey(error));

  const saveOrder = async (ids: string[]): Promise<void> => {
    try {
      await reorder.mutateAsync({ listKey, ids });
    } catch (error) {
      fail(error);
    }
  };

  const drop = async (targetId: string): Promise<void> => {
    if (!dragging || dragging === targetId) {
      return;
    }

    const ids = options.map((option) => option.id).filter((id) => id !== dragging);
    ids.splice(ids.indexOf(targetId), 0, dragging);
    setDragging(null);
    await saveOrder(ids);
  };

  // A phone has no drag and drop, so a row also moves one place at a time from its menu.
  const move = async (index: number, by: -1 | 1): Promise<void> => {
    const ids = options.map((option) => option.id);
    const [moved] = ids.splice(index, 1);

    if (moved !== undefined) {
      ids.splice(index + by, 0, moved);
      await saveOrder(ids);
    }
  };

  const toggle = async (option: LookupOption): Promise<void> => {
    try {
      await update.mutateAsync({ id: option.id, body: { isActive: !option.isActive } });
    } catch (error) {
      fail(error);
    }
  };

  const destroy = async (option: LookupOption): Promise<void> => {
    const question = option.isSystem ? "lookups.confirmDeleteSystem" : "lookups.confirmDelete";

    if (!window.confirm(t(question, { name: lookupLabel(option, i18n.language) }))) {
      return;
    }

    try {
      await remove.mutateAsync(option.id);
      toast.success("lookups.deleted");
    } catch (error) {
      fail(error);
    }
  };

  return (
    <section
      data-testid="lookup-list"
      className="min-w-0 flex-1 border border-line rounded-card bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-heading font-medium text-ink">{t(`lookups.lists.${listKey}`)}</h2>
          <p className="text-label text-ink-subtle">{t(`lookups.hints.${listKey}`)}</p>
        </div>

        <Button
          icon={<Icon name="plus" />}
          size="sm"
          data-testid="lookup-add"
          onClick={() => setAdding(true)}
        >
          {t("lookups.add")}
        </Button>
      </div>

      {options.length === 0 ? (
        <EmptyState icon="list" data-testid="lookup-list-empty" title="lookups.empty" />
      ) : (
        <ul data-testid="lookup-options" className="flex flex-col">
          {options.map((option, index) => (
            <li
              key={option.id}
              data-testid={`lookup-option-${option.code}`}
              draggable
              onDragStart={() => setDragging(option.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event: DragEvent) => event.preventDefault()}
              onDrop={() => void drop(option.id)}
              className={cn(
                "flex items-center gap-3 border-b border-line py-2.5 last:border-b-0",
                dragging === option.id && "opacity-40",
              )}
            >
              <span className="hidden cursor-grab text-ink-subtle md:inline" aria-hidden="true">
                <Icon name="grip" />
              </span>

              <button
                type="button"
                data-testid="lookup-option-open"
                onClick={() => setEditing(option)}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start",
                  !option.isActive && "opacity-60",
                )}
              >
                {coloured && (
                  <ToothSwatch
                    style={states.info(option.code).style}
                    className="inline-block size-4 shrink-0 rounded-sm border"
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block break-words text-value text-ink">
                    {lookupLabel(option, i18n.language)}
                  </span>
                  <span className="block text-label text-ink-subtle">
                    <Ltr>{option.code}</Ltr>
                    {option.isSystem && (
                      <span data-testid="lookup-option-system"> · {t("lookups.system")}</span>
                    )}
                  </span>
                </span>
              </button>

              <Switch
                data-testid="lookup-option-active"
                checked={option.isActive}
                label={t("lookups.active")}
                hideLabel
                onCheckedChange={() => void toggle(option)}
              />

              <RowMenu label={t("lookups.rowMenu")} data-testid="lookup-option-menu">
                <MenuItem
                  icon="edit"
                  data-testid="lookup-option-edit"
                  onSelect={() => setEditing(option)}
                >
                  {t("common.edit")}
                </MenuItem>
                {index > 0 && (
                  <MenuItem
                    icon="chevron-up"
                    data-testid="lookup-option-up"
                    onSelect={() => void move(index, -1)}
                  >
                    {t("lookups.moveUp")}
                  </MenuItem>
                )}
                {index < options.length - 1 && (
                  <MenuItem
                    icon="chevron-down"
                    data-testid="lookup-option-down"
                    onSelect={() => void move(index, 1)}
                  >
                    {t("lookups.moveDown")}
                  </MenuItem>
                )}
                <MenuItem
                  icon="trash"
                  tone="danger"
                  data-testid="lookup-option-delete"
                  onSelect={() => void destroy(option)}
                >
                  {t("common.delete")}
                </MenuItem>
              </RowMenu>
            </li>
          ))}
        </ul>
      )}

      <LookupOptionModal
        data-testid="lookup-option-modal"
        open={adding || editing !== null}
        listKey={listKey}
        coloured={coloured}
        option={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    </section>
  );
}
