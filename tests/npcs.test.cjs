const assert = require('node:assert/strict');
const test = require('node:test');

let city, gameStateModule, economyModule, placesModule, npcsModule;
test.before(async () => {
  [city, gameStateModule, economyModule, placesModule, npcsModule] = await Promise.all([
    import('../js/city-config.js'),
    import('../js/game-state.js'),
    import('../js/economy.js'),
    import('../js/places.js'),
    import('../js/npcs.js')
  ]);
});

function setup() {
  globalThis.localStorage = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, v); }, removeItem(k) { this.map.delete(k); } };
  const game = gameStateModule.createGameState();
  game.startNewGame({ mode: 'resident' });
  const economy = economyModule.createEconomy({ state: game, bus: game.bus });
  const places = placesModule.createPlaces({ state: game, economy, bus: game.bus });
  const npcs = npcsModule.createNpcs({ state: game, bus: game.bus });
  return { game, places, npcs };
}

test('every new yorker stands at a real, walkable corner', () => {
  const { npcs } = setup();
  assert.ok(npcs.npcs.length >= 14, `expected a populated city, got ${npcs.npcs.length}`);
  const ids = new Set();
  for (const n of npcs.npcs) {
    assert.ok(!ids.has(n.id), `duplicate npc ${n.id}`);
    ids.add(n.id);
    assert.equal(city.blockAt(n.pos.x, n.pos.z), null, `${n.name} stands inside a building`);
    assert.ok(city.nearestRoads(n.pos.x, n.pos.z, 26).some(({ road, dist }) => dist < road.w / 2 + 6), `${n.name} is not near a street`);
    for (const part of ['morning', 'afternoon', 'evening']) {
      assert.ok(typeof n.lines[part] === 'string' && n.lines[part].length > 20, `${n.name} needs ${part} lines`);
    }
    assert.ok(n.tips.length >= 2, `${n.name} should carry local tips`);
  }
});

test('encounters resolve by distance and respond to the game clock', () => {
  const { npcs, game } = setup();
  const sasha = npcs.npcs.find((n) => n.id === 'npc-sasha');
  assert.equal(npcs.nearby(sasha.pos.x, sasha.pos.z, 6).id, 'npc-sasha');
  assert.equal(npcs.nearby(sasha.pos.x + 500, sasha.pos.z, 10), null, 'nobody nearby far away');

  game.setClock(9 * 60, 1);
  assert.equal(npcs.partOfDay(game.state.clock.minutes), 'morning');
  assert.ok(npcs.greet(sasha).includes('Audition') || npcs.greet(sasha).includes('slice'), 'morning line used');
  game.setClock(14 * 60, 1);
  assert.equal(npcs.partOfDay(game.state.clock.minutes), 'afternoon');
  game.setClock(22 * 60, 1);
  assert.equal(npcs.partOfDay(game.state.clock.minutes), 'evening');
});

test('chatting once builds a connection; tips repeat without duplicating', () => {
  const { game, npcs } = setup();
  const sal = npcs.npcs.find((n) => n.id === 'npc-sal');
  const first = npcs.talk(sal, 'chat');
  assert.equal(first.met, true);
  assert.equal(game.state.connections.length, 1);
  const again = npcs.talk(sal, 'chat');
  assert.equal(again.met, false);
  assert.equal(game.state.connections.length, 1);

  const tip = npcs.talk(sal, 'tip');
  assert.ok(tip.line.length > 20);
  assert.ok(/OMNY|subway|7th/.test(tip.line), 'tips carry the useful facts');
});
