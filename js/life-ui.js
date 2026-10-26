// js/life-ui.js
// The life-simulation UI: wallet/needs/clock panel, mission chip, interaction prompt, the place &
// people panel, subway ride overlay, toasts, journal and the arrival/welcome screen.
//
// This module only renders and reports clicks — all game logic lives in life.js and the systems
// under js/. Rendering follows the repo's safe DOM conventions (textContent / classList /
// createElement, no innerHTML) and reuses the existing panel/popover design language.

import { isTypingInField } from './city-config.js';

const fmt = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
};

const el = (id) => document.getElementById(id);
const needClass = (v) => (v < 25 ? 'is-low' : v < 55 ? 'is-mid' : '');

export function createLifeUI({ economy, missions, subway, handlers }) {
  const refs = {
    hud: el('life-hud'),
    money: el('life-money'),
    rent: el('life-rent'),
    energy: el('need-energy'),
    hunger: el('need-hunger'),
    day: el('life-day'),
    clock: el('life-clock'),
    mission: el('life-mission'),
    missionTitle: el('life-mission-title'),
    missionSub: el('life-mission-sub'),
    prompt: el('life-prompt'),
    promptText: el('life-prompt-text'),
    place: el('life-place'),
    placeTitle: el('life-place-title'),
    placeSub: el('life-place-sub'),
    placeBlurb: el('life-place-blurb'),
    placeActions: el('life-place-actions'),
    placeClose: el('life-place-close'),
    placeBullet: el('life-place-bullet'),
    travel: el('life-travel'),
    travelBullet: el('life-travel-bullet'),
    travelTitle: el('life-travel-title'),
    travelFill: el('life-travel-fill'),
    travelSub: el('life-travel-sub'),
    toasts: el('life-toasts'),
    journal: el('life-journal'),
    journalBody: el('life-journal-body'),
    journalClose: el('life-journal-close'),
    welcome: el('life-welcome'),
    welcomeChoices: el('welcome-choices'),
    welcomeSetup: el('welcome-setup'),
    welcomeContinue: el('welcome-continue'),
    welcomeNew: el('welcome-new'),
    welcomeRoam: el('welcome-roam'),
    welcomeArrivals: el('welcome-arrivals'),
    welcomeModes: el('welcome-modes'),
    welcomeStart: el('welcome-start'),
    welcomeBack: el('welcome-back'),
    autoBtn: el('time-auto')
  };

  let journalTab = 'missions';
  let promptTarget = null; // { kind: 'place'|'npc'|'station', ... }

  // --- HUD ------------------------------------------------------------------

  function refreshHUD() {
    const s = handlers.getState();
    if (!s) return;
    if (refs.money) {
      refs.money.textContent = fmt(s.moneyCents);
      refs.money.classList.toggle('is-low-balance', s.moneyCents < 5000);
    }
    if (refs.rent) {
      const showRent = s.housing && s.mode !== 'tourist' && s.mode !== 'freeroam';
      refs.rent.hidden = !showRent;
      if (showRent) refs.rent.textContent = `rent ${fmt(s.housing.dailyRentCents)}/day`;
    }
    if (refs.energy) {
      refs.energy.style.transform = `scaleX(${Math.max(0, Math.min(1, s.needs.energy / 100))})`;
      refs.energy.className = `need-fill ${needClass(s.needs.energy)}`;
    }
    if (refs.hunger) {
      refs.hunger.style.transform = `scaleX(${Math.max(0, Math.min(1, s.needs.hunger / 100))})`;
      refs.hunger.className = `need-fill need-hunger ${needClass(s.needs.hunger)}`;
    }
    if (refs.day) refs.day.textContent = `Day ${s.clock.day}`;
  }

  const CLOCK_FMT = (minutes) => {
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    const h24 = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    return `${h24 % 12 === 0 ? 12 : h24 % 12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
  };

  function refreshClock(minutes) {
    if (refs.clock) refs.clock.textContent = CLOCK_FMT(minutes);
  }

  function flashMoney(delta) {
    if (!refs.money || !delta) return;
    refs.money.classList.add(delta > 0 ? 'is-earning' : 'is-spending');
    clearTimeout(flashMoney.t);
    flashMoney.t = setTimeout(() => refs.money.classList.remove('is-earning', 'is-spending'), 550);
  }

  // --- Mission chip -----------------------------------------------------------

  function refreshMission() {
    const active = missions.current();
    if (!refs.mission) return;
    refs.mission.classList.toggle('hidden', !active);
    if (!active) return;
    refs.missionTitle.textContent = active.title;
    const st = missions.status(active);
    const left = st.filter((o) => !o.done).length;
    const next = st.find((o) => !o.done);
    refs.missionSub.textContent = next ? (next.target > 1 ? `${next.label} · ${Math.min(next.progress, next.target)}/${next.target}` : next.label) : 'Ready to complete…';
    refs.mission.classList.toggle('is-complete', left === 0);
  }

  // --- Prompt ------------------------------------------------------------------

  function setPrompt(candidate) {
    promptTarget = candidate;
    if (!refs.prompt) return;
    if (!candidate) {
      refs.prompt.classList.add('hidden');
      return;
    }
    refs.prompt.classList.remove('hidden');
    refs.promptText.textContent = candidate.label;
  }

  function promptAction() {
    if (!promptTarget) return;
    if (promptTarget.kind === 'place') handlers.openPlace(promptTarget.place);
    else if (promptTarget.kind === 'npc') handlers.openNpc(promptTarget.npc);
    else if (promptTarget.kind === 'station') handlers.openStation(promptTarget.station);
  }

  // --- Place / NPC / station panel ------------------------------------------------

  function bulletFor(lines) {
    const bullet = refs.placeBullet;
    if (!bullet) return;
    if (!lines || !lines.length) {
      bullet.hidden = true;
      return;
    }
    bullet.hidden = false;
    bullet.textContent = lines[0];
    const color = subway.colorFor(lines[0]);
    bullet.style.background = color;
    bullet.classList.toggle('is-light', color === '#FCCC0A' || color === '#A7A9AC');
  }

  function lineBulletEl(line) {
    const span = document.createElement('span');
    span.className = 'line-bullet';
    const color = subway.colorFor(line);
    span.style.background = color;
    span.classList.toggle('is-light', color === '#FCCC0A' || color === '#A7A9AC');
    span.textContent = line;
    return span;
  }

  function openPlacePanel({ title, sub, blurb, lines, actions, searchable }) {
    refs.placeTitle.textContent = title;
    refs.placeSub.textContent = sub || '';
    refs.placeBlurb.textContent = blurb || '';
    bulletFor(lines);
    const list = refs.placeActions;
    list.replaceChildren();
    let searchInput = null;
    if (searchable) {
      const wrap = document.createElement('div');
      wrap.className = 'life-station-search';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon');
      icon.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#i-search');
      icon.appendChild(use);
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search stations…';
      searchInput.setAttribute('aria-label', 'Search stations');
      searchInput.autocomplete = 'off';
      searchInput.spellcheck = false;
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        list.querySelectorAll('.pop-item').forEach((b) => {
          b.hidden = q.length > 0 && !b.dataset.search.includes(q);
        });
      });
      wrap.append(icon, searchInput);
      list.appendChild(wrap);
    }
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pop-item${action.disabled ? ' is-disabled' : ''}`;
      btn.dataset.search = `${title} ${action.label} ${action.sub || ''}`.toLowerCase();
      const name = document.createElement('span');
      name.className = 'pop-name';
      name.textContent = action.label;
      btn.appendChild(name);
      if (action.bullets) {
        const bl = document.createElement('span');
        for (const line of action.bullets.slice(0, 5)) bl.appendChild(lineBulletEl(line));
        bl.style.display = 'flex';
        bl.style.gap = '3px';
        btn.appendChild(bl);
      }
      if (action.price) {
        const price = document.createElement('span');
        price.className = 'pop-price';
        price.textContent = action.price;
        btn.appendChild(price);
      } else if (action.sub) {
        const subEl = document.createElement('span');
        subEl.className = 'pop-sub';
        subEl.textContent = action.sub;
        btn.appendChild(subEl);
      }
      if (!action.disabled) btn.addEventListener('click', () => action.run());
      list.appendChild(btn);
    }
    if (supportsPopover()) refs.place.showPopover();
    if (searchInput) searchInput.focus();
  }

  function closePlacePanel() {
    if (supportsPopover() && refs.place.matches(':popover-open')) refs.place.hidePopover();
  }

  // --- Journal ----------------------------------------------------------------

  function openJournal() {
    renderJournal();
    if (supportsPopover() && !refs.journal.matches(':popover-open')) refs.journal.showPopover();
  }

  function closeJournal() {
    if (supportsPopover() && refs.journal.matches(':popover-open')) refs.journal.hidePopover();
  }

  function renderJournal() {
    const body = refs.journalBody;
    if (!body) return;
    body.replaceChildren();
    if (journalTab === 'missions') renderMissionsTab(body);
    else if (journalTab === 'wallet') renderWalletTab(body);
    else renderCityTab(body);
  }

  function checkIcon(done) {
    const span = document.createElement('span');
    span.className = 'j-check';
    if (done) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#i-check');
      svg.appendChild(use);
      span.appendChild(svg);
    }
    return span;
  }

  function renderMissionsTab(body) {
    const s = handlers.getState();
    for (const m of missions.journal()) {
      const row = document.createElement('div');
      row.className = `j-mission${m.complete ? ' is-done' : ''}${missions.current()?.id === m.id ? ' is-active' : ''}`;
      const title = document.createElement('div');
      title.className = 'j-mission-title';
      title.appendChild(checkIcon(m.complete));
      const t = document.createElement('span');
      t.textContent = m.title;
      title.appendChild(t);
      if (m.rewardCents) {
        const rw = document.createElement('span');
        rw.className = 'j-mission-reward';
        rw.textContent = `+${fmt(m.rewardCents)}`;
        title.appendChild(rw);
      }
      row.appendChild(title);
      if (!m.complete) {
        const blurb = document.createElement('p');
        blurb.className = 'j-mission-blurb';
        blurb.textContent = m.blurb;
        row.appendChild(blurb);
        for (const o of m.objectives) {
          const obj = document.createElement('div');
          obj.className = `j-objective${o.done ? ' done' : ''}`;
          obj.appendChild(checkIcon(o.done));
          const label = document.createElement('span');
          label.textContent = o.label;
          obj.appendChild(label);
          if (o.target > 1 && !o.done) {
            const prog = document.createElement('span');
            prog.className = 'j-progress';
            prog.textContent = `${Math.min(o.progress, o.target)}/${o.target}`;
            obj.appendChild(prog);
          }
          row.appendChild(obj);
        }
      }
      body.appendChild(row);
    }
    if (s && s.missionsCompleted.length === 8) {
      const note = document.createElement('p');
      note.className = 'j-note';
      note.textContent = 'All eight done. New York is yours — the city keeps going.';
      body.appendChild(note);
    }
  }

  function renderWalletTab(body) {
    const s = handlers.getState();
    const bal = document.createElement('div');
    bal.className = 'j-row';
    const label = document.createElement('span');
    label.textContent = 'Balance';
    const value = document.createElement('span');
    value.className = 'j-value';
    value.textContent = fmt(s.moneyCents);
    bal.append(label, value);
    body.appendChild(bal);

    if (s.housing) {
      const rent = document.createElement('div');
      rent.className = 'j-row';
      const rl = document.createElement('span');
      rl.textContent = `Rent · ${s.housing.name}`;
      const rv = document.createElement('span');
      rv.className = 'j-value';
      rv.textContent = `${fmt(s.housing.dailyRentCents)}/day`;
      rent.append(rl, rv);
      body.appendChild(rent);
    }
    if (s.job) {
      const job = document.createElement('div');
      job.className = 'j-row';
      const jl = document.createElement('span');
      jl.textContent = `Job · ${s.job.title} (${s.job.employer})`;
      const jv = document.createElement('span');
      jv.className = 'j-value';
      jv.textContent = `~${fmt(s.job.shiftPayCents)}/shift`;
      job.append(jl, jv);
      body.appendChild(job);
    }

    const ledgerTitle = document.createElement('div');
    ledgerTitle.className = 'welcome-step-label';
    ledgerTitle.style.margin = '12px 0 2px';
    ledgerTitle.textContent = 'Recent money moves';
    body.appendChild(ledgerTitle);
    const ledger = economy.ledger.slice(0, 12);
    if (!ledger.length) {
      const empty = document.createElement('div');
      empty.className = 'j-row';
      empty.textContent = 'Nothing yet — buy a coffee, make a name.';
      body.appendChild(empty);
    }
    for (const entry of ledger) {
      const row = document.createElement('div');
      row.className = 'j-row';
      const l = document.createElement('span');
      l.textContent = entry.label;
      const v = document.createElement('span');
      v.className = `j-value ${entry.delta > 0 ? 'pos' : 'neg'}`;
      v.textContent = `${entry.delta > 0 ? '+' : ''}${fmt(entry.delta)}`;
      row.append(l, v);
      body.appendChild(row);
    }
    const note = document.createElement('p');
    note.className = 'j-note';
    note.textContent = 'Example prices, reviewed February 2026 against typical New York ranges — not quotes. Rent is prorated daily from a monthly listing price.';
    body.appendChild(note);
  }

  function renderCityTab(body) {
    const s = handlers.getState();
    const grid = document.createElement('div');
    grid.className = 'j-stat-grid';
    const stat = (num, label) => {
      const box = document.createElement('div');
      box.className = 'j-stat';
      const n = document.createElement('div');
      n.className = 'j-stat-num';
      n.textContent = num;
      const l = document.createElement('div');
      l.className = 'j-stat-label';
      l.textContent = label;
      box.append(n, l);
      grid.appendChild(box);
    };
    const totalPlaces = placesCount();
    stat(`${Object.keys(s.visitedPois).length}/${totalPlaces}`, 'Places discovered');
    stat(`${s.discovered.stations.length}/${subway.stations.length}`, 'Subway stations found');
    stat(String(s.connections.length), 'People you know');
    stat(String(s.subwayRides), 'Subway rides');
    stat(String(s.mealsEaten), 'Meals eaten');
    stat(String(s.shiftsWorked), 'Shifts worked');
    stat(String(s.clock.day), 'Days in the city');
    stat(fmt(s.moneyCents), 'Current balance');
    body.appendChild(grid);
    const note = document.createElement('p');
    note.className = 'j-note';
    note.textContent = 'The simulation covers Manhattan from ~125th St to the Battery. People and businesses are fictional; transit geography and fares follow the real system in simplified form.';
    body.appendChild(note);
  }

  let placesCountCache = 0;
  function placesCount() {
    return placesCountCache || subway.stations.length;
  }

  // --- Toasts ------------------------------------------------------------------

  function toast(text, kind = 'info') {
    if (!refs.toasts) return;
    const t = document.createElement('div');
    t.className = `life-toast kind-${kind}`;
    t.textContent = text;
    refs.toasts.appendChild(t);
    while (refs.toasts.children.length > 3) refs.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('is-leaving'), 3600);
    setTimeout(() => t.remove(), 4000);
  }

  // --- Travel overlay ------------------------------------------------------------

  function showTravel({ line, title, sub }) {
    if (!refs.travel) return;
    refs.travelBullet.textContent = line || 'NY';
    refs.travelBullet.style.background = subway.colorFor(line) || 'var(--taxi)';
    refs.travelBullet.classList.toggle('is-light', line === 'N' || line === 'Q' || line === 'R' || line === 'W' || line === 'L');
    refs.travelTitle.textContent = title;
    refs.travelSub.textContent = sub || '';
    refs.travelFill.style.transform = 'scaleX(0)';
    refs.travel.classList.remove('hidden');
  }

  function travelProgress(p) {
    if (refs.travelFill) refs.travelFill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
  }

  function hideTravel() {
    if (refs.travel) refs.travel.classList.add('hidden');
  }

  // --- Welcome ---------------------------------------------------------------------

  function showWelcome({ hasSave }) {
    if (!refs.welcome) return;
    refs.welcomeContinue.hidden = !hasSave;
    refs.welcomeChoices.hidden = false;
    refs.welcomeSetup.hidden = true;
    refs.welcome.classList.remove('hidden');
  }

  function hideWelcome() {
    if (refs.welcome) refs.welcome.classList.add('hidden');
  }

  function showWelcomeSetup() {
    refs.welcomeChoices.hidden = true;
    refs.welcomeSetup.hidden = false;
    renderWelcomeOptions();
  }

  function renderWelcomeOptions() {
    // Arrivals
    refs.welcomeArrivals.replaceChildren();
    for (const a of handlers.getArrivals()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pop-item';
      const name = document.createElement('span');
      name.className = 'pop-name';
      name.textContent = a.label;
      const sub = document.createElement('span');
      sub.className = 'pop-sub';
      sub.textContent = a.sub;
      btn.append(name, sub);
      btn.dataset.arrival = a.id;
      btn.addEventListener('click', () => {
        welcomePick.arrival = a.id;
        syncWelcomeSelection();
      });
      refs.welcomeArrivals.appendChild(btn);
    }
    // Modes
    refs.welcomeModes.replaceChildren();
    for (const m of handlers.getModes()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pop-item';
      const name = document.createElement('span');
      name.className = 'pop-name';
      name.textContent = m.label;
      const sub = document.createElement('span');
      sub.className = 'pop-sub';
      sub.textContent = m.blurb;
      btn.append(name, sub);
      btn.dataset.mode = m.id;
      btn.addEventListener('click', () => {
        welcomePick.mode = m.id;
        syncWelcomeSelection();
      });
      refs.welcomeModes.appendChild(btn);
    }
    syncWelcomeSelection();
  }

  const welcomePick = { arrival: null, mode: null };

  function syncWelcomeSelection() {
    const mark = (container, attr, value) => {
      container.querySelectorAll('.pop-item').forEach((b) => {
        b.classList.toggle('active', b.dataset[attr] === value);
      });
    };
    mark(refs.welcomeArrivals, 'arrival', welcomePick.arrival);
    mark(refs.welcomeModes, 'mode', welcomePick.mode);
    refs.welcomeStart.disabled = !(welcomePick.arrival && welcomePick.mode);
  }

  function welcomeIntro(arrival) {
    // A one-panel intro shown right after arriving (uses the place panel for visual continuity).
    openPlacePanel({
      title: `Welcome to New York`,
      sub: arrival.label,
      blurb: `${arrival.intro} ${arrival.fareNote}`,
      lines: null,
      actions: [{
        label: 'Out into the city',
        sub: 'Press E near anything that glows to interact',
        run() {
          closePlacePanel();
        }
      }]
    });
  }

  // --- Wiring ---------------------------------------------------------------------

  function supportsPopover() {
    return typeof HTMLElement.prototype.showPopover === 'function';
  }

  function isAnyPanelOpen() {
    const pop = supportsPopover();
    return (pop && refs.place.matches(':popover-open')) ||
      (pop && refs.journal.matches(':popover-open')) ||
      (refs.welcome && !refs.welcome.classList.contains('hidden')) ||
      (refs.travel && !refs.travel.classList.contains('hidden'));
  }

  function isJournalOpen() {
    return supportsPopover() && refs.journal.matches(':popover-open');
  }

  function wire() {
    if (refs.prompt) refs.prompt.addEventListener('click', promptAction);
    if (refs.placeClose) refs.placeClose.addEventListener('click', closePlacePanel);
    if (refs.journalClose) refs.journalClose.addEventListener('click', closeJournal);
    if (refs.welcomeContinue) refs.welcomeContinue.addEventListener('click', () => handlers.onWelcomeContinue());
    if (refs.welcomeNew) refs.welcomeNew.addEventListener('click', showWelcomeSetup);
    if (refs.welcomeRoam) refs.welcomeRoam.addEventListener('click', () => handlers.onWelcomeRoam());
    if (refs.welcomeBack) refs.welcomeBack.addEventListener('click', () => {
      refs.welcomeSetup.hidden = true;
      refs.welcomeChoices.hidden = false;
    });
    if (refs.welcomeStart) refs.welcomeStart.addEventListener('click', () => {
      if (welcomePick.arrival && welcomePick.mode) handlers.onWelcomeStart(welcomePick.mode, welcomePick.arrival);
    });
    // The journal opens from the mission chip's native popovertarget too — render on open.
    if (refs.journal) {
      refs.journal.addEventListener('beforetoggle', (e) => {
        if (e.newState === 'open') renderJournal();
      });
    }
    document.querySelectorAll('.life-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        journalTab = tab.dataset.tab;
        document.querySelectorAll('.life-tab').forEach((t) => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        renderJournal();
      });
    });

    // Interaction keys. Typing into the map search must not trigger them.
    window.addEventListener('keydown', (e) => {
      if (isTypingInField(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyE' && !e.repeat) {
        if (isAnyPanelOpen() || (handlers.isMapOpen && handlers.isMapOpen())) return;
        promptAction();
      } else if (e.code === 'KeyJ' && !e.repeat) {
        if (isJournalOpen()) closeJournal();
        else if (!isAnyPanelOpen()) openJournal();
      }
    });
  }

  wire();

  return {
    refreshHUD,
    refreshClock,
    refreshMission,
    flashMoney,
    setPrompt,
    openPlacePanel,
    closePlacePanel,
    openJournal,
    closeJournal,
    toast,
    showTravel,
    travelProgress,
    hideTravel,
    showWelcome,
    hideWelcome,
    showWelcomeSetup,
    welcomeIntro,
    isAnyPanelOpen,
    isJournalOpen,
    lineBulletEl,
    setPlacesCount: (n) => { placesCountCache = n; }
  };
}
