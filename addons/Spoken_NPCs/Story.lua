local _, NPCs = ...

-- A boss's story in Spoken's narrator, as words with no voice, once per character, when the boss
-- is killed. The game sends no kill for a boss whose fight it may not announce (`onTarget`), so its
-- death is watched after the player targets it.

local L = NPCs.L

local source

-- [creature id] = { map, key }, from Data/Creatures.lua, built on first use.
local byCreature
local function Creatures()
	if byCreature then return byCreature end
	byCreature = {}
	for map, bosses in pairs(_G.SpokenBossCreatures or {}) do
		for key, entry in pairs(bosses) do
			if entry.creature then byCreature[entry.creature] = { map = map, key = key } end
		end
	end
	return byCreature
end

--- Registers the bosses' stories with Spoken as a part of its own, after the settings are read.
function NPCs:SetupStories()
	if source or not (Spoken and Spoken.RegisterSource and Spoken.ShowsNarratorFor) then return end
	source = Spoken:RegisterSource("bosses", {
		title = L.OPT_PAGE_TITLE,
		addon = "Spoken_NPCs",
		icon = NPCs.ICON,
		about = L.PART_ABOUT,
		order = 5,
		textOnly = true,
	})
end

--- Shows the story of the boss `key` of `map` in the narrator. Nothing when this character has
--- been shown it, the narrator would not show it, or the boss has none. Returns whether it queued.
--- A story is low, as gossip is: a voiced line coming drops it while it waits. It counts as shown
--- once it starts, so one dropped or cleared shows the next time.
function NPCs:ReadStory(map, key)
	if not (source and SpokenNPCsCharacter) then return false end
	local id = map .. ":" .. key
	if SpokenNPCsCharacter.storiesRead[id] or not Spoken:ShowsNarratorFor("bosses") then return false end
	local clip = self:StoryClip(map, key)
	if not clip then return false end
	clip.priority = "low"
	clip.startCallback = function() SpokenNPCsCharacter.storiesRead[id] = true end
	return source:Enqueue(clip) and true or false
end

-- The bosses the player met alive, of those whose fight may start no encounter: [guid] = { boss, since,
-- zone }. The client clears the target as the boss dies, so the target is no help then; the boss is
-- found by its GUID on any unit the client reports it on (a nameplate, the soft target, the mouse),
-- whose health event and dead flag are still readable.
local watched = {}
local watcher, polling

local POLL_SECONDS = 1
local WATCH_SECONDS = 1800

-- Calls `fn`, handing an error to the game's handler instead of raising it, so one failure does not
-- end the death check or the poll.
local function Safely(fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok and geterrorhandler then geterrorhandler()(err) end
end

-- Whether `unit` is dead, or nil when the client hides it.
local function Dead(unit)
	local dead = UnitIsDead(unit)
	if issecretvalue and issecretvalue(dead) then return nil end
	return dead and true or false
end

-- The zone the player is in, or nil while the client gives none (a loading screen) or hides it.
local function Zone()
	local zone = Spoken.NotSecret(GetRealZoneText())
	if zone ~= "" then return zone end
end

local function Unwatch(guid)
	watched[guid] = nil
	if not next(watched) and watcher then watcher:UnregisterEvent("UNIT_HEALTH") end
end

--- `unit` may be a boss watched: if it is, and dead, the boss is met and its story shown.
function NPCs:CheckUnit(unit)
	local guid = unit and Spoken.NotSecret(UnitGUID(unit))
	local entry = guid and watched[guid]
	if not entry or Dead(unit) ~= true then return end
	Unwatch(guid)
	local boss = entry.boss
	Safely(self.FoundBoss, self, boss.map, boss.key)
	self:ReadStory(boss.map, boss.key)
end

-- The event is not everywhere: the bosses are also looked for by their GUID once a second. A watch
-- ends half an hour after the boss was last seen, or where the player left the zone it began in.
local function Poll()
	polling = false
	local now, zone = GetTime(), Zone()
	for guid, entry in pairs(watched) do
		if now - entry.since > WATCH_SECONDS or (zone and entry.zone and zone ~= entry.zone) then
			Unwatch(guid)
		else
			local unit = UnitTokenFromGUID and UnitTokenFromGUID(guid)
			if unit then
				entry.since = now
				Safely(NPCs.CheckUnit, NPCs, unit)
			end
		end
	end
	if next(watched) then polling = true; C_Timer.After(POLL_SECONDS, Poll) end
end

-- Only these units can be a boss the player has met: the rest of a raid's health events are not looked at.
local function Reported(unit)
	return unit == "target" or unit == "softenemy" or unit == "mouseover" or unit == "focus"
		or (unit and (unit:find("^nameplate") or unit:find("^boss%d")))
end

local function Watch(boss, guid)
	watched[guid] = { boss = boss, since = GetTime(), zone = Zone() }
	if not watcher then
		watcher = CreateFrame("Frame")
		watcher:SetScript("OnEvent", function(_, _, unit) if Reported(unit) then NPCs:CheckUnit(unit) end end)
	end
	watcher:RegisterEvent("UNIT_HEALTH")
	if not polling then polling = true; C_Timer.After(POLL_SECONDS, Poll) end
end

--- The player targeted a unit, or one came into view (`unit`): a boss whose fight may start no
--- encounter, alive and not yet told, is watched until it dies. A target cleared, as it is when the
--- boss dies, leaves the watch as it was.
function NPCs:TargetChanged(unit)
	unit = unit or "target"
	local guid = Spoken.NotSecret(UnitGUID and UnitGUID(unit))
	if not guid or watched[guid] then return end
	local id = Spoken.CreatureID(guid)
	local boss = id and Creatures()[id]
	if not (boss and self:IsUnannounced(boss.map, boss.key)) or Dead(unit) ~= false then return end
	if self:IsBossFound(boss.map, boss.key) and SpokenNPCsCharacter.storiesRead[boss.map .. ":" .. boss.key] then return end
	Watch(boss, guid)
end

--- An encounter was won: its bosses are met, and their stories shown.
function NPCs:EncounterEnded(encounterID, success)
	if success ~= 1 then return end
	self:FoundEncounter(encounterID)
	for _, boss in ipairs(self:BossesOfEncounter(encounterID)) do self:ReadStory(boss.map, boss.key) end
end

--- Every story this character was shown can be shown again. Returns how many.
function NPCs:ForgetStories()
	local count = 0
	for _ in pairs(SpokenNPCsCharacter and SpokenNPCsCharacter.storiesRead or {}) do count = count + 1 end
	if SpokenNPCsCharacter then SpokenNPCsCharacter.storiesRead = {} end
	return count
end
