// js/economy.js
// Player wallet on top of game-state: a catalog of clearly-labeled example prices, guarded
// spending, a session ledger for the journal and the daily rent cycle. All money is integer
// cents internally; every price shown in the game flows through here so the numbers stay
// consistent. Prices are plausible 2025 New York examples for teaching purposes — they are not
// quotes, and rents in particular vary block by block.

const formatCents = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
};

// Example prices, last reviewed February 2026 against typical NYC ranges (OMNY fare $2.90 is the
// real MTA base fare). Labeled as examples in the UI.
export const FOOD_ITEMS = [
  { id: 'coffee', label: 'Drip coffee', sub: 'Corner deli · to go', cents: 350, need: { hunger: -6, energy: 12 }, kind: 'food' },
  { id: 'bagel', label: 'Bagel with cream cheese', sub: 'Corner deli · breakfast', cents: 375, need: { hunger: -28, energy: 10 }, kind: 'food' },
  { id: 'slice', label: 'Pizza slice', sub: '$1-language has retired, this is a plain cheese slice', cents: 425, need: { hunger: -30, energy: 8 }, kind: 'food' },
  { id: 'taco', label: 'Street tacos (2)', sub: 'Halal cart / taquería', cents: 500, need: { hunger: -34, energy: 8 }, kind: 'food' },
  { id: 'sandwich', label: 'Deli sandwich', sub: 'Chopped cheese territory', cents: 950, need: { hunger: -48, energy: 14 }, kind: 'food' },
  { id: 'burger', label: 'Burger & fries', sub: 'Diner sit-down', cents: 1275, need: { hunger: -60, energy: 18 }, kind: 'food' },
  { id: 'groceries', label: 'Bag of groceries', sub: 'Covers a couple of home meals', cents: 2850, need: { hunger: -85, energy: 15 }, kind: 'food' }
];

export function foodItem(id) {
  return FOOD_ITEMS.find((f) => f.id === id) || null;
}

export { formatCents };

export function createEconomy({ state, bus }) {
  const ledger = []; // session-only journal history (not persisted)

  function note(delta, label) {
    ledger.unshift({ day: state.state.clock.day, at: state.state.clock.minutes, delta, label, balance: state.moneyCents });
    if (ledger.length > 40) ledger.length = 40;
  }

  // Rent: charged once per in-game day if the mode pays rent and the player has housing.
  // Rent is allowed to push the balance negative — with warnings, then eviction (see missions).
  bus.on('newday', () => {
    const mode = state.state.mode;
    if (mode === 'tourist' || mode === 'freeroam') return;
    const housing = state.state.housing;
    if (!housing) return;
    const rent = housing.dailyRentCents;
    if (rent <= 0) return;
    const balance = state.adjustMoney(-rent, `Rent · ${housing.name}`);
    note(-rent, `Rent · ${housing.name}`);
    if (balance < 0) {
      state.state.evictionWarnings += 1;
      const left = 4 - state.state.evictionWarnings;
      if (left <= 0) {
        state.setHousing(null);
        state.state.evictionWarnings = 0;
        bus.emit('evicted', { name: housing.name });
        bus.emit('toast', { text: 'Evicted — you could not cover rent. Find a place you can afford.', kind: 'bad' });
      } else {
        bus.emit('toast', { text: `Balance is negative after rent. Eviction in ${left} day${left === 1 ? '' : 's'} if nothing changes.`, kind: 'warn' });
      }
    }
  });

  return {
    format: formatCents,
    get ledger() {
      return ledger;
    },

    // Returns true if the purchase happened. Never lets the balance go negative.
    spend(cents, label) {
      if (!Number.isFinite(cents) || cents <= 0) return false;
      if (state.state.moneyCents < cents) {
        bus.emit('toast', { text: `Not enough money — ${formatCents(cents)} needed for ${label || 'that'}.`, kind: 'warn' });
        return false;
      }
      state.adjustMoney(-Math.round(cents), label);
      note(-Math.round(cents), label);
      return true;
    },

    earn(cents, label) {
      if (!Number.isFinite(cents) || cents <= 0) return false;
      state.adjustMoney(Math.round(cents), label);
      note(Math.round(cents), label);
      return true;
    },

    canAfford(cents) {
      return state.state.moneyCents >= cents;
    }
  };
}
