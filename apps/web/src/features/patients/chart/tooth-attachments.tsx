import type { Attachment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Img } from '@web/components/ui/img';
import { Skeleton } from '@web/components/ui/skeleton';
import { useAttachment } from '@web/features/patients/queries';
import { formatDate } from '@web/lib/format';

// The list endpoint returns metadata only, so each thumbnail asks for its own short-lived URL — one
// that expires in minutes must not be minted for images nobody opens.
export function ToothAttachments({
  attachments,
}: {
  attachments: readonly Attachment[];
}): JSX.Element {
  const { t } = useTranslation();

  if (attachments.length === 0) {
    return <p className="text-value text-ink-muted">{t('chart.panel.noAttachments')}</p>;
  }

  return (
    <ul className="grid grid-cols-3 gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <AttachmentThumbnail attachment={attachment} />
        </li>
      ))}
    </ul>
  );
}

function AttachmentThumbnail({ attachment }: { attachment: Attachment }): JSX.Element {
  const { t } = useTranslation();
  // The list response carries no URL; ask for one only for what is on screen.
  const { data, isPending, isError } = useAttachment(attachment.id, true);

  const isImage = attachment.mime.startsWith('image/');

  return (
    <figure className="flex flex-col gap-1">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-control border border-line bg-canvas">
        {isPending && <Skeleton className="size-full rounded-none" />}

        {isError && <span className="text-label text-danger-500">{t('errors.generic')}</span>}

        {data?.downloadUrl && isImage && (
          <Img
            src={data.downloadUrl}
            alt={attachment.filename}
            aspectRatio="1/1"
            className="size-full"
          />
        )}

        {data?.downloadUrl && !isImage && (
          <a
            href={data.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="px-1 text-center text-label text-primary-600 underline"
          >
            {t('chart.panel.openFile')}
          </a>
        )}
      </div>

      <figcaption className="truncate text-[11px] text-ink-muted" title={attachment.filename}>
        {formatDate(attachment.createdAt)}
      </figcaption>
    </figure>
  );
}
