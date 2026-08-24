/**
 * Gruppen-Schnittmenge (Spec 4.6.3): Mitarbeiter, die in ALLEN gewählten
 * Gruppen enthalten sind — im Gegensatz zur Vereinigung (Mitglied in
 * mindestens einer Gruppe). Reihenfolge der Eingabeliste bleibt erhalten.
 */
export function intersectGroupMembers<E extends { ID: number }>(
  employees: E[],
  groupIds: number[],
  groupMembersMap: Map<number, Set<number>>,
): E[] {
  return employees.filter(e =>
    groupIds.every(gid => (groupMembersMap.get(gid) ?? new Set<number>()).has(e.ID)),
  );
}
