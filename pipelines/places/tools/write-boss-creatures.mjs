#!/usr/bin/env node
// Writes Data/Creatures.lua for Spoken NPCs from boss_creatures.py's JSON:
//
//   node pipelines/places/tools/write-boss-creatures.mjs <boss_creatures.json> [--out <file>]
//
// Where the database gives a boss no model, the Adventure Guide's (retail JournalEncounter tables) fills in:
// its creature's model where Forever's client has that model.
// boss-creatures-manual.json then sets the creature and model of the bosses the database cannot give, each
// with its evidence, and fails the run on a model the client does not have.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { guideFinder, readBosses } from "../../lib/bosses.mjs";
import { FOREVER_BUILD, RETAIL_BUILD, wagoTable } from "../../lib/wago.mjs";
import { renderCreatures } from "./lib/boss-creatures.mjs";
import { ROOT } from "./lib/wiki.mjs";

const args = process.argv.slice(2);
const input = args[0] && !args[0].startsWith("--") ? args[0] : null;
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : join(ROOT, "addons/Spoken_NPCs/Data/Creatures.lua");
if (!input) throw new Error("usage: write-boss-creatures.mjs <boss_creatures.json> [--out file]");

const rows = JSON.parse(await readFile(input, "utf8"));

const guideEncounters = await wagoTable("JournalEncounter", { build: RETAIL_BUILD, locale: "enUS" });
const guideCreatures = await wagoTable("JournalEncounterCreature", { build: RETAIL_BUILD, locale: "enUS" });
const models = new Set((await wagoTable("CreatureDisplayInfo", { build: FOREVER_BUILD, locale: "enUS" })).map((r) => Number(r.ID)));
const guideOf = guideFinder(guideEncounters);
const inOrder = (list) => [...list].sort((a, b) => Number(a.OrderIndex) - Number(b.OrderIndex));

const have = new Map(rows.map((r) => [`${r.map}\t${r.key}`, r]));
/** The row of the boss `key` of `map`, a new empty one where there is none. */
function rowFor(map, key) {
  let row = have.get(`${map}\t${key}`);
  if (!row) {
    row = { map, key, creature: null, display: null };
    have.set(`${map}\t${key}`, row);
    rows.push(row);
  }
  return row;
}
// A model the client does not have draws an empty portrait: none, so the guide's or the unknown boss's is drawn.
for (const row of rows) if (row.display && !models.has(row.display)) row.display = null;
let filledModels = 0;
const bosses = await readBosses();
for (const boss of bosses) {
  const guide = guideOf(boss);
  if (!guide) continue;
  const row = rowFor(boss.map, boss.key);
  if (!row.display) {
    const model = inOrder(guideCreatures.filter((c) => c.JournalEncounterID === guide.ID))
      .map((c) => Number(c.CreatureDisplayInfoID))
      .find((id) => id && models.has(id));
    if (model) {
      row.display = model;
      filledModels++;
    }
  }
}
// Creatures only Forever has, known from Efficient Games' records of the fight, are not in the database, and a
// few of its creatures are drawn with another model in Forever than the database's.
const fixed = JSON.parse(await readFile(join(ROOT, "pipelines/places/tools/boss-creatures-manual.json"), "utf8"));
const known = new Set(bosses.map((b) => `${b.map}\t${b.key}`));
for (const entry of fixed) {
  const at = `${entry.map}\t${entry.key}`;
  if (!known.has(at)) throw new Error(`boss-creatures-manual.json: ${entry.map} "${entry.key}" is not a boss in Data/Bosses.lua`);
  if (entry.display && !models.has(entry.display)) {
    throw new Error(`boss-creatures-manual.json: ${entry.key}'s display ${entry.display} is not in the client's CreatureDisplayInfo`);
  }
  const row = rowFor(entry.map, entry.key);
  if ("creature" in entry) row.creature = entry.creature;
  if ("display" in entry) row.display = entry.display;
}
const kept = rows.filter((r) => r.creature || r.display);
await writeFile(OUT, renderCreatures(kept), "utf8");
console.log(kept.length, "bosses ->", OUT, `(guide: ${filledModels} models; by hand: ${fixed.length} creatures)`);
