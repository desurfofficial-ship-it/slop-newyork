// js/missions.js
// The guided story: eight everyday New York situations, in a sensible order. Mission progress is
// derived live from the game state (rides taken, meals eaten, leases signed…), so it survives
// crashes, ignores schema drift and never disagrees with the HUD. Only the completion list
// persists — that is also what gates the rewards.
//
// In Free Roam mode nothing is tracked (see PLAY_MODES.tracksMissions).

const MISSIONS = [
  {
    id: 'm-first-day',
    title: 'Your First Day',
    blurb: 'Every New Yorker started somewhere. Find The Edison Grand on 45th St — the newcomer hotel where every arrival story here begins.',
    rewardCents: 2500,
    objectives: [
      { id: 'reach-hotel', label: 'Reach The Edison Grand (45th St, off Times Sq)', done: (s) => (s.visitedPois['hotel-edison'] || 0) > 0 }
    ]
  },
  {
    id: 'm-get-around',
    title: 'Get Around',
    blurb: 'The subway is the city\'s bloodstream. Find an entrance with the green globes, tap in, and let the rails do the work.',
    rewardCents: 1500,
    objectives: [
      { id: 'ride', label: 'Take the subway anywhere', done: (s) => s.subwayRides >= 1, target: 1, progress: (s) => s.subwayRides }
    ]
  },
  {
    id: 'm-eat-budget',
    title: 'Eat on a Budget',
    blurb: 'Feeding yourself is a daily skill here. Anything under $10 counts as surviving like a local.',
    rewardCents: 1000,
    objectives: [
      { id: 'cheap-meal', label: 'Eat a meal that cost under $10', done: (s) => s.cheapMeals >= 1, target: 1, progress: (s) => s.cheapMeals }
    ]
  },
  {
    id: 'm-find-place',
    title: 'Find a Place to Live',
    blurb: 'Hotels are for visitors. Compare the listings, do the rent math, and sign something.',
    rewardCents: 0,
    objectives: [
      { id: 'lease', label: 'Sign a lease on any apartment', done: (s) => Boolean(s.housing) }
    ]
  },
  {
    id: 'm-first-job',
    title: 'Your First Job',
    blurb: 'Rent does not pay itself. Find work anywhere that will have you, then show up.',
    rewardCents: 2000,
    objectives: [
      { id: 'hired', label: 'Get hired', done: (s) => Boolean(s.job) },
      { id: 'shift', label: 'Complete a full shift', done: (s) => s.shiftsWorked >= 1, target: 1, progress: (s) => s.shiftsWorked }
    ]
  },
  {
    id: 'm-explore',
    title: 'Explore the Neighborhood',
    blurb: 'New York rewards the curious. Six different spots, and you will know this town better than most locals.',
    rewardCents: 2500,
    objectives: [
      { id: 'places', label: 'Visit 6 different places', done: (s) => Object.keys(s.visitedPois).length >= 6, target: 6, progress: (s) => Object.keys(s.visitedPois).length }
    ]
  },
  {
    id: 'm-weekend',
    title: 'Plan Your Weekend',
    blurb: 'All budget and no play makes nobody. The park is free. So are the library, the arch and the Terminal.',
    rewardCents: 1500,
    objectives: [
      { id: 'leisure', label: 'Do 3 leisure activities', done: (s) => s.leisureVisits >= 3, target: 3, progress: (s) => s.leisureVisits }
    ]
  },
  {
    id: 'm-make-it',
    title: 'Make It in New York',
    blurb: 'The real test: a home, work, people who know your name — and savings left over.',
    rewardCents: 10000,
    objectives: [
      { id: 'housing', label: 'Keep a lease active', done: (s) => Boolean(s.housing) },
      { id: 'job', label: 'Hold a job', done: (s) => Boolean(s.job) },
      { id: 'people', label: 'Know 5 people', done: (s) => s.connections.length >= 5, target: 5, progress: (s) => s.connections.length },
      { id: 'savings', label: 'Save $5,000', done: (s) => s.moneyCents >= 500000, target: 500000, progress: (s) => Math.min(s.moneyCents, 500000) }
    ]
  }
];

// Counted from visit ids: attractions and the hotel count as leisure; groceries do not.
const LEISURE_PREFIX = 'att-';

export function createMissions({ state, bus, economy }) {
  let watching = false;

  function missionById(id) {
    return MISSIONS.find((m) => m.id === id) || null;
  }

  function completedSet() {
    return new Set(state.state.missionsCompleted);
  }

  function current() {
    if (!state.state.started || !trackable()) return null;
    const done = completedSet();
    return MISSIONS.find((m) => !done.has(m.id)) || null;
  }

  function trackable() {
    return state.state.started;
  }

  function status(mission) {
    return mission.objectives.map((o) => ({
      id: o.id,
      label: o.label,
      done: Boolean(o.done(state.state)),
      progress: o.progress ? o.progress(state.state) : 0,
      target: o.target || 1
    }));
  }

  function completeIfReady(mission) {
    if (!mission || completedSet().has(mission.id)) return false;
    const st = status(mission);
    if (!st.every((o) => o.done)) return false;
    state.completeMission(mission.id);
    if (mission.rewardCents > 0) economy.earn(mission.rewardCents, `Mission complete · ${mission.title}`);
    bus.emit('toast', { text: `Mission complete — ${mission.title}.${mission.rewardCents ? ` +${economy.format(mission.rewardCents)}` : ''}`, kind: 'ok' });
    const next = current();
    if (next) bus.emit('toast', { text: `New mission: ${next.title}`, kind: 'info' });
    bus.emit('missions-updated', { completed: mission.id });
    return true;
  }

  function check() {
    if (!trackable()) return;
    completeIfReady(current());
  }

  // Leisure counter: distinct attraction visits (park, zoo, library…).
  function refreshLeisure() {
    const leisure = Object.keys(state.state.visitedPois).filter((id) => id.startsWith(LEISURE_PREFIX)).length;
    if (leisure !== state.state.leisureVisits) {
      state.state.leisureVisits = leisure;
    }
  }

  // Cheap-meal counter is fed by the places module (bus event 'meal-eaten').
  bus.on('meal-eaten', ({ cents }) => {
    if (typeof cents === 'number' && cents < 1000) {
      state.state.cheapMeals = (state.state.cheapMeals || 0) + 1;
    }
  });
  bus.on('visit', refreshLeisure);
  bus.on('discover', refreshLeisure);

  if (!watching) {
    watching = true;
    // Progress arrives through many events; check() is idempotent and cheap, so simply watch all
    // of the ones that can flip an objective (the generic 'state' plus the counting events).
    for (const event of ['state', 'ride', 'meal', 'shift', 'meet', 'housing', 'job', 'discover', 'visit', 'meal-eaten', 'money']) {
      bus.on(event, check);
    }
  }

  return {
    missions: MISSIONS,
    missionById,
    current,
    status,
    trackable,

    // Journal view: everything with live status.
    journal() {
      const done = completedSet();
      return MISSIONS.map((m) => ({
        ...m,
        complete: done.has(m.id),
        active: false,
        objectives: status(m)
      }));
    }
  };
}
