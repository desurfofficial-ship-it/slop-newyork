// js/game-state.js
// Central life-simulation state: wallet, needs, the in-game clock, housing, job, social
// connections, discovery progress and mission progress. Plain data + a tiny event bus so the
// gameplay systems (economy, places, subway, npcs, missions) stay decoupled from each other and
// from the UI.
//
// Persistence lives under its own key (`nyc-life-save`); the pre-existing `nyc-player-state`
// position save in main.js is untouched. Everything is fault tolerant: corrupt or foreign data
// falls back to defaults instead of breaking the game.

const SAVE_KEY = 'nyc-life-save';
const SAVE_VERSION = 1;

// Play modes change the starting wallet, whether rent applies and whether missions are tracked.
export const PLAY_MODES = {
  tourist: { id: 'tourist', label: 'Tourist', blurb: 'See the sights, eat well, ride the rails.', startCents: 180000, paysRent: false, tracksMissions: true },
  resident: { id: 'resident', label: 'New Resident', blurb: 'Find a home, learn the subway, settle in.', startCents: 240000, paysRent: true, tracksMissions: true },
  career: { id: 'career', label: 'Career', blurb: 'Start light, work shifts, grow your savings.', startCents: 120000, paysRent: true, tracksMissions: true },
  freeroam: { id: 'freeroam', label: 'Free Roam', blurb: 'A full wallet and no obligations.', startCents: 500000, paysRent: false, tracksMissions: false }
};

// Arrival scenario ids. Spawn coordinates and intro text live in places.js, which computes them
// from the city grid (1:1 world units) — this module stays free of geometry.
export const ARRIVAL_IDS = ['penn', 'portauthority', 'jfk'];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

function defaultState() {
  return {
    version: SAVE_VERSION,
    started: false,
    mode: 'freeroam',
    arrival: 'penn',
    moneyCents: 0,
    needs: { energy: 100, hunger: 0 }, // hunger 0 = full, 100 = starving
    clock: { day: 1, minutes: nowMinutes() },
    housing: null, // { id, name, dailyRentCents, quality }
    job: null, // { id, title, shiftPayCents, level }
    shiftsWorked: 0,
    connections: [], // npc ids met
    achievements: [],
    discovered: { pois: [], stations: [] },
    visitedPois: {}, // poiId -> visit count
    mealsEaten: 0,
    subwayRides: 0,
    missionProgress: {}, // missionId -> { objectiveId: progress }
    missionsCompleted: [],
    activeMissionId: null,
    evictionWarnings: 0,
    playSeconds: 0,
    settings: { autoTime: true, clockSpeed: 1 }
  };
}

function sanitize(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const s = d;
  s.started = raw.started === true;
  s.mode = Object.hasOwn(PLAY_MODES, raw.mode) ? raw.mode : 'freeroam';
  s.arrival = ARRIVAL_IDS.includes(raw.arrival) ? raw.arrival : 'penn';
  s.moneyCents = Number.isFinite(raw.moneyCents) ? clamp(Math.round(raw.moneyCents), -500000, 100000000) : 0;
  if (raw.needs && typeof raw.needs === 'object') {
    s.needs.energy = clamp(Number(raw.needs.energy) || 0, 0, 100);
    s.needs.hunger = clamp(Number(raw.needs.hunger) || 0, 0, 100);
  }
  if (raw.clock && typeof raw.clock === 'object') {
    s.clock.day = clamp(Math.round(Number(raw.clock.day) || 1), 1, 9999);
    s.clock.minutes = clamp(Math.round(Number(raw.clock.minutes) || 0), 0, 1439);
  }
  if (raw.housing && typeof raw.housing === 'object' && typeof raw.housing.id === 'string') {
    s.housing = {
      id: raw.housing.id,
      name: String(raw.housing.name || 'Apartment').slice(0, 80),
      dailyRentCents: clamp(Math.round(Number(raw.housing.dailyRentCents) || 0), 0, 100000),
      quality: String(raw.housing.quality || '').slice(0, 24)
    };
  }
  if (raw.job && typeof raw.job === 'object' && typeof raw.job.id === 'string') {
    s.job = {
      id: raw.job.id,
      title: String(raw.job.title || 'Job').slice(0, 60),
      shiftPayCents: clamp(Math.round(Number(raw.job.shiftPayCents) || 0), 0, 100000),
      level: clamp(Math.round(Number(raw.job.level) || 1), 1, 9)
    };
  }
  s.shiftsWorked = clamp(Math.round(Number(raw.shiftsWorked) || 0), 0, 999999);
  if (Array.isArray(raw.connections)) s.connections = raw.connections.filter((c) => typeof c === 'string').slice(0, 200);
  if (Array.isArray(raw.achievements)) s.achievements = raw.achievements.filter((c) => typeof c === 'string').slice(0, 200);
  if (raw.discovered && typeof raw.discovered === 'object') {
    if (Array.isArray(raw.discovered.pois)) s.discovered.pois = raw.discovered.pois.filter((c) => typeof c === 'string').slice(0, 500);
    if (Array.isArray(raw.discovered.stations)) s.discovered.stations = raw.discovered.stations.filter((c) => typeof c === 'string').slice(0, 500);
  }
  if (raw.visitedPois && typeof raw.visitedPois === 'object') {
    for (const [k, v] of Object.entries(raw.visitedPois)) {
      if (typeof k === 'string' && Number.isFinite(v)) s.visitedPois[k.slice(0, 60)] = clamp(Math.round(v), 0, 99999);
    }
  }
  s.mealsEaten = clamp(Math.round(Number(raw.mealsEaten) || 0), 0, 999999);
  s.subwayRides = clamp(Math.round(Number(raw.subwayRides) || 0), 0, 999999);
  if (raw.missionProgress && typeof raw.missionProgress === 'object') {
    for (const [mid, objs] of Object.entries(raw.missionProgress)) {
      if (typeof mid !== 'string' || !objs || typeof objs !== 'object') continue;
      const clean = {};
      for (const [oid, p] of Object.entries(objs)) {
        if (typeof oid === 'string' && Number.isFinite(p)) clean[oid.slice(0, 60)] = clamp(Math.round(p), 0, 999999);
      }
      s.missionProgress[mid.slice(0, 60)] = clean;
    }
  }
  if (Array.isArray(raw.missionsCompleted)) s.missionsCompleted = raw.missionsCompleted.filter((c) => typeof c === 'string').slice(0, 100);
  if (typeof raw.activeMissionId === 'string') s.activeMissionId = raw.activeMissionId.slice(0, 60);
  s.evictionWarnings = clamp(Math.round(Number(raw.evictionWarnings) || 0), 0, 99);
  s.playSeconds = clamp(Math.round(Number(raw.playSeconds) || 0), 0, 99999999);
  if (raw.settings && typeof raw.settings === 'object') {
    s.settings.autoTime = raw.settings.autoTime !== false;
    s.settings.clockSpeed = raw.settings.clockSpeed === 2 ? 2 : raw.settings.clockSpeed === 4 ? 4 : 1;
  }
  return s;
}

// --- Tiny event bus ---------------------------------------------------------------------------

export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => this.off(event, fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (e) {
          console.warn(`[life] listener for "${event}" failed`, e);
        }
      }
    }
  };
}

// --- Game state -------------------------------------------------------------------------------

export function createGameState(bus = createEventBus()) {
  let state = defaultState();
  let dirty = false;

  const emitChange = () => bus.emit('state', state);

  function markDirty() {
    dirty = true;
  }

  return {
    bus,
    get state() {
      return state;
    },
    get isDirty() {
      return dirty;
    },

    // --- Session lifecycle ---
    hasSave() {
      try {
        return localStorage.getItem(SAVE_KEY) !== null;
      } catch {
        return false;
      }
    },

    save() {
      try {
        state.version = SAVE_VERSION;
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        dirty = false;
        return true;
      } catch {
        return false; // storage disabled or full — the game keeps playing without saves
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        state = sanitize(JSON.parse(raw));
        emitChange();
        return true;
      } catch (e) {
        console.warn('[life] save could not be read, starting fresh', e);
        state = defaultState();
        return false;
      }
    },

    clearSave() {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch { /* storage unavailable */ }
    },

    startNewGame({ mode = 'resident', arrival = 'penn' } = {}) {
      const fresh = defaultState();
      fresh.started = true;
      fresh.mode = Object.hasOwn(PLAY_MODES, mode) ? mode : 'resident';
      fresh.arrival = ARRIVAL_IDS.includes(arrival) ? arrival : 'penn';
      fresh.moneyCents = PLAY_MODES[fresh.mode].startCents;
      fresh.clock.minutes = nowMinutes();
      state = fresh;
      bus.emit('start', { mode: fresh.mode, arrival: fresh.arrival });
      emitChange();
      this.save();
    },

    // --- Money (integer cents; economy.js wraps this with prices & the ledger) ---
    adjustMoney(centsDelta, reason = '') {
      if (!Number.isFinite(centsDelta) || centsDelta === 0) return state.moneyCents;
      state.moneyCents = clamp(Math.round(state.moneyCents + centsDelta), -1000000, 100000000);
      bus.emit('money', { delta: centsDelta, reason, balance: state.moneyCents });
      markDirty();
      emitChange();
      return state.moneyCents;
    },

    // --- Needs ---
    setNeed(need, value) {
      if (need !== 'energy' && need !== 'hunger') return;
      const v = clamp(value, 0, 100);
      if (state.needs[need] === v) return;
      state.needs[need] = v;
      markDirty();
      emitChange();
    },

    // --- In-game clock: minutes since midnight, day counter. 1 real second ≈ 1 game minute. ---
    advanceMinutes(minutes) {
      const m = Math.round(minutes);
      if (m <= 0) return;
      state.clock.minutes += m;
      while (state.clock.minutes >= 1440) {
        state.clock.minutes -= 1440;
        state.clock.day += 1;
        bus.emit('newday', { day: state.clock.day });
      }
      bus.emit('clock', { ...state.clock });
      markDirty();
      emitChange();
    },

    setClock(minutes, day) {
      if (Number.isFinite(minutes)) state.clock.minutes = clamp(Math.round(minutes), 0, 1439);
      if (Number.isFinite(day) && day >= 1) state.clock.day = Math.round(day);
      bus.emit('clock', { ...state.clock });
      markDirty();
      emitChange();
    },

    setSetting(key, value) {
      if (!Object.hasOwn(state.settings, key)) return;
      state.settings[key] = value;
      bus.emit('setting', { key, value });
      markDirty();
      emitChange();
    },

    // --- Progress bookkeeping ---
    recordPoiVisit(poiId) {
      if (typeof poiId !== 'string' || !poiId) return false;
      const first = !state.visitedPois[poiId];
      state.visitedPois[poiId] = (state.visitedPois[poiId] || 0) + 1;
      if (first && !state.discovered.pois.includes(poiId)) state.discovered.pois.push(poiId);
      bus.emit(first ? 'discover' : 'visit', { id: poiId });
      markDirty();
      emitChange();
      return first;
    },

    recordStationVisit(stationId) {
      if (typeof stationId !== 'string' || !stationId) return false;
      if (state.discovered.stations.includes(stationId)) return false;
      state.discovered.stations.push(stationId);
      bus.emit('discover', { id: stationId, station: true });
      markDirty();
      emitChange();
      return true;
    },

    recordMeal() {
      state.mealsEaten += 1;
      bus.emit('meal', { count: state.mealsEaten });
      markDirty();
    },

    recordRide() {
      state.subwayRides += 1;
      bus.emit('ride', { count: state.subwayRides });
      markDirty();
    },

    recordShift() {
      state.shiftsWorked += 1;
      bus.emit('shift', { count: state.shiftsWorked });
      markDirty();
    },

    meetNpc(npcId) {
      if (typeof npcId !== 'string' || !npcId || state.connections.includes(npcId)) return false;
      state.connections.push(npcId);
      bus.emit('meet', { id: npcId });
      markDirty();
      emitChange();
      return true;
    },

    setHousing(housing) {
      state.housing = housing; // null to move out
      bus.emit('housing', { housing });
      markDirty();
      emitChange();
    },

    setJob(job) {
      state.job = job;
      bus.emit('job', { job });
      markDirty();
      emitChange();
    },

    addAchievement(id) {
      if (typeof id !== 'string' || !id || state.achievements.includes(id)) return false;
      state.achievements.push(id);
      bus.emit('achievement', { id });
      markDirty();
      emitChange();
      return true;
    },

    // --- Mission progress ---
    getMissionProgress(missionId) {
      return state.missionProgress[missionId] || null;
    },

    setMissionObjective(missionId, objectiveId, value) {
      if (!state.missionProgress[missionId]) state.missionProgress[missionId] = {};
      state.missionProgress[missionId][objectiveId] = Math.max(0, Math.round(value));
      markDirty();
      emitChange();
    },

    setActiveMission(missionId) {
      state.activeMissionId = missionId;
      markDirty();
      emitChange();
    },

    completeMission(missionId) {
      if (state.missionsCompleted.includes(missionId)) return false;
      state.missionsCompleted.push(missionId);
      state.activeMissionId = null;
      bus.emit('mission-complete', { id: missionId });
      markDirty();
      emitChange();
      return true;
    },

    tickPlayTime(seconds) {
      state.playSeconds += seconds;
    }
  };
}
