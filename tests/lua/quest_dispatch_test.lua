-- Which line the player reads for a quest interaction, across the three ways a client can
-- present one. Run with `make test-player`.
--
-- The interesting case is the third: DialogueUI calls QuestFrame:UnregisterAllEvents() and
-- draws its own dialog, so no Blizzard quest panel is ever shown. Classifying a quest
-- interaction by which panel is visible therefore has to have a fallback, and that fallback
-- used to assume "accept" - which read the offer text again at every turn-in.
local here = arg[0]:match("^(.*)/[^/]*$") or "."
package.path = here .. "/?.lua;" .. package.path
local stub = require("wow_client_stub")
local print = stub.print
stub.SetClient("16001"); stub.ResetSound(); stub.ResetTimers()
local VO = stub.LoadQuests(here .. "/../../addons/Spoken_Quests/", here .. "/../../addons/Spoken/")
local Spoken = _G.Spoken

local world = stub.world
local failures = 0

-- Observed through the player's public seam rather than by monkeypatching the queue: what
-- the client would hear is what CLIP_STARTED reports.
local played = {}
Spoken:RegisterCallback("CLIP_STARTED", function(clip)
    table.insert(played, clip.fileName)
end)

local function Expect(scenario, expected)
    local actual = table.concat(played, ", ")
    if actual == expected then
        print(string.format("ok   %s\n     played: %s", scenario, actual ~= "" and actual or "(nothing)"))
    else
        failures = failures + 1
        print(string.format("FAIL %s\n     expected: %s\n     actual:   %s", scenario,
            expected ~= "" and expected or "(nothing)", actual ~= "" and actual or "(nothing)"))
    end
end

local function StartScenario()
    Spoken:StopAll()
    world.questID = 0
    stub.ShowPanel(nil)
    stub.FireEvent("QUEST_FINISHED")
    stub.Advance(10)
    -- Cleared last, so a line the previous scenario left behind cannot pass for this one's.
    Spoken:StopAll()
    for i = #played, 1, -1 do played[i] = nil end
end

local quests = { 101, 102, 103 }
local lookup = {}
for _, quest in ipairs(quests) do
    lookup[string.format("%d-accept", quest)] = 1
    lookup[string.format("%d-complete", quest)] = 1
end

VO.Addon:OnInitialize()
VO.DataModules:Register("TestPack", {
    SoundLengthLookupByFileName = lookup,
    GetSoundPath = function(_, fileName) return fileName .. ".ogg" end,
})

world.title = "Test Quest"
world.questText = "Go and do the thing."
world.progressText = "Have you done the thing?"
world.rewardText = "You have done the thing."

-- Wait out the deferred data module load that OnInitialize schedules.
stub.Advance(2)

-- A quest hand-off as the default UI presents it: the reward panel is what is on screen.
local quest = quests[1]
StartScenario()
world.questID = quest
stub.ShowPanel("QuestFrameDetailPanel")
stub.FireEvent("QUEST_DETAIL")
stub.Advance(3)
world.questID = 0
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")
stub.Advance(120)
world.questID = quest
stub.ShowPanel("QuestFrameRewardPanel")
stub.FireEvent("QUEST_COMPLETE")
stub.Advance(3)
world.questID = 0
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")
stub.Advance(3)
Expect("default UI: offer reads accept, turn-in reads complete",
    string.format("%d-accept, %d-complete", quest, quest))

-- The same hand-off on a client that keeps reporting the quest ID after its frame closes.
-- Nothing may be read once the dialog is gone.
quest = quests[2]
StartScenario()
world.questID = quest
stub.ShowPanel("QuestFrameDetailPanel")
stub.FireEvent("QUEST_DETAIL")
stub.Advance(3)
world.questID = 0
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")
stub.Advance(120)
world.questID = quest
stub.ShowPanel("QuestFrameRewardPanel")
stub.FireEvent("QUEST_COMPLETE")
stub.Advance(3)
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")   -- The quest ID is deliberately left set.
stub.Advance(3)
Expect("stale quest ID after the frame closes reads nothing more",
    string.format("%d-accept, %d-complete", quest, quest))

-- A replacement dialog addon: the client is in a quest dialog the whole time, but no
-- Blizzard panel is ever visible, so only the events say which interaction this is.
quest = quests[3]
StartScenario()
world.questID = quest
stub.FireEvent("QUEST_DETAIL")
stub.Advance(3)
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.Advance(120)
world.questID = quest
stub.FireEvent("QUEST_PROGRESS")
stub.Advance(1)
stub.FireEvent("QUEST_COMPLETE")
stub.Advance(3)
Expect("replacement dialog UI: turn-in reads complete, not accept",
    string.format("%d-accept, %d-complete", quest, quest))

-- An auto-accept addon (Leatrix Plus, and the auto-turn-in addons besides it) calls
-- AcceptQuest from its own QUEST_DETAIL handler, so the quest dialog is gone in the same
-- frame the offer arrived in. The 10 Hz watcher never sees a quest ID to stabilize, so the
-- event snapshot is the only record that the interaction happened.
quest = quests[1]
StartScenario()
world.questID = quest
stub.FireEvent("QUEST_DETAIL")
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.Advance(3)
Expect("auto-accepted quest still reads accept", string.format("%d-accept", quest))

-- The turn-in half of the same addon: it answers QUEST_PROGRESS with CompleteQuest and
-- QUEST_COMPLETE with GetQuestReward, so both arrive and close within one frame.
quest = quests[2]
StartScenario()
world.questID = quest
stub.FireEvent("QUEST_PROGRESS")
stub.FireEvent("QUEST_COMPLETE")
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.Advance(3)
Expect("auto-turned-in quest still reads complete", string.format("%d-complete", quest))

-- The rest use quests with every line, progress included, and the events that say what became
-- of the quest: QUEST_ACCEPTED (Classic's questLogIndex, questID) and QUEST_TURNED_IN.
local full, followUp = 104, 105
lookup[string.format("%d-accept", full)] = 1
lookup[string.format("%d-progress", full)] = 1
lookup[string.format("%d-complete", full)] = 1
lookup[string.format("%d-accept", followUp)] = 1

-- An auto-accept addon whose handler runs before Spoken's: the dialog is closed, and its globals
-- cleared, before Spoken hears of the offer. Only the accept event says which quest it was.
StartScenario()
world.questID = 0
world.title = ""
stub.FireEvent("QUEST_FINISHED")
stub.FireEvent("QUEST_DETAIL")
stub.Advance(0.3)
world.title = "Test Quest"
stub.FireEvent("QUEST_ACCEPTED", 1, full)
stub.Advance(3)
Expect("auto-accept that closes the window before Spoken sees the offer still reads accept",
    string.format("%d-accept", full))

-- Auto-accept closing the window at once, followed by the server's accept event: one read.
StartScenario()
world.questID = full
stub.FireEvent("QUEST_DETAIL")
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.Advance(0.3)
stub.FireEvent("QUEST_ACCEPTED", 1, full)
stub.Advance(3)
Expect("auto-accept closing the window at once reads accept once", string.format("%d-accept", full))

-- The same on a client that keeps reporting the quest ID after the window has closed: the ID
-- never drops to 0, so the accept event is what says the window closed on an accepted quest.
StartScenario()
world.questID = full
stub.FireEvent("QUEST_DETAIL")
stub.FireEvent("QUEST_FINISHED")
stub.Advance(0.3)
stub.FireEvent("QUEST_ACCEPTED", 1, full)
stub.Advance(3)
Expect("auto-accept with a quest ID left set after the window closes reads accept once",
    string.format("%d-accept", full))

-- A player who reads the offer and accepts it: the watcher reads it, the accept event adds nothing.
StartScenario()
world.questID = full
stub.ShowPanel("QuestFrameDetailPanel")
stub.FireEvent("QUEST_DETAIL")
stub.Advance(3)
world.questID = 0
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")
stub.FireEvent("QUEST_ACCEPTED", 1, full)
stub.Advance(3)
Expect("normal accept reads accept once", string.format("%d-accept", full))

-- A player who declines: no accept event comes, and nothing is read beyond what the open window read.
StartScenario()
world.questID = full
stub.ShowPanel("QuestFrameDetailPanel")
stub.FireEvent("QUEST_DETAIL")
stub.Advance(3)
world.questID = 0
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")
stub.Advance(15)
Expect("declined quest reads its offer once and nothing more", string.format("%d-accept", full))

-- Auto turn-in: CompleteQuest answers the progress page, the server sends the reward page a moment
-- later and GetQuestReward closes it. Each page is read, in order, as a player clicking through hears them.
StartScenario()
world.questID = full
stub.FireEvent("QUEST_PROGRESS")
stub.Advance(0.1)
stub.FireEvent("QUEST_COMPLETE")
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.Advance(0.1)
stub.FireEvent("QUEST_TURNED_IN", full, 0, 0)
stub.Advance(5)
Expect("auto turn-in reads progress then complete",
    string.format("%d-progress, %d-complete", full, full))

-- An auto turn-in addon whose handler runs before Spoken's: the reward page is gone before Spoken
-- hears of it, and the turn-in event names the quest.
StartScenario()
world.questID = 0
world.title = ""
stub.FireEvent("QUEST_FINISHED")
stub.FireEvent("QUEST_COMPLETE")
stub.Advance(0.3)
world.title = "Test Quest"
stub.FireEvent("QUEST_TURNED_IN", full, 0, 0)
stub.Advance(3)
Expect("auto turn-in that closes the window before Spoken sees the reward page still reads complete",
    string.format("%d-complete", full))

-- Auto turn-in and the follow-up's auto-accept within one poll of the watcher: no page is lost to the next.
StartScenario()
world.questID = full
stub.FireEvent("QUEST_PROGRESS")
stub.FireEvent("QUEST_COMPLETE")
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.FireEvent("QUEST_TURNED_IN", full, 0, 0)
world.questID = followUp
stub.FireEvent("QUEST_DETAIL")
world.questID = 0
stub.FireEvent("QUEST_FINISHED")
stub.FireEvent("QUEST_ACCEPTED", 1, followUp)
stub.Advance(5)
Expect("auto turn-in then the follow-up's auto-accept reads all three pages",
    string.format("%d-progress, %d-complete, %d-accept", full, full, followUp))

if failures > 0 then
    print(string.format("\n%d scenario(s) failed", failures))
    os.exit(1)
end
print("\nall scenarios passed")
