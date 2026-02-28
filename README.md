# Marice & Cats — House Adventure

A Zelda-style 2D top-down prototype. Find Alice, Olive, and Beatrice; feed the cats, explore the house, and get snuggles.

## How to run

- **Option 1:** Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge).
- **Option 2:** Serve the folder with a local server (e.g. `npx serve .` or `python -m http.server`) and open the URL in your browser.

## Controls

- **Keyboard:** WASD or Arrow keys to move (grid-based). **E** / **Space** / **Enter** to interact or advance dialogue.
- **Mobile:** On-screen D-pad to move; **INTERACT** button to interact or advance dialogue.

## How to play

1. Start outside. Check the house plaque for a hint, then enter the front door code to get inside.
2. Explore the main floor. Talk to **Alice** on her cat tree.
3. Find **Purrpops** in the kitchen cupboards and give them to Alice.
4. Alice hints about the **Basement Key** under the sofa blanket. Search the sofa, then unlock the basement door.
5. Find **Olive** under the treadmill in the basement. Give her Purrpops too.
6. Olive gives you a **Laundry Basket**. Use it on the blocked stairs on the main floor.
7. Go upstairs and find **Beatrice** under her blanket.
8. Get a **Shrimp & Salmon Feast** plate from the kitchen and give it to Beatrice.
9. Enjoy the ending.

Optional: find the three cat toys (jingle ball, feather wand, laser pointer) hidden around the house.

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
- **Ending:** `assets/portraits/snuggle_pile.svg` is included.

If portrait files are missing, dialogue still works; the portrait area is hidden.

## Tech

- Vanilla JavaScript, HTML5 Canvas, CSS. No build step.
- Save/load via `localStorage`. Settings (volume, screen shake, particles) persist.
- Script load order: `data/maps.js` → `data/dialogue.js` → `game-engine.js` → `game-main.js`.
