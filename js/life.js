// js/life.js
// The life-simulation orchestrator: owns the game state and all sim systems, drives them from the
// render loop, and is the single integration point with main.js. main.js creates one LifeSim and
// calls update() each frame; everything else stays inside this module and the systems it wires.

import { createGameState, PLAY_MODES } from './game-state.js';
import { createEconomy } from './economy.js';
import { createSubway } from './subway.js';
import { createPlaces, NEEDS_PER_GAME_HOUR, ARRIVALS } from './places.js';
import { createNpcs } from './npcs.js';
import { createMissions } from './missions.js';
import { createDayCycle } from './day-cycle.js';
import { createLifeUI } from './life-ui.js';

export function createLifeSim({
  controllerManager,
  mapSystem,
  teleportTo,
  selectTime,
  isMapOpen
}) {
  const game = createGameState();
  const hadSave = game.hasSave();
  if (hadSave) game.load();

  const economy = createEconomy({ state: game, bus: game.bus });
  const subway = createSubway();
  mapSystem.setStations(subway.stations); // MTA bullets on the minimap & atlas, searchable
  const places = createPlaces({ state: game, economy, bus: game.bus });
  const npcs = createNpcs({ state: game, bus: game.bus });
  const missions = createMissions({ state: game, bus: game.bus, economy });

  // Live day/night: preset changes flow through main.js's selectTime so lighting, grade and the
  // segmented control all stay in sync. The Auto button's active state is synced there too.
  let dayCycle = null;
  const ui = createLifeUI({
    economy,
    missions,
    subway,
    handlers: {
      getState: () => game.state,
      getArrivals: () => ARRIVALS,
      getModes: () => Object.values(PLAY_MODES),
      isMapOpen: () => (isMapOpen ? isMapOpen() : false),
      openPlace,
      openNpc,
      openStation,
      onWelcomeContinue,
      onWelcomeRoam,
      onWelcomeStart
    }
  });
  ui.setPlacesCount(places.places.length);

  // Travel (subway ride) animation state
  let travel = null;
  let scanTimer = 0;
  let saveTimer = 0;
  let lastClockMinutes = null;
  let decaySkipMinutes = 0;
  let cityReady = false;

  // Needs track the in-game clock (awake hours; sleep compensates via decaySkipMinutes).
  game.bus.on('slept', ({ minutes }) => {
    decaySkipMinutes += minutes;
  });

  dayCycle = createDayCycle({
    state: game,
    applyPreset: (presetId) => selectTime(presetId, { fromDayCycle: true })
  });

  function started() {
    return game.state.started;
  }

  // --- Prompt scanning -------------------------------------------------------------

  function scanInteractions(dt) {
    scanTimer -= dt;
    if (scanTimer > 0) return;
    scanTimer = 0.22;
    if (!started() || travel || ui.isAnyPanelOpen() || (isMapOpen && isMapOpen())) {
      ui.setPrompt(null);
      return;
    }
    const ent = controllerManager.getActiveEntity();
    if (!ent) return;
    const px = ent.position.x;
    const pz = ent.position.z;

    let best = null; // { kind, dist, ... }
    const place = places.scan(px, pz, 15);
    if (place) best = { kind: 'place', dist: Math.hypot(place.x - px, place.z - pz), place };
    const npc = npcs.nearby(px, pz, 9);
    if (npc) {
      const d = Math.hypot(npc.pos.x - px, npc.pos.z - pz);
      if (!best || d < best.dist) best = { kind: 'npc', dist: d, npc };
    }
    const station = subway.nearestStation(px, pz, 16);
    if (station) {
      const d = Math.hypot(station.x - px, station.z - pz);
      if (!best || d < best.dist) best = { kind: 'station', dist: d, station };
    }

    if (!best) {
      ui.setPrompt(null);
      return;
    }
    const label = best.kind === 'place'
      ? best.place.name
      : best.kind === 'npc'
        ? `${best.npc.name} — ${best.npc.role}`
        : `${best.station.name} · Subway`;
    ui.setPrompt({ ...best, label });
  }

  // --- Interaction panels ----------------------------------------------------------

  function placeActionsFor(place) {
    return places.actionsFor(place).map((a) => ({
      label: a.label,
      sub: a.sub,
      disabled: a.disabled,
      run: () => {
        const ok = a.run();
        if (ok) {
          if (place.kind !== 'attraction') game.recordPoiVisit(place.id);
          refreshAll();
        }
        return ok;
      }
    }));
  }

  function openPlace(place) {
    if (!place) return;
    ui.closePlacePanel();
    ui.openPlacePanel({
      title: place.name,
      sub: place.district,
      blurb: place.blurb,
      lines: null,
      actions: placeActionsFor(place)
    });
  }

  function openNpc(npc) {
    ui.closePlacePanel();
    const render = (body, met) => {
      ui.openPlacePanel({
        title: npc.name,
        sub: npc.role,
        blurb: body,
        lines: null,
        actions: [
          {
            label: met ? 'Chat some more' : 'Say hello',
            sub: 'Builds your circle',
            run: () => {
              const res = npcs.talk(npc, 'chat');
              render(res.line, !res.met);
            }
          },
          {
            label: 'Ask for local advice',
            sub: 'The facts locals actually use',
            run: () => {
              const res = npcs.talk(npc, 'tip');
              render(res.line, true);
            }
          },
          {
            label: 'See you around',
            sub: '',
            run: () => ui.closePlacePanel()
          }
        ]
      });
    };
    render(npcs.greet(npc), false);
  }

  function openStation(station) {
    ui.closePlacePanel();
    game.recordStationVisit(station.id);
    const others = subway.stations
      .filter((s) => s !== station)
      .map((s) => {
        const plan = subway.plan(station, s);
        return { s, plan };
      })
      .filter((e) => e.plan)
      .sort((a, b) => a.plan.minutes - b.plan.minutes);
    ui.openPlacePanel({
      title: station.name,
      sub: station.lines.map((l) => `${l}`).join(' · '),
      blurb: 'Where to? Fares are $2.90 per ride (OMNY). Travel time is simplified, not a real schedule.',
      lines: station.lines,
      searchable: true,
      actions: others.map(({ s, plan }) => ({
        label: s.name,
        bullets: s.lines,
        sub: plan.transfers ? `${plan.minutes} min · ${plan.transfers} transfer` : `${plan.minutes} min`,
        price: '$2.90',
        run: () => ride(station, s, plan)
      }))
    });
  }

  function ride(from, to, plan) {
    if (travel) return;
    if (!economy.spend(plan.fareCents, `Subway · ${from.name} → ${to.name}`)) return;
    ui.closePlacePanel();
    controllerManager.resetInput();
    const line = plan.legs[0].line;
    travel = {
      from,
      to,
      plan,
      t: 0,
      duration: Math.min(plan.minutes, 22) * 0.55, // real seconds on the train
      advanced: 0
    };
    ui.showTravel({
      line,
      title: plan.transfers ? `Riding the ${line}, then the ${plan.legs[plan.legs.length - 1].line}…` : `Riding the ${line}…`,
      sub: `${from.name} → ${to.name}`
    });
  }

  function updateTravel(rawDt) {
    if (!travel) return;
    travel.t += rawDt;
    const p = Math.min(1, travel.t / travel.duration);
    const target = Math.floor(p * travel.plan.minutes);
    if (target > travel.advanced) {
      game.advanceMinutes(target - travel.advanced);
      travel.advanced = target;
    }
    ui.travelProgress(p);
    if (p >= 1) {
      const { to, plan } = travel;
      travel = null;
      ui.hideTravel();
      teleportTo(to.x, to.z, to.heading);
      game.recordRide();
      game.recordStationVisit(to.id);
      game.bus.emit('toast', {
        text: `You arrive at ${to.name}.${plan.transfers ? ' (One transfer)' : ''} Head up the stairs — the green globes are behind you.`,
        kind: 'ok'
      });
      refreshAll();
    }
  }

  // --- Clock, needs, saving ----------------------------------------------------------

  function updateNeeds() {
    const now = game.state.clock.minutes + (game.state.clock.day - 1) * 1440;
    if (lastClockMinutes === null) {
      lastClockMinutes = now;
      return;
    }
    let delta = now - lastClockMinutes;
    if (delta <= 0) return;
    lastClockMinutes = now;
    const skipped = Math.min(delta, decaySkipMinutes);
    decaySkipMinutes -= skipped;
    delta -= skipped;
    if (delta <= 0) return;
    const hours = delta / 60;
    game.setNeed('hunger', game.state.needs.hunger + NEEDS_PER_GAME_HOUR.hunger * hours);
    game.setNeed('energy', game.state.needs.energy + NEEDS_PER_GAME_HOUR.energy * hours);
  }

  function refreshAll() {
    ui.refreshHUD();
    ui.refreshMission();
  }

  // --- Welcome flow -------------------------------------------------------------------

  function onCityReady() {
    cityReady = true;
    if (!started()) {
      ui.showWelcome({ hasSave: hadSave && game.state.started });
    } else {
      // A returning player: HUD on, clock synced, light aligned, no ceremony.
      ui.refreshHUD();
      ui.refreshMission();
      ui.refreshClock(game.state.clock.minutes);
    }
  }

  function beginSession({ intro, arrival }) {
    ui.hideWelcome();
    ui.refreshHUD();
    ui.refreshMission();
    ui.refreshClock(game.state.clock.minutes);
    if (dayCycle) dayCycle.refresh();
    if (intro) ui.welcomeIntro(arrival);
    game.save();
  }

  function onWelcomeContinue() {
    beginSession({
      intro: false,
      arrival: places.arrival(game.state.arrival)
    });
    game.bus.emit('toast', { text: 'Back in New York. Your money, your keys, your problems — all where you left them.', kind: 'info' });
  }

  function onWelcomeRoam() {
    game.startNewGame({ mode: 'freeroam', arrival: 'portauthority' });
    beginSession({ intro: false, arrival: places.arrival('portauthority') });
    game.bus.emit('toast', { text: 'Free roam: the city is open. Press E near doors, globes and people.', kind: 'info' });
  }

  function onWelcomeStart(mode, arrivalId) {
    game.startNewGame({ mode, arrival: arrivalId });
    const arrival = places.arrival(arrivalId);
    teleportTo(arrival.x, arrival.z, arrival.heading);
    beginSession({ intro: true, arrival });
  }

  // --- Persistence -----------------------------------------------------------------------

  function save() {
    game.save();
  }

  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  // Toasts & money flash
  game.bus.on('toast', (t) => ui.toast(t.text, t.kind));
  game.bus.on('money', ({ delta }) => ui.flashMoney(delta));
  game.bus.on('clock', ({ minutes }) => ui.refreshClock(minutes));
  game.bus.on('housing', refreshAll);
  game.bus.on('job', refreshAll);
  game.bus.on('missions-updated', refreshAll);
  game.bus.on('evicted', refreshAll);

  // --- Public surface (called from main.js) ------------------------------------------------

  return {
    get state() {
      return game.state;
    },
    get dayCycle() {
      return dayCycle;
    },

    onCityReady,

    update(dt, rawDt) {
      if (!cityReady) return;
      if (started()) {
        if (dayCycle) dayCycle.update(rawDt, true);
        updateNeeds();
        updateTravel(rawDt);
        scanInteractions(dt);
        saveTimer += rawDt;
        if (saveTimer > 12) {
          saveTimer = 0;
          game.save();
        }
      }
    },

    save,

    // main.js's selectTime forwards manual picks here (see the 'auto' branch there).
    handleTimeSelection(timeId) {
      if (!dayCycle) return false;
      if (timeId === 'auto') {
        dayCycle.setAuto(!dayCycle.auto);
        return true;
      }
      dayCycle.setManual(timeId);
      return false; // continue with the regular preset application
    },

    syncAutoButton(on) {
      const btn = document.getElementById('time-auto');
      if (btn) btn.classList.toggle('active', on);
    }
  };
}
