import type { SupportedSite } from "./constants";

export function siteFilter(site: SupportedSite) {
  return {
    must: [{ key: "site", match: { value: site } }],
  };
}

export function staleSiteFilter(site: SupportedSite, currentPointIds: string[]) {
  if (currentPointIds.length === 0) {
    throw new Error("Refusing to construct a stale-vector filter without current point IDs");
  }

  return {
    must: [{ key: "site", match: { value: site } }],
    must_not: [{ has_id: currentPointIds }],
  };
}
