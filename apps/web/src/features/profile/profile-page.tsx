import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, personName, type ChangePasswordInput } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  Avatar,
  Badge,
  Button,
  EmailLink,
  FormField,
  Icon,
  PageHeader,
  PasswordInput,
  PersonName,
  PhoneLink,
  useToast,
} from "@clinic/ui";
import { authApi } from "@web/features/auth/api";
import { ProfileFormModal } from "@web/features/profile/profile-form-modal";
import { useSession } from "@web/features/auth/session";
import { ApiError, errorMessageKey } from "@web/lib/api-error";

export function ProfilePage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user, logout } = useSession();
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.changePassword(values);
      reset();
      toast.success("profile.passwordChanged");
      // The API revokes every session on a password change, so sign out here too.
      await logout();
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.statusCode === 401
          ? "auth.invalidCredentials"
          : errorMessageKey(error),
      );
    }
  });

  return (
    <div data-testid="profile-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="profile-header"
        title="profile.title"
        subtitle="profile.subtitle"
        {...(user && {
          primaryAction: (
            <Button
              icon={<Icon name="edit" />}
              data-testid="profile-edit"
              onClick={() => setEditing(true)}
            >
              {t("profile.edit")}
            </Button>
          ),
        })}
      />

      {user && (
        <ProfileFormModal
          data-testid="profile-form-modal"
          open={editing}
          onOpenChange={setEditing}
          user={user}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          data-testid="profile-details"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <h2 className="text-heading font-medium text-ink">{t("profile.details")}</h2>

          {/* Read-only here: a staff photo is set by the admin on the users screen, where accounts
              are managed. */}
          <div className="mt-3 flex items-center gap-3">
            <Avatar
              data-testid="profile-avatar"
              name={personName(user?.name, i18n.language)}
              tintKey={user?.id ?? ""}
              src={user?.photoUrl}
              size={64}
            />
            <PersonName
              name={user?.name}
              data-testid="profile-name"
              className="text-value font-medium text-ink"
            />
          </div>

          {/* The summary box the drawers and the patient file use: a 12px
              caption over the value, two to a row. */}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-value">
            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("users.name")}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                <PersonName name={user?.name} showBoth />
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("users.phone")}</dt>
              <dd className="mt-0.5 font-medium">
                <PhoneLink value={user?.phone} />
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("users.email")}</dt>
              <dd className="mt-0.5 font-medium">
                <EmailLink value={user?.email} />
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("users.role")}</dt>
              <dd className="mt-0.5">
                {user && (
                  <Badge tone="info" data-testid="profile-role">
                    {t(`roles.${user.role}`)}
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          data-testid="profile-password"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <h2 className="text-heading font-medium text-ink">{t("profile.changePassword")}</h2>

          <form
            data-testid="profile-password-form"
            className="mt-3 flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <FormField
              label="profile.currentPassword"
              htmlFor="current-password"
              error={errors.currentPassword}
              errorKey={errors.currentPassword ? "errors.validation.passwordMin" : undefined}
            >
              <PasswordInput
                placeholder={t("common.placeholders.password")}
                id="current-password"
                data-testid="profile-field-current-password"
                autoComplete="current-password"
                hasError={errors.currentPassword !== undefined}
                {...register("currentPassword")}
              />
            </FormField>

            <FormField
              label="profile.newPassword"
              htmlFor="new-password"
              error={errors.newPassword}
              errorKey={
                errors.newPassword?.type === "custom"
                  ? "errors.validation.passwordSame"
                  : errors.newPassword
                    ? "errors.validation.passwordMin"
                    : undefined
              }
            >
              <PasswordInput
                placeholder={t("common.placeholders.password")}
                id="new-password"
                data-testid="profile-field-new-password"
                autoComplete="new-password"
                hasError={errors.newPassword !== undefined}
                {...register("newPassword")}
              />
            </FormField>

            <Button
              icon={<Icon name="key" />}
              type="submit"
              data-testid="profile-change-password"
              isLoading={isSubmitting}
              className="self-start"
            >
              {t("profile.changePassword")}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
