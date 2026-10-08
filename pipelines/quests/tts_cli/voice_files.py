"""Which file each NPC speaks a line in, for a pack.

A corpus row is a line and one NPC speaking it, written with the voice its file was made in.
The NPC's own voice is its answer in the corpus's `npcs`, the site's npc table. Where the two
differ, the NPC speaks the line in a file of its own voice (naming.variant_file_name), which
the site generates; until that file has audio in the store being built, the NPC keeps the
line's own file, so nobody falls silent while a voice waits to be made.

The site reads lines the same way (apps/web/src/lib/quests/catalogue.ts): a speaker whose NPC
nobody knows anything about keeps the voice its row was written with.
"""
import os

from tts_cli.flavors import voice_name
from tts_cli.naming import subfolder_from_line_id, variant_file_name, variant_line_id

#: The lines an NPC speaks in its own voice. Progress text is never voiced.
OWN_VOICE_SOURCES = frozenset({"accept", "complete"})


def npc_voices(corpus: dict) -> dict:
    """(npcType, npcId) -> the voice the NPC's answer names, for every NPC with one."""
    voices = {}
    for npc in corpus.get("npcs", []):
        if npc.get("provenance") == "none" or not npc["race"] or not npc["gender"]:
            continue
        voices[(npc["npcType"], npc["npcId"])] = voice_name(npc["race"], npc["gender"],
                                                            npc["flavor"])
    return voices


def stored_stems(store_files) -> set:
    """Store-relative stems ('quests/5-accept') of every audio file a store holds."""
    return {os.path.splitext(rel)[0] for rel in store_files}


def with_voice_files(corpus: dict, stems: set) -> dict:
    """The corpus with each row of OWN_VOICE_SOURCES moved to its NPC's own voice's file, where that
    file has audio among `stems`. The rest are as they were."""
    voices = npc_voices(corpus)
    # A line's file was made in its first speaker's voice, as the site reads it (catalogue.ts
    # voiced): a later speaker written with another voice still speaks that file's.
    written = {}
    for line in corpus["lines"]:
        written.setdefault(line["lineId"], line["voice"])
    lines = []
    for line in corpus["lines"]:
        voice = voices.get((line["npcType"], line["npcId"]))
        if line["source"] in OWN_VOICE_SOURCES and voice and voice != written[line["lineId"]]:
            file_name = variant_file_name(line["fileName"], voice)
            if f'{subfolder_from_line_id(line["lineId"])}/{file_name}' in stems:
                line = {**line, "lineId": variant_line_id(line["lineId"], voice),
                        "fileName": file_name, "voice": voice}
        lines.append(line)
    return {**corpus, "lines": lines}
