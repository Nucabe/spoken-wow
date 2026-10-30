// Which boss rows the client's encounter list means.
//
// A boss is matched by encounter id, never by key: the game renames bosses and keeps their ids,
// and a renamed boss must keep its key and its stories. Pure, so the intake can be tested
// without a database.

import { keyOf } from "../../../lib/bosses.mjs";

/**
 * @param existing   boss rows as readBosses({ includeRetired: true }) returns them
 * @param fromClient { id, ids, map, name, position, key? } per boss the client lists. `key`, where
 *   given, is what a new boss is filed under: a boss the game names as its creature keeps the
 *   encounter's key (bosses.mjs renameAsCreatures). Else the key is minted from `name`.
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
        key: boss.key ?? keyOf(boss.name),
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

const sameIds = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

/** What reconcileBosses' result would change: { inserted, updated } rows of `upserts`. */
export function bossChanges(existing, upserts) {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const inserted = [];
  const updated = [];
  for (const row of upserts) {
    const was = byId.get(row.id);
    if (!was) inserted.push(row);
    else if (
      was.map !== row.map || was.position !== row.position || (was.zone ?? null) !== (row.zone ?? null) ||
      was.retired !== row.retired || !sameIds(was.encounterIds, row.encounterIds)
    ) updated.push(row);
  }
  return { inserted, updated };
}

/**
 * The names of `wanted` ({ kind, id, lang, name }) recordName would write, given `state`, store
 * readNameState's maps by kind ({ boss, instance }). A name equal to the current one records
 * nothing, and neither does one already filed beneath an edited current name.
 */
export function nameChanges(state, wanted) {
  return wanted.filter((n) => {
    const at = state[n.kind]?.get(n.id)?.get(n.lang);
    if (at?.name === n.name) return false;
    return !(at?.origin === "edited" && at.latest === n.name);
  });
}
