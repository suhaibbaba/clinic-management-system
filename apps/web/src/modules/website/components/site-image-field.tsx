import { ALLOWED_CLINIC_LOGO_MIME_TYPES, MAX_SITE_IMAGE_BYTES } from "@clinic/shared";
import { useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Img, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { imageWidth } from "@web/modules/website/lib/image-width";
import { useUploadSiteImage } from "@web/modules/website/queries";

export function SiteImageField({
  id,
  label,
  url,
  hasImage,
  onUpload,
  onRemove,
  width = 128,
  height = 80,
  minWidth,
}: {
  readonly id: string;
  readonly label: string;
  readonly url: string | undefined;
  readonly hasImage: boolean;
  readonly onUpload: (key: string, url: string) => void;
  readonly onRemove: () => void;
  readonly width?: number;
  readonly height?: number;
  readonly minWidth: number;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const upload = useUploadSiteImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    if (!ALLOWED_CLINIC_LOGO_MIME_TYPES.some((allowed) => allowed === file.type)) {
      toast.error("website.image.unsupported");
      return;
    }

    if (file.size > MAX_SITE_IMAGE_BYTES) {
      toast.error("website.image.tooLarge");
      return;
    }

    const pixels = await imageWidth(file);

    if (pixels !== null && pixels < minWidth) {
      toast.error("website.image.tooSmall", { width: minWidth, actual: pixels });
      return;
    }

    try {
      const uploaded = await upload.mutateAsync(file);
      onUpload(uploaded.key, uploaded.url);
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid={`site-image-${id}`} className="flex flex-col gap-1.5">
      <p className="text-label font-medium text-ink">{t(label)}</p>
      <p className="text-meta text-ink-subtle">
        {t("website.image.minWidth", { width: minWidth })}
      </p>

      <div className="flex items-center gap-3">
        {hasImage ? (
          <Img
            data-testid={`site-image-${id}-preview`}
            src={url ?? null}
            alt={t(label)}
            width={width}
            height={height}
            fit="cover"
            className="rounded-control border border-line bg-sunken"
          />
        ) : (
          <span
            data-testid={`site-image-${id}-empty`}
            aria-label={t("website.image.none")}
            style={{ width, height }}
            className="flex shrink-0 items-center justify-center rounded-control border border-dashed border-line-strong text-ink-subtle"
          >
            <Icon name="image" />
          </span>
        )}

        <span className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            type="file"
            id={`${id}-file`}
            data-testid={`site-image-${id}-input`}
            className="hidden"
            accept={ALLOWED_CLINIC_LOGO_MIME_TYPES.join(",")}
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            icon={<Icon name="upload" />}
            variant="secondary"
            size="sm"
            data-testid={`site-image-${id}-upload`}
            isLoading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {t(hasImage ? "website.image.replace" : "website.image.upload")}
          </Button>
          {hasImage && (
            <Button
              icon={<Icon name="trash" />}
              variant="ghost"
              size="sm"
              data-testid={`site-image-${id}-remove`}
              onClick={onRemove}
            >
              {t("website.image.remove")}
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
