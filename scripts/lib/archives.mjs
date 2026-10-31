// Where each section's take archive is on this machine: the deployment's
// SPOKEN_<SECTION>_AUDIO_HISTORY, or the pipeline's audio-history/ beside it.
//
// One rule for every script that reads the archive -- sounds.mjs for the takes, acted.mjs for
// the voice actors' recordings -- and the one pull-live.sh writes into by the same variable,
// so a pull lands where a build looks.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Bosses have no pipeline of their own: their takes sit beside places', in a directory of their
// own (apps/web/src/lib/takes/adapters.ts says the same).
const DEFAULTS = { bosses: join(ROOT, "pipelines", "places", "bosses-audio-history") };

export function archiveOf(section) {
  return process.env[`SPOKEN_${section.toUpperCase()}_AUDIO_HISTORY`]
    ?? DEFAULTS[section] ?? join(ROOT, "pipelines", section, "audio-history");
}
