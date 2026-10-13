import type { PublicSiteDoctor } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Icon, PersonName, Switch, usePersonName } from "@clinic/ui";
import { DraftText } from "@web/modules/website/components/draft-text";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { blankText } from "@web/modules/website/lib/site-draft";

export function DoctorsField({
  doctors,
}: {
  readonly doctors: readonly PublicSiteDoctor[];
}): JSX.Element {
  const { t } = useTranslation();
  const nameOf = usePersonName();
  const { draft, update } = useEditor();
  const [open, setOpen] = useState<string | null>(null);
  const { hidden, profiles } = draft.doctors;

  if (doctors.length === 0) {
    return (
      <p data-testid="doctors-field-empty" className="text-label text-ink-muted">
        {t("website.doctors.empty")}
      </p>
    );
  }

  const openProfile = (doctorId: string): void => {
    if (open === doctorId) {
      setOpen(null);
      return;
    }

    if (!profiles.some((profile) => profile.doctorId === doctorId)) {
      update((current) => ({
        ...current,
        doctors: {
          ...current.doctors,
          profiles: [
            ...current.doctors.profiles,
            { doctorId, title: blankText(), bio: blankText() },
          ],
        },
      }));
    }

    setOpen(doctorId);
  };

  return (
    <ul data-testid="doctors-field" className="flex flex-col divide-y divide-line">
      {doctors.map((doctor) => {
        const shown = !hidden.includes(doctor.id);
        const index = profiles.findIndex((profile) => profile.doctorId === doctor.id);

        return (
          <li key={doctor.id} data-testid={`doctors-field-${doctor.id}`} className="py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={nameOf(doctor.name)}
                  tintKey={doctor.id}
                  src={doctor.photoUrl}
                  size={32}
                />
                <span className="min-w-0">
                  <PersonName name={doctor.name} className="block truncate text-value text-ink" />
                  <span className="block truncate text-label text-ink-muted">
                    {doctor.specialty}
                    {!doctor.photoUrl && ` · ${t("website.doctors.noPhoto")}`}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Button
                  variant="quiet"
                  size="sm"
                  icon={<Icon name="edit" />}
                  aria-expanded={open === doctor.id}
                  data-testid={`doctors-field-${doctor.id}-profile`}
                  onClick={() => openProfile(doctor.id)}
                >
                  {t("website.doctors.editProfile")}
                </Button>
                <Switch
                  hideLabel
                  data-testid={`doctors-field-${doctor.id}-switch`}
                  checked={shown}
                  label={t("website.doctors.show", { name: nameOf(doctor.name) })}
                  onCheckedChange={(checked) =>
                    update((current) => ({
                      ...current,
                      doctors: {
                        ...current.doctors,
                        hidden: checked
                          ? current.doctors.hidden.filter((id) => id !== doctor.id)
                          : [...current.doctors.hidden, doctor.id],
                      },
                    }))
                  }
                />
              </span>
            </div>

            {open === doctor.id && index >= 0 && (
              <div className="mt-3 flex flex-col gap-3 rounded-panel border border-line bg-sunken p-3">
                <DraftText
                  path={`doctors.profiles.${index}.title`}
                  label="website.doctors.title"
                  hint="website.doctors.titleHint"
                />
                <DraftText
                  path={`doctors.profiles.${index}.bio`}
                  label="website.doctors.bio"
                  multiline
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
