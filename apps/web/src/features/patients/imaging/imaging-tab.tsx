import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_TYPES,
  isFdiTooth,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type AttachmentType,
} from '@clinic/shared';
import { useRef, useState, type ChangeEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, Input, Select, useToast } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { canDelete, canManageAttachments } from '@web/features/patients/permissions';
import {
  useAttachment,
  useDeleteAttachment,
  usePatientAttachments,
  useUploadAttachment,
} from '@web/features/patients/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDate } from '@web/lib/format';

/**
 * X-rays and documents on the patient file.
 *
 * Uploading is the API's three-step flow and nothing else: presign, PUT the
 * bytes straight to storage, confirm. The API builds the key and re-reads the
 * real size and content type from the bucket afterwards, so nothing here is
 * trusted — this screen only picks the file and says what kind of image it is.
 *
 * The grid shows metadata; each thumbnail asks for its own short-lived signed
 * URL, because the list endpoint deliberately returns neither a key nor a URL.
 */
export function ImagingTab({ patientId }: { patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();

  const [typeFilter, setTypeFilter] = useState<AttachmentType | ''>('');
  const [toothFilter, setToothFilter] = useState('');

  const tooth = Number(toothFilter);
  const toothIsValid = toothFilter !== '' && Number.isInteger(tooth) && isFdiTooth(tooth);

  const attachments = usePatientAttachments(patientId, {
    ...(typeFilter !== '' && { type: typeFilter }),
    ...(toothIsValid && { tooth }),
  });

  const canUpload = user ? canManageAttachments(user.role) : false;
  const canRemove = user ? canDelete(user.role) : false;

  return (
    <div className="flex flex-col gap-4">
      {canUpload && <UploadRow patientId={patientId} />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <label htmlFor="imaging-type" className="mb-1 block text-label text-ink-muted">
            {t('imaging.type')}
          </label>
          <Select
            id="imaging-type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as AttachmentType | '')}
            placeholder={t('common.all')}
            options={ATTACHMENT_TYPES.map((value) => ({
              value,
              label: t(`imaging.types.${value}`),
            }))}
          />
        </div>

        <div className="w-32">
          <label htmlFor="imaging-tooth" className="mb-1 block text-label text-ink-muted">
            {t('imaging.filterTooth')}
          </label>
          <Input
            id="imaging-tooth"
            dir="ltr"
            inputMode="numeric"
            placeholder="46"
            value={toothFilter}
            onChange={(event) => setToothFilter(event.target.value)}
            hasError={toothFilter !== '' && !toothIsValid}
          />
        </div>

        {toothFilter !== '' && !toothIsValid && (
          <p role="alert" className="text-label text-danger-600">
            {t('imaging.invalidTooth')}
          </p>
        )}
      </div>

      {attachments.isPending && <p className="text-value text-ink-muted">{t('common.loading')}</p>}

      {attachments.isError && <EmptyState title="errors.generic" hint="imaging.loadFailed" />}

      {attachments.data?.length === 0 && (
        <EmptyState title="imaging.empty" hint={canUpload ? 'imaging.emptyHint' : undefined} />
      )}

      {attachments.data && attachments.data.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {attachments.data.map((attachment) => (
            <li key={attachment.id}>
              <ImageCard
                attachment={attachment}
                patientId={patientId}
                canRemove={canRemove}
                onError={(error) => toast.error(errorMessageKey(error))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Picks a file and its kind, then runs the presign → upload → confirm flow. */
function UploadRow({ patientId }: { patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const upload = useUploadAttachment(patientId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<AttachmentType>('xray_periapical');
  const [tooth, setTooth] = useState('');

  const handleFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Checked here so an oversized or unsupported file never starts a round
    // trip; the API checks the stored object again, which is the real gate.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('imaging.tooLarge');
      event.target.value = '';
      return;
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.some((allowed) => allowed === file.type)) {
      toast.error('imaging.unsupportedType');
      event.target.value = '';
      return;
    }

    const parsed = Number(tooth);
    const toothNumber = tooth !== '' && isFdiTooth(parsed) ? parsed : null;

    try {
      await upload.mutateAsync({ file, type, tooth: toothNumber });
      toast.success('imaging.uploaded');
      setTooth('');
    } catch (error) {
      toast.error(errorMessageKey(error));
    } finally {
      // Lets the same file be picked again after a failure.
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-5 shadow-card">
      <div className="min-w-44">
        <label htmlFor="upload-type" className="mb-1 block text-label text-ink-muted">
          {t('imaging.type')}
        </label>
        <Select
          id="upload-type"
          value={type}
          onChange={(event) => setType(event.target.value as AttachmentType)}
          options={ATTACHMENT_TYPES.map((value) => ({
            value,
            label: t(`imaging.types.${value}`),
          }))}
        />
      </div>

      <div className="w-28">
        <label htmlFor="upload-tooth" className="mb-1 block text-label text-ink-muted">
          {t('imaging.tooth')}
        </label>
        <Input
          id="upload-tooth"
          dir="ltr"
          inputMode="numeric"
          placeholder="46"
          value={tooth}
          onChange={(event) => setTooth(event.target.value)}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
        onChange={(event) => void handleFile(event)}
      />

      <Button disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
        {t(upload.isPending ? 'imaging.uploading' : 'imaging.upload')}
      </Button>

      <p className="text-label text-ink-muted">{t('imaging.uploadHint')}</p>
    </div>
  );
}

function ImageCard({
  attachment,
  patientId,
  canRemove,
  onError,
}: {
  attachment: Attachment;
  patientId: string;
  canRemove: boolean;
  onError: (error: unknown) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  // The list carries no URL; one is minted per image actually on screen.
  const { data, isPending } = useAttachment(attachment.id, true);
  const remove = useDeleteAttachment(patientId);

  const isImage = attachment.mime.startsWith('image/');

  const handleDelete = async (): Promise<void> => {
    try {
      await remove.mutateAsync(attachment.id);
      toast.success('imaging.deleted');
    } catch (error) {
      onError(error);
    }
  };

  return (
    <figure className="flex flex-col gap-1.5 rounded-card bg-surface shadow-card p-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-inset">
        {isPending && <span className="text-label text-ink-subtle">{t('common.loading')}</span>}

        {data?.downloadUrl &&
          (isImage ? (
            <a href={data.downloadUrl} target="_blank" rel="noreferrer" className="size-full">
              <img
                src={data.downloadUrl}
                alt={attachment.filename}
                className="size-full object-cover"
                loading="lazy"
              />
            </a>
          ) : (
            <a
              href={data.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2 text-center text-label text-primary-600 underline"
            >
              {t('chart.panel.openFile')}
            </a>
          ))}
      </div>

      <figcaption className="flex flex-col gap-1">
        <span className="truncate text-label font-medium text-ink" title={attachment.filename}>
          {attachment.filename}
        </span>

        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{t(`imaging.types.${attachment.type}`)}</Badge>
          {attachment.tooth !== null && (
            <Badge tone="info">
              <span dir="ltr">{attachment.tooth}</span>
            </Badge>
          )}
        </span>

        <span className="text-[11px] text-ink-muted" dir="ltr">
          {formatDate(attachment.createdAt)}
        </span>

        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => void handleDelete()}
          >
            {t('common.delete')}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}
