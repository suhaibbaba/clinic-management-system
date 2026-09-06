import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_TYPES,
  isFdiTooth,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type AttachmentType,
} from '@clinic/shared';
import { useRef, useState, type ChangeEvent, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, Icon, Input, Select, useToast } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { canDelete, canManageAttachments } from '@web/features/patients/permissions';
import {
  useAttachment,
  useDeleteAttachment,
  usePatientAttachments,
  useUploadAttachment,
} from '@web/features/patients/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { cn } from '@web/lib/cn';
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
            {/* Not "Type": the uploader above has a field by that name, and two
                identical labels on one screen is a guess about which is which. */}
            {t('imaging.filterType')}
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

      {attachments.isError && (
        <EmptyState icon="alert" title="errors.generic" hint="imaging.loadFailed" />
      )}

      {attachments.data?.length === 0 && (
        // The hint says where images will appear, not how to add one. The
        // drop zone above already says "add an X-ray" in bigger type thirty
        // pixels higher, and for someone without upload rights "upload the
        // first X-ray" was advice they cannot take.
        <EmptyState icon="image" title="imaging.empty" hint="imaging.emptyHint" />
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
  const [isOver, setIsOver] = useState(false);

  const send = async (file: File): Promise<void> => {
    // Checked here so an oversized or unsupported file never starts a round
    // trip; the API checks the stored object again, which is the real gate.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('imaging.tooLarge');
      return;
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.some((allowed) => allowed === file.type)) {
      toast.error('imaging.unsupportedType');
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
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];

    if (file) {
      await send(file);
    }

    // Lets the same file be picked again after a failure.
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsOver(false);

    const file = event.dataTransfer.files.item(0);

    if (file) {
      void send(file);
    }
  };

  return (
    <div className="rounded-card bg-surface p-5 shadow-card">
      {/*
        What the file is, before the file itself: both fields are sent with the
        upload, and a drop zone that fires the moment a file lands has to have
        them answered already.
      */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1 sm:flex-none">
          <label htmlFor="upload-type" className="mb-1 block text-label text-ink-muted">
            {t('imaging.type')}
          </label>
          <Select
            placeholder={t('common.placeholders.selectType')}
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
      </div>

      {/*
        A drop zone rather than a button in a row of filters.
        
        The upload used to be one `sm` button sitting between a type select and
        a tooth box, which read as a third filter — "I can't find the place to
        push X-rays" was the entirely fair verdict. A dashed target with the
        action written on it is what every other app has taught people to look
        for, and dragging a file onto it is how a scan actually arrives.

        Not a `<button>`: it contains one, and a button inside a button is not
        valid HTML. The keyboard path is the button in the middle.
      */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-panel border-2 border-dashed px-4 py-8 text-center',
          'transition-colors duration-150',
          isOver ? 'border-primary-500 bg-primary-50' : 'border-line-strong bg-inset/40',
        )}
      >
        <Icon name="upload" className="size-7 text-ink-subtle" />

        <p className="text-value font-semibold text-ink">{t('imaging.uploadTitle')}</p>
        <p className="text-label text-ink-muted">{t('imaging.dropHint')}</p>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
          onChange={(event) => void handleFile(event)}
        />

        <Button
          className="mt-2"
          icon={<Icon name="upload" />}
          isLoading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {t(upload.isPending ? 'imaging.uploading' : 'imaging.upload')}
        </Button>

        <p className="mt-1 text-label text-ink-subtle">{t('imaging.uploadHint')}</p>
      </div>
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
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-canvas">
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
            icon={<Icon name="trash" />}
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
