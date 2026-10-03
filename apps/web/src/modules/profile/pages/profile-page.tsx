import { personName } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Badge,
  Button,
  EmailLink,
  Icon,
  PageHeader,
  PersonName,
  PhoneLink,
  useToast,
} from "@clinic/ui";
import { sendPasswordReset } from "@web/shared/api/users";
import { UserFormModal } from "@web/modules/users/components/user-form-modal";
import { PasskeysSection } from "@web/modules/profile/components/passkeys-section";
import { useSession } from "@web/shared/providers/session";
import { errorToast } from "@web/shared/lib/api-error";

export function ProfilePage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user } = useSession();
  const [editing, setEditing] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const sendLink = async (): Promise<void> => {
    if (!user?.email || sendingLink) {
      return;
    }

    setSendingLink(true);

    try {
      await sendPasswordReset(user.id);
      toast.success("profile.passwordLinkSent", { email: user.email });
    } catch (error) {
      toast.error(...errorToast(error));
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <div data-testid="profile-page" className="flex flex-col gap-5">
      <PageHeader data-testid="profile-header" title="profile.title" subtitle="profile.subtitle" />

      {user && (
        <UserFormModal
          data-testid="profile-form-modal"
          open={editing}
          onOpenChange={setEditing}
          userId={user.id}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          data-testid="profile-details"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Icon name="user" size="md" className="text-ink-muted" />
            <h2 className="flex-1 text-heading font-medium text-ink">{t("profile.details")}</h2>
            {user && (
              <Button
                icon={<Icon name="edit" />}
                variant="secondary"
                size="sm"
                data-testid="profile-edit"
                onClick={() => setEditing(true)}
              >
                {t("common.edit")}
              </Button>
            )}
          </div>

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
          data-testid="profile-sign-in"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <div className="flex items-center gap-2">
            <Icon name="lock" size="md" className="text-ink-muted" />
            <h2 className="text-heading font-medium text-ink">{t("profile.signIn")}</h2>
          </div>

          <div data-testid="profile-password" className="mt-3">
            <h3 className="text-value font-semibold text-ink">{t("profile.changePassword")}</h3>
            <p className="mt-1 text-label text-ink-muted">
              {t(user?.email ? "profile.passwordLinkHint" : "profile.passwordNoEmail")}
            </p>

            <Button
              icon={<Icon name="mail" />}
              variant="secondary"
              data-testid="profile-send-password-link"
              isLoading={sendingLink}
              aria-disabled={!user?.email || sendingLink || undefined}
              className="mt-3"
              onClick={() => void sendLink()}
            >
              {t("profile.sendPasswordLink")}
            </Button>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <PasskeysSection />
          </div>
        </section>
      </div>
    </div>
  );
}
