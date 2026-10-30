// Which boss rows the client's encounter list means.
//
// A boss is matched by encounter id, never by key: the game renames bosses and keeps their ids,
// and a renamed boss must keep its key and its stories. Pure, so the intake can be tested
// without a database.

import { keyOf } from "../../../lib/bosses.mjs";

/**
 * @param existing   boss rows as readBosses({ includeRetired: true }) returns them
 * @param fromClient { id, ids, map, name, position } per boss the client lists
 * @returns upserts (rows to write, existing keys kept) and retire (ids of live bosses the
 *   client no longer lists)
 */
export function reconcileBosses(existing, fromClient) {
  const byEncounter = new Map();
  for (const row of existing) {
    for (const id of new Set([row.id, ...row.encounterIds])) byEncounter.set(id, row);
  }

  const upserts = [];
  const seen = new Set();
  for (const boss of fromClient) {
    const ids = [...new Set([boss.id, ...(boss.ids ?? [])])];
    const match = ids.map((id) => byEncounter.get(id)).find(Boolean);
    if (match) {
      seen.add(match.id);
      upserts.push({
        ...match,
        map: boss.map,
        position: boss.position,
        encounterIds: [...new Set([...match.encounterIds, ...ids])],
        retired: false,
      });
    } else {
      upserts.push({
        id: boss.id,
        map: boss.map,
        key: keyOf(boss.name),
        position: boss.position,
        encounterIds: ids,
        creatureId: null,
        displayId: null,
        zone: null,
        retired: false,
      });
    }
  }

  const retire = existing.filter((row) => !row.retired && !seen.has(row.id)).map((row) => row.id);
  return { upserts, retire };
}
