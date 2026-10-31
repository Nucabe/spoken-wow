-- The modules another addon may reach: Places, Readables and Bosses each put their table in a
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

-- Whether the UI file `path` defines `module:name`. The UI files need frames this stub does not
-- build, so the functions they hold are found in their source instead.
local function Defines(path, module, name)
    local file = assert(io.open(ADDONS .. path))
    local source = file:read("*a")
    file:close()
    return source:find("\nfunction " .. module .. ":" .. name .. "%(") ~= nil
end

stub.SetClient("16001"); stub.ResetSound(); stub.ResetTimers()

---------------------------------------------------------------- places
local Z = H.LoadPlaces(ADDONS .. "Spoken_Places/")
Expect("SpokenPlaces is the Places module", _G.SpokenPlaces, Z)
for _, name in ipairs({ "GetLore", "GetSubzoneLore", "HasAudio", "PlayLore", "StopLore", "IsPlayingLore" }) do
    Expect("SpokenPlaces:" .. name .. " exists", type(_G.SpokenPlaces[name]), "function")
end
for _, name in ipairs({ "IsLocked", "ShowLoreFor" }) do
    Expect("SpokenPlaces:" .. name .. " is defined", Defines("Spoken_Places/UI/LoreWindow.lua", "SpokenPlaces", name), true)
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
for _, name in ipairs({ "CompendiumHas", "ShowReadables" }) do
    Expect("SpokenReadables:" .. name .. " is defined", Defines("Spoken_Readables/UI/Readables.lua", "SpokenReadables", name), true)
end

---------------------------------------------------------------- bosses
local B = {}
local chunk = assert(loadfile(ADDONS .. "Spoken_Bosses/Core.lua"))
chunk("Spoken_Bosses", B)
Expect("SpokenBossesAddon is the Bosses module", _G.SpokenBossesAddon, B)

if Failures() > 0 then os.exit(1) end
print("\nAll module global tests passed")
