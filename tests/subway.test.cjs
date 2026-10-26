const assert = require('node:assert/strict');
const test = require('node:test');

let city, subwayModule;
test.before(async () => {
  [city, subwayModule] = await Promise.all([
    import('../js/city-config.js'),
    import('../js/subway.js')
  ]);
});

test('every subway entrance lands on a real street, outside buildings, inside the island', () => {
  const { STATIONS } = subwayModule;
  assert.ok(STATIONS.length >= 45, `expected a dense network, got ${STATIONS.length}`);
  const ids = new Set();
  for (const s of STATIONS) {
    assert.ok(!ids.has(s.id), `duplicate station id ${s.id}`);
    ids.add(s.id);
    assert.equal(city.blockAt(s.x, s.z), null, `${s.name} must not sit inside a building`);
    const nearby = city.nearestRoads(s.x, s.z, 26);
    assert.ok(
      nearby.some(({ road, dist }) => dist < road.w / 2 + 6),
      `${s.name} (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) is not near a street`
    );
    const shore = city.getIslandBoundsAtZ(s.z);
    assert.ok(s.x > shore.westX && s.x < shore.eastX, `${s.name} drifted off the island`);
    assert.ok(s.lines.length >= 1 && s.lines.every((l) => subwayModule.LINE_COLORS[l]), `${s.name} has unknown line bullets`);
  }
});

test('key real-world stations exist with their real line bullets', () => {
  const { STATIONS } = subwayModule;
  const find = (namePart, line) => STATIONS.find((s) => s.name.includes(namePart) && s.lines.includes(line));
  assert.ok(find('Penn Station', '1'), 'Penn Station on the 1/2/3');
  assert.ok(find('Penn Station', 'A'), 'Penn Station on the A/C/E');
  assert.ok(find('Times Sq', '7') || find('42 St', '7'), 'Times Sq–42 St on the 7');
  assert.ok(find('Grand Central', 'S'), 'Grand Central on the shuttle');
  assert.ok(find('Union Sq', 'L'), 'Union Sq on the L');
  assert.ok(find('Columbus Circle', 'A'), 'Columbus Circle on the A');
  assert.ok(find('Rockefeller', 'B'), 'Rockefeller Center on the B/D/F/M');
  assert.ok(find('Hudson Yards', '7'), 'the 7 terminus at Hudson Yards');
  assert.ok(find('125 St', 'A') || find('125 St', 'B'), 'Harlem terminal included');
  assert.ok(find('Wall St', '4') || find('Fulton St', '4'), 'Financial District terminal included');
});

test('route planning finds direct rides and sensible single transfers', () => {
  const { STATIONS, createSubway, FARE_CENTS } = subwayModule;
  const subway = createSubway();
  const byName = (name, lines) => STATIONS.find((s) => s.name === name && (!lines || lines.every((l) => s.lines.includes(l))));

  const timesSq = byName('Times Sq–42 St') || STATIONS.find((s) => s.lines.includes('7') && s.lines.includes('1'));
  const gct = byName('Grand Central–42 St');
  const direct = subway.plan(byName('34 St–Hudson Yards'), timesSq);
  assert.equal(direct.transfers, 0, 'Hudson Yards → Times Sq is a direct 7 ride');
  assert.equal(direct.fareCents, FARE_CENTS);

  const penn1 = byName('34 St–Penn Station', ['1']);
  const toGct = subway.plan(penn1, gct);
  assert.ok(toGct, 'Penn → Grand Central has a route');
  assert.equal(toGct.transfers, 1, 'Penn (1/2/3) → GCT needs one transfer');
  assert.ok(toGct.legs[0].to === 'Times Sq–42 St', 'transfer happens at Times Sq');
  assert.ok(toGct.minutes >= direct.minutes, 'transfers cost time');

  const same = subway.plan(timesSq, timesSq);
  assert.equal(same, null, 'no route to the same station');
});

test('ride time model stays within a playable range', () => {
  const { STATIONS, rideMinutes } = subwayModule;
  const timesSq = STATIONS.find((s) => s.name === 'Times Sq–42 St' || (s.lines.includes('7') && s.lines.includes('S')));
  for (const s of STATIONS) {
    const m = rideMinutes(timesSq, s);
    assert.ok(m >= 3 && m <= 24, `${s.name}: ${m} min out of range`);
  }
  assert.ok(rideMinutes(timesSq, STATIONS[0]) <= 24);
});
