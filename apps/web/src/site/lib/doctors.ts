import type { PublicSite, PublicSiteDoctor, SiteDoctorProfile } from "@clinic/shared";

export const visibleDoctors = (site: PublicSite): PublicSiteDoctor[] => {
  const hidden = new Set(site.content.doctors.hidden);

  return site.doctors.filter((doctor) => !hidden.has(doctor.id));
};

export const profileOf = (site: PublicSite, doctorId: string): SiteDoctorProfile | undefined =>
  site.content.doctors.profiles.find((profile) => profile.doctorId === doctorId);
