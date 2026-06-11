# Marice & Cats — House Adventure

A Zelda-style 2D top-down prototype. Find Alice, Olive, and Beatrice; feed the cats, explore the house, and get snuggles.

## How to run

- **Option 1:** Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge).
- **Option 2:** Serve the folder with a local server (e.g. `npx serve .` or `python -m http.server`) and open the URL in your browser.

## Controls

- **Keyboard:** WASD or Arrow keys to move (grid-based). **E** / **Space** / **Enter** to interact, pet a cat, or advance dialogue.
- **Helpful keys:** **H** for hint + objective ping, **Q** for Quest Log, **P** to pause.
- **Mobile:** Swipe/drag anywhere on the game to move (touch joystick), or use the on-screen D-pad. A quick **tap** on the screen interacts/pets — or use the **INTERACT** button. For the largest view, rotate to landscape.

## How to play

1. Start outside. Check the house plaque for a hint, then enter the front door code to get inside.
2. Explore the main floor. Talk to **Alice** on her cat tree.
3. Find **Purrpops** in the kitchen cupboards and give them to Alice.
4. Alice hints about the **Basement Key** under the sofa blanket. Search the sofa, then unlock the basement door.
5. Find **Olive** under the treadmill in the basement. Give her Purrpops too.
6. Olive gives you a **Laundry Basket**. Use it on the blocked stairs on the main floor.
7. Go upstairs and find **Beatrice** under her blanket.
8. Get a **Shrimp & Salmon Feast** plate from the kitchen and give it to Beatrice.
9. Enjoy the ending — then hit **Keep Playing** to free-roam.

Every cat you feed **joins you and trails behind Marice** through the whole house. Walk up to one of your followers and press **INTERACT** (or tap) to **pet it** — purrs, hearts, and an affection counter that's tallied on the ending screen.

Optional side quests:

- Find the three **cat toys** (jingle ball, feather wand, laser pointer) hidden around the house.
- Recover the four pages of **Marice's diary** — one softly glowing page on each floor, each with a bit of backstory about how the girls came home.

Each cat also has her own **voice**: Alice's prim meow, Olive's excited double chirp, and Beatrice's low dramatic drawl.

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

## Tech

- Vanilla JavaScript, HTML5 Canvas, CSS. No build step.
- Save/load via `localStorage`. Settings (volume, screen shake, particles) persist.
- Script load order: `data/maps.js` → `data/dialogue.js` → `game-engine.js` → `game-main.js`.
