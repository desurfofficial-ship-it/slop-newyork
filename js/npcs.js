// js/npcs.js
// Named New Yorkers you can run into around the city. Each stands near a real corner (validated
// by the tests), reacts to the time of day, and short conversations build your "connections" —
// the social side of the simulation. All characters are fictional; the transit facts they share
// are the real ones a visitor actually needs.

import { ALL_PLACES } from './places.js';

// Encounters stand exactly at their anchor place's entrance (positions are validated by tests).
const atPlace = (placeId) => {
  const p = ALL_PLACES.find((pl) => pl.id === placeId);
  return p ? { x: p.x, z: p.z } : { x: 0, z: 0 };
};

// timeOfDay: morning < 12, afternoon < 19, evening otherwise (game clock)
const NPC_DEFS = [
  {
    id: 'npc-sal', name: 'Sal', role: 'deli counterman', anchor: 'deli-penn',
    lines: {
      morning: 'Egg, salt, peppa, up top? You look like a first-day-in-town breakfast.',
      afternoon: 'Lunch rush is over. You want quiet? Walk one block east and turn anywhere.',
      evening: 'Deli closes when the boss says. In New York that means "eventually".'
    },
    tips: ['OMNY caps your subway fares at $34 a week — after that, rides are free.', 'Penn Station has entrances on 7th and 8th Ave. The 1/2/3 run under 7th.']
  },
  {
    id: 'npc-ruth', name: 'Ruth', role: 'retired librarian', anchor: 'att-library',
    lines: {
      morning: 'The lions are Patience and Fortitude. The building opened in 1911 and the reading rooms are still free.',
      afternoon: 'Take the free one-hour tour. The copy of the Gutenberg Bible is upstairs.',
      evening: 'The steps are the best free people-watching in Midtown. Bring your own sandwich.'
    },
    tips: ['The library, Bryant Park and Grand Central are all within two blocks of each other.', 'Bryant Park\'s lawn has free chairs — nobody will bother you.']
  },
  {
    id: 'npc-marcus', name: 'Marcus', role: 'bike messenger', anchor: 'job-courier',
    lines: {
      morning: 'Rule one: the checkered cab always wins. Rule two: see rule one.',
      afternoon: 'Midtown between 40th and 57th is all one-way traffic — learn it or walk it.',
      evening: 'Fastest way across town? The 7 under 42nd. Fastest way to lose money? A cab at 5 PM.'
    },
    tips: ['The subway costs $2.90 a ride with OMNY — tap the same card or phone each time.', 'Avenues run north-south, streets east-west, and the grid is 29° off true north.']
  },
  {
    id: 'npc-ines', name: 'Inés', role: 'gallery assistant', anchor: 'att-bryant',
    lines: {
      morning: 'Free museums day list: the Met is pay-what-you-wish for New York residents. The library is always free.',
      afternoon: 'Bryant Park at lunch is chess players and models eating salads. Both very serious.',
      evening: 'Winter they flood the lawn into a rink. Summer, outdoor movies. Always something.'
    },
    tips: ['Bryant Park sits behind the New York Public Library on 6th Ave.', 'The B/D/F/M stop under the park is 42 St–Bryant Pk.']
  },
  {
    id: 'npc-jamaal', name: 'Jamaal', role: 'paralegal', anchor: 'deli-fulton',
    lines: {
      morning: 'FiDi empties at 6 PM sharp. Then it\'s yours.',
      afternoon: 'Stone Street has the lunch crowd from every office in a ten-block radius.',
      evening: 'Wall Street takes five minutes to see. The 2/3 stop is right there.'
    },
    tips: ['The 4/5 run up Broadway through the Financial District — Wall St and Fulton St stations.', 'Fulton St station connects 9 lines under one dome. Follow the signs, not the rumors.']
  },
  {
    id: 'npc-priya', name: 'Priya', role: 'grad student', anchor: 'bakery-harlem',
    lines: {
      morning: 'The 1 and the 2/3 both run up here — the 1 on Broadway, the 2/3 on Lenox.',
      afternoon: 'Schomburg Library is two blocks east. Free, and the reading room is gorgeous.',
      evening: 'Rent is lower up here and the bakery situation is unbeatable. That\'s the whole math.'
    },
    tips: ['The A/B/C/D stop at 125 St is the express hub for Harlem.', 'Columbia University is at 116th St — the 1 stop is named after it.']
  },
  {
    id: 'npc-danny', name: 'Danny', role: 'tour guide', anchor: 'att-times',
    lines: {
      morning: 'Times Square is emptyest before 9 AM. Best photo window, no crowd.',
      afternoon: 'Everything on this square costs triple. The subway is $2.90 — same train, same city.',
      evening: 'Red steps at TKTS: free seats, best light show on earth at dusk.'
    },
    tips: ['Times Sq–42 St station links the 1/2/3, 7, N/Q/R/W and the S shuttle — eleven platforms.', 'TKTS sells same-day Broadway tickets at a discount. The booth is under the red steps.']
  },
  {
    id: 'npc-wendy', name: 'Wendy', role: 'nurse', anchor: 'deli-uws',
    lines: {
      morning: 'Cross streets get bigger numbers as you go uptown. 72nd is north of 59th. You\'ll never get lost again.',
      afternoon: 'The park is 51 blocks long. Enter anywhere — you cannot see it all in one day.',
      evening: 'Night shift tip: the 1 runs local all night. The 2/3 go express and skip us.'
    },
    tips: ['"Uptown" means higher street numbers, "downtown" means lower.', 'Central Park West stations: 72, 81 (Museum), 86, 96 — all B/C except 96 (A/B/C).']
  },
  {
    id: 'npc-theo', name: 'Theo', role: 'barista', anchor: 'job-cafe',
    lines: {
      morning: 'You want the regulars\' order? "Regular" means milk and two sugars. Everything else is negotiable.',
      afternoon: 'Latte art peaked in 2016 and I\'ll die on that hill. The espresso is still good though.',
      evening: 'Tip jar is for stories. Best one today wins the muffin.'
    },
    tips: ['A drip coffee at a deli: ~$3.50. A café latte in Midtown: $6-7. Both get you a bathroom key.', 'New Yorkers order "a coffee, regular" — that\'s with milk and sugar.']
  },
  {
    id: 'npc-may', name: 'May', role: 'seamstress', anchor: 'bakery-kanal',
    lines: {
      morning: 'Canal Street: everything is negotiable except the pork buns. Those are fixed price.',
      afternoon: 'The Manhattan Bridge hums if you put your hand on the railing. Try it.',
      evening: 'East Broadway after dark is a different city. Bring an appetite and cash.'
    },
    tips: ['Chinatown rents are among the last reachable ones downtown — and you still get the best food.', 'The 6 runs under Canal Street; the N/Q/R/W cross it at Broadway; the J/Z ride over the bridge.']
  },
  {
    id: 'npc-frank', name: 'Frank', role: 'cab driver', anchor: 'att-grandcentral',
    lines: {
      morning: 'Grand Central at 8 AM: forty thousand people late for something. Beautiful, ain\'t it?',
      afternoon: 'The clock in the main hall — the real one\'s brass, the four faces are opal. Worth being 2 minutes late.',
      evening: 'Evening rush is 4 to 7. Walk if it\'s under twenty blocks. You\'ll beat me anyway.'
    },
    tips: ['The S shuttle runs between Times Sq and Grand Central, every few minutes, no other stops.', 'Twenty blocks ≈ one mile on the numbered grid. Ten avenues ≈ one mile too.']
  },
  {
    id: 'npc-lucia', name: 'Lucía', role: 'nanny', anchor: 'att-centralpark',
    lines: {
      morning: 'Playground circuit starts at 10. Bethesda fountain by 11. Naps are non-negotiable.',
      afternoon: 'The mall — that long tree-lined walk — is where all the movie scenes happen.',
      evening: 'Strawberry Fields, the mosaic that says "Imagine". West side at 72nd. Free, always.'
    },
    tips: ['Central Park is free and 843 acres. The 5th Ave stops: N/Q/R at 59th, 6 at 68th and 77th.', 'The park closes 1 AM to 6 AM. Yes, they actually close it.']
  },
  {
    id: 'npc-kwame', name: 'Kwame', role: 'street musician', anchor: 'att-wsq',
    lines: {
      morning: 'Saxophone and the arch at 9 AM — before the students wake up. Prime acoustics.',
      afternoon: 'Chess tables: five dollars a game, and that old man by the fountain will destroy you.',
      evening: 'Washington Square is the village\'s living room. NYU is all around you.'
    },
    tips: ['The park\'s fountain sits where Fifth Avenue would run — the grid bends around the park.', 'The R/W at 8 St–NYU and the A/C/E/B/D/F/M at West 4th are both a short walk away.']
  },
  {
    id: 'npc-sasha', name: 'Sasha', role: 'actor', anchor: 'pizza-times',
    lines: {
      morning: 'Audition at 10, shift at 2, show at 8. The slice holds the whole plan together.',
      afternoon: 'Broadway between shows: half-price booth at TKTS, or people-watch in Duffy Square.',
      evening: 'If you see a line outside a theater at 7:25, someone is selling rush tickets. Ask politely.'
    },
    tips: ['A plain cheese slice runs about $4.25 these days. The dollar-slice era is over — grieve, then eat.', 'The N/Q/R/W stop at 49 St drops you right at the theater district\'s doorstep.']
  },
  {
    id: 'npc-eddie', name: 'Eddie', role: 'superintendent', anchor: 'apt-harlem-studio',
    lines: {
      morning: 'Rule of renting: if the broker asks for a year up front in cash, walk away.',
      afternoon: 'A super who answers the phone is worth two months of good reviews.',
      evening: 'Heat\'s on from October to May by law — landlords must keep it at least 68 daytime.'
    },
    tips: ['Apartment ads list "month" rent; most leases also want first month + one month deposit.', 'Ask if heat and hot water are included — in most buildings, they\'re the landlord\'s problem by law.']
  },
  {
    id: 'npc-georgia', name: 'Georgia', role: 'hotel concierge', anchor: 'hotel-edison',
    lines: {
      morning: 'Wake-up call, map, umbrella, patience — the four things every guest actually needs.',
      afternoon: 'The Theatre District runs 41st to 54th, 6th to 9th Ave. Everything else is marketing.',
      evening: 'Skip the restaurants ON Times Square. Walk two blocks in any direction. Thank me later.'
    },
    tips: ['Hotels charge "occupancy taxes" on top of the room rate — budget roughly 15% extra per night.', 'The 50 St (C/E) and 49 St (N/Q/R/W) stations are closest to most hotels in the district.']
  }
];

const partOfDay = (minutes) => (minutes < 720 ? 'morning' : minutes < 1140 ? 'afternoon' : 'evening');

export function createNpcs({ state, bus }) {
  const npcs = NPC_DEFS.map((def) => ({
    ...def,
    pos: atPlace(def.anchor)
  }));

  return {
    npcs,

    // Nearest encounter within reach (throttled scan from the game loop).
    nearby(x, z, radius = 10) {
      let best = null;
      let bestD = radius;
      for (const n of npcs) {
        const d = Math.hypot(n.pos.x - x, n.pos.z - z);
        if (d < bestD) {
          best = n;
          bestD = d;
        }
      }
      return best;
    },

    // The opening line for the current game time.
    greet(npc) {
      return npc.lines[partOfDay(state.state.clock.minutes)] || npc.lines.afternoon;
    },

    // Dialogue options. Each returns { line, kind } for the UI; effects go through game-state.
    talk(npc, optionId) {
      if (optionId === 'chat') {
        const first = state.meetNpc(npc.id);
        if (first) {
          bus.emit('toast', { text: `${npc.name} — a new connection. You know ${state.state.connections.length} people in this city now.`, kind: 'ok' });
        }
        return { line: npc.lines[partOfDay(state.state.clock.minutes)] || npc.lines.afternoon, met: first };
      }
      if (optionId === 'tip') {
        const tip = npc.tips[Math.floor(state.state.clock.day * 7 + npc.id.length * 3) % npc.tips.length];
        return { line: tip, kind: 'tip' };
      }
      return null;
    },

    partOfDay
  };
}
