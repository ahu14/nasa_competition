# NOVA — Mars Outpost

A playable pixel-art Mars exploration game, built to match the supplied reference. No libraries, API keys, installation, or build step are needed.

Open `dist/index.html` in a browser, or run:

```sh
node scripts/serve.mjs
```

Then visit **http://localhost:4173**.

The homepage uses the supplied **Mars Mission Menu_ How to Play.svg** artwork. Choose **Start** to enter or continue your expedition. **Settings** saves your sound and camera zoom preferences; **How to Play** explains the controls and mission. The game loads after Start, so waiting on the homepage uses no suit resources. Your saved expedition is preserved. The game itself is at `game.html`.

The game fills the browser window with no header, footer, frame, or page margins. Sound, help, pause, and mission controls float over the map. Press **Esc** or use the pause button to return to the main menu. The expand button enters browser fullscreen while keeping dialogs and controls available.

Use **WASD / arrow keys** to walk, **Shift** to move faster, **E / Space** to interact, **M** for your mission log, **H** for the field guide, and **Esc** to pause. Click or tap a place to walk there automatically. Touch movement buttons are available on phones.

The camera follows your astronaut through an open world. Terrain generates as you explore in any direction, with rocks, ice deposits, craters, and desert regions beyond the original outpost. **Scroll / + / −** to zoom. The surface scanner shows nearby terrain and your direction, and marks home in green. Press **B** or use the home button to return to base immediately. Your saved position can be anywhere in the world.

Restore the solar panels, start the greenhouse, collect ice, transmit your report from the habitat, and return to the landing pad to finish. The rover and flag have optional discoveries. Progress saves locally on the current device. Start a fresh expedition from the pause menu.

All seven stations are separated by at least 1,800 world units (about one and a half screen widths at the default zoom). Each has its own buildings, collision area, and road entrance. Follow the roads or click the gold direction-and-distance marker to walk to the next mission. The station scanner automatically fits all stations so you can find them across the world. Home recall and oxygen rescue return you to the habitat.

`dist/index.html`, `dist/home.js`, and `dist/menu.css` provide the homepage. `dist/game.html` hosts the game. `dist/core.js` contains terrain generation, navigation, collision, mission rules, and save validation. `dist/world.js` renders terrain as needed, with bounded caches for continuous exploration. `dist/character.js` loads and draws the supplied astronaut SVG animations. `dist/game.js` contains the camera, input, audio, and UI. `dist/style.css` contains the responsive game interface.

Run the simulation checks with `node --test tests/game.test.cjs`.

The outpost artwork at `dist/assets/mars-outpost.png` was created using the built-in image generation tool, using the user's image as a style and layout reference. The final prompt is recorded in `ASSET-PROMPT.md`. The world renderer uses its buildings and scenery as sprites over generated terrain.

The character uses the five user-supplied SVGs, with four walk frames per direction and the supplied idle pose. See `dist/assets/astronaut/README.md` for the source mapping. Prepared frames remain native SVGs with transparent backgrounds and a consistent size. Walking stops when the character stops, retains its facing direction, and animates faster while sprinting.
