type CentralLink = { id: string; legacyCollection?: string | null; legacyId?: string | number | null };
type LegacyRef = { collection: string; id: string | number };

/** Read-only comparison of identifiers. Callers decide how to investigate each gap. */
export function auditLeadLinks(centrals: CentralLink[], legacyRecords: LegacyRef[]) {
  const ref = (collection: string, id: string | number) => `${collection}:${String(id)}`;
  const available = new Set(legacyRecords.map((record) => ref(record.collection, record.id)));
  const linked = new Map<string, string>();
  const centralWithoutLink: string[] = [];
  const centralMissingLegacy: string[] = [];
  const duplicateCentralLinks: string[] = [];
  for (const central of centrals) {
    if (!central.legacyCollection || central.legacyId == null) {
      centralWithoutLink.push(central.id);
      continue;
    }
    const key = ref(central.legacyCollection, central.legacyId);
    if (!available.has(key)) centralMissingLegacy.push(central.id);
    if (linked.has(key)) duplicateCentralLinks.push(central.id);
    linked.set(key, central.id);
  }
  const orphanLegacy = legacyRecords
    .filter((record) => !linked.has(ref(record.collection, record.id)))
    .map((record) => ({ collection: record.collection, id: String(record.id) }));
  centralWithoutLink.sort();
  centralMissingLegacy.sort();
  duplicateCentralLinks.sort();
  orphanLegacy.sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id));
  return { centralWithoutLink, centralMissingLegacy, duplicateCentralLinks, orphanLegacy };
}
