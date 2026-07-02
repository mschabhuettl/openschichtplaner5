export interface GroupTreeOption {
  id: number;
  /** Baumgerechtes Label: je Ebene eingerückt (└-Präfix ab Ebene 1). */
  label: string;
  depth: number;
  name: string;
}

/**
 * Gruppen als Baum (5GROUP.SUPERID) in Dropdown-Reihenfolge: Tiefensuche ab den
 * Wurzeln, Kinder alphabetisch — wie die Baumstruktur der Original-
 * Gruppenauswahl. Waisen (unbekannte SUPERID) und Zyklen landen als Wurzeln.
 */
type GroupLike = { ID: number; NAME: string; SUPERID?: number };

export function groupTreeOptions<T extends GroupLike>(groups: T[]): GroupTreeOption[] {
  const byId = new Map(groups.map(g => [g.ID, g]));
  const children = new Map<number, T[]>();
  const roots: T[] = [];
  for (const g of groups) {
    const sup = g.SUPERID ?? 0;
    if (sup && byId.has(sup) && sup !== g.ID) {
      if (!children.has(sup)) children.set(sup, []);
      children.get(sup)!.push(g);
    } else {
      roots.push(g);
    }
  }
  const byName = (a: GroupLike, b: GroupLike) => (a.NAME || '').localeCompare(b.NAME || '', 'de');
  const out: GroupTreeOption[] = [];
  const visited = new Set<number>();
  const walk = (g: GroupLike, depth: number) => {
    if (visited.has(g.ID)) return; // Zyklus-Schutz
    visited.add(g.ID);
    const indent = '   '.repeat(depth);
    out.push({ id: g.ID, name: g.NAME, depth, label: depth > 0 ? `${indent}└ ${g.NAME}` : g.NAME });
    for (const c of (children.get(g.ID) ?? []).sort(byName)) walk(c, depth + 1);
  };
  for (const r of roots.sort(byName)) walk(r, 0);
  // Sicherheitsnetz: durch Zyklen nie erreichte Gruppen flach anhängen
  for (const g of groups) if (!visited.has(g.ID)) out.push({ id: g.ID, name: g.NAME, depth: 0, label: g.NAME });
  return out;
}
