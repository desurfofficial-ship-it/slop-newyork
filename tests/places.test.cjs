const assert = require('node:assert/strict');
const test = require('node:test');

let city, economyModule, placesModule, gameStateModule;
test.before(async () => {
  [city, economyModule, placesModule, gameStateModule] = await Promise.all([
    import('../js/city-config.js'),
    import('../js/economy.js'),
    import('../js/places.js'),
    import('../js/game-state.js')
  ]);
});

function withStorage() {
  globalThis.localStorage = {
    map: new Map(),
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; },
    setItem(k, v) { this.map.set(k, String(v)); },
    removeItem(k) { this.map.delete(k); }
  };
}

function setup({ mode = 'resident', rng = () => 0.99 } = {}) {
  withStorage();
  const game = gameStateModule.createGameState();
  game.startNewGame({ mode, arrival: 'penn' });
  const bus = game.bus;
  const economy = economyModule.createEconomy({ state: game, bus });
  const places = placesModule.createPlaces({ state: game, economy, bus, rng });
  return { game, economy, places, bus };
}

test('every interactive place lands on a real street, outside buildings, inside the island', () => {
  const { places } = setup();
  assert.ok(places.places.length >= 22, `expected a lived-in city, got ${places.places.length}`);
  for (const p of places.places) {
    assert.equal(city.blockAt(p.x, p.z), null, `${p.name} must not sit inside a building`);
    const nearby = city.nearestRoads(p.x, p.z, 26);
    assert.ok(nearby.some(({ road, dist }) => dist < road.w / 2 + 6), `${p.name} (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) is not near a street`);
    const shore = city.getIslandBoundsAtZ(p.z);
    assert.ok(p.x > shore.westX && p.x < shore.eastX, `${p.name} drifted off the island`);
  }
  for (const a of places.arrivals) {
    assert.equal(city.blockAt(a.x, a.z), null, `${a.label} arrival must not sit inside a building`);
    assert.ok(city.nearestRoads(a.x, a.z, 30).some(({ road, dist }) => dist < road.w / 2 + 6), `${a.label} arrival must be near a street`);
  }
});

test('arrival scenarios resolve to real, distinct spawn points', () => {
  const { places } = setup();
  assert.equal(places.arrivals.length, 3);
  const spawns = new Set(places.arrivals.map((a) => `${Math.round(a.x)},${Math.round(a.z)}`));
  assert.equal(spawns.size, 3, 'arrivals spawn at different corners of the city');
  const penn = places.arrival('penn');
  assert.ok(Math.abs(penn.z - city.streetZ(32)) < 1, 'Penn Station arrives at 32nd St');
  const port = places.arrival('portauthority');
  assert.ok(Math.abs(port.z - city.streetZ(40)) < 1, 'Port Authority arrives at 40th St');
});

test('buying food costs money, feeds you and counts meals', () => {
  const { game, economy, places } = setup();
  game.setNeed('hunger', 60);
  game.setClock(600, 1);
  const spot = places.placeById('pizza-times');
  assert.ok(spot, 'pizzeria exists');
  const buy = places.actionsFor(spot).find((a) => a.id === 'buy-slice');
  assert.ok(buy, 'slice is on the menu');
  const before = game.state.moneyCents;
  assert.equal(buy.run(), true);
  assert.equal(game.state.moneyCents, before - 425);
  assert.ok(game.state.needs.hunger < 40, 'hunger decreased');
  assert.equal(game.state.mealsEaten, 1);
  assert.ok(game.state.clock.minutes !== 600, 'a few minutes pass');
});

test('buying food you cannot afford is refused with a toast', () => {
  const { game, places, bus } = setup({ mode: 'career' });
  game.adjustMoney(-(game.state.moneyCents)); // broke
  const toasts = [];
  bus.on('toast', (t) => toasts.push(t));
  const spot = places.placeById('deli-penn');
  const buy = places.actionsFor(spot).find((a) => a.id === 'buy-groceries');
  assert.equal(buy.run(), false);
  assert.ok(toasts.some((t) => t.kind === 'warn' && /Not enough money/.test(t.text)));
  assert.equal(game.state.mealsEaten, 0);
});

test('signing a lease costs the deposit and starts daily rent; rent charges on each new day', () => {
  const { game, places, economy } = setup({ mode: 'resident' });
  game.setClock(1200, 1);
  const apt = places.placeById('apt-harlem-studio');
  const lease = places.actionsFor(apt).find((a) => a.id === 'lease');
  const before = game.state.moneyCents;
  assert.equal(lease.run(), true);
  assert.equal(game.state.housing.id, 'apt-harlem-studio');
  assert.equal(game.state.moneyCents, before - apt.depositCents);

  // Midnight rollover charges one day of prorated rent
  game.advanceMinutes(1440 - game.state.clock.minutes);
  assert.equal(game.state.clock.day, 2);
  assert.equal(game.state.moneyCents, before - apt.depositCents - apt.dailyRentCents);
});

test('rent cannot be paid forever: warnings then eviction', () => {
  const { game, places, bus } = setup({ mode: 'resident' });
  const apt = places.placeById('apt-chinatown-room');
  places.actionsFor(apt).find((a) => a.id === 'lease').run();
  game.adjustMoney(-(game.state.moneyCents - 100)); // nearly broke
  const evicted = [];
  bus.on('evicted', (e) => evicted.push(e));
  for (let day = 0; day < 5; day++) game.advanceMinutes(1440 - game.state.clock.minutes);
  assert.equal(game.state.housing, null, 'unpayable rent ends in eviction');
  assert.equal(evicted.length, 1);
  assert.equal(game.state.evictionWarnings, 0, 'warnings reset after eviction');
});

test('apply for a job, work a shift: pay arrives, time passes, energy drains', () => {
  const { game, places } = setup();
  const spot = places.placeById('job-cafe');
  const apply = places.actionsFor(spot).find((a) => a.id === 'apply');
  assert.equal(apply.run(), true);
  assert.equal(game.state.job.title, 'Barista');
  game.setClock(540, 1);
  game.setNeed('energy', 90);
  const shift = places.actionsFor(spot).find((a) => a.id === 'shift');
  const before = game.state.moneyCents;
  assert.equal(shift.run(), true);
  assert.equal(game.state.moneyCents - before, 7000);
  assert.equal(game.state.clock.minutes, 540 + 240);
  assert.ok(game.state.needs.energy < 90 - 20, 'a shift is tiring');
  assert.equal(game.state.shiftsWorked, 1);
});

test('the office job requires street experience first', () => {
  const { game, places } = setup();
  const office = places.placeById('job-office');
  const apply = places.actionsFor(office).find((a) => a.id === 'apply');
  assert.equal(apply.disabled, true, 'locked without shifts');
  assert.equal(apply.run(), false);
  game.state.shiftsWorked = 2;
  const applyNow = places.actionsFor(office).find((a) => a.id === 'apply');
  assert.equal(applyNow.disabled, false, 'experience unlocks the office');
  assert.equal(applyNow.run(), true);
  assert.equal(game.state.job.shiftPayCents, 13000);
});

test('sleeping advances to 07:00 and restores energy; attractions cost and refresh', () => {
  const { game, places } = setup();
  const hotel = places.hotel;
  const sleep = places.actionsFor(hotel).find((a) => a.id === 'sleep');
  game.setClock(23 * 60 + 30, 3);
  game.setNeed('energy', 20);
  assert.equal(sleep.run(), true);
  assert.equal(game.state.clock.day, 4);
  assert.equal(game.state.clock.minutes, 7 * 60);
  assert.equal(game.state.needs.energy, 100);

  const zoo = places.placeById('att-zoo');
  const before = game.state.moneyCents;
  const ticket = places.actionsFor(zoo).find((a) => a.id === 'visit');
  assert.equal(ticket.run(), true);
  assert.equal(game.state.moneyCents, before - 1950);
  assert.equal(game.state.visitedPois['att-zoo'], 1);
  assert.ok(game.state.discovered.pois.includes('att-zoo'));
  // free attraction
  const park = places.placeById('att-bryant');
  assert.equal(places.actionsFor(park).find((a) => a.id === 'visit').run(), true);
  assert.equal(game.state.moneyCents, before - 1950, 'the park is still free');
});

test('lucky shifts earn a tip on top of the wage', () => {
  const { game, places } = setup({ rng: () => 0.0 });
  const spot = places.placeById('job-cafe');
  places.actionsFor(spot).find((a) => a.id === 'apply').run();
  const shift = places.actionsFor(spot).find((a) => a.id === 'shift');
  const before = game.state.moneyCents;
  shift.run();
  const earned = game.state.moneyCents - before;
  assert.ok(earned > 7000 && earned <= 7000 + 3000, `tip lands within the plausible range (${earned})`);
});

test('place scanning finds the nearest spot within radius only', () => {
  const { places } = setup();
  const spot = places.placeById('pizza-times');
  const found = places.scan(spot.x, spot.z, 10);
  assert.ok(found, 'a spot finds itself');
  assert.equal(places.scan(spot.x + 100, spot.z + 100, 10), null, 'nothing within radius far away');
});
