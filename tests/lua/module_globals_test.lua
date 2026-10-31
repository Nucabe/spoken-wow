-- The modules another addon may reach: Places, Readables and NPCs each put their table in a
-- global of their name, and the functions such an addon asks (is there a story, is it found,
-- is it voiced, read it, show it) are on it. What stops a refactor from closing the door a
-- feature addon came in through. Run with `make test-player`.
local here = arg[0]:match("^(.*)/[^/]*$") or "."
package.path = here .. "/?.lua;" .. package.path
local stub = require("wow_client_stub")
local H = require("queue_helpers")
local print = stub.print
local ADDONS = here .. "/../../addons/"
local Expect, Failures = H.Expecter(print)

stub.SetClient("16001"); stub.ResetSound(); stub.ResetTimers()

---------------------------------------------------------------- places
local Z = H.LoadPlaces(ADDONS .. "Spoken_Places/")
Expect("SpokenPlaces is the Places module", _G.SpokenPlaces, Z)
for _, name in ipairs({ "GetLore", "GetSubzoneLore", "HasAudio", "PlayLore", "StopLore", "IsPlayingLore" }) do
    Expect("SpokenPlaces:" .. name .. " exists", type(_G.SpokenPlaces[name]), "function")
end

---------------------------------------------------------------- readables
local env = stub.LoadSpoken(ADDONS .. "Spoken/")
env.Addon:Enable()
local R = {}
for _, file in ipairs({ "Locale/enUS", "Checksum", "Core", "Language", "Reader", "Audio", "Playlist" }) do
    local chunk = assert(loadfile(ADDONS .. "Spoken_Readables/" .. file .. ".lua"))
    chunk("Spoken_Readables", R)
end
Expect("SpokenReadables is the Readables module", _G.SpokenReadables, R)
for _, name in ipairs({ "PlaceOf", "BookById", "HasAudio", "PlayFrom", "StopReading", "IsNarrating" }) do
    Expect("SpokenReadables:" .. name .. " exists", type(_G.SpokenReadables[name]), "function")
end

---------------------------------------------------------------- npcs
local N = {}
local chunk = assert(loadfile(ADDONS .. "Spoken_NPCs/Core.lua"))
chunk("Spoken_NPCs", N)
Expect("SpokenNPCs is the NPCs module", _G.SpokenNPCs, N)

if Failures() > 0 then os.exit(1) end
print("\nAll module global tests passed")
