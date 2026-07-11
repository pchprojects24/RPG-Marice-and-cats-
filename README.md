# Marice & Cats — The Great Treat Heist

A cozy Zelda-style 2D top-down **detective adventure**.

**The premise:** Marice was gone for twenty minutes. She came home to a crime scene — the treat jar knocked on its side, empty, a trail of crumbs... and all three cats mysteriously "hiding" in different corners of the house, each acting *very* innocent. Put on your detective coat and crack the case:

- **Alice** — *the Witness.* Saw everything from her cat tree. Bills by the Purrpop.
- **Olive** — *the Muscle.* Found under the treadmill at the scene of the crumbs. Claims she was "doing zoomies."
- **Beatrice** — *the Mastermind.* Currently disguised as a blanket. Will trade a full confession for a Shrimp & Salmon Feast.

Interrogate the suspects, follow the clues floor by floor, and deliver the only possible verdict: **guilty of being adorable** — sentenced to dinner on time and a lifetime of snuggles.

## How to run

- **Option 1:** Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge).
- **Option 2:** Serve the folder with a local server (e.g. `npx serve .` or `python -m http.server`) and open the URL in your browser.

## Controls

- **Keyboard:** WASD or Arrow keys to move (grid-based). **E** / **Space** / **Enter** to interact, pet a cat, or advance dialogue.
- **Helpful keys:** **H** for hint + objective ping, **Q** for the Case Log, **P** to pause.
- **Mobile:** Swipe/drag anywhere on the game to move (touch joystick), or use the on-screen D-pad. A quick **tap** on the screen interacts/pets — or use the **INTERACT** button. For the largest view, rotate to landscape.

## How to crack the case

1. Start outside. The front door code is hidden in the house plaque riddle.
2. Survey the kitchen crime scene, then interview **Alice** the witness on her cat tree. Her consulting fee: **Purrpops** from the kitchen cupboards.
3. Alice's tip leads to the **Basement Key** under the sofa blanket. The trail leads down.
4. Confront **Olive** under the treadmill — caught red-pawed in a pile of crumbs. Interrogation snacks (more Purrpops) make her talk.
5. Olive flips on the mastermind and hands over a **Laundry Basket** — use it to clear the staged laundry avalanche blocking the stairs.
6. Upstairs, the mastermind **Beatrice** ("I am a blanket") trades her full confession for a **Shrimp & Salmon Feast** from the kitchen.
7. Hear the confession, deliver the verdict, and enjoy the **Case Closed** ending — then hit **Keep Playing** to free-roam with your three convicted felons.

Every cat you win over **joins you and trails behind Marice** through the whole house. Walk up to one of your followers and press **INTERACT** (or tap) to **pet it** — purrs, hearts, and an affection counter tallied on the ending screen.

Optional side cases:

- Recover the heist crew's **stashed toy loot** — three "confiscated" toys (jingle ball, feather wand, laser pointer) hidden around the house from previous, unprosecuted crimes.
- Find the four pages of **Marice's diary** — one softly glowing page on each floor, each with a bit of backstory about how the girls came home.

Each cat also has her own **voice**: Alice's prim meow, Olive's excited double chirp, and Beatrice's low dramatic drawl.

## True-to-life details

- **Real time of day:** the front yard and garden follow your actual clock — cool morning light, bright noon, golden-hour evenings, and deep-blue nights when the porch lights glow and outdoor fixtures switch on. During the day the sun does the work and the fixtures stay off.
- **Wildlife by the clock:** birdsong outside during the day, crickets after dark.
- **Footsteps match the surface:** grass swishes, the porch deck knocks like wood, the walkway and basement click like concrete, and upstairs carpet muffles your steps.
- **Hungry cats call out:** a cat you haven't won over yet meows now and then on your floor (louder when you're close) with a little ♪ over her head — suspects getting impatient for their snack bribes.
- **Pet responsibly:** cats love pets, but pet the same girl too fast and she gets overstimulated — a playful nip and a tail flick, then she needs a moment before purring again.
- **Auto-pause:** switching apps or locking your phone pauses the game and silences audio.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set source to the branch that contains these files (e.g. `main`), root `/`.
4. Save. The site will be at `https://<username>.github.io/<repo>/`.

## Required assets

- **Portraits (optional):** For dialogue portraits, add 512×512 PNGs in `assets/portraits/`:
  - `marice_portrait_512.png`
  - `alice_portrait_512.png`
  - `olive_portrait_512.png`
  - `beatrice_portrait_512.png`
- **Ending:** The ending screen uses the same character portrait PNGs shown above.

If portrait files are missing, dialogue still works; the portrait area is hidden.

## Install on your phone

The game ships a web-app manifest, so you can **Add to Home Screen** (Safari share menu on iOS, Chrome menu on Android) and it launches fullscreen like a native app.

## Tech

- Vanilla JavaScript, HTML5 Canvas, CSS. No build step.
- **Fixed-timestep game loop** (60 logic updates/sec) — the game runs at the same speed on 60 Hz, 90 Hz, and 120 Hz displays.
- **Offscreen-canvas caching** for the static tile layer, minimap, and vignette — instead of procedurally redrawing ~300 tiles every frame, cutting CPU/battery use dramatically on phones.
- Save/load via `localStorage`. Settings (volume, screen shake, particles) persist.
- Script load order: `data/maps.js` → `data/dialogue.js` → `game-engine.js` → `game-main.js`.
