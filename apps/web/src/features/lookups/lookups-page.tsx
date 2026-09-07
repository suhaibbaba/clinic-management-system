import {
  COLOURED_LOOKUP_LISTS,
  LOOKUP_LIST_KEYS,
  lookupLabel,
  type LookupListKey,
  type LookupOption,
} from '@clinic/shared';
import { useMemo, useState, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  RowAction,
  Switch,
  useToast,
} from '@web/components/ui';
import { LookupOptionModal } from '@web/features/lookups/lookup-option-modal';
import {
  useDeleteLookupOption,
  useLookupList,
  useReorderLookupOptions,
  useUpdateLookupOption,
} from '@web/features/lookups/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { cn } from '@web/lib/cn';

/**
 * القوائم — the lists behind every dropdown in the app.
 *
 * One screen rather than a settings section per module, because the thing a
 * clinic is doing here is the same thing every time: adding a word they use
 * that the system did not ship with. A tab per list, the list itself under it,
 * and nothing else.
 *
 * Two rules the screen has to make visible, because the API enforces them and
 * a refusal the user could not have predicted is a bug in the screen:
 *
 *  - **A built-in row cannot be removed or switched off.** Something in the
 *    application refers to it by code — the chart draws `missing` specially,
 *    the ledger already holds `cash` — so the delete and the toggle are not
 *    offered, and the row says why.
 *  - **Its name and colour are editable anyway.** "نقداً" may well be "خالص"
 *    in this clinic, and that is not a code change.
 */
export function LookupsPage(): JSX.Element {
  const { t } = useTranslation();
  const [listKey, setListKey] = useState<LookupListKey>(LOOKUP_LIST_KEYS[0]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('lookups.title')} subtitle={t('lookups.subtitle')} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <nav
          aria-label={t('lookups.pickList')}
          className="flex gap-1 overflow-x-auto rounded-card bg-surface p-2 shadow-card lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-visible"
        >
          {LOOKUP_LIST_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-current={key === listKey ? 'true' : undefined}
              onClick={() => setListKey(key)}
              className={cn(
                'shrink-0 rounded-control px-3 py-2 text-start text-value transition-colors',
                key === listKey
                  ? 'bg-primary-50 font-medium text-primary-700'
                  : 'text-ink-muted hover:bg-sunken hover:text-ink',
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

  // Inactive rows included: this is the one screen where a switched-off option
  // has to be visible, or switching it back on is impossible.
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

  const fail = (error: unknown): void => toast.error(errorMessageKey(error));

  /**
   * The whole order goes back on drop, not "move this one to position 4":
   * two people reordering at once would otherwise interleave into an order
   * neither of them chose.
   */
  const drop = async (targetId: string): Promise<void> => {
    if (!dragging || dragging === targetId) {
      return;
    }

    const ids = options.map((option) => option.id).filter((id) => id !== dragging);
    ids.splice(ids.indexOf(targetId), 0, dragging);
    setDragging(null);

    try {
      await reorder.mutateAsync({ listKey, ids });
    } catch (error) {
      fail(error);
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
    if (!window.confirm(t('lookups.confirmDelete', { name: lookupLabel(option, i18n.language) }))) {
      return;
    }

    try {
      await remove.mutateAsync(option.id);
      toast.success('lookups.deleted');
    } catch (error) {
      fail(error);
    }
  };

  return (
    <section className="min-w-0 flex-1 rounded-card bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-value font-medium text-ink">{t(`lookups.lists.${listKey}`)}</h2>
          <p className="text-label text-ink-subtle">{t(`lookups.hints.${listKey}`)}</p>
        </div>

        <Button icon={<Icon name="plus" />} size="sm" onClick={() => setAdding(true)}>
          {t('lookups.add')}
        </Button>
      </div>

      {options.length === 0 ? (
        <EmptyState icon="list" title="lookups.empty" />
      ) : (
        <ul className="flex flex-col gap-1">
          {options.map((option) => (
            <li
              key={option.id}
              draggable
              onDragStart={() => setDragging(option.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event: DragEvent) => event.preventDefault()}
              onDrop={() => void drop(option.id)}
              className={cn(
                'flex items-center gap-3 rounded-control border border-transparent px-2 py-2',
                'hover:border-line hover:bg-sunken',
                dragging === option.id && 'opacity-40',
                !option.isActive && 'opacity-60',
              )}
            >
              <span className="cursor-grab text-ink-subtle" aria-hidden="true">
                <Icon name="grip" />
              </span>

              {coloured && (
                <span
                  aria-hidden="true"
                  className="inline-block size-4 shrink-0 rounded-sm border border-line"
                  style={option.color ? { backgroundColor: option.color } : undefined}
                />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-value text-ink">
                  {lookupLabel(option, i18n.language)}
                </span>
                <span className="block truncate text-label text-ink-subtle" dir="ltr">
                  {option.code}
                </span>
              </span>

              {option.isSystem && <Badge tone="neutral">{t('lookups.system')}</Badge>}

              <Switch
                checked={option.isActive}
                // A built-in row switched off would make behaviour written
                // against it unreachable rather than absent.
                disabled={option.isSystem}
                label={t('lookups.active')}
                onCheckedChange={() => void toggle(option)}
              />

              <RowAction icon={<Icon name="edit" />} onClick={() => setEditing(option)}>
                {t('common.edit')}
              </RowAction>

              {!option.isSystem && (
                <RowAction
                  icon={<Icon name="trash" />}
                  tone="quiet"
                  onClick={() => void destroy(option)}
                >
                  {t('common.delete')}
                </RowAction>
              )}
            </li>
          ))}
        </ul>
      )}

      <LookupOptionModal
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
