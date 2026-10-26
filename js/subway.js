// js/subway.js
// A playable, simplified New York City subway. Station names, line bullets and locations follow
// the real system inside the simulated area (Manhattan, roughly 125th St → Battery); schedules,
// express/local patterns and fares beyond the base OMNY ride are simplified. This is a teaching
// model, not real MTA information.
//
// Coordinates are computed from the city grid helpers (avenueX / streetZ / getBroadwayX, all 1:1
// with the world), so every entrance sits where its real station is. The list below is also the
// single source of truth for the 3D stair entrances in street-details.js and the markers on the
// map.

import { AVENUES, ROADS, getBroadwayX, streetZ, avenueX } from './city-config.js';

// Official MTA trunk colors for the bullets.
export const LINE_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C',
  '7': '#B933AD',
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'L': '#A7A9AC', 'S': '#6C6E70'
};

export const FARE_CENTS = 290; // OMNY base fare, real as of Feb 2026
const TRANSFER_MINUTES = 4;

const AVENUE_BY_ID = new Map(AVENUES.map((a) => [a.id, a]));

// Sidewalk entrance just off a given avenue's curb (side: +1 east curb, -1 west curb).
const at = (avenueId, z, side = 1) => {
  const a = AVENUE_BY_ID.get(avenueId);
  const half = a ? a.width / 2 : 8;
  return { x: avenueX(avenueId) + side * (half + 3.2), z };
};
// Entrance off Broadway, whose centerline curves through Midtown. Downtown blocks are narrow,
// so the curb offset tightens there.
const atBroadway = (z, side = 1, off = 11) => ({ x: getBroadwayX(z) + side * off, z });

// name, lines, position. Side choice mirrors where real stair entrances sit where it matters.
// Lower Manhattan note: the roads database thins out south of Houston St, so a few downtown
// stations sit at the nearest modeled corner (the real 1 line runs one avenue west on Varick St).
const STATION_DEFS = [
  // --- 1/2/3 Broadway–7th Ave line ---
  ['Canal St', ['1'], { x: -355, z: 3700 }], // Varick St & Canal St
  ['14 St', ['1', '2', '3'], at('7', streetZ(14), -1)],
  ['18 St', ['1'], at('7', streetZ(18), -1)],
  ['23 St', ['1'], at('7', streetZ(23), 1)],
  ['28 St', ['1'], at('7', streetZ(28), 1)],
  ['34 St–Penn Station', ['1', '2', '3'], at('7', streetZ(34), -1)],
  ['50 St', ['1'], atBroadway(streetZ(50), -1)],
  ['59 St–Columbus Circle', ['1', 'A', 'B', 'C', 'D'], { x: -838, z: -1358 }], // Columbus Cir, SE quadrant
  ['66 St–Lincoln Center', ['1'], atBroadway(streetZ(66), -1)],
  ['72 St', ['1', '2', '3'], atBroadway(streetZ(72), -1)],
  ['79 St', ['1'], atBroadway(streetZ(79), -1)],
  ['86 St', ['1'], atBroadway(streetZ(86), -1)],
  ['96 St', ['1', '2', '3'], atBroadway(streetZ(96), -1)],
  ['103 St', ['1'], atBroadway(streetZ(103), -1)],
  ['110 St–Cathedral Pkwy', ['1'], atBroadway(streetZ(110), -1)],
  ['116 St–Columbia University', ['1'], atBroadway(streetZ(116), -1)],
  ['125 St', ['1'], atBroadway(streetZ(125), -1)],
  // --- 4/5/6 Lexington Ave line (south of City Hall it runs up Broadway) ---
  ['Wall St', ['4', '5'], { x: 183, z: 5700 }],
  ['Fulton St', ['4', '5'], { x: 209, z: 5320 }],
  ['14 St–Union Sq', ['4', '5', '6', 'L', 'N', 'Q', 'R', 'W'], atBroadway(streetZ(14), 1)],
  ['23 St', ['6'], at('lex', streetZ(23), -1)],
  ['33 St', ['6'], at('lex', streetZ(33), -1)],
  ['Grand Central–42 St', ['4', '5', '6', '7', 'S'], at('lex', 0, -1)],
  ['51 St', ['6'], at('lex', streetZ(51), 1)],
  ['59 St', ['4', '5', '6'], at('lex', streetZ(59), 1)],
  ['68 St–Hunter College', ['6'], at('lex', streetZ(68), -1)],
  ['77 St', ['6'], at('lex', streetZ(77), -1)],
  ['96 St', ['6'], at('lex', streetZ(96), 1)],
  ['103 St', ['6'], at('lex', streetZ(103), 1)],
  ['116 St', ['6'], at('lex', streetZ(116), 1)],
  ['125 St', ['4', '5', '6'], at('lex', streetZ(125), 1)],
  // --- 7 Flushing line along 42nd St ---
  ['Times Sq–42 St', ['1', '2', '3', '7', 'N', 'Q', 'R', 'W', 'S'], atBroadway(streetZ(42), 1)],
  ['34 St–Hudson Yards', ['7'], at('11', streetZ(34), -1)],
  ['42 St–Bryant Pk', ['7', 'B', 'D', 'F', 'M'], at('6', 0, 1)],
  // --- N/Q/R/W Broadway line ---
  ['Canal St', ['N', 'Q', 'R', 'W'], { x: 316, z: 3701 }],
  ['Prince St', ['R', 'W'], { x: 344, z: 3271 }],
  ['Broadway–Lafayette St', ['B', 'D', 'F', 'M'], { x: 330, z: 3420 }],
  ['34 St–Herald Sq', ['B', 'D', 'F', 'M', 'N', 'Q', 'R', 'W'], atBroadway(streetZ(34), 1)],
  ['49 St', ['N', 'Q', 'R', 'W'], at('7', streetZ(49), -1)],
  ['57 St–7 Av', ['N', 'Q', 'R'], at('7', streetZ(57), -1)],
  ['5 Av/59 St', ['N', 'Q', 'R'], at('5', streetZ(59), -1)],
  // --- Second Ave line (Q) ---
  ['72 St', ['Q'], at('2', streetZ(72), 1)],
  ['86 St', ['Q'], at('2', streetZ(86), 1)],
  ['96 St', ['Q'], at('2', streetZ(96), 1)],
  // --- A/C/E 8th Ave line ---
  ['14 St', ['A', 'C', 'E', 'L'], at('8', streetZ(14), 1)],
  ['23 St', ['C', 'E'], at('8', streetZ(23), -1)],
  ['34 St–Penn Station', ['A', 'C', 'E'], at('8', streetZ(34), 1)],
  ['42 St–Port Authority Bus Terminal', ['A', 'C', 'E'], at('8', 0, -1)],
  ['50 St', ['C', 'E'], at('8', streetZ(50), 1)],
  ['72 St', ['A', 'B', 'C', 'D'], at('8', streetZ(72), -1)],
  ['81 St–Museum of Natural History', ['B', 'C'], at('8', streetZ(81), -1)],
  ['86 St', ['B', 'C'], at('8', streetZ(86), -1)],
  ['96 St', ['A', 'B', 'C'], at('8', streetZ(96), 0)], // on Central Park West itself
  ['103 St', ['B', 'C'], at('8', streetZ(103), 0)],
  ['110 St–Cathedral Pkwy', ['B', 'C'], { x: -876, z: -5499 }],
  ['116 St–Columbia University', ['B', 'C'], at('8', streetZ(116), 1)],
  ['125 St', ['A', 'B', 'C', 'D'], at('8', streetZ(125), -1)],
  // --- B/D/F/M 6th Ave line ---
  ['47–50 Sts–Rockefeller Ctr', ['B', 'D', 'F', 'M'], at('6', streetZ(49), -1)],
  ['23 St', ['F', 'M'], at('6', streetZ(23), 1)],
  ['14 St', ['F', 'M'], at('6', streetZ(14), 1)],
  // --- L Canarsie line east of Union Sq ---
  ['3 Av', ['L'], at('3', streetZ(14), -1)],
  ['1 Av', ['L'], at('1', streetZ(14), 1)]
];

// Duplicate names above are separate stations on different avenues (e.g. two "23 St" stops).
export const STATIONS = STATION_DEFS.map(([name, lines, pos]) => ({
  id: `st-${name}-${Math.round(pos.x)}-${Math.round(pos.z)}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
  name,
  lines,
  color: LINE_COLORS[lines[0]],
  x: pos.x,
  z: pos.z,
  heading: Math.PI,
  district: pos.x < -700 ? 'West Side' : pos.x > 600 ? 'East Side' : 'Midtown/Downtown'
}));

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Rides: about 2 minutes of overhead plus travel time at roughly 260 m per game minute,
// capped so no single ride eats the whole session. Transfers add their own wait.
export function rideMinutes(from, to, transfers = 0) {
  const m = 2 + dist(from, to) / 260 + transfers * TRANSFER_MINUTES;
  return Math.max(3, Math.min(24, Math.round(m)));
}

function planRoute(from, to) {
  const shared = from.lines.filter((l) => to.lines.includes(l));
  if (shared.length) {
    return { transfers: 0, legs: [{ line: shared[0], from: from.name, to: to.name }] };
  }
  // One transfer: a station that shares a line with each end.
  let best = null;
  for (const mid of STATIONS) {
    if (mid === from || mid === to) continue;
    const a = mid.lines.find((l) => from.lines.includes(l));
    const b = mid.lines.find((l) => to.lines.includes(l));
    if (!a || !b) continue;
    const cost = dist(from, mid) + dist(mid, to);
    if (!best || cost < best.cost) best = { mid, a, b, cost };
  }
  if (best) {
    return {
      transfers: 1,
      legs: [
        { line: best.a, from: from.name, to: best.mid.name },
        { line: best.b, from: best.mid.name, to: to.name }
      ]
    };
  }
  return null; // no simple route within the simulated area
}

export function createSubway() {
  return {
    stations: STATIONS,
    fareCents: FARE_CENTS,

    stationById(id) {
      return STATIONS.find((s) => s.id === id) || null;
    },

    nearestStation(x, z, radius = 22) {
      let best = null;
      let bestD = radius;
      for (const s of STATIONS) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bestD) {
          best = s;
          bestD = d;
        }
      }
      return best;
    },

    plan(from, to) {
      if (!from || !to || from === to) return null;
      const route = planRoute(from, to);
      if (!route) return null;
      return {
        ...route,
        minutes: rideMinutes(from, to, route.transfers),
        fareCents: FARE_CENTS
      };
    }
  };
}
