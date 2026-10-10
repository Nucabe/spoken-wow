/**
 * A line's voice, read from its speakers' NPCs (migration 0070). Against a real Postgres,
 * because what is being tested is the catalogue's join.
 *
 * Needs DATABASE_URL and migrations applied.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

const { closeDb, db } = await import("@/lib/db");
const { corpus } = await import("./catalogue");

const WHOLE_CORPUS = { timeout: 20_000 };

let questId: number;
let lineId: string;
let npcIds: number[];

beforeEach(() => {
  questId = 950_000_000 + Math.floor(Math.random() * 40_000_000);
  lineId = `q:${questId}:accept`;
  npcIds = [questId, questId + 1, questId + 2];
});

afterEach(async () => {
  await db().query(`delete from "quest_line_speaker" where "lineId" = $1`, [lineId]);
  await db().query(`delete from "quest_line" where "lineId" = $1`, [lineId]);
  await db().query(`delete from "npc" where "npcId" = any($1::int[])`, [npcIds]);
  await db().query(`delete from "entity_name" where "entityId" = any($1::text[])`, [npcIds.map(String)]);
});

afterAll(closeDb);

/** An English line spoken by `speakers`, each written with the voice the extract gave it. */
async function line(speakers: { npcId: number; race: string; gender: string; flavor: string | null }[]) {
  await db().query(
    `insert into "quest_line"
       ("lineId", "variant", "lang", "version", "isCurrent", "origin", "source", "questId",
        "questTitle", "fileName", "text", "originalText", "generatable")
     values ($1, 0, 'enUS', 1, true, 'extracted', 'accept', $2, 'A Test Quest', $3,
             'Bring me six wolf pelts.', 'Bring me six wolf pelts.', true)`,
    [lineId, questId, `${questId}-accept`],
  );
  for (const [index, speaker] of speakers.entries()) {
    await db().query(
      `insert into "quest_line_speaker"
         ("lineId", "variant", "lang", "ord", "npcType", "npcId", "npcName", "race", "gender",
          "flavor", "voice")
       values ($1, 0, 'enUS', $2, 'creature', $3, 'Test Speaker', $4, $5, $6, $7)`,
      [
        lineId, 1_900_000_000 + (questId % 50_000_000) * 3 + index, speaker.npcId,
        speaker.race, speaker.gender, speaker.flavor,
        [speaker.race, speaker.gender, speaker.flavor].filter(Boolean).join("-"),
      ],
    );
  }
}

async function npc(npcId: number, values: { race: string | null; gender: string | null; flavor: string | null; provenance: string }) {
  await db().query(
    `insert into "npc" ("npcKind", "npcId", "race", "gender", "flavor", "provenance", "confirmed")
     values ('creature', $1, $2, $3, $4, $5, $5 in ('corpus', 'moderator'))`,
    [npcId, values.race, values.gender, values.flavor, values.provenance],
  );
}

async function voices(): Promise<string[]> {
  return (await corpus()).lines.filter((candidate) => candidate.lineId === lineId).map((l) => l.voice);
}

describe("a line's voice", WHOLE_CORPUS, () => {
  it("is its NPC's, whatever the speaker row was written with", async () => {
    await line([{ npcId: npcIds[0], race: "tauren", gender: "male", flavor: "warrior" }]);
    await npc(npcIds[0], { race: "tauren", gender: "male", flavor: "elder", provenance: "moderator" });

    expect(await voices()).toEqual(["tauren-male-elder"]);
  });

  it("has no flavor while its NPC has none, and no voice the roster has", async () => {
    await line([{ npcId: npcIds[0], race: "tauren", gender: "male", flavor: "warrior" }]);
    await npc(npcIds[0], { race: "tauren", gender: "male", flavor: null, provenance: "corpus" });

    expect(await voices()).toEqual(["tauren-male"]);
  });

  it("is one voice for every speaker, in the flavor most of their NPCs have", async () => {
    await line(npcIds.map((npcId) => ({ npcId, race: "human", gender: "male", flavor: "standard" })));
    await npc(npcIds[0], { race: "human", gender: "male", flavor: "warrior", provenance: "corpus" });
    await npc(npcIds[1], { race: "human", gender: "male", flavor: "official", provenance: "corpus" });
    await npc(npcIds[2], { race: "human", gender: "male", flavor: "official", provenance: "corpus" });

    expect(await voices()).toEqual(["human-male-official", "human-male-official", "human-male-official"]);
  });

  it("keeps the speaker's own voice when nothing is known about its NPC", async () => {
    await line([{ npcId: npcIds[0], race: "orc", gender: "female", flavor: "standard" }]);
    await npc(npcIds[0], { race: null, gender: null, flavor: null, provenance: "none" });

    expect(await voices()).toEqual(["orc-female-standard"]);
  });
});

describe("the catalogue", WHOLE_CORPUS, () => {
  it("moves when an NPC's answer changes, so every line it speaks is voiced anew", async () => {
    await line([{ npcId: npcIds[0], race: "tauren", gender: "male", flavor: "warrior" }]);
    await npc(npcIds[0], { race: "tauren", gender: "male", flavor: "warrior", provenance: "moderator" });
    expect(await voices()).toEqual(["tauren-male-warrior"]);

    await db().query(
      `update "npc" set "flavor" = 'elder', "updatedAt" = now() where "npcKind" = 'creature' and "npcId" = $1`,
      [npcIds[0]],
    );
    expect(await voices()).toEqual(["tauren-male-elder"]);
  });
});
