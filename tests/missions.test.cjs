const assert = require('node:assert/strict');
const test = require('node:test');

let gameStateModule, economyModule, placesModule, missionsModule;
test.before(async () => {
  [gameStateModule, economyModule, placesModule, missionsModule] = await Promise.all([
    import('../js/game-state.js'),
    import('../js/economy.js'),
    import('../js/places.js'),
    import('../js/missions.js')
  ]);
});

function setup({ mode = 'resident' } = {}) {
  globalThis.localStorage = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, v); }, removeItem(k) { this.map.delete(k); } };
  const game = gameStateModule.createGameState();
  game.startNewGame({ mode, arrival: 'portauthority' });
  const economy = economyModule.createEconomy({ state: game, bus: game.bus });
  const places = placesModule.createPlaces({ state: game, economy, bus: game.bus });
  const missions = missionsModule.createMissions({ state: game, bus: game.bus, economy });
  return { game, economy, places, missions };
}

test('the chain starts at Your First Day and advances by completing objectives', () => {
  const { game, places, missions } = setup();
  assert.equal(missions.current().id, 'm-first-day');
  // check in at the hotel completes mission 1
  const checkIn = places.actionsFor(places.hotel).find((a) => a.id === 'check-in');
  assert.equal(checkIn.run(), true);
  assert.ok(game.state.missionsCompleted.includes('m-first-day'));
  assert.equal(missions.current().id, 'm-get-around');
  assert.ok(game.state.moneyCents > 0, 'reward lands in the wallet');
});

test('mission 2 completes after a subway ride is recorded', () => {
  const { game, missions } = setup();
  skipTo(game, 'm-first-day');
  assert.equal(missions.current().id, 'm-get-around');
  game.recordRide();
  assert.ok(game.state.missionsCompleted.includes('m-get-around'), 'ride completes Get Around');
  assert.equal(missions.current().id, 'm-eat-budget');
});

test('eating a cheap meal counts; an expensive one does not', () => {
  const { game, missions } = setup();
  skipTo(game, 'm-first-day', 'm-get-around');
  const burger = places_module_eat(game, 'burger'); // $12.75 — too expensive
  assert.equal(missions.current().id, 'm-eat-budget');
  const slice = places_module_eat(game, 'slice');
  assert.ok(game.state.missionsCompleted.includes('m-eat-budget'), 'the $4.25 slice completes the mission');
  assert.equal(game.state.cheapMeals, 1);
});

function skipTo(game, ...ids) {
  game.state.missionsCompleted.push(...ids);
  game.bus.emit('state', game.state); // missions derive progress from state events
}

function places_module_eat(game, itemId) {
  // helper: the meal-eaten event is what missions tracks (mirrors places.foodAction)
  const cents = { burger: 1275, slice: 425, groceries: 2850 }[itemId];
  game.bus.emit('meal-eaten', { cents, label: itemId });
  return cents;
}

test('housing, job and shifts drive the middle of the chain', () => {
  const { game, places, missions } = setup();
  skipTo(game, 'm-first-day', 'm-get-around', 'm-eat-budget');
  assert.equal(missions.current().id, 'm-find-place');
  const apt = places.placeById('apt-chinatown-room');
  places.actionsFor(apt).find((a) => a.id === 'lease').run();
  assert.ok(game.state.missionsCompleted.includes('m-find-place'));
  assert.equal(missions.current().id, 'm-first-job');

  const job = places.placeById('job-cafe');
  places.actionsFor(job).find((a) => a.id === 'apply').run();
  assert.ok(!game.state.missionsCompleted.includes('m-first-job'), 'hired alone is not enough');
  places.actionsFor(job).find((a) => a.id === 'shift').run();
  assert.ok(game.state.missionsCompleted.includes('m-first-job'), 'a full shift completes it');
  assert.equal(missions.current().id, 'm-explore');
});

test('exploration counts any six distinct places', () => {
  const { game, missions } = setup();
  skipTo(game, 'm-first-day', 'm-get-around', 'm-eat-budget', 'm-find-place', 'm-first-job');
  assert.equal(missions.current().id, 'm-explore');
  for (const id of ['deli-penn', 'pizza-times', 'cart-6th', 'deli-herald', 'market-union', 'bakery-kanal']) {
    game.recordPoiVisit(id);
  }
  assert.ok(game.state.missionsCompleted.includes('m-explore'));
  assert.equal(game.state.leisureVisits, 0, 'food spots are not leisure');
});

test('three leisure activities complete the weekend mission; make-it needs everything', () => {
  const { game, missions } = setup();
  skipTo(game, 'm-first-day', 'm-get-around', 'm-eat-budget', 'm-find-place', 'm-first-job', 'm-explore');
  assert.equal(missions.current().id, 'm-weekend');
  game.recordPoiVisit('att-bryant');
  game.recordPoiVisit('att-zoo');
  assert.ok(!game.state.missionsCompleted.includes('m-weekend'), 'two is not enough');
  game.recordPoiVisit('att-esb');
  assert.ok(game.state.missionsCompleted.includes('m-weekend'));
  assert.equal(missions.current().id, 'm-make-it');

  // make-it: housing + job + people + $5,000
  assert.ok(!game.state.missionsCompleted.includes('m-make-it'));
  game.setHousing({ id: 'x', name: 'X', dailyRentCents: 100, quality: 'q' });
  game.setJob({ id: 'j', title: 'T', employer: 'E', shiftPayCents: 1000, level: 1 });
  game.adjustMoney(500000 - game.state.moneyCents);
  assert.ok(!game.state.missionsCompleted.includes('m-make-it'), 'needs 5 connections too');
  for (const id of ['a', 'b', 'c', 'd', 'e']) game.meetNpc(id);
  assert.ok(game.state.missionsCompleted.includes('m-make-it'));
  assert.equal(missions.current(), null, 'the chain ends');
});

test('journal reports live status for every mission', () => {
  const { missions } = setup();
  const journal = missions.journal();
  assert.equal(journal.length, 8);
  assert.equal(journal[0].complete, false);
  const first = journal[0].objectives[0];
  assert.equal(first.done, false);
  assert.match(first.label, /Edison Grand/);
});
