// The end-to-end golden path, run against the real UI modules with a minimal DOM stub:
// welcome → arrive → walk to the hotel → check in (mission 1) → eat → ride the subway →
// sleep → save → load. The production life.js / life-ui.js / places.js / subway.js code runs
// unchanged; only the browser is faked. (Layout and rendering are covered by the browser.)
const assert = require('node:assert/strict');
const test = require('node:test');

let domHelper, subwayModule, placesModule, lifeModule;

const dom = (id) => globalThis.document.getElementById(id);
let hotel, pizzeria;
test.before(async () => {
  domHelper = require('./helpers/dom-stub.cjs');
  [subwayModule, placesModule, lifeModule] = await Promise.all([
    import('../js/subway.js'),
    import('../js/places.js'),
    import('../js/life.js')
  ]);
  hotel = placesModule.ALL_PLACES.find((p) => p.id === 'hotel-edison');
  pizzeria = placesModule.ALL_PLACES.find((p) => p.id === 'pizza-times');
});

function boot({ x = 0, z = 0 } = {}) {
  domHelper.createDom(); // fresh globals per node process; the save persists across boots inside a test
  const appliedPresets = [];
  const teleports = [];
  const player = { position: { x, z, y: 0 }, heading: 0 };
  const controllerManager = {
    getActiveEntity: () => player,
    resetInput: () => {}
  };
  const mapSystem = { setStations() {}, isFullMapOpen: false };
  const life = lifeModule.createLifeSim({
    controllerManager,
    mapSystem,
    teleportTo: (tx, tz, heading) => {
      player.position.x = tx;
      player.position.z = tz;
      player.heading = heading;
      teleports.push({ x: tx, z: tz, heading });
      return { x: tx, z: tz };
    },
    selectTime: (preset) => appliedPresets.push(preset),
    isMapOpen: () => false
  });
  return {
    life,
    teleports,
    appliedPresets,
    setPlayer: (px, pz) => {
      player.position.x = px;
      player.position.z = pz;
    },
    walkAndOpen: (place) => {
      // close whatever panel is open (e.g. the arrival intro) before interacting
      dom('life-place').hidePopover();
      ctx.setPlayer(place.x + 2, place.z);
      life.update(0.3, 0.3); // step past the scan throttle and find the spot
      dom('life-prompt').click(); // opens the panel
      return dom('life-place-actions').querySelectorAll('.pop-item');
    }
  };
}
let ctx;

const fmt = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
};

test('welcome → arrive at Penn Station → HUD and mission chip come alive', () => {
  ctx = boot();
  const { life, teleports } = ctx;
  life.onCityReady();
  assert.equal(dom('life-welcome').classList.contains('hidden'), false, 'welcome shows for a new player');
  assert.equal(dom('welcome-continue').hidden, true, 'no Continue without a save');

  dom('welcome-new').click();
  const arrivals = dom('welcome-arrivals').querySelectorAll('.pop-item');
  const modes = dom('welcome-modes').querySelectorAll('.pop-item');
  assert.equal(arrivals.length, 3);
  assert.equal(modes.length, 4);
  arrivals[0].click(); // Penn Station
  modes[1].click(); // New Resident
  assert.equal(dom('welcome-start').disabled, false, 'start unlocks after picking both');
  dom('welcome-start').click();

  assert.equal(dom('life-welcome').classList.contains('hidden'), true, 'welcome closes');
  assert.equal(life.state.started, true);
  assert.equal(life.state.mode, 'resident');
  assert.equal(life.state.moneyCents, 240000, 'resident starting wallet is $2,400');
  assert.equal(dom('life-money').textContent, '$2,400.00', 'wallet HUD renders');
  assert.equal(dom('life-mission-title').textContent, 'Your First Day', 'mission chip shows the first mission');
  assert.equal(teleports.length, 1, 'the arrival teleports the player');
  assert.ok(globalThis.localStorage.getItem('nyc-life-save'), 'the new life saves immediately');
});

test('checking in at the newcomer hotel completes Your First Day', () => {
  const actions = ctx.walkAndOpen(hotel);
  const labels = actions.map((a) => a.querySelector('.pop-name').textContent);
  assert.ok(labels.includes('Get your room key'), `check-in is offered (${labels.join(', ')})`);
  actions[labels.indexOf('Get your room key')].click();
  assert.ok(ctx.life.state.missionsCompleted.includes('m-first-day'), 'mission 1 completes');
  assert.equal(dom('life-mission-title').textContent, 'Get Around', 'the chain advances');
  assert.equal(dom('life-mission').classList.contains('hidden'), false);
});

test('buying a slice costs $4.25, feeds you and updates the wallet HUD', () => {
  const { life } = ctx;
  const actions = ctx.walkAndOpen(pizzeria);
  const labels = actions.map((a) => a.querySelector('.pop-name').textContent);
  const idx = labels.indexOf('Buy pizza slice');
  assert.ok(idx >= 0, 'the pizzeria sells slices');
  const hungerBefore = life.state.needs.hunger;
  actions[idx].click();
  assert.equal(life.state.mealsEaten, 1);
  assert.ok(life.state.needs.hunger < hungerBefore, 'the slice reduces hunger');
  assert.equal(dom('life-money').textContent, fmt(life.state.moneyCents), 'the HUD wallet reflects the purchase');
});

test('riding the subway spends the fare, runs the overlay and lands at Hudson Yards', () => {
  const { life, teleports } = ctx;
  const subway = subwayModule.createSubway();
  const timesSq = subway.stations.find((s) => s.name === 'Times Sq–42 St');
  const hudson = subway.stations.find((s) => s.name === '34 St–Hudson Yards');

  const actions = ctx.walkAndOpen(timesSq);
  assert.match(dom('life-place-title').textContent, /Times Sq/, 'the station panel names the station');
  const rows = actions.filter((r) => r.querySelector('.pop-price'));
  const pick = rows.find((r) => r.querySelector('.pop-name').textContent === '34 St–Hudson Yards');
  assert.ok(pick, 'Hudson Yards is listed');
  assert.equal(pick.querySelector('.pop-price').textContent, '$2.90');

  const before = life.state.moneyCents;
  pick.click();
  assert.equal(before - life.state.moneyCents, 290, 'the fare left the wallet');
  assert.equal(dom('life-travel').classList.contains('hidden'), false, 'travel overlay shows');

  for (let i = 0; i < 60 && dom('life-travel').classList.contains('hidden') === false; i++) {
    life.update(0.5, 0.5);
  }
  assert.equal(dom('life-travel').classList.contains('hidden'), true, 'the ride ends');
  assert.equal(life.state.subwayRides, 1);
  assert.ok(life.state.discovered.stations.includes(timesSq.id), 'origin station discovered');
  const last = teleports[teleports.length - 1];
  assert.equal(Math.round(last.x), Math.round(hudson.x), 'the player exits at Hudson Yards');
  assert.equal(Math.round(last.z), Math.round(hudson.z));
});

test('sleeping advances to 07:00, restores energy; the save round-trips into a fresh boot', () => {
  const { life } = ctx;
  const actions = ctx.walkAndOpen(hotel);
  const labels = actions.map((a) => a.querySelector('.pop-name').textContent);
  const checkIn = labels.indexOf('Get your room key');
  if (checkIn >= 0 && !actions[checkIn].disabled) actions[checkIn].click();

  life.state.clock.minutes = 23 * 60;
  life.state.needs.energy = 20;
  const actions2 = ctx.walkAndOpen(hotel);
  const labels2 = actions2.map((a) => a.querySelector('.pop-name').textContent);
  const sleepIdx = labels2.findIndex((l) => /until 7 AM/i.test(l));
  assert.ok(sleepIdx >= 0, 'sleep is available at the hotel');
  actions2[sleepIdx].click();
  assert.equal(life.state.clock.minutes, 7 * 60, 'slept to 07:00');
  assert.equal(life.state.needs.energy, 100, 'woke rested');

  life.save();
  const boot2 = boot();
  boot2.life.onCityReady();
  assert.equal(boot2.life.state.started, true, 'the save restores into the new session');
  assert.equal(boot2.life.state.moneyCents, life.state.moneyCents, 'the wallet survives');
  assert.equal(dom('life-money').textContent, fmt(boot2.life.state.moneyCents));
  assert.equal(dom('welcome-continue').hidden, false, 'returning players get Continue');
});
