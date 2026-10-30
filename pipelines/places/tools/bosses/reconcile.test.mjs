import test from "node:test";
import assert from "node:assert/strict";

import { reconcileBosses } from "./reconcile.mjs";

const row = (over) => ({
  id: 1,
  map: 70,
  key: "x",
  position: 1,
  encounterIds: [over.id ?? 1],
  creatureId: null,
  displayId: null,
  zone: null,
  retired: false,
  ...over,
});
const client = (over) => ({ id: 1, ids: [over.id ?? 1], map: 70, name: "X", position: 1, ...over });

test("a boss keeps its key when the client renames it", () => {
  const { upserts } = reconcileBosses(
    [row({ id: 2756, key: "targorr the dread" })],
    [client({ id: 2756, name: "Targorr the Terrible" })],
  );
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].key, "targorr the dread");
});

test("a new encounter mints its key from the English name", () => {
  const { upserts } = reconcileBosses([], [client({ id: 9999, name: "Mr. Smite" })]);
  assert.equal(upserts[0].key, "mr smite");
  assert.equal(upserts[0].id, 9999);
});

test("a boss the client no longer lists is retired, not dropped", () => {
  const { upserts, retire } = reconcileBosses(
    [row({ id: 2758, key: "gone" }), row({ id: 2756, key: "kept" })],
    [client({ id: 2756, name: "Kept" })],
  );
  assert.deepEqual(retire, [2758]);
  assert.ok(!upserts.some((u) => u.id === 2758));
});

test("a boss matched through another difficulty's encounter id", () => {
  const { upserts } = reconcileBosses(
    [row({ id: 3, key: "old key", encounterIds: [3, 1] })],
    [client({ id: 1, ids: [1, 3], name: "Newer Name" })],
  );
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].key, "old key");
  assert.equal(upserts[0].id, 3);
});

test("a retired boss that comes back is un-retired, and one already retired is not retired again", () => {
  const { upserts, retire } = reconcileBosses(
    [row({ id: 5, key: "back", retired: true }), row({ id: 6, key: "still gone", retired: true })],
    [client({ id: 5, name: "Back" })],
  );
  assert.equal(upserts[0].retired, false);
  assert.deepEqual(retire, []);
});
