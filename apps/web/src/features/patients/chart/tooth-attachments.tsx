import type { Attachment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { useAttachment } from '@web/features/patients/queries';
import { formatDate } from '@web/lib/format';

/**
 * X-rays taken of this tooth.
 *
 * The list endpoint returns metadata only — no key, no URL — so each thumbnail
 * asks for its own short-lived signed URL. That is the API's design, not a
 * limitation to work around: a URL that expires in minutes must not be minted
 * for images nobody opens.
 *
 * This whole section is hidden for roles ROLES.md forbids attachment data to;
 * the API refuses them regardless.
 */
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
        {isPending && <span className="text-label text-ink-subtle">{t('common.loading')}</span>}

        {isError && <span className="text-label text-danger-500">{t('errors.generic')}</span>}

        {data?.downloadUrl && isImage && (
          <img
            src={data.downloadUrl}
            alt={attachment.filename}
            className="size-full object-cover"
            loading="lazy"
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
