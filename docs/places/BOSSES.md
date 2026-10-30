# Boss data

The dungeon and raid bosses of Spoken_NPCs: which instances and bosses exist, their names in
every language, their creature and model, and their stories. This file is where that data lives,
how the tools write it and how it is checked.

## Where the data lives

Three tables in the site's database are the source: `boss_instance` (one row per instance map),
`boss` (one row per boss) and `boss_line` (one row per boss, language and version, holding the
story). Boss and instance names are rows of `entity_name`, kind `boss` (the boss id as text) and
`instance` (the map as text). The three Lua files under `addons/Spoken_NPCs/Data/` are an export of
them, committed so that the addon builds on a clone with no Postgres.

```
client tables --make bosses--> boss_instance, boss, entity_name
write-boss-creatures.mjs -----> boss (creatureId, displayId)
apply-boss-stories.mjs -------> boss_line
   ^ [{ map, key, lang?, text }] JSON: rewritten stories, or assemble-boss-stories.mjs' output
the site (a later change) ----> boss_line, entity_name
                                   |
              make npcs-export --> Data/Bosses.lua, Creatures.lua, Stories.lua  (commit the diff)
```

`pipelines/places/tools/bosses/store.mjs` is the one place that reads and writes these tables.
There is no file fallback: a tool that writes boss data fails with a message when `DATABASE_URL`
is unset and never writes Lua. `bosses/reconcile.mjs` decides which rows the client's encounter
list means, `bosses/shape.mjs` turns rows into what the three files hold, and `bosses/export.mjs`
writes them.

`build-boss-stories.mjs` and `assemble-boss-stories.mjs` gather source text and never write under
`addons/`: they write to `build/boss-stories/` (gitignored) by default and refuse an `--out` under
`addons/`. Their stories reach the addon only through `apply-boss-stories.mjs` and the export.

## Stories in every language

`boss_line` has no reference from one language's row to another's, and nothing asks whether
English has text before returning a German story. A language's story exists whether English has
one or not, and the export ships every language that has a current row.

`Stories.lua` carries all languages in one file. A boss with English only is a string. A boss with
more is a table, `{ "English", deDE = "..." }`. A boss with a story in another language and none in
English is `{ deDE = "..." }`.

## Origins

| Origin | Meaning | Taken over by |
| --- | --- | --- |
| `rewritten` | Text a tool wrote (`apply-boss-stories.mjs`). | A rewrite or an edit. |
| `edited` | Written or corrected by a person. | Only another edit. A tool write lands underneath as a version that is not live. |

Names have their own two origins: `extracted`, written from the client's tables by `make bosses`,
and `edited`, changed on the site. They follow the `entity_name` rules: an unchanged name records
nothing, a changed game name replaces an extracted one, and an edited current name stays current.
A boss newly added to `pipelines/lib/boss-names.json` takes its creature's names where the
database has them; a language its creature has no name in keeps the name already recorded for the
encounter until someone edits it. Text that has not changed is
not recorded again, so version numbers count changes. A second run of a tool on a database where
someone has since edited a story changes nothing.

## Matching and retiring

A boss is identified by its instance map and `key`. The pipelines match a boss by its encounter
id, never by key and never by English text. `boss.id` is the primary encounter id and
`boss.encounterIds` holds every id that stands for the same boss (difficulties, versions).

The key is minted from the English name when a boss first appears and is frozen after that. When
the game renames a boss, its encounter id is the same: the row keeps its key and its stories and
only the extracted names move. A key is the one in `Stories.lua[map][key]`, so renaming it would
orphan the story.

A boss the client no longer lists, or one in `UNCONFIRMED` (`pipelines/lib/bosses.mjs`), gets
`retired = true`. It is never deleted, so its stories survive, and the export leaves it out.

## Which database

Production is upstream, as for every section's corpus. Run a tool that writes boss data against
it with the variable set inline, never exported:

```sh
DATABASE_URL=$PROD_DATABASE_URL node pipelines/places/tools/apply-boss-stories.mjs <dir>
make npcs-sync       # replaces the local boss tables and boss names with the droplet's
make npcs-export
make npcs-check
```

`make npcs-sync` is destructive; confirm before running it. It goes through
`scripts/db/sync-section.sh bosses`, and `make npcs-check-synced` compares the local data with the
droplet's through `scripts/db/check-synced.sh bosses`, using the digest in
`deploy/web/sql/bosses_stamp.sql` because the boss tables have no serial id to stamp.

The tables were seeded from the committed Lua by a one-off intake, kept outside this repository
(`import-boss-lore.mts`, run from `apps/web` with `npx tsx`). It is not part of the build.

## Commands

```sh
make bosses          # bring boss_instance, boss and the names into step with the client
node pipelines/lib/bosses.mjs --check   # list what the client would change; fails if anything
node pipelines/places/tools/write-boss-creatures.mjs <boss_creatures.json>
node pipelines/places/tools/apply-boss-stories.mjs <dir of *.json>   # { map, key, lang?, text }, lang enUS if left out
make npcs-export     # write Bosses.lua, Creatures.lua and Stories.lua from the database
make npcs-check      # do the committed files match the database?
make npcs-sync       # replace the local boss tables with the droplet's (DESTRUCTIVE)
make npcs-check-synced
```

The tools that write boss data need `DATABASE_URL`, and so do `node pipelines/lib/bosses.mjs
--check` and `make npcs-check`, which read the tables. `make bosses` writes the tables and not
`Bosses.lua`; run `make npcs-export` after it. `write-boss-creatures.mjs` sets every live boss, to
null where nothing gives it a creature. `Creatures.lua` keeps its `\r\n` line endings.

## Checks

| Command | Fails when |
| --- | --- |
| `make npcs-check` | A committed file differs from the database. It ignores each file's leading comment lines and line endings. Needs `DATABASE_URL`. |
| `node pipelines/lib/bosses.mjs --check` | The client's encounter table would change the boss tables. Needs `DATABASE_URL`. |
| `pnpm --filter @spoken/places-pipeline test` | Reconciling, shaping or exporting changes behaviour. |
| `make test-player` | `tests/lua/npcs_bosses_test.lua` and the rest of the addon's Lua tests fail. |

`make npcs-check` is not part of `make check` or `make lint`, which have to pass on a clone with no
Postgres.
