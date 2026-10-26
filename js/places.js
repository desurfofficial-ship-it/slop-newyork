// js/places.js
// The interactive city: food spots, apartment listings, workplaces, attractions and the arrival
// scenarios. Every position is computed from the real street grid (1:1 world meters, see
// city-config.js), so a deli stands where a deli would stand. All businesses, landlords and
// employers are fictional; prices are plausible NYC examples, not quotes.
//
// The unit tests validate that every spot lands on a real street, outside buildings.

import { avenueX, streetZ, getBroadwayX, nearestRoads } from './city-config.js';
import { FOOD_ITEMS } from './economy.js';

// Sidewalk-ish spot just off an avenue's curb (side: +1 east, -1 west, 0 centerline).
const at = (avenueId, z, side = 1) => {
  const offsets = { '-1': -6.8, '0': 0, '1': 6.8 };
  return { x: avenueX(avenueId) + offsets[String(side)], z };
};
const atBroadway = (z, side = 1) => ({ x: getBroadwayX(z) + side * 7, z });

// --- Arrival scenarios ------------------------------------------------------------------------
export const ARRIVALS = [
  {
    id: 'penn',
    label: 'Penn Station',
    sub: 'LIRR & NJ Transit · 7th Av & 32nd St',
    x: at('7', streetZ(32), 1).x,
    z: streetZ(32),
    heading: Math.PI,
    intro: 'Your train rumbles into Penn Station under Macy\'s. Up the stairs, 7th Ave hits you all at once — steam, horns, a hundred conversations. Your budget is what is in your pocket.',
    fareNote: 'Most arrivals cost nothing extra — you are already here.'
  },
  {
    id: 'portauthority',
    label: 'Port Authority Bus Terminal',
    sub: '8th Av & 40th St',
    x: at('8', streetZ(40), 1).x,
    z: streetZ(40),
    heading: Math.PI,
    intro: 'The bus squeezes into the Port Authority. Times Square glows one block east. Find the subway entrances — the whole city is downstream of a MetroCard swipe.',
    fareNote: 'Most arrivals cost nothing extra — you are already here.'
  },
  {
    id: 'jfk',
    label: 'JFK Airport (by taxi)',
    sub: 'A yellow cab drops you in Lower Manhattan',
    x: -305.7,
    z: 5210,
    heading: Math.PI,
    intro: 'The cab crosses the East River and the skyline fills the windshield — that ride cost about $70, the first lesson in New York arithmetic. One World Trade Center rises over Vesey St.',
    fareNote: 'The taxi from JFK (~$70) is already reflected in your starting cash.'
  }
];

// --- Food spots -------------------------------------------------------------------------------
const FOOD_SPOTS = [
  { id: 'deli-penn', name: 'Garden Deli', kind: 'food', x: at('7', streetZ(33), 1).x, z: streetZ(33), district: 'Midtown South', menu: ['coffee', 'bagel', 'sandwich', 'groceries'], blurb: 'A classic corner deli: steam table, lottery tickets, the best egg sandwich in a five-block radius. Maybe.' },
  { id: 'pizza-times', name: 'Duffy Square Pizza', kind: 'food', x: atBroadway(streetZ(46), 1).x, z: streetZ(46), district: 'Theater District', menu: ['slice', 'coffee'], blurb: 'Two-train pizza: fold it, eat it walking, question your life choices at the second grease drip.' },
  { id: 'cart-6th', name: 'Halal Cart on 6th', kind: 'food', x: at('6', streetZ(52), 1).x, z: streetZ(52), district: 'Midtown', menu: ['taco', 'coffee'], blurb: 'The smell reaches three avenues. Office workers and cyclists in one line.' },
  { id: 'deli-herald', name: 'Herald Square Deli', kind: 'food', x: atBroadway(streetZ(35), -1).x, z: streetZ(35), district: 'Herald Square', menu: ['coffee', 'bagel', 'sandwich'], blurb: 'Bagels the size of your palm, cream cheese applied without mercy.' },
  { id: 'market-union', name: 'Union Square Greenmarket', kind: 'food', x: 188, z: 2051, district: 'Union Square', menu: ['groceries'], blurb: 'Farmers stake out the square four days a week. Groceries here cost more and taste like it.' },
  { id: 'bakery-kanal', name: 'Canal Street Bakery', kind: 'food', x: 316, z: 3760, district: 'Chinatown', menu: ['coffee', 'taco'], blurb: 'Pork buns in the steamer, iced coffee in the summer, cash preferred, always.' },
  { id: 'deli-fulton', name: 'Fulton Street Deli', kind: 'food', x: 209, z: 5360, district: 'Financial District', menu: ['coffee', 'bagel', 'sandwich'], blurb: 'Suit jackets and hard hats in the same line. The pickles are serious.' },
  { id: 'deli-uws', name: 'West 72nd Deli', kind: 'food', x: atBroadway(streetZ(72), -1).x, z: streetZ(72), district: 'Upper West Side', menu: ['coffee', 'bagel', 'groceries'], blurb: 'Strollers, dogs, and a line that moves with terrifying efficiency.' },
  { id: 'bakery-harlem', name: 'Lenox Avenue Bakery', kind: 'food', x: at('7', streetZ(125), 1).x, z: streetZ(125), district: 'Harlem', menu: ['coffee', 'bagel'], blurb: 'Coffee strong enough to walk home by itself.' }
];

// --- Apartment listings (fictional landlords, plausible rents) --------------------------------
const monthDaily = (monthlyCents) => Math.round(monthlyCents / 30);
const APARTMENTS = [
  {
    id: 'apt-chinatown-room', name: 'Shared walk-up, Bayard St', district: 'Chinatown',
    monthlyCents: 105000, quality: 'A room in a four-person flat. The kitchen is a hotplate and diplomacy.',
    x: 304, z: 3800
  },
  {
    id: 'apt-harlem-studio', name: 'Studio above the bakery, W 125th', district: 'Harlem',
    monthlyCents: 185000, quality: 'Small, sunny, and the whole block smells like bread in the morning.',
    x: at('7', streetZ(125), -1).x, z: streetZ(125)
  },
  {
    id: 'apt-uws-studio', name: 'Studio near the park, W 72nd', district: 'Upper West Side',
    monthlyCents: 245000, quality: 'Fourth-floor walk-up. Central Park is your extended living room.',
    x: atBroadway(streetZ(72), 1).x, z: streetZ(72)
  },
  {
    id: 'apt-ev-1br', name: 'One-bedroom, E 10th St', district: 'East Village',
    monthlyCents: 320000, quality: 'A real door between the bed and the guests. Radiator has opinions.',
    x: at('2', streetZ(10), 1).x, z: streetZ(10)
  }
].map((a) => ({ ...a, dailyRentCents: monthDaily(a.monthlyCents), depositCents: a.monthlyCents }));

// --- Workplaces (fictional employers, plausible example wages) --------------------------------
const WORKPLACES = [
  { id: 'job-deli', employer: 'Canal Street Bakery', title: 'Deli counter clerk', shiftPayCents: 7800, drain: { energy: 26, hunger: 18 }, x: 320, z: 3755, district: 'Chinatown', blurb: 'Slicing, scooping, small talk in three languages.' },
  { id: 'job-cafe', employer: 'Midtown Grind Café', title: 'Barista', shiftPayCents: 7000, drain: { energy: 24, hunger: 16 }, x: at('6', streetZ(48), -1).x, z: streetZ(48), district: 'Midtown', blurb: 'Espresso machine Diplomacy 101. Regulars tip in stories.' },
  { id: 'job-courier', employer: 'Midtown Courier Co.', title: 'Bike messenger', shiftPayCents: 9500, drain: { energy: 42, hunger: 24 }, x: 247, z: -164, district: 'Midtown East', blurb: 'You will learn every pothole between 30th and 57th by name.' },
  { id: 'job-office', employer: 'Fifth Avenue Suites', title: 'Office assistant', shiftPayCents: 13000, drain: { energy: 30, hunger: 18 }, requiresShifts: 2, x: at('5', streetZ(53), -1).x, z: streetZ(53), district: 'Midtown', blurb: 'A desk, a phone, and views of other people having views.' }
];

// --- Attractions ------------------------------------------------------------------------------
const ATTRACTIONS = [
  { id: 'att-times', name: 'Times Square Plaza', priceCents: 0, minutes: 30, energy: 5, x: -220, z: 7, district: 'Theater District', blurb: 'The lights never blink first. Stand still and watch the city orbit you.' },
  { id: 'att-bryant', name: 'Bryant Park', priceCents: 0, minutes: 45, energy: 10, x: at('6', streetZ(41), 1).x, z: streetZ(41), district: 'Midtown', blurb: 'Lawn chairs between the library and 5th Ave. The most civilized half hour in Midtown.' },
  { id: 'att-library', name: 'New York Public Library', priceCents: 0, minutes: 45, energy: 8, x: at('5', streetZ(41), -1).x, z: streetZ(41), district: 'Midtown', blurb: 'Marble lions, free Wi-Fi, and reading rooms that smell of quiet.' },
  { id: 'att-grandcentral', name: 'Grand Central Terminal', priceCents: 0, minutes: 30, energy: 6, x: 313, z: -7, district: 'Midtown East', blurb: 'Look up: the ceiling is backwards on purpose. Or on accident. Ask a docent.' },
  { id: 'att-centralpark', name: 'Central Park (Bethesda Terrace)', priceCents: 0, minutes: 60, energy: 14, x: at('5', streetZ(72), 1).x, z: streetZ(72), district: 'Central Park', blurb: 'Eight hundred acres of deliberate calm in the middle of everything.' },
  { id: 'att-wsq', name: 'Washington Square Park', priceCents: 0, minutes: 45, energy: 10, x: at('university', streetZ(8), -1).x, z: streetZ(8), district: 'Greenwich Village', blurb: 'Pianists, chess hustlers, and the arch. NYU\'s de facto quad.' },
  { id: 'att-zoo', name: 'Central Park Zoo', priceCents: 1950, minutes: 75, energy: 10, x: at('5', streetZ(64), 1).x, z: streetZ(64), district: 'Central Park', blurb: 'Small, dense, and the penguins have a cult following.' },
  { id: 'att-esb', name: 'Empire State Building · 86th-floor deck', priceCents: 4400, minutes: 90, energy: 6, x: at('5', streetZ(34), -1).x, z: streetZ(34), district: 'Midtown South', blurb: 'The classic. Go at blue hour and watch the grid switch on.' }
];

// --- Home base / hotel ------------------------------------------------------------------------
const HOTEL = { id: 'hotel-edison', name: 'The Edison Grand', kind: 'home', x: at('7', streetZ(45), 1).x, z: streetZ(45), district: 'Theater District', blurb: 'Your room is small and the radiator sings, but housekeeping is included.' };

export const ALL_PLACES = [
  ...FOOD_SPOTS,
  ...APARTMENTS.map((a) => ({ ...a, kind: 'apartment' })),
  ...WORKPLACES.map((w) => ({ ...w, kind: 'work' })),
  ...ATTRACTIONS.map((a) => ({ ...a, kind: 'attraction' })),
  HOTEL
];

export const APARTMENT_LISTINGS = APARTMENTS;
export const WORK_LISTINGS = WORKPLACES;

// House rules for the simulation loop (exported so life.js and tests agree on the numbers).
export const NEEDS_PER_GAME_HOUR = { hunger: 4, energy: -3 };
export const SHIFT_MINUTES = 240;
export const SLEEP_TARGET = 7 * 60; // sleep until 07:00

const MINUTES_AT = (minutes) => ((Math.round(minutes) % 1440) + 1440) % 1440;

export function createPlaces({ state, economy, bus }) {
  function applyNeed(deltas) {
    if (!deltas) return;
    if (deltas.hunger) state.setNeed('hunger', state.state.needs.hunger + deltas.hunger);
    if (deltas.energy) state.setNeed('energy', state.state.needs.energy + deltas.energy);
  }

  function foodAction(spot, item) {
    return {
      id: `buy-${item.id}`,
      label: `Buy ${item.label.toLowerCase()}`,
      sub: economy.format(item.cents),
      run() {
        if (!economy.spend(item.cents, `${item.label} · ${spot.name}`)) return false;
        applyNeed(item.need);
        state.recordMeal();
        bus.emit('meal-eaten', { cents: item.cents, label: item.label });
        state.advanceMinutes(10);
        bus.emit('toast', { text: `${item.label} from ${spot.name}. ${item.need.hunger <= -30 ? 'That was a real meal.' : 'Quick and cheap.'}`, kind: 'ok' });
        return true;
      }
    };
  }

  function homeActions() {
    const housing = state.state.housing;
    const isHome = housing !== null;
    return [{
      id: 'check-in',
      label: 'Get your room key',
      sub: 'Newcomer check-in · free',
      run() {
        state.recordPoiVisit(HOTEL.id);
        state.advanceMinutes(5);
        bus.emit('toast', { text: 'Room key in pocket. This is your base until you find your own place.', kind: 'ok' });
        return true;
      }
    }, {
      id: 'sleep',
      label: isHome ? 'Head upstairs & sleep until 7 AM' : `Sleep at ${HOTEL.name} until 7 AM`,
      sub: isHome ? 'Free · wakes you rested' : 'Included for visitors',
      run() {
        const now = MINUTES_AT(state.state.clock.minutes);
        let ahead = SLEEP_TARGET - now;
        if (ahead <= 0) ahead += 1440;
        state.advanceMinutes(ahead);
        state.setNeed('energy', 100);
        state.setNeed('hunger', state.state.needs.hunger + 22);
        bus.emit('toast', { text: isHome ? `You slept at ${housing.name}. Rent comes out of every new day.` : `You slept at ${HOTEL.name}.`, kind: 'ok' });
        bus.emit('slept', { minutes: ahead });
        return true;
      }
    }, {
      id: 'rest-hour',
      label: 'Rest an hour',
      sub: 'Free · +15 energy',
      run() {
        state.advanceMinutes(60);
        applyNeed({ energy: 15, hunger: 6 });
        return true;
      }
    }];
  }

  return {
    places: ALL_PLACES,
    arrivals: ARRIVALS,
    hotel: HOTEL,
    foodItem: (id) => FOOD_ITEMS.find((f) => f.id === id) || null,

    arrival(id) {
      return ARRIVALS.find((a) => a.id === id) || ARRIVALS[0];
    },

    // Nearest interactive spot within reach of the player (called throttled from the loop).
    scan(x, z, radius = 14) {
      let best = null;
      let bestD = radius;
      for (const p of ALL_PLACES) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bestD) {
          best = p;
          bestD = d;
        }
      }
      return best;
    },

    placeById(id) {
      return ALL_PLACES.find((p) => p.id === id) || null;
    },

    // The available interactions at a spot. UI renders these; each run() is self-contained.
    actionsFor(place) {
      if (!place) return [];
      const actions = [];
      if (place.kind === 'food') {
        for (const itemId of place.menu) {
          const item = this.foodItem(itemId);
          if (item) actions.push(foodAction(place, item));
        }
        actions.push({
          id: 'sit',
          label: 'Sit a while',
          sub: 'Free · +6 energy',
          run() {
            state.advanceMinutes(25);
            applyNeed({ energy: 6 });
            return true;
          }
        });
      } else if (place.kind === 'apartment') {
        const leased = state.state.housing && state.state.housing.id === place.id;
        if (leased) {
          actions.push({ id: 'leased', label: 'You live here', sub: 'Your lease', disabled: true });
        } else {
          actions.push({
            id: 'lease',
            label: `Sign the lease`,
            sub: `Deposit (1 month) ${economy.format(place.depositCents)} · then ${economy.format(place.dailyRentCents)}/day`,
            run() {
              if (!economy.spend(place.depositCents, `Lease deposit · ${place.name}`)) return false;
              state.setHousing({ id: place.id, name: place.name, dailyRentCents: place.dailyRentCents, quality: place.district });
              bus.emit('toast', { text: `Keys to ${place.name}! Rent: ${economy.format(place.dailyRentCents)} each new day.`, kind: 'ok' });
              return true;
            }
          });
          actions.push({ id: 'view', label: 'View the listing', sub: `${economy.format(place.monthlyCents)}/month · ${place.district}`, disabled: true });
        }
      } else if (place.kind === 'work') {
        const job = state.state.job;
        if (job && job.id === place.id) {
          actions.push({
            id: 'shift',
            label: `Work a shift (4 h)`,
            sub: `Earn ~${economy.format(job.shiftPayCents)}`,
            run() {
              applyNeed({ energy: -place.drain.energy, hunger: place.drain.hunger });
              state.advanceMinutes(SHIFT_MINUTES);
              state.recordShift();
              let pay = job.shiftPayCents;
              const bonus = Math.random() < 0.2 ? Math.round((1500 + Math.random() * 1500) / 100) * 100 : 0;
              economy.earn(pay + bonus, bonus ? `${place.title} · ${place.employer} (+tip)` : `${place.title} · ${place.employer}`);
              if (bonus) bus.emit('toast', { text: `A regular tipped you ${economy.format(bonus)}.`, kind: 'ok' });
              return true;
            }
          });
        } else if (job) {
          actions.push({ id: 'employed', label: `You work at ${job.employer}`, sub: 'Quit there before applying here (coming soon)', disabled: true });
        } else {
          const blocked = place.requiresShifts && state.state.shiftsWorked < place.requiresShifts;
          actions.push({
            id: 'apply',
            label: blocked ? `Needs ${place.requiresShifts} shifts of experience` : `Apply for a job here`,
            sub: blocked ? `You have ${state.state.shiftsWorked}` : `${place.title} · ~${economy.format(place.shiftPayCents)}/shift`,
            disabled: Boolean(blocked),
            run() {
              if (blocked) return false;
              state.setJob({ id: place.id, title: place.title, employer: place.employer, shiftPayCents: place.shiftPayCents, level: 1 });
              bus.emit('toast', { text: `Hired! ${place.title} at ${place.employer}. Shifts take 4 hours.`, kind: 'ok' });
              return true;
            }
          });
        }
      } else if (place.kind === 'attraction') {
        actions.push({
          id: 'visit',
          label: place.priceCents ? `Buy a ticket & explore` : `Look around`,
          sub: place.priceCents ? economy.format(place.priceCents) : 'Free',
          run() {
            if (place.priceCents && !economy.spend(place.priceCents, place.name)) return false;
            state.recordPoiVisit(place.id);
            state.advanceMinutes(place.minutes);
            applyNeed({ energy: place.energy, hunger: Math.round(place.minutes / 12) });
            bus.emit('toast', { text: `${place.name}. ${place.blurb}`, kind: 'ok' });
            return true;
          }
        });
      } else if (place.kind === 'home') {
        actions.push(...homeActions());
      }
      return actions;
    }
  };
}
