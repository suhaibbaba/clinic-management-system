import { DEFAULT_LOOKUP_COLOUR, type LookupListKey, type LookupOption } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, FormField, Input, Modal, useToast } from '@web/components/ui';
import { useCreateLookupOption, useUpdateLookupOption } from '@web/features/lookups/queries';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * Adding a word to one of the clinic's lists, or renaming one it already has.
 *
 * Both names are asked for, not one: the interface has two languages and a
 * list with only an Arabic name would leave an English screen showing a code.
 * The code itself is never edited — it is what every row already recorded
 * refers to, and changing it would silently reinterpret them — so it is shown
 * for the built-in rows and derived from the English name for new ones.
 */
export function LookupOptionModal({
  open,
  listKey,
  coloured,
  option,
  onClose,
}: {
  readonly open: boolean;
  readonly listKey: LookupListKey;
  /** Only the tooth chart paints with a colour; elsewhere the field is noise. */
  readonly coloured: boolean;
  readonly option: LookupOption | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const create = useCreateLookupOption();
  const update = useUpdateLookupOption();

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [color, setColor] = useState(DEFAULT_LOOKUP_COLOUR);

  useEffect(() => {
    if (!open) {
      return;
    }

    setNameAr(option?.nameAr ?? '');
    setNameEn(option?.nameEn ?? '');
    setColor(option?.color ?? DEFAULT_LOOKUP_COLOUR);
  }, [open, option]);

  const submit = async (): Promise<void> => {
    // A built-in state keeps the theme's own light/dark pair unless somebody
    // deliberately picks a colour, so an untouched default is sent as null.
    const chosen =
      coloured && (color !== DEFAULT_LOOKUP_COLOUR || !option?.isSystem) ? color : null;

    try {
      if (option) {
        await update.mutateAsync({
          id: option.id,
          body: { nameAr: nameAr.trim(), nameEn: nameEn.trim(), color: chosen },
        });
        toast.success('lookups.updated');
      } else {
        await create.mutateAsync({
          listKey,
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim(),
          color: chosen,
        });
        toast.success('lookups.created');
      }

      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={t(option ? 'lookups.editTitle' : 'lookups.newTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={nameAr.trim() === '' || nameEn.trim() === ''}
            isLoading={create.isPending || update.isPending}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {option?.isSystem && (
          <p className="flex items-center gap-2 rounded-control bg-sunken px-3 py-2 text-label text-ink-muted">
            <Badge tone="neutral">{t('lookups.system')}</Badge>
            {t('lookups.systemHint')}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="lookups.nameAr" htmlFor="lookup-name-ar" required>
            <Input
              id="lookup-name-ar"
              // The browser reads the direction off what is typed: this field
              // holds Arabic but the screen around it may be in English.
              dir="auto"
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
            />
          </FormField>

          <FormField label="lookups.nameEn" htmlFor="lookup-name-en" required>
            <Input
              id="lookup-name-en"
              dir="ltr"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
            />
          </FormField>
        </div>

        {coloured && (
          <FormField label="lookups.color" htmlFor="lookup-color" hint={t('lookups.colorHint')}>
            <span className="flex items-center gap-3">
              <input
                id="lookup-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-10 cursor-pointer rounded-control border border-line bg-surface p-1"
              />
              <span dir="ltr" className="font-mono text-label text-ink-muted">
                {color}
              </span>
            </span>
          </FormField>
        )}

        {option && (
          <FormField label="lookups.code" htmlFor="lookup-code" hint={t('lookups.codeHint')}>
            <Input id="lookup-code" dir="ltr" value={option.code} disabled readOnly />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
