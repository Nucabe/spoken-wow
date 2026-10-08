from tts_cli.build import build_tables
from tts_cli.ignores import ignored_files
from tts_cli.voice_files import npc_voices, stored_stems, with_voice_files


def line(npc_id, voice, line_id="q:109:accept", file_name="109-accept", source="accept",
         npc_type="creature"):
    return {"lineId": line_id, "source": source, "questId": 109, "questTitle": "Report",
            "npcId": npc_id, "npcName": f"NPC {npc_id}", "npcType": npc_type,
            "voice": voice, "fileName": file_name, "originalText": "Go to Gryan.",
            "generatable": True}


def npc(npc_id, race, gender, flavor, provenance="corpus", npc_type="creature"):
    return {"npcType": npc_type, "npcId": npc_id, "race": race, "gender": gender,
            "flavor": flavor, "provenance": provenance}


CORPUS = {
    "lines": [
        line(1, "human-male-official"),
        line(2, "human-male-official"),
        line(3, "human-male-official"),
        line(4, "human-male-official"),
        line(5, "human-male-official", line_id="g:abc", file_name="abc", source="gossip"),
    ],
    "npcs": [
        npc(1, "human", "male", "official"),
        npc(2, "human", "male", "warrior"),
        npc(3, "human", "male", None),
        npc(4, None, None, None, provenance="none"),
        npc(5, "human", "male", "warrior"),
    ],
}


def test_an_npc_voice_is_its_answer_and_none_where_nothing_is_known():
    assert npc_voices(CORPUS) == {
        ("creature", 1): "human-male-official",
        ("creature", 2): "human-male-warrior",
        ("creature", 3): "human-male",
        ("creature", 5): "human-male-warrior",
    }


def test_an_npc_speaks_its_own_voices_file_once_the_store_has_it():
    stems = stored_stems(["quests/109-accept.mp3", "quests/109-accept-human-male-warrior.mp3",
                          "gossip/abc-human-male-warrior.mp3"])
    rows = [(row["npcId"], row["lineId"], row["fileName"])
            for row in with_voice_files(CORPUS, stems)["lines"]]
    assert rows == [
        (1, "q:109:accept", "109-accept"),
        (2, "q:109:accept~human-male-warrior", "109-accept-human-male-warrior"),
        # No flavor, so no file anybody could have made: the line's own until it gets one.
        (3, "q:109:accept", "109-accept"),
        (4, "q:109:accept", "109-accept"),
        # Greetings keep one voice per file for now.
        (5, "g:abc", "abc"),
    ]


def test_an_npc_keeps_the_lines_own_file_while_its_voice_has_no_audio():
    rows = with_voice_files(CORPUS, stored_stems(["quests/109-accept.mp3"]))["lines"]
    assert [row["lineId"] for row in rows[:4]] == ["q:109:accept"] * 4


def test_the_addon_finds_a_givers_own_voice_by_the_moments_file():
    stems = stored_stems(["quests/109-accept-human-male-warrior.mp3"])
    tables = build_tables(with_voice_files(CORPUS, stems))
    assert tables["npc_quest_file_lookups"] == (
        "QuestFileLookupByNPCID", {"109-accept": {2: "109-accept-human-male-warrior"}})
    assert tables["object_quest_file_lookups"] == ("QuestFileLookupByObjectID", {})


def test_a_line_in_another_voice_is_ignored_with_its_line():
    stems = stored_stems(["quests/109-accept-human-male-warrior.mp3"])
    corpus = with_voice_files(CORPUS, stems)
    ignored = {"q:109:accept": "a test quest"}
    assert build_tables(corpus, ignored)["npc_quest_file_lookups"][1] == {}
    assert "quests/109-accept-human-male-warrior.mp3" in ignored_files(corpus, ignored)
