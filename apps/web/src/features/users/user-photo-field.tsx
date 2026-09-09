import {
  ALLOWED_USER_PHOTO_MIME_TYPES,
  MAX_USER_PHOTO_BYTES,
  personName,
  type User,
} from '@clinic/shared';
import { useRef, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Icon, useToast } from '@web/components/ui';
import { useRemoveUserPhoto, useUploadUserPhoto } from '@web/features/users/queries';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * The staff photo on the user form: the face as it will be drawn, and the two
 * buttons that change it.
 *
 * Only on an existing user, because the upload is addressed to a user id and a
 * form that has not been saved has none. Creating somebody and then adding
 * their photo is one extra step and the honest one — the alternative was
 * holding bytes in the browser through a submit that may fail.
 *
 * The type and size are checked here **before** anything is signed rather than
 * after it lands, because a two-megabyte ceiling that only announces itself
 * after a slow upload is not a limit anyone can work with. The API checks the
 * stored bytes again, which is the real gate — this one is a courtesy.
 */
export function UserPhotoField({ user }: { readonly user: User }): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadUserPhoto();
  const remove = useRemoveUserPhoto();

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    if (!ALLOWED_USER_PHOTO_MIME_TYPES.some((allowed) => allowed === file.type)) {
      toast.error('users.photoUnsupported');
      return;
    }

    if (file.size > MAX_USER_PHOTO_BYTES) {
      toast.error('users.photoTooLarge');
      return;
    }

    try {
      await upload.mutateAsync({ id: user.id, file });
      toast.success('users.photoUpdated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const clear = async (): Promise<void> => {
    try {
      await remove.mutateAsync(user.id);
      toast.success('users.photoRemoved');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar
        name={personName(user.name, i18n.language)}
        tintKey={user.id}
        src={user.photoUrl}
        className="size-16"
      />

      <div className="flex flex-col items-start gap-1">
        <p className="text-label text-ink-muted">{t('users.photoHint')}</p>

        <span className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_USER_PHOTO_MIME_TYPES.join(',')}
            aria-label={t('users.photo')}
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              // Cleared so picking the same file twice still fires a change.
              event.target.value = '';
            }}
          />

          <Button
            icon={<Icon name="upload" />}
            variant="secondary"
            size="sm"
            isLoading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {t(user.photoUrl ? 'users.replacePhoto' : 'users.uploadPhoto')}
          </Button>

          {user.photoUrl && (
            <Button
              icon={<Icon name="trash" />}
              variant="secondary"
              size="sm"
              isLoading={remove.isPending}
              onClick={() => void clear()}
            >
              {t('common.delete')}
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
