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

-- The boss the player last targeted alive, of those whose fight may start no encounter: { boss, guid,
-- since }. The client clears the target as the boss dies, so the target is no help then; the boss is
-- found by its GUID on any unit the client reports it on (a nameplate, the soft target, the mouse),
-- whose health event and dead flag are still readable. `generation` ends the polling of an earlier one.
local watched, generation = nil, 0
local watcher

local POLL_SECONDS = 1
local WATCH_SECONDS = 1800

-- Whether `unit` is dead, or nil when the client hides it.
local function Dead(unit)
	local dead = UnitIsDead(unit)
	if issecretvalue and issecretvalue(dead) then return nil end
	return dead and true or false
end

--- Stops watching the boss, as it died or the player left.
function NPCs:StopWatching()
	watched = nil
	if watcher then watcher:UnregisterEvent("UNIT_HEALTH") end
end

--- `unit` may be the boss watched: if it is, and dead, the boss is met and its story shown.
function NPCs:CheckUnit(unit)
	if not (watched and unit) or Spoken.NotSecret(UnitGUID(unit)) ~= watched.guid or Dead(unit) ~= true then return end
	local boss = watched.boss
	self:StopWatching()
	self:FoundBoss(boss.map, boss.key)
	self:ReadStory(boss.map, boss.key)
end

-- The event is not everywhere: the boss is also looked for by its GUID once a second.
local function Poll(mine)
	if mine ~= generation or not watched then return end
	if GetTime() - watched.since > WATCH_SECONDS then return NPCs:StopWatching() end
	local unit = UnitTokenFromGUID and UnitTokenFromGUID(watched.guid)
	if unit then NPCs:CheckUnit(unit) end
	if watched then C_Timer.After(POLL_SECONDS, function() Poll(mine) end) end
end

local function Watch(boss, guid)
	if watched and watched.guid == guid then return end
	watched, generation = { boss = boss, guid = guid, since = GetTime() }, generation + 1
	watcher = watcher or CreateFrame("Frame")
	watcher:SetScript("OnEvent", function(_, _, unit) NPCs:CheckUnit(unit) end)
	watcher:RegisterEvent("UNIT_HEALTH")
	local mine = generation
	C_Timer.After(POLL_SECONDS, function() Poll(mine) end)
end

--- The player targeted a unit: a boss whose fight may start no encounter is watched until it dies.
--- A target cleared, as it is when the boss dies, leaves the watch as it was.
function NPCs:TargetChanged()
	local guid = Spoken.NotSecret(UnitGUID and UnitGUID("target"))
	local id = Spoken.CreatureID(guid)
	if not id then return end
	-- A boss only Forever has is not among Data/Creatures.lua's: known by its name in the dungeon
	-- the player is in.
	local boss = Creatures()[id] or self:BossNamed(Spoken.NotSecret(UnitName and UnitName("target")))
	if boss and self:IsUnannounced(boss.map, boss.key) and Dead("target") == false then Watch(boss, guid) end
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
