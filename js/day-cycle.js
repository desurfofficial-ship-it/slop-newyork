// js/day-cycle.js
// A live in-game day: the game clock advances in real time (1 real second ≈ 1 game minute) and
// the four existing lighting presets (golden / midday / twilight / midnight, see lighting.js)
// are applied automatically as the hour changes. Choosing a preset by hand pauses the cycle;
// the "Live" switch resumes it. Weather is not simulated — only the light changes.

const PRESET_BY_HOUR = [
  { from: 5, preset: 'golden' }, // dawn / early morning light
  { from: 10, preset: 'midday' }, // full sun
  { from: 17, preset: 'twilight' }, // blue hour
  { from: 20.5, preset: 'midnight' } // night
];

export function presetForMinutes(minutes) {
  const hours = (minutes / 60) % 24;
  let preset = PRESET_BY_HOUR[PRESET_BY_HOUR.length - 1].preset;
  for (const range of PRESET_BY_HOUR) {
    if (hours >= range.from) preset = range.preset;
  }
  return preset;
}

const formatClock = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${ampm}`;
};

export { formatClock };

export function createDayCycle({ state, applyPreset, onAutoChange }) {
  let auto = state.settings.autoTime;
  let appliedPreset = null;
  let clockAccumulator = 0; // fractional game minutes; 1 real second = 1 game minute

  function syncPreset(force = false) {
    const wanted = presetForMinutes(state.clock.minutes);
    if (force || wanted !== appliedPreset) {
      appliedPreset = wanted;
      applyPreset(wanted);
    }
  }

  return {
    get auto() {
      return auto;
    },
    get preset() {
      return appliedPreset;
    },

    setAuto(on) {
      auto = on === true;
      state.setSetting('autoTime', auto);
      if (auto) syncPreset(true);
      if (onAutoChange) onAutoChange(auto);
    },

    // A hand-picked preset pauses the live cycle (the player owns the light until they resume).
    setManual(presetId) {
      auto = false;
      if (state.settings.autoTime) state.setSetting('autoTime', false);
      appliedPreset = presetId;
      if (onAutoChange) onAutoChange(false);
    },

    // dt: real seconds. Only the started session advances the city clock.
    update(dt, started) {
      if (started && auto) {
        const speed = state.settings.clockSpeed === 2 ? 2 : state.settings.clockSpeed === 4 ? 4 : 1;
        clockAccumulator += dt * speed;
        if (clockAccumulator >= 0.5) {
          const minutes = Math.floor(clockAccumulator);
          clockAccumulator -= minutes;
          state.advanceMinutes(minutes);
        }
        syncPreset();
      }
    },

    // After loading a save or sleeping, re-align the light with the clock.
    refresh() {
      syncPreset(true);
    }
  };
}
