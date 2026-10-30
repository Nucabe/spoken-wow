#!/usr/bin/env bash
# Uploads the built bosses sound pack, SpokenBossesAudio, to CurseForge. Wago answers 413 to a
# sound pack (scripts/lib/wago.sh), so a Wago player gets it from the GitHub release
# (scripts/audio-github-release.sh bosses <lang>).
#
#   ./scripts/npcs/release.sh --dry-run          # say what would be sent, send nothing
#   ./scripts/npcs/release.sh                    # the English sound pack
#   ./scripts/npcs/release.sh --lang=deDE audio  # that language's sound pack instead
#
# A pack whose page under publishers/bosses/ has no `curseforge` id has no project to upload
# to, and is refused before anything else: the project is created by hand on CurseForge first.
#
# Needs CURSEFORGE_TOKEN in the environment or in the repo-root .env. Generate one at
# https://authors-old.curseforge.com/account/api-tokens -- it is an author token
# tied to your account, not to a project, so the same one covers all three.
#
# This uploads files, and declares the pack's one required dependency -- Spoken -- with the
# file; relations are upload metadata, not a project setting. It does not create projects or
# edit descriptions: there is no API for either, and a script that rewrote them every release
# could undo an edit made in the web UI.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$REPO/dist"

# The language whose sound pack `audio` means. English unless --lang says otherwise.
LANG_CODE=enUS
pack_field() { node "$REPO/scripts/lib/packs.mjs" get bosses "$LANG_CODE" - "$1"; }
english() { [[ "$LANG_CODE" == enUS ]]; }

# Site-relative API, per game. WoW projects are not reachable through another
# game's subdomain even with a valid token.
API="https://wow.curseforge.com/api"

# The clients a zip can target. Matched by name against /api/game/versions rather
# than hardcoding the numeric IDs, because those IDs are not documented anywhere
# and would be mystery constants the first time they need changing.
#
# ANNIVERSARY is the 2.5.6 client the Anniversary realms run. Its name on
# CurseForge is whatever /api/game/versions calls it -- if the default below is
# not it, the exactly-one-match check further down fails loudly before anything is
# uploaded, which is the failure mode to want.
GAME_VERSION_ERA="${GAME_VERSION_ERA:-1.15.9}"
GAME_VERSION_ANNIVERSARY="${GAME_VERSION_ANNIVERSARY:-2.5.6}"
# The 1.60.1 Forever client, which is CurseForge's name for the one whose TOC suffix is
# _Camelot. Both addons declare interface 16001 and load there.
GAME_VERSION_FOREVER="${GAME_VERSION_FOREVER:-1.60.1}"

# CurseForge's own channel, which is not the same thing as the beta disclaimer in
# the descriptions. Marking these "beta" would keep most addon managers from
# offering them to players on the default channel -- the audience this is for.
RELEASE_TYPE="${RELEASE_TYPE:-release}"

# project key -> CurseForge project ID, addon folder the version is read from,
# and the zip basename package-audio.sh produces, all from LANG_CODE's page under
# publishers/bosses/.
target_curseforge() { case "$1" in audio) pack_field curseforge;; esac; }
target_addon()      { case "$1" in audio) pack_field folder;; esac; }
target_zip()        { target_addon "$1"; }
# The project's slug, for the link printed after an upload.
target_slug()       { case "$1" in audio) pack_field slug;; esac; }
# Required dependencies by CurseForge slug. The pack is data, inert without the module that
# reads it, and Spoken_NPCs ships inside spoken, so that is what the pack names.
target_dependencies()  { case "$1" in audio) echo "spoken";; esac; }
target_game_versions() { echo "$GAME_VERSION_ERA $GAME_VERSION_ANNIVERSARY $GAME_VERSION_FOREVER"; }

dry_run=""
targets=()
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) dry_run=1;;
    --lang=*) LANG_CODE="${arg#--lang=}";;
    audio) targets+=("$arg");;
    *) echo "error: unknown argument '$arg' (expected: audio, --lang=..., --dry-run)" >&2; exit 1;;
  esac
done

if ! english; then
  # ${targets[@]+...} rather than a bare expansion: macOS's bash 3.2 raises "unbound variable"
  # under set -u when "${targets[@]}" is empty, which it is for `--lang=xx` alone.
  for t in ${targets[@]+"${targets[@]}"}; do
    [[ "$t" == audio ]] || { echo "error: --lang=$LANG_CODE releases a sound pack, not '$t'" >&2; exit 1; }
  done
  (( ${#targets[@]} > 0 )) || targets=("audio")
fi

if (( ${#targets[@]} == 0 )); then
  targets=("audio")
fi

# Before the token and before CurseForge is asked anything, in a dry run too: with no project
# there is nothing a real run could do, and a dry run's job is to say so.
for target in "${targets[@]}"; do
  if [[ -z "$(target_curseforge "$target")" ]]; then
    echo "error: $(pack_field name) ($LANG_CODE) has no CurseForge project yet." >&2
    echo "       Create the project on CurseForge first, then add its id as 'curseforge:' to" >&2
    echo "       publishers/$(pack_field page)." >&2
    echo "       The GitHub release does not need one:  ./scripts/audio-github-release.sh bosses $LANG_CODE" >&2
    exit 1
  fi
done

command -v curl >/dev/null || { echo "error: curl is required" >&2; exit 1; }
command -v node >/dev/null || { echo "error: node is required (for JSON handling)" >&2; exit 1; }

# The token is account-wide -- it uploads all six projects -- so it lives once, in the
# repo-root .env alongside the other shared credentials, rather than in a shell history or
# in a copy per pipeline.
if [[ -z "${CURSEFORGE_TOKEN:-}" && -f "$REPO/.env" ]]; then
  CURSEFORGE_TOKEN="$(sed -n 's/^CURSEFORGE_TOKEN=//p' "$REPO/.env" | head -1 | tr -d '\r"')"
fi
if [[ -z "${CURSEFORGE_TOKEN:-}" ]]; then
  echo "error: CURSEFORGE_TOKEN is not set" >&2
  echo "       Generate one at https://authors-old.curseforge.com/account/api-tokens" >&2
  echo "       then put CURSEFORGE_TOKEN=... in the repo root's .env, or export it." >&2
  exit 1
fi

api_get() {
  curl -fsSL -H "X-Api-Token: $CURSEFORGE_TOKEN" "$API/$1"
}

#-- the game versions ---------------------------------------------------------
# The list is fetched once; each name is resolved against it separately, and a
# name matching anything other than exactly one version is fatal. An unknown name
# here is the failure that otherwise produces a file uploaded against the wrong
# client, which players discover as "the addon does not appear in my AddOns list".
versions_json=""
versions_json="$(api_get "game/versions")" || {
  echo "error: could not list game versions -- is the token valid?" >&2
  exit 1
}

resolve_game_version() {
  node -e '
    const wanted = process.argv[1];
    const versions = JSON.parse(process.argv[2]);
    const hits = versions.filter((v) => v.name === wanted);
    if (hits.length !== 1) {
      console.error(`expected exactly one game version named ${wanted}, found ${hits.length}`);
      if (hits.length > 1) console.error(JSON.stringify(hits));
      process.exit(1);
    }
    process.stdout.write(String(hits[0].id));
  ' "$1" "$versions_json"
}

echo "resolving game versions..."
for name in $GAME_VERSION_ERA $GAME_VERSION_ANNIVERSARY $GAME_VERSION_FOREVER; do
  echo "  $name -> id $(resolve_game_version "$name")"
done

#-- the changelog -------------------------------------------------------------
# The section of docs/bosses/CHANGELOG.md for the version being uploaded, headed by the pack's
# release tag in every language: `## <version> — bosses-audio`, `## <version> — bosses-audio-deDE`.
changelog_for() {
  node "$REPO/scripts/lib/packs.mjs" changelog "$REPO/docs/bosses/CHANGELOG.md" "$1" "$(pack_field release)"
}

#-- preflight -------------------------------------------------------------------
# The zip is resolved before any upload starts, in --dry-run too, since a dry run's job is to
# say what a real run would hit.
missing=()
for target in "${targets[@]}"; do
  addon="$(target_addon "$target")"
  if [[ "$target" == audio ]] && ! english; then
    version="$(pack_field version)"
  else
    toc="$REPO/addons/$addon/$addon.toc"
    version="$(sed -n 's/^## Version:[[:space:]]*//p' "$toc" 2>/dev/null | head -1 | tr -d '\r')"
  fi
  if [[ -z "$version" ]]; then
    missing+=("$target -- not built (no version); run make npcs-package-audio")
    continue
  fi
  zip_path="$DIST/$(target_zip "$target")-$version.zip"
  [[ -f "$zip_path" ]] || missing+=("$zip_path")
done
if (( ${#missing[@]} > 0 )); then
  echo "error: missing zips -- nothing was released:" >&2
  for m in "${missing[@]}"; do echo "  $m" >&2; done
  exit 1
fi

#-- upload --------------------------------------------------------------------
for target in "${targets[@]}"; do
  project="$(target_curseforge "$target")"
  addon="$(target_addon "$target")"
  zip_name="$(target_zip "$target")"

  # Checked rather than assumed: a target added here without its project id would
  # otherwise POST to CurseForge's /projects//upload-file and fail somewhere less
  # legible, or worse, land on whatever project the API resolved.
  if [[ -z "$project" ]]; then
    echo "error: no CurseForge project id for '$target' -- create the project and add its id to target_curseforge()" >&2
    exit 1
  fi

  if [[ "$target" == audio ]] && ! english; then
    version="$(pack_field version)"
  else
    toc="$REPO/addons/$addon/$addon.toc"
    version="$(sed -n 's/^## Version:[[:space:]]*//p' "$toc" | head -1 | tr -d '\r')"
  fi
  zip_path="$DIST/$zip_name-$version.zip"

  echo
  echo "=== $target -> curseforge ==="

  if [[ ! -f "$zip_path" ]]; then
    echo "error: $zip_path does not exist -- run make npcs-package-audio first" >&2
    exit 1
  fi

  changelog="$(changelog_for "$version")"
  size="$(du -h "$zip_path" | cut -f1)"

  echo "  file:      $zip_path ($size)"
  echo "  version:   $version   release type: $RELEASE_TYPE"
  echo "  changelog: $(echo "$changelog" | head -1) ..."

  game_version_names="$(target_game_versions "$target")"
  game_version_ids=""
  for name in $game_version_names; do
    game_version_ids="$game_version_ids $(resolve_game_version "$name")"
  done

  # One file can carry versions from more than one client. If CurseForge ever
  # rejects the pair (Era and Anniversary are different game-version *types*),
  # the fix is to upload the same zip once per id rather than to drop one of them.
  #
  # Built with node rather than a heredoc: the changelog is markdown containing
  # quotes, backticks and newlines, and hand-escaping it into JSON is how a
  # release ends up with a mangled changelog nobody notices for a month.
  # By slug, which must name an approved project or the upload fails with errorCode 1018.
  dependencies="$(target_dependencies "$target")"
  metadata="$(node -e '
    const [changelog, releaseType, gameVersionIds, displayName, dependencies] = process.argv.slice(1);
    const slugs = dependencies.trim().split(/\s+/).filter(Boolean);
    process.stdout.write(JSON.stringify({
      changelog,
      changelogType: "markdown",
      displayName,
      gameVersions: gameVersionIds.trim().split(/\s+/).map(Number),
      releaseType,
      ...(slugs.length ? { relations: { projects: slugs.map((slug) => ({ slug, type: "requiredDependency" })) } } : {}),
    }));
  ' "$changelog" "$RELEASE_TYPE" "$game_version_ids" "$zip_name $version" "$dependencies")"

  echo "  curse:     project $project, game versions $game_version_names"
  [[ -n "$dependencies" ]] && echo "  requires:  $(echo $dependencies)"

  if [[ -n "$dry_run" ]]; then
    echo "  dry run -- not uploading to CurseForge"
  else

  # --progress-bar because the packs are hundreds of megabytes and a silent curl
  # for six minutes is indistinguishable from a hang.
  #
  # Deliberately not -f: on a rejection the API explains itself in the response
  # body, and -f discards exactly that, leaving "curl: (56) error 400" as the only
  # evidence of a release that will not go out. The status code is appended on its
  # own line instead, and split back off below.
  #
  # --form-string for the metadata, never -F: -F reads `;` in a value as the start
  # of a `;type=` parameter and silently truncates there, so a changelog with a
  # semicolon in it arrives as invalid JSON and the API rejects the whole release.
  # The file part stays -F, which is what makes @ mean "read this file".
  response="$(curl -sS --progress-bar -w '\n%{http_code}' \
    -H "X-Api-Token: $CURSEFORGE_TOKEN" \
    --form-string "metadata=$metadata" \
    -F "file=@$zip_path" \
    "$API/projects/$project/upload-file")" || {
      echo "error: could not reach CurseForge for $target" >&2
      exit 1
    }

  status="${response##*$'\n'}"
  response="${response%$'\n'*}"

  if [[ "$status" != 2* ]]; then
    echo "error: upload failed for $target -- HTTP $status" >&2
    echo "$response" >&2
    exit 1
  fi

  file_id="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).id ?? "?"))' "$response")"
  echo "  uploaded -- file id $file_id"
  echo "  https://www.curseforge.com/wow/addons/$(target_slug "$target")/files/$file_id"
  fi

done

#-- descriptions --------------------------------------------------------------
# There is no API for these. Uploading a file cannot update the page around it,
# so the most this can do is notice that the text in the repository has moved on
# from what was last pasted, and say so at the moment somebody is already looking
# at the project pages.
echo
stale="$(node "$REPO/scripts/descriptions.mjs" --drift --group=bosses)"
if [[ -n "$stale" ]]; then
  echo "descriptions that differ from what was last pasted into the site:"
  echo "$stale" | while IFS=$'\t' read -r slug why; do
    echo "  $slug -- $why  ($DIST/descriptions/$slug.md)"
  done
  echo "  paste them, then: make descriptions-published"
else
  echo "descriptions match what was last pasted."
fi

echo
echo "done. Uploads sit in moderation before they appear publicly."
