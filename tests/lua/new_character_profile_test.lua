-- The profile for new characters: a character logging in with Spoken for the first time starts on
-- the profile chosen on Spoken's page, in Spoken's settings and in the quests module's, and every
-- character that has logged in before keeps its profile and every value in it. Runs the real
-- AceDB, since which profile a character gets is AceDB's profileKeys, which the stub's AceDB does
-- not have. Run with `make test-player`.
local here = arg[0]:match("^(.*)/[^/]*$") or "."
package.path = here .. "/?.lua;" .. package.path
local stub = require("wow_client_stub")
local H = require("queue_helpers")
local print = stub.print
local SPOKEN = here .. "/../../addons/Spoken/"
local QUESTS = here .. "/../../addons/Spoken_Quests/"
local Expect, Failures = H.Expecter(print)

_G.UnitFactionGroup = _G.UnitFactionGroup or function() return "Alliance", "Alliance" end
_G.GetCurrentRegion = _G.GetCurrentRegion or function() return 3 end
_G.GetCurrentRegionName = _G.GetCurrentRegionName or function() return "EU" end

-- The real libraries over the stub's: LibStub hands back the stub's table, emptied here so the file
-- fills it as a first load would. AceDB reads the character's name as its file loads, so each login
-- loads it again under that name.
local function RealLibraries(name)
    stub.world.playerName = name
    for _, lib in ipairs({ "CallbackHandler-1.0", "AceDB-3.0" }) do
        local made = _G.LibStub:NewLibrary(lib, 1)
        for key in pairs(made) do made[key] = nil end
        dofile(SPOKEN .. "Libs/" .. lib .. "/" .. lib .. ".lua")
    end
end

local function Copy(value)
    if type(value) ~= "table" then return value end
    local out = {}
    for key, inner in pairs(value) do out[key] = Copy(inner) end
    return out
end

local function Same(a, b)
    if type(a) ~= "table" or type(b) ~= "table" then return a == b end
    for key, value in pairs(a) do if not Same(value, rawget(b, key)) then return false end end
    for key in pairs(b) do if rawget(a, key) == nil then return false end end
    return true
end

-- The test harness writes Style and LineGap into the profile a character is on (LoadSpoken), and
-- the first login on a profile places the minimap button: each saved profile has them already, as a
-- profile that has been played on has, so a write here is a change to what the player had.
local function Profile(fontSize)
    return { Transcript = { FontSize = fontSize }, Frame = { Style = "classic" }, Audio = { LineGap = 0 },
        Minimap = { LibDBIcon = { minimapPos = 204 } } }
end

--- What a player has saved: Alice on a profile of her own, Bob on Shared, in both addons.
local function Seed(newCharacters)
    _G.SpokenSettings = {
        profileKeys = { ["Alice - Realm"] = "Alice - Realm", ["Bob - Realm"] = "Shared" },
        profiles = { ["Alice - Realm"] = Profile(20), Shared = Profile(12) },
        global = { NewCharacterProfile = newCharacters },
    }
    _G.SpokenQuestsSettings = {
        profileKeys = { ["Alice - Realm"] = "Alice - Realm", ["Bob - Realm"] = "Shared" },
        profiles = {
            ["Alice - Realm"] = { Audio = { Autoplay = false } },
            Shared = { Audio = { GreetingFirst = true } },
        },
    }
end

local env, VO
--- A login of `name` with Spoken and its quests module, then a logout, which is when AceDB strips
--- what it filled in and the game writes the saved variables.
local function Play(name)
    stub.SetClient("16001"); stub.ResetSound(); stub.ResetTimers(); stub.ResetFrames()
    stub.ldbObjects = {}; stub.dbIcons = {}
    RealLibraries(name)
    VO, env = stub.LoadQuests(QUESTS, SPOKEN)
    VO.Addon:OnInitialize()
    local spoken, quests = env.Addon.db:GetCurrentProfile(), VO.Addon.db:GetCurrentProfile()
    local fontSize = env.Addon.db.profile.Transcript.FontSize
    local autoplay = VO.Addon.db.profile.Audio.Autoplay
    local AceDB = _G.LibStub("AceDB-3.0")
    AceDB.frame.scripts.OnEvent(AceDB.frame, "PLAYER_LOGOUT")
    return spoken, quests, fontSize, autoplay
end

---------------------------------------------------------------- a profile chosen for new characters
Seed("Shared")
local spokenBefore, questsBefore = Copy(SpokenSettings), Copy(SpokenQuestsSettings)

local spoken, quests, fontSize, autoplay = Play("Alice")
Expect("a character with a profile of its own keeps it in Spoken", spoken, "Alice - Realm")
Expect("...and in the quests module", quests, "Alice - Realm")
Expect("...with its settings", fontSize, 20)
Expect("...and the quests module's", autoplay, false)

spoken, quests = Play("Bob")
Expect("a character on another profile keeps it in Spoken", spoken, "Shared")
Expect("...and in the quests module", quests, "Shared")
Expect("after both log in, Spoken's saved profiles are as they were", Same(SpokenSettings.profiles, spokenBefore.profiles), true)
Expect("...and which character is on which", Same(SpokenSettings.profileKeys, spokenBefore.profileKeys), true)
Expect("...and the quests module's profiles", Same(SpokenQuestsSettings.profiles, questsBefore.profiles), true)
Expect("...and which character is on which there", Same(SpokenQuestsSettings.profileKeys, questsBefore.profileKeys), true)

spoken, quests, fontSize = Play("Carol")
Expect("a new character starts on the profile chosen for new characters", spoken, "Shared")
Expect("...in the quests module too", quests, "Shared")
Expect("...with that profile's settings", fontSize, 12)
Expect("...and stays on it", SpokenSettings.profileKeys["Carol - Realm"], "Shared")
Expect("no profile is made for the new character", SpokenSettings.profiles["Carol - Realm"], nil)
Expect("...in the quests module either", SpokenQuestsSettings.profiles["Carol - Realm"], nil)
Expect("the shared profile is as it was", Same(SpokenSettings.profiles.Shared, spokenBefore.profiles.Shared), true)
Expect("...and its quests settings", Same(SpokenQuestsSettings.profiles.Shared, questsBefore.profiles.Shared), true)
Expect("Alice's profile is as it was", Same(SpokenSettings.profiles["Alice - Realm"], spokenBefore.profiles["Alice - Realm"]), true)

---------------------------------------------------------------- none chosen
Seed(nil)
spokenBefore = Copy(SpokenSettings)
spoken, quests, fontSize = Play("Dave")
Expect("with none chosen, a new character gets a profile of its own", spoken, "Dave - Realm")
Expect("...in the quests module too", quests, "Dave - Realm")
Expect("...starting from the defaults", fontSize, 16)
Expect("...and the shared profile is as it was", Same(SpokenSettings.profiles.Shared, spokenBefore.profiles.Shared), true)
spoken = Play("Bob")
Expect("...and a character on another profile keeps it", spoken, "Shared")

---------------------------------------------------------------- the chosen profile deleted
Seed("Gone")
spoken, quests = Play("Erin")
Expect("a chosen profile that no longer exists gives a new character a profile of its own", spoken, "Erin - Realm")
Expect("...in the quests module too", quests, "Erin - Realm")
Expect("...and is not made again", SpokenSettings.profiles.Gone, nil)

---------------------------------------------------------------- the choice on Spoken's page
Seed(nil)
Play("Alice")
local Options = env.Options
Expect("with none chosen, the page shows a profile of their own", Options:NewCharacterProfile(), false)
Options:SetNewCharacterProfile("Shared")
Expect("choosing a profile keeps it for every character", SpokenSettings.global.NewCharacterProfile, "Shared")
Expect("...and the page shows it", Options:NewCharacterProfile(), "Shared")
Expect("...and the character choosing stays on its own", env.Addon.db:GetCurrentProfile(), "Alice - Realm")
Options:DeleteProfile("Shared")
Expect("deleting the chosen profile goes back to a profile of their own", SpokenSettings.global.NewCharacterProfile, nil)
Options:SetNewCharacterProfile("Alice - Realm")
Options:SetNewCharacterProfile(false)
Expect("choosing a profile of their own clears the choice", SpokenSettings.global.NewCharacterProfile, nil)

stub.world.playerName = nil
if Failures() > 0 then print(Failures() .. " failure(s)"); os.exit(1) end
