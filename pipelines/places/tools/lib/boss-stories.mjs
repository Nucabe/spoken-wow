// Data/Stories.lua, as every boss story tool writes it.

import { LOCALES } from "../../../lib/dungeons.mjs";
import { luaString } from "./wiki.mjs";

/** A story as Lua: English, or { 1?: English, deDE: ... } as { "English", deDE = "..." }, locales in LOCALES order. */
function entry(story) {
  if (typeof story === "string") return luaString(story);
  const parts = [];
  if (story[1] !== undefined) parts.push(luaString(story[1]));
  for (const locale of LOCALES) if (story[locale] !== undefined) parts.push(`${locale} = ${luaString(story[locale])}`);
  return parts.length === 1 && story[1] !== undefined ? luaString(story[1]) : `{ ${parts.join(", ")} }`;
}

/** The Lua file: `stories` is { map: { key: story } }. */
export function renderStories(stories) {
  const blocks = Object.keys(stories)
    .map(Number)
    .sort((a, b) => a - b)
    .map((map) => {
      const lines = Object.keys(stories[map])
        .sort()
        .map((key) => `\t\t[${luaString(key)}] = ${entry(stories[map][key])},`);
      return `\t[${map}] = {\n${lines.join("\n")}\n\t},`;
    });
  return `-- The bosses' stories, by instance map and the boss's key (Data/Bosses.lua):
--   SpokenBossStories[map][key] = "The words of its story."
-- Written from the Adventure Guide's text and from warcraft.wiki.gg (CC BY-SA 4.0), rewritten in one
-- voice and kept to Classic (THIRD_PARTY.md). A boss with no entry shows that its story is not written yet.
-- Exported from the boss tables by pipelines/places/tools/bosses/export.mjs (make npcs-export).

SpokenBossStories = SpokenBossStories or {}
for map, stories in pairs({
${blocks.join("\n")}
}) do
\tSpokenBossStories[map] = stories
end
`;
}
