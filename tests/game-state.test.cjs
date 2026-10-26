const assert = require('node:assert/strict');
const test = require('node:test');

let gameStateModule;
test.before(async () => {
  gameStateModule = await import('../js/game-state.js');
});

// Storage stub: the module touches localStorage lazily (at call time), so defining it on
// globalThis inside each test is enough. A throwing variant exercises the fault-tolerance paths.
function withStorage(map = new Map(), throwing = false) {
  globalThis.localStorage = {
    getItem: (k) => (throwing ? throwNow() : (map.has(k) ? map.get(k) : null)),
    setItem: (k, v) => (throwing ? throwNow() : map.set(k, String(v))),
    removeItem: (k) => (throwing ? throwNow() : map.delete(k))
  };
  return map;
}
function throwNow() { throw new Error('storage unavailable'); }

test('startNewGame applies the play mode wallet and keeps the clock at real time', () => {
  const { createGameState, PLAY_MODES } = gameStateModule;
  withStorage();
  const game = createGameState();
  game.startNewGame({ mode: 'resident', arrival: 'penn' });
  assert.equal(game.state.started, true);
  assert.equal(game.state.mode, 'resident');
  assert.equal(game.state.moneyCents, PLAY_MODES.resident.startCents);
  const d = new Date();
  assert.equal(game.state.clock.minutes, d.getHours() * 60 + d.getMinutes());
});

test('money adjustments clamp, emit events and round to cents', () => {
  const { createGameState } = gameStateModule;
  withStorage();
  const game = createGameState();
  game.startNewGame({ mode: 'freeroam' });
  const events = [];
  game.bus.on('money', (e) => events.push(e));
  assert.equal(game.adjustMoney(290), 500290);
  assert.equal(game.adjustMoney(-100.4), 500190); // rounds to whole cents
  assert.equal(game.adjustMoney(0).valueOf(), 500190);
  assert.equal(events.length, 2, 'zero deltas are ignored');
  assert.equal(game.adjustMoney(-99999999), -1000000, 'balance is clamped, never runaway negative');
});

test('advanceMinutes rolls over days and emits the clock event', () => {
  const { createGameState } = gameStateModule;
  withStorage();
  const game = createGameState();
  game.startNewGame({ mode: 'resident' });
  game.setClock(1438, 3);
  const clocks = [];
  const days = [];
  game.bus.on('clock', (c) => clocks.push(c));
  game.bus.on('newday', (d) => days.push(d));
  game.advanceMinutes(5);
  assert.equal(game.state.clock.day, 4);
  assert.equal(game.state.clock.minutes, 3);
  assert.equal(days.length, 1);
  game.advanceMinutes(0);
  game.advanceMinutes(-4);
  assert.equal(clocks.length, 1, 'non-positive advances are ignored');
});

test('poi, station and npc records report first-time discovery only once', () => {
  const { createGameState } = gameStateModule;
  withStorage();
  const game = createGameState();
  game.startNewGame({ mode: 'tourist' });
  assert.equal(game.recordPoiVisit('deli-42'), true);
  assert.equal(game.recordPoiVisit('deli-42'), false);
  assert.equal(game.state.discovered.pois.length, 1);
  assert.equal(game.state.visitedPois['deli-42'], 2);
  assert.equal(game.recordStationVisit('sts-14st'), true);
  assert.equal(game.recordStationVisit('sts-14st'), false);
  assert.equal(game.meetNpc('sal'), true);
  assert.equal(game.meetNpc('sal'), false);
  assert.equal(game.state.connections.length, 1);
});

test('save persists state and load restores it; corrupt data falls back to defaults', async () => {
  const { createGameState } = gameStateModule;
  const map = withStorage();
  const game = createGameState();
  game.startNewGame({ mode: 'career', arrival: 'jfk' });
  game.adjustMoney(-50000);
  game.setNeed('energy', 42);
  game.setClock(990, 2);
  game.setHousing({ id: 'apt-harlem-studio', name: 'Harlem Studio', dailyRentCents: 6200, quality: 'cozy' });
  assert.equal(game.save(), true);
  assert.equal(map.has('nyc-life-save'), true);

  const game2 = createGameState();
  assert.equal(game2.load(), true);
  assert.equal(game2.state.mode, 'career');
  assert.equal(game2.state.arrival, 'jfk');
  assert.equal(game2.state.moneyCents, game.state.moneyCents);
  assert.equal(game2.state.needs.energy, 42);
  assert.equal(game2.state.clock.day, 2);
  assert.equal(game2.state.housing.name, 'Harlem Studio');

  map.set('nyc-life-save', '{not json');
  const game3 = createGameState();
  assert.equal(game3.load(), false);
  assert.equal(game3.state.started, false, 'corrupt save starts fresh');
  assert.equal(game3.state.moneyCents, 0);
});

test('save and load survive storage being unavailable', () => {
  const { createGameState } = gameStateModule;
  withStorage(new Map(), true);
  const game = createGameState();
  game.startNewGame({ mode: 'freeroam' });
  assert.equal(game.save(), false, 'saving without storage keeps playing');
  assert.equal(game.load(), false);
  assert.equal(game.hasSave(), false);
});

test('sanitize clamps hostile values from foreign saves', async () => {
  const { createGameState } = gameStateModule;
  withStorage();
  const game = createGameState();
  globalThis.localStorage.setItem('nyc-life-save', JSON.stringify({
    version: 99,
    started: true,
    moneyCents: Number.MAX_SAFE_INTEGER,
    needs: { energy: 9999, hunger: -50 },
    clock: { day: 0, minutes: 5000 },
    connections: 'nope',
    missionProgress: { m1: { o1: -3, o2: 1e9, bad: 'x' } },
    settings: { clockSpeed: 7 }
  }));
  assert.equal(game.load(), true);
  const s = game.state;
  assert.equal(s.mode, 'freeroam', 'unknown mode resets');
  assert.equal(s.moneyCents, 100000000);
  assert.equal(s.needs.energy, 100);
  assert.equal(s.needs.hunger, 0);
  assert.equal(s.clock.day, 1);
  assert.equal(s.clock.minutes, 1439, 'hostile minutes clamp into the valid range');
  assert.equal(s.connections.length, 0);
  assert.equal(s.missionProgress.m1.o1, 0);
  assert.equal(s.missionProgress.m1.o2, 999999);
  assert.equal(s.settings.clockSpeed, 1);
});

test('mission objective helpers track per-mission progress and completion events', () => {
  const { createGameState } = gameStateModule;
  withStorage();
  const game = createGameState();
  game.startNewGame({ mode: 'resident' });
  const done = [];
  game.bus.on('mission-complete', (e) => done.push(e.id));
  game.setMissionObjective('m-get-around', 'rides', 1);
  assert.equal(game.getMissionProgress('m-get-around').rides, 1);
  assert.equal(game.completeMission('m-get-around'), true);
  assert.equal(game.completeMission('m-get-around'), false, 'double completion is rejected');
  assert.deepEqual(done, ['m-get-around']);
  assert.equal(game.state.missionsCompleted.includes('m-get-around'), true);
});
