#!/usr/bin/env node
// What each boss casts, from the Abilities of its warcraft.wiki.gg article (CC BY-SA 4.0): the spell ids in its
// {{Abilities|name|text|icon=|id=}} lines that are the boss's own: under its heading (or every phase of its
// fight where no heading names it), not under another creature's name, and not marked for another season.
//
// Usage: node tools/boss-abilities.mjs <out.json>      out.json: [{ map, key, name, title, spells: [ids] }]
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { flat, readBosses } from "../../lib/bosses.mjs";
import { cachedQuery, creatureTitles, isDisambiguation, ROOT } from "./lib/wiki.mjs";

// A heading that is not a boss: a variant of the fight or a crowd with it.
const NOT_BOSS = /season|hardcore|heroic|mythic|phase|adds?\b|guards?|protectors?|minions?|trash|pet/i;
// A heading that parts one fight rather than naming who casts: a phase or form, the shared or unique abilities,
// the original fight where the page also has Classic Timewalking's.
const PART = /\bphase\b|\bform$|^(?:shared |unique )?abilities$|^original$/i;
const CROWD = /season|hardcore|heroic|mythic|adds?\b|guards?|protectors?|minions?|trash|pet/i;
// Season of Mastery's brands on Ebonroc and Flamegor: never in Forever.
const OTHER_SEASON = /\(\s*Season of Mastery only\s*\)/i;
const TEMPLATE = /\{\{abilities\|/i;

/** Wiki markup to plain words: [[a|b]] -> b, bold and italics dropped. */
const plain = (s) =>
  s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .trim();

/** The name (first unnamed parameter) of the line's {{Abilities}} template, markup kept. */
function templateName(line) {
  const body = line.slice(line.search(TEMPLATE) + "{{abilities|".length);
  let depth = 0;
  let field = "";
  for (const c of body) {
    if (c === "[" || c === "{") depth++;
    if (c === "]" || c === "}") {
      if (depth === 0) break;
      depth--;
    }
    if (c === "|" && depth === 0) {
      if (!/^\s*[\w ]+=/.test(field)) return field.trim();
      field = "";
    } else field += c;
  }
  return /^\s*[\w ]+=/.test(field) ? "" : field.trim();
}

/** The creature a line stands for, where it is a name on its own: '''Ohgan''', ;[[Jank]], ====Sir Zeliek====. */
function ownerOf(line) {
  const m = line.match(/^'''(.+?)'''\s*:?\s*$/) ?? line.match(/^;\s*(.+?)\s*$/) ?? line.match(/^={4,}\s*(.+?)\s*={4,}\s*$/);
  const name = m && plain(m[1]);
  return name && !PART.test(name) ? name : null;
}

/** A bullet whose sub-bullets are another creature's: a name on its own, an ability named by a link, a summon. */
function namesCreature(line) {
  const alone = line.match(/^\*+\s*'''(.+?)'''\s*:?\s*$/) ?? line.match(/^\*+\s*('{2,3})?(\[\[[^\]]+\]\])\1\s*:?\s*$/);
  if (alone) return !PART.test(plain(alone.at(-1)));
  if (!TEMPLATE.test(line)) return false;
  const name = templateName(line);
  return name.includes("[[") || /^summon\b/i.test(name);
}

/** The ids of one part of the section, the lines of creatures other than `name` left out. */
function idsOfPart(chunk, mine) {
  const lines = chunk.split(/\r?\n/);
  const owners = lines.map(ownerOf);
  const bossNamed = owners.some((o) => o && mine(o));
  const groups = new Map([[null, []]]);
  let owner = null;
  let stack = [];
  for (const [i, line] of lines.entries()) {
    if (owners[i]) {
      owner = owners[i];
      stack = [];
      continue;
    }
    const depth = line.match(/^\*+/)?.[0].length ?? 0;
    if (depth === 0) stack = [];
    while (stack.length && stack.at(-1).depth >= depth) stack.pop();
    const under = stack.some((s) => s.other);
    if (depth) stack.push({ depth, other: namesCreature(line) });
    if (under || OTHER_SEASON.test(line) || (bossNamed && owner !== null && !mine(owner))) continue;
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner).push(...[...line.matchAll(/\{\{abilities\|[^\n]*?\bid=(\d+)/gi)].map((m) => Number(m[1])));
  }
  // An encounter of several (The Ugly Goblin's five goblins): one of each in turn, so the cap leaves none out.
  const [first, ...rest] = [...groups.values()];
  const out = [...first];
  for (let k = 0; rest.some((ids) => k < ids.length); k++) for (const ids of rest) if (k < ids.length) out.push(ids[k]);
  return out;
}

/** The spell ids of the article's Abilities that belong to `name`. */
export function abilities(text, name) {
  const section = text.match(/^==\s*Abilities\s*==\s*$([\s\S]*?)(?=^==[^=]|(?![\s\S]))/m);
  if (!section) return [];
  const mine = (s) => {
    const f = flat(plain(s));
    return f !== "" && (f.includes(flat(name)) || flat(name).includes(f));
  };
  const parts = section[1].split(/^===(?!=)\s*(.+?)\s*===\s*$/m);
  const headings = [];
  for (let i = 1; i < parts.length; i += 2) headings.push({ heading: parts[i], chunk: parts[i + 1] });
  const named = headings.filter((h) => mine(h.heading));
  const own = named.length
    ? named
    : headings.filter(
        (h) => (PART.test(h.heading) && !CROWD.test(h.heading)) || (headings.length === 1 && !NOT_BOSS.test(h.heading)),
      );
  return [...new Set([parts[0], ...own.map((h) => h.chunk)].flatMap((chunk) => idsOfPart(chunk, mine)))];
}

async function wikitext(title) {
  const query = `action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`;
  const { json } = await cachedQuery(query, `${title}#wikitext`);
  return json?.parse ? { text: json.parse.wikitext, title: json.parse.title } : null;
}

async function main() {
  // boss-sources.json: for each boss the wiki pages the research found (wikiTitle, abilityTitle) and its
  // creature ids. The pages tried first.
  const hints = new Map(
    JSON.parse(await readFile(join(ROOT, "pipelines/zones/tools/boss-sources.json"), "utf8")).map((h) => [`${h.map}\t${h.key}`, h]),
  );
  const out = [];
  const bosses = await readBosses();
  for (const [n, boss] of bosses.entries()) {
    process.stdout.write(`\r  ${n + 1}/${bosses.length}`);
    const hint = hints.get(`${boss.map}\t${boss.key}`);
    const titles = [hint?.abilityTitle, hint?.wikiTitle, ...creatureTitles(boss.name)].filter(Boolean);
    for (const title of [...new Set(titles)]) {
      let page;
      try {
        page = await wikitext(title);
      } catch {
        continue;
      }
      if (!page || isDisambiguation(page.text)) continue;
      const spells = abilities(page.text, boss.name);
      if (spells.length) {
        out.push({ map: boss.map, key: boss.key, name: boss.name, title: page.title, spells });
        break;
      }
    }
  }
  process.stdout.write("\n");
  await writeFile(process.argv[2], JSON.stringify(out, null, 1));
  console.log(`${out.length} of ${bosses.length} bosses have abilities in their article -> ${process.argv[2]}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
