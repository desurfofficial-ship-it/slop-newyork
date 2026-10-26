# Slop New York — City Life Simulator

A New York City **life simulator** built on top of [mrdoob's Slop New York](https://github.com/mrdoob/slop-newyork/) — a photorealistic Manhattan built with [three.js](https://threejs.org/), WebGPURenderer and TSL.

You arrive in New York with a wallet, a clock and no idea where anything is. Learn the subway, eat on a budget, find an apartment, get a job, meet New Yorkers, and make it in the city.

> The original game — exploring Manhattan on foot, by yellow cab, by bicycle or by helicopter with 11 cinematic cameras — is fully preserved. Everything in this README under "Life simulation" is layered on top of it without changing how it plays.

## Run it

No build step, no dependencies — plain ES modules:

```bash
# any static file server works; python is preinstalled almost everywhere
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open the GitHub Pages deployment if you forked with Pages enabled. A WebGPU-capable browser (Chrome/Edge 121+) gives the full visual experience; the game falls back to WebGL2 automatically elsewhere.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move / steer (per-mode, see the in-game hint bar) |
| `1 2 3 4` | Walk · Drive · Cycle · Fly |
| `E` | Interact — food spots, apartments, workplaces, subway entrances, people |
| `J` | Journal — missions, wallet ledger, city record |
| `M` | Full street atlas (searchable; includes subway stations) |
| `V` / `5–0` | Cycle / pick cameras |
| `H` | Hide the HUD |
| `N` / `B` | Mute · horn |

Touch controls (joystick + tappable prompts) and gamepads are supported as before.

## Life simulation

**Arrival.** Choose how you arrive — Penn Station, Port Authority, or a taxi from JFK — and who you are: Tourist, New Resident, Career, or Free Roam. Each mode changes your starting money and whether rent applies.

**Economy.** Everything costs plausible example dollars (reviewed February 2026 against typical NYC ranges; the $2.90 OMNY fare is real). A coffee is $3.50, a slice $4.25, a Harlem studio lists at $1,850/month — charged as prorated rent every in-game day. Rent you can't pay brings warnings, then eviction. Work shifts to earn; tips happen.

**Subway.** 62 stations across the 1/2/3, 4/5/6, 7, N/Q/R/W, A/C/E, B/D/F/M, L and the Times Square–Grand Central shuttle, at their real locations inside the simulated area. Tap in, see the route plan (including transfers), ride — the trip takes game time and drops you at the real exit. Station entrances are the green-globe stairs on the sidewalks.

**A living day.** The city clock advances in real time (1 real second ≈ 1 game minute) and the lighting follows the hour — golden mornings, midday, blue hour, night — or pick any preset manually to pause the cycle.

**People.** Sixteen fictional New Yorkers stand at real corners with things worth hearing — schedule-aware lines and local tips that carry the real facts a visitor needs (fare capping, how the grid works, where the free stuff is). Chatting builds your circle.

**Missions.** Eight, in a sensible order: Your First Day → Get Around → Eat on a Budget → Find a Place to Live → Your First Job → Explore the Neighborhood → Plan Your Weekend → Make It in New York. Progress is tracked live; rewards land in the wallet.

**Sleep, hunger, energy.** Meals and rest matter, gently. Sleep until 07:00 at the newcomer hotel (or your own place once you lease one) and the day resets with you restored.

**Saving.** Your life auto-saves to this browser (`nyc-life-save`) every 12 seconds and when you leave; your position saves as before (`nyc-player-state`). The Continue button on the title screen picks up exactly where you left off. Corrupt or unavailable storage never blocks playing.

## What's real and what's simulated

- **Real (simplified):** street geography at 1:1 scale from NYC Open Data & OpenStreetMap; subway station names, lines and locations; OMNY base fare; the avenue/street grid.
- **Example prices:** all food, rents, wages and attraction tickets are plausible 2026 figures for teaching purposes, not quotes. Rents especially vary block by block.
- **Fictional:** every business, employer, landlord, NPC and the hotel. No real schedule data — ride times are a game model, not MTA information.
- **Out of scope:** areas outside ~125th St → Battery are scenery (Brooklyn is visible but not walkable/station-served in this model), and weather is not simulated — only the light changes.

## Testing

```bash
node --test tests/*.test.cjs   # 146 tests
```

The suite includes all original engine tests (geometry, traffic, cameras, teleports, boot integrity) plus new coverage: save sanitation, economy guardrails, rent/eviction, every subway entrance validated against the real street grid, route planning, mission chain, NPC facts, and a stubbed-DOM integration test that walks the entire golden path (welcome → arrive → check in → eat → ride → sleep → save → load) through the production modules.

## Repository

- Original game and architecture: [mrdoob/slop-newyork](https://github.com/mrdoob/slop-newyork/) (MIT). Geographic data: NYC Open Data, © OpenStreetMap contributors (ODbL).
- Life-simulation modules (this fork): `js/game-state.js`, `js/economy.js`, `js/day-cycle.js`, `js/subway.js`, `js/places.js`, `js/npcs.js`, `js/missions.js`, `js/life-ui.js`, `js/life.js` — plain ES modules, no new dependencies, no build step.

## Known limitations & next steps

- Ride times are heuristic (capped at 24 game minutes); no express/local modeling.
- Job progression is one level deep by design; quitting a job is not yet possible.
- Brooklyn/Queens are visual scenery; crossing bridges on foot is not supported by the street network.
- No weather; the four lighting presets are the palette.
- Recommended next: cooking at home from groceries, weekly OMNY fare capping, more NPC routines tied to the day cycle, and a map layer for apartment listings.
