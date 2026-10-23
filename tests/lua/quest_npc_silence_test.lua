-- Silence NPC Voices: only an NPC whose greeting a pack reads is silenced as its window opens;
-- a quest-giver no pack voices keeps its own greeting. A quest window
-- whose quest is not known yet is silenced at once. Run with `make test-player`.
local here = arg[0]:match("^(.*)/[^/]*$") or "."
package.path = here .. "/?.lua;" .. package.path
local stub = require("wow_client_stub")
local H = require("queue_helpers")
local Expect, Failures = H.Expecter(stub.print)
local QUESTS = here .. "/../../addons/Spoken_Quests/"
local SPOKEN = here .. "/../../addons/Spoken/"

stub.SetClient("16001"); stub.ResetSound(); stub.ResetTimers(); stub.ResetFrames()
_G.SpokenQuestsSettings = nil
local VO = stub.LoadQuests(QUESTS, SPOKEN)
VO.Addon:OnInitialize()
local GREETING_HASH = "0123456789abcdef0123456789abcdef"
VO.DataModules:Register("TestPack", {
    SoundLengthLookupByFileName = { [GREETING_HASH] = 3 },
    GetSoundPath = function(_, fileName) return fileName .. ".ogg" end,
    GossipLookupByNPCID = { [23456] = { ["Welcome to the inn."] = GREETING_HASH } },
})
stub.Advance(2)
_G.SpokenEnv.Addon.db.profile.Audio.AutoToggleDialog = true
_G.SpokenEnv.Addon.db.profile.Audio.SoundChannel = "Master"
stub.world.npcName, stub.world.npcGUID = "Marshal", "Creature-0-0-0-0-12345-0"

local quests = { available = 0, active = 0 }
_G.GetNumGossipAvailableQuests = function() return quests.available end
_G.GetNumGossipActiveQuests = function() return quests.active end
_G.GetNumAvailableQuests = function() return quests.available end
_G.GetNumActiveQuests = function() return quests.active end

local function Open(event)
    stub.ShowGossip("Well met.")
    stub.FireEvent(event)
    -- Read in the same frame the window opened: before anything has had time to play.
    return GetCVar("Sound_EnableDialog")
end
local function Close()
    stub.HidePanels()
    stub.FireEvent("GOSSIP_CLOSED")
    stub.Advance(3)
    _G.Spoken:StopAll()
end

quests.available = 1
Expect("a quest-giver no pack voices keeps its greeting", Open("GOSSIP_SHOW"), "1")
Close()

quests.available, quests.active = 0, 1
Expect("...so does one with a quest to take back", Open("GOSSIP_SHOW"), "1")
Close()

Expect("...and one whose greeting window lists quests", Open("QUEST_GREETING"), "1")
Close()

-- A quest window whose quest cannot be told yet (no ID this early) mutes all the same, and the
-- mute lifts itself with no line coming.
stub.world.questID = 0
stub.ShowPanel("QuestFrameDetailPanel")
stub.FireEvent("QUEST_DETAIL")
Expect("a quest window with no quest known yet mutes the NPC at once", GetCVar("Sound_EnableDialog"), "0")
stub.Advance(2)
Expect("...and gives its voice back when no line comes", GetCVar("Sound_EnableDialog"), "1")
stub.ShowPanel(nil)
stub.FireEvent("QUEST_FINISHED")

-- A first talk: the client has not shown this NPC's text before, so the window opens without it
-- and the read 0.1s later finds no text. A pack voices the NPC, so the mute holds and the window
-- is read again until the text is there.
quests.available, quests.active = 0, 0
local function Talk(guid, text)
    stub.world.npcGUID = guid
    stub.ShowGossip(text)
    stub.FireEvent("GOSSIP_SHOW")
    return GetCVar("Sound_EnableDialog")
end
local VOICED, PLAIN = "Creature-0-0-0-0-23456-0", "Creature-0-0-0-0-12345-0"

Expect("a first talk to a voiced NPC mutes it as its window opens, its text not there yet", Talk(VOICED, ""), "0")
stub.Advance(0.15)
Expect("...and stays muted when the read finds no text yet", GetCVar("Sound_EnableDialog"), "0")
Expect("...with nothing read yet", _G.Spoken:GetCurrent(), nil)
-- The client fills the window in without another GOSSIP_SHOW.
stub.world.gossipText = "Welcome to the inn."
stub.Advance(0.3)
local current = _G.Spoken:GetCurrent()
Expect("...the window is read again, and the line starts once its text arrives", current and current.fileName, GREETING_HASH)
Expect("...with the NPC still silent", GetCVar("Sound_EnableDialog"), "0")
Close()

Expect("an NPC with no voice data is never muted", Talk(PLAIN, "Well met."), "1")
stub.Advance(0.15)
Expect("...not after the read either", GetCVar("Sound_EnableDialog"), "1")
Close()

-- The text is there and no pack has a line for it: nothing is coming, so the greeting is not held.
Expect("a voiced NPC is muted as its window opens", Talk(VOICED, "Not a line any pack has."), "0")
stub.Advance(0.15)
Expect("...and given its voice back as soon as its text is read and has no line", GetCVar("Sound_EnableDialog"), "1")
Expect("...with nothing queued", _G.Spoken:GetQueueSize(), 0)
Close()

-- The text never arrives: the window is read again a few times, then the voice comes back.
Expect("a voiced NPC whose window gets no text is muted as it opens", Talk(VOICED, ""), "0")
stub.Advance(0.9)
Expect("...held while the window is read again", GetCVar("Sound_EnableDialog"), "0")
stub.Advance(0.5)
Expect("...and given its voice back, nothing having played", GetCVar("Sound_EnableDialog"), "1")
Expect("...with nothing queued", _G.Spoken:GetQueueSize(), 0)
Close()

-- A window closed while it waits for its text is not read afterwards.
Talk(VOICED, "")
Close()
stub.world.gossipText = "Welcome to the inn."
stub.Advance(0.5)
Expect("a window closed before its text arrived is not read", _G.Spoken:GetCurrent(), nil)
Close()

if Failures() > 0 then print(string.format("\n%d failure(s)", Failures())); os.exit(1) end
print("\nAll quest NPC silence tests passed")
