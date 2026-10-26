"""The lines NPCs say out loud in the world (export_chatter_lines.py): what is kept of the DB's
creature_text rows, and the file written from them."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from export_chatter_lines import collect, render  # noqa: E402


def test_a_line_is_kept_once_per_speaker_by_its_broadcast_id():
    rows = [(10, 100, "Halt!"), (10, 100, "Halt!"), (10, 101, "Move  along.")]
    assert collect(rows) == {10: [(100, "Halt!"), (101, "Move along.")]}


def test_an_emote_stored_as_a_say_is_not_a_line():
    # 269 of the 2836 rows in the repack: "%s becomes enraged!" is Type 12 with an emote's text.
    rows = [(10, 100, "%s becomes enraged!"), (10, 101, "%s's eyes glow."), (11, 102, "Halt, %s!")]
    assert collect(rows) == {11: [(102, "Halt, %s!")]}


def test_a_speaker_with_only_emotes_is_not_written():
    assert render(collect([(10, 100, "%s goes into a frenzy!")]), {10: "Hogger"}).count("[10]") == 0


def test_the_name_is_written_beside_the_lines():
    text = render({10: [(100, "Halt!")]}, {10: "Town  Guard"})
    assert '[10] = { name = "Town Guard",' in text
    assert "{ id = 100, text = \"Halt!\" }," in text
