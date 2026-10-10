const PROJECT_SLUGS = [
  "samridhi-621-panchi",
  "ridhi-966-1",
  "ridhi-249-2",
  "sidhi-857",
  "samridhi-365",
  "sandhida-191",
  "dholera-estates",
  "dholera-estates-1",
  "dholera-estates-2",
  "samridhi-872-2",
] as const;

const NEWS_SLUGS = [
  "namo-gujarat-kaushalya-rozgar-mission",
  "cabinet-clears-semiconductor-units-dholera-surat",
  "indo-taiwan-industrial-park-sanand-dholera",
  "uae-presidents-visit-dholera-sir",
  "dholera-plots-tata-intel-semiconductor-future",
  "dholera-infrastructure-june-2026",
  "tata-electronics-semiconductor-fabs-gujarat",
  "tata-group-aerospace-base-dholera",
  "airbus-rd-centre-gati-shakti-vishwavidyalaya",
  "gujarat-space-station-isro",
  "dholera-airport-complete-by-december",
  "dholera-factories-for-the-world",
  "cbic-notifies-dholera-customs-port",
] as const;

export const OMANA_SITE_ORIGIN = "https://omanaprojects.com";

export const OMANA_PUBLIC_PATHS = [
  "/",
  "/about",
  "/services",
  "/projects",
  ...PROJECT_SLUGS.map((slug) => `/projects/${slug}`),
  "/contact",
  "/news",
  ...NEWS_SLUGS.map((slug) => `/news/${slug}`),
  "/blog",
] as const;

export function categoryForOmanaPath(path: string) {
  if (path.startsWith("/projects/")) return "Projects";
  if (path === "/projects") return "Projects";
  if (path.startsWith("/news/")) return "News";
  if (path === "/news") return "News";
  if (path.startsWith("/blog")) return "Blog";
  if (path === "/services") return "Services";
  if (path === "/about") return "About";
  if (path === "/contact") return "Contact";
  return "General";
}
