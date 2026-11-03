import type { PublicSite, PublicSiteDoctor, SiteDocument, SiteDoctorProfile } from "@clinic/shared";

export const visibleDoctors = (
  site: PublicSite,
  siteDocument: SiteDocument,
): PublicSiteDoctor[] => {
  const hidden = new Set(siteDocument.collections.doctors.hidden);

  return site.doctors.filter((doctor) => !hidden.has(doctor.id));
};

export const profileOf = (
  siteDocument: SiteDocument,
  doctorId: string,
): SiteDoctorProfile | undefined =>
  siteDocument.collections.doctors.profiles.find((profile) => profile.doctorId === doctorId);
