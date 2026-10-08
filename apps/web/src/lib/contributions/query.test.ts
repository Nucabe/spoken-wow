import { describe, expect, it } from "vitest";

import { DEFAULT_SORT, bucketOf, contributionsHref, nextSort, sortOf, matchesSearch, matchesSource, matchesStage, nextContributionFilters, pageOf, sectionOf } from "./query";

describe("nextContributionFilters", () => {
  const current = { status: "new", bucket: "ready", client: "all", source: "all", stage: "all", sort: DEFAULT_SORT } as const;

  it("changes the dimension named in `next` and keeps the other", () => {
    expect(nextContributionFilters(current, { bucket: "blocked" })).toEqual({
      status: "new",
      bucket: "blocked",
      client: "all",
      source: "all",
      stage: "all",
      sort: DEFAULT_SORT,
    });
  });

  it("resets a dimension to its default when `next` names it with no value", () => {
    // FilterChip's reset button calls onChange(undefined) -- the key is present, the value
    // isn't, and that must read as "clear this filter", not "leave it alone".
    expect(nextContributionFilters({ status: "accepted", bucket: "blocked", client: "forever", source: "books", stage: "all", sort: DEFAULT_SORT }, { bucket: undefined })).toEqual(
      { status: "accepted", bucket: "ready", client: "forever", source: "books", stage: "all", sort: DEFAULT_SORT },
    );
  });

  it("changes the client dimension alone", () => {
    expect(nextContributionFilters(current, { client: "legacy" })).toEqual({ ...current, client: "legacy" });
  });

  it("changes the source dimension alone", () => {
    expect(nextContributionFilters(current, { source: "zones" })).toEqual({ ...current, source: "zones" });
  });

  it("leaves every dimension alone when `next` names none", () => {
    expect(nextContributionFilters(current, {})).toEqual(current);
  });
});

describe("contributionsHref", () => {
  it("builds a query string carrying every dimension", () => {
    expect(contributionsHref({ status: "new", bucket: "ready", client: "era", source: "all", stage: "all", sort: DEFAULT_SORT }, { status: "rejected" })).toBe(
      "/contributions?status=rejected&client=era&source=all&stage=all",
    );
  });

  it("writes the bucket only when it is not the ready rows", () => {
    expect(
      contributionsHref({ status: "new", bucket: "ready", client: "all", source: "all", stage: "all", sort: DEFAULT_SORT }, { bucket: "blocked" }),
    ).toBe("/contributions?status=new&client=all&source=all&stage=all&bucket=blocked");
  });
});

describe("sort", () => {
  const filters = { status: "new", bucket: "ready", client: "all", source: "all", stage: "all", sort: DEFAULT_SORT } as const;

  it("starts a newly clicked column in its own direction, and flips the one in force", () => {
    expect(nextSort(DEFAULT_SORT, "filed")).toEqual({ column: "filed", direction: "desc" });
    expect(nextSort(DEFAULT_SORT, "source")).toEqual({ column: "source", direction: "asc" });
    expect(nextSort(DEFAULT_SORT, "count")).toEqual({ column: "count", direction: "asc" });
    expect(nextSort({ column: "count", direction: "asc" }, "count")).toEqual({ column: "count", direction: "desc" });
  });

  it("reads the query string, falling back to most sent first", () => {
    expect(sortOf("filed", "asc")).toEqual({ column: "filed", direction: "asc" });
    expect(sortOf("filed", undefined)).toEqual({ column: "filed", direction: "desc" });
    expect(sortOf("filed", "sideways")).toEqual({ column: "filed", direction: "desc" });
    for (const column of [undefined, "", "npc", "createdAt; drop table"]) expect(sortOf(column, "asc")).toEqual(DEFAULT_SORT);
  });

  it("carries a sort in the href and leaves the default out", () => {
    expect(contributionsHref(filters, { sort: { column: "filed", direction: "asc" } })).toBe(
      "/contributions?status=new&client=all&source=all&stage=all&sort=filed&dir=asc",
    );
    expect(contributionsHref({ ...filters, sort: { column: "filed", direction: "asc" } }, { sort: DEFAULT_SORT })).toBe(
      "/contributions?status=new&client=all&source=all&stage=all",
    );
  });

  it("keeps the sort across a filter change", () => {
    const sort = { column: "source", direction: "desc" } as const;
    expect(nextContributionFilters({ ...filters, sort }, { status: "accepted" }).sort).toEqual(sort);
  });
});

describe("paging", () => {
  it("carries a page past the first, and leaves the first page bare", () => {
    const filters = { status: "new", bucket: "ready", client: "all", source: "all", stage: "all", sort: DEFAULT_SORT } as const;
    expect(contributionsHref(filters, {}, 3)).toBe("/contributions?status=new&client=all&source=all&stage=all&page=3");
    expect(contributionsHref(filters, {}, 1)).toBe("/contributions?status=new&client=all&source=all&stage=all");
    // A filter change starts again from the first page.
    expect(contributionsHref(filters, { status: "accepted" })).toBe("/contributions?status=accepted&client=all&source=all&stage=all");
  });

  it("reads anything that is not a positive integer as the first page", () => {
    expect(pageOf("4")).toBe(4);
    for (const value of [undefined, "", "0", "-2", "1.5", "abc"]) expect(pageOf(value)).toBe(1);
  });
});

describe("bucketOf", () => {
  const npc = { race: "tauren", gender: "male", flavor: "warrior" as string | null, conflict: [] };

  it("is ready for a quests row whose NPC has a race and gender in a roster voice, guessed or not", () => {
    expect(bucketOf("quests", npc)).toBe("ready");
  });

  it("is blocked for a quests row with no NPC, no race or gender, a conflict, or a voice off the roster", () => {
    expect(bucketOf("quests", null)).toBe("blocked");
    expect(bucketOf("quests", { ...npc, gender: null })).toBe("blocked");
    expect(bucketOf("quests", { ...npc, race: null })).toBe("blocked");
    expect(bucketOf("quests", { ...npc, conflict: [{}] })).toBe("blocked");
    expect(bucketOf("quests", { ...npc, race: "murloc" })).toBe("blocked");
    // tauren-male has only flavored voices, so the bare pair is not one.
    expect(bucketOf("quests", { ...npc, flavor: null })).toBe("blocked");
  });

  it("is ready for zones and books, which name no NPC", () => {
    expect(bucketOf("zones", null)).toBe("ready");
    expect(bucketOf("books", null)).toBe("ready");
  });
});

describe("matchesStage", () => {
  const quest = (stage: "accept" | "progress" | "complete" | null) => ({ title: "Stalk With The Earthmother", questId: 76156, stage });

  it("lets everything through when no stage is picked", () => {
    expect(matchesStage(null, "all")).toBe(true);
    expect(matchesStage("gossip", "all")).toBe(true);
    expect(matchesStage(quest(null), "all")).toBe(true);
  });

  it("matches a quest row on its own stage only", () => {
    expect(matchesStage(quest("progress"), "progress")).toBe(true);
    expect(matchesStage(quest("progress"), "complete")).toBe(false);
    expect(matchesStage(quest(null), "accept")).toBe(false);
  });

  it("drops gossip and rows with no quest concept from any narrowed view", () => {
    expect(matchesStage("gossip", "accept")).toBe(false);
    expect(matchesStage(null, "complete")).toBe(false);
  });
});

describe("matchesSearch", () => {
  const row = {
    text: "Bring me 240 gold, mortal.",
    npc: { npcId: 240, npcName: "Marshal Dughan" },
    quest: { title: "A Threat Within", questId: 783, stage: "accept" as const },
  };

  it("reads a bare number as an NPC or quest id, never as text", () => {
    expect(matchesSearch(row, "240")).toBe(true);
    expect(matchesSearch(row, "783")).toBe(true);
    expect(matchesSearch(row, "240", "quest")).toBe(false);
    expect(matchesSearch({ ...row, npc: undefined }, "240")).toBe(false);
  });

  it("matches words in the NPC's name, the quest's title or the text, without case", () => {
    expect(matchesSearch(row, "dughan")).toBe(true);
    expect(matchesSearch(row, "threat")).toBe(true);
    expect(matchesSearch(row, "MORTAL")).toBe(true);
    expect(matchesSearch(row, "murloc")).toBe(false);
  });

  it("keeps to the field asked for", () => {
    expect(matchesSearch(row, "mortal", "npc")).toBe(false);
    expect(matchesSearch(row, "dughan", "text")).toBe(false);
    expect(matchesSearch(row, "240", "text")).toBe(true);
    expect(matchesSearch(row, "threat", "quest")).toBe(true);
  });

  it("matches everything on a blank query, and a gossip row on no quest", () => {
    expect(matchesSearch(row, "  ")).toBe(true);
    expect(matchesSearch({ ...row, quest: "gossip" }, "783")).toBe(false);
  });
});

describe("contributionsHref search", () => {
  const filters = { status: "new", bucket: "ready", client: "all", source: "all", stage: "all", sort: DEFAULT_SORT } as const;

  it("writes the query and where it is searched only when set, and keeps them across a filter change", () => {
    expect(contributionsHref(filters, { q: " dughan ", searchIn: "npc" })).toBe(
      "/contributions?status=new&client=all&source=all&stage=all&q=dughan&filter=npc",
    );
    expect(contributionsHref({ ...filters, q: "dughan", searchIn: "any" }, { status: "accepted" })).toBe(
      "/contributions?status=accepted&client=all&source=all&stage=all&q=dughan",
    );
  });
});

describe("sectionOf / matchesSource", () => {
  const quest = { title: "Stalk With The Earthmother", questId: 76156, stage: "accept" as const };

  it("lists a quests row with no quest under gossip, and every other row under its source", () => {
    expect(sectionOf({ source: "quests" }, "gossip")).toBe("gossip");
    expect(sectionOf({ source: "quests" }, quest)).toBe("quests");
    expect(sectionOf({ source: "zones" }, null)).toBe("zones");
  });

  it("keeps gossip out of quests and quests out of gossip", () => {
    expect(matchesSource("gossip", "quests")).toBe(false);
    expect(matchesSource("quests", "gossip")).toBe(false);
    expect(matchesSource("gossip", "gossip")).toBe(true);
    expect(matchesSource("gossip", "all")).toBe(true);
  });
});
