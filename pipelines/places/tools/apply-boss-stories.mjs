#!/usr/bin/env node
// Records the boss stories rewritten into one voice in boss_line, as English, origin 'rewritten'.
//
//   node tools/apply-boss-stories.mjs <dir of rewritten *.json>
//
// Each JSON file is an array of { map, key, text }: a boss's story (key = its key). A dungeon's own
// (key "_") is skipped: a dungeon's page is empty. tools/build-boss-stories.mjs --packets writes the
// source material they were rewritten from. A story's source is the wiki article boss-sources.json
// names for the boss, where it names one.
//
// A story an editor has changed on the site stays current: the rewrite lands beneath it. Data/Stories.lua
// is written from the table by make npcs-export. Credit is in THIRD_PARTY.md.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { close, readBosses, recordStory, requireDatabase } from "./bosses/store.mjs";
import { loadEnvFile } from "./lib/env.mjs";
import { ROOT, sourceUrl } from "./lib/wiki.mjs";

const dir = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!dir) {
  console.error("usage: apply-boss-stories.mjs <dir of rewritten *.json>");
  process.exit(1);
}
await loadEnvFile();
try {
  requireDatabase("apply-boss-stories");
  await main();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await close();
}

async function main() {
  const idOf = new Map((await readBosses()).map((b) => [`${b.map}\t${b.key}`, b.id]));
  const titles = JSON.parse(await readFile(join(ROOT, "pipelines/places/tools/boss-sources.json"), "utf8"));
  const titleOf = new Map(titles.filter((s) => s.wikiTitle).map((s) => [`${s.map}\t${s.key}`, s.wikiTitle]));

  const counts = { inserted: 0, unchanged: 0, "kept-edit": 0 };
  const unresolved = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()) {
    for (const row of JSON.parse(await readFile(join(dir, file), "utf8"))) {
      const text = String(row.text ?? "").trim();
      if (!text || row.key === "_") continue;
      const at = `${row.map}\t${row.key}`;
      const bossId = idOf.get(at);
      if (bossId === undefined) {
        unresolved.push(`${row.map} "${row.key}" (${file})`);
        continue;
      }
      const title = titleOf.get(at);
      const source = title ? sourceUrl(title) : null;
      counts[await recordStory({ bossId, lang: "enUS", text, source, origin: "rewritten" })]++;
    }
  }

  console.log(`${counts.inserted} inserted, ${counts.unchanged} unchanged, ${counts["kept-edit"]} kept-edit`);
  if (unresolved.length > 0) {
    console.log(`${unresolved.length} stories name no live boss:`);
    for (const line of unresolved) console.log(`  ${line}`);
  }
  if (counts.inserted > 0) console.log("then: make npcs-export");
}
