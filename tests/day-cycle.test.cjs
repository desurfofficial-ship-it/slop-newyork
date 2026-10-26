const assert = require('node:assert/strict');
const test = require('node:test');

let gameStateModule, dayCycleModule, economyModule;
test.before(async () => {
  [gameStateModule, dayCycleModule, economyModule] = await Promise.all([
    import('../js/game-state.js'),
    import('../js/day-cycle.js'),
    import('../js/economy.js')
  ]);
});

function setup() {
  globalThis.localStorage = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, v); }, removeItem(k) { this.map.delete(k); } };
  const game = gameStateModule.createGameState();
  game.startNewGame({ mode: 'resident' });
  return game;
}

test('presets follow the hour: golden mornings, midday afternoons, twilight evenings, midnight nights', () => {
  const { presetForMinutes } = dayCycleModule;
  assert.equal(presetForMinutes(6 * 60), 'golden');
  assert.equal(presetForMinutes(9 * 60 + 59), 'golden');
  assert.equal(presetForMinutes(10 * 60), 'midday');
  assert.equal(presetForMinutes(16 * 60 + 59), 'midday');
  assert.equal(presetForMinutes(17 * 60), 'twilight');
  assert.equal(presetForMinutes(20 * 60), 'twilight');
  assert.equal(presetForMinutes(20 * 60 + 31), 'midnight');
  assert.equal(presetForMinutes(3 * 60), 'midnight');
});

test('the live cycle advances the clock and re-applies presets as hours pass', () => {
  const game = setup();
  game.setClock(9 * 60 + 30, 1);
  const applied = [];
  const cycle = dayCycleModule.createDayCycle({ state: game, applyPreset: (p) => applied.push(p) });
  assert.equal(cycle.auto, true);
  // 45 game minutes at 60x speed: 45 real seconds compressed into update() calls
  let t = 0;
  for (let i = 0; i < 45 * 60; i++) {
    cycle.update(1 / 60, true);
  }
  assert.equal(game.state.clock.minutes, 10 * 60 + 15, 'the clock advanced 45 game minutes');
  assert.ok(applied.includes('midday'), 'the midday preset took over');
  assert.equal(cycle.preset, 'midday');
});

test('a hand-picked preset pauses the cycle; Live resumes it', () => {
  const game = setup();
  game.setClock(12 * 60, 1);
  const cycle = dayCycleModule.createDayCycle({ state: game, applyPreset: () => {} });
  cycle.setManual('midnight');
  assert.equal(cycle.auto, false);
  assert.equal(game.state.settings.autoTime, false, 'the preference persists in settings');
  cycle.update(5, true);
  assert.equal(game.state.clock.minutes, 12 * 60, 'a paused cycle does not advance the clock');
  cycle.setAuto(true);
  assert.equal(game.state.settings.autoTime, true);
  cycle.update(5, true);
  assert.equal(game.state.clock.minutes, 12 * 60 + 5);
  assert.equal(cycle.preset, 'midday', 'refreshing re-aligns with the clock');
});
