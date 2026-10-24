local _, NPCs = ...

-- A boss's story in Spoken's narrator, as words with no voice, once per character, when the boss
-- is killed. The game sends no kill for a boss whose fight it may not announce (`onTarget`), so its
-- death is watched while the player has it targeted.

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

-- The target, where it is a boss whose fight may start no encounter and it is alive; `generation`
-- ends the polling of an earlier one.
local watched, generation = nil, 0

local POLL_SECONDS = 0.5

--- The boss watched is dead, so it is met and its story shown.
function NPCs:CheckWatched()
	if not watched or Spoken.NotSecret(UnitIsDead("target")) ~= true then return end
	local boss = watched
	watched = nil
	self:FoundBoss(boss.map, boss.key)
	self:ReadStory(boss.map, boss.key)
end

-- The client's health events are not relied on: the target is read twice a second while it is watched.
local function Poll(mine)
	if mine ~= generation or not watched then return end
	NPCs:CheckWatched()
	if watched then C_Timer.After(POLL_SECONDS, function() Poll(mine) end) end
end

--- The player targeted a unit: a boss whose fight may start no encounter is watched until it dies.
function NPCs:TargetChanged()
	watched, generation = nil, generation + 1
	local id = Spoken.CreatureID(UnitGUID and UnitGUID("target"))
	if not id then return end
	-- A boss only Forever has is not among Data/Creatures.lua's: known by its name in the dungeon
	-- the player is in.
	local boss = Creatures()[id] or self:BossNamed(Spoken.NotSecret(UnitName and UnitName("target")))
	if boss and self:IsUnannounced(boss.map, boss.key) and Spoken.NotSecret(UnitIsDead("target")) == false then
		watched = boss
		local mine = generation
		C_Timer.After(POLL_SECONDS, function() Poll(mine) end)
	end
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
