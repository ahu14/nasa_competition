# NOVA — Mars Outpost

A playable pixel-art Mars exploration game, built to match the supplied reference. No libraries, API keys, installation, or build step are needed.

Open `dist/index.html` in a browser, or run:

```sh
node scripts/serve.mjs
```

Then visit **http://localhost:4173**.

The homepage uses the supplied **Mars Mission Menu_ How to Play.svg** artwork. Choose **Start** to enter or continue your expedition. **Settings** saves your sound and camera zoom preferences; **How to Play** explains the controls and mission. The game loads after Start, so waiting on the homepage uses no suit resources. Your saved expedition is preserved. The game itself is at `game.html`.

The game fills the browser window with no header, footer, frame, or page margins. Sound, help, pause, and mission controls float over the map. Press **Esc** or use the pause button to return to the main menu. The expand button enters browser fullscreen while keeping dialogs and controls available.

**Testing the story again:** refreshing resumes your autosave. Choose **Replay story** beside the saved-expedition label on the homepage, or press **Esc → Replay story from the beginning** in the game. This restarts Day 1, the wake-up scene, Earth call, ORBI name reveal, exploration discoveries, starting supply reserves, and breakfast/weather preparation while keeping completed outpost missions, samples, suit resources, and settings. **Esc → Start a fresh expedition** resets everything after its confirmation screen.

The opening story begins inside the spaceship. The astronaut has just woken beside a sleep pod and remembers nothing, including her own name. A thought bubble above her asks **“Who am I?”**. Press **E**, **Enter**, or **Space**, or tap **Continue**, to advance her thoughts. Choose **Look around** to begin exploring the cabin. Suit resources stay paused during the opening. The story saves after each line and resumes where you left off. A fresh expedition replays the opening; existing mission progress is preserved when adding the prologue to an older save.

The spaceship is a walkable interior with furniture collisions, a sleep pod, life support, an airlock, and an Earth communications screen. Use the **Earth screen** and **Airlock** shortcuts to walk to them, or walk and click around normally. Life support transfers oxygen from a finite reservoir into your suit. Collect canisters in the greenhouse and install them here to replenish the reservoir. Suit oxygen does not drain indoors; walking and running still use astronaut energy after ORBI's introduction.

After the wake-up dialogue she stays in the cabin. After about four active seconds inside, an incoming Earth transmission adds a **!** above the communications screen and to its shortcut. Open the console to answer. Advance with **Continue transmission**, **E**, **Enter**, or **Space**: she explains her amnesia, and Earth Control promises to arrive in **about 15 days** and bring her home. The final reply is interrupted by **SYSTEM ERROR**, followed by **SIGNAL LOST**. The rescue promise and failed-call log remain saved when reopening the console, leaving the ship, or reloading. The alert timer pauses with the pause menu or a hidden tab. Older saves receive the new call without losing expedition progress.

Two seconds after disconnection, the Earth screen closes and returns you to the cabin. **ORBI’s separate TV**, beside the sleep pod, lights up with a **!**. Tap it to open a full-screen conversation with the supplied robot mascot, a large speech bubble, and reply choices inspired by the reference. ORBI says **“Morning, Mira! Ready for today’s tasks?”** — the first clue to the astronaut’s name. Ask about your name or what happened, then hear ORBI’s reassurance and your actual next mission. **E / Enter / Space** advances the focused reply; **Esc** or **Back to cabin** leaves. The conversation resumes from its saved line. After finishing, return to ORBI for the current task briefing. The learned name appears in the game HUD and survives reloads and airlock trips. Existing disconnected saves receive ORBI’s alert automatically. Change `ASTRONAUT_NAME` in `dist/core.js` to customize the name.

After ORBI, prepare each morning: **eat breakfast → drink water → check today’s weather**. The galley is at the lower left of the cabin. Each meal uses 10 food-stock points and restores up to 40 astronaut energy, capped at 100. You can eat again after exertion, even if today's breakfast is already complete. Drinking uses 15 water-stock points. The weather screen beside the airlock shows the day's simulated conditions. **Only Day 1 locks departure until the Earth call, ORBI conversation, breakfast, water, weather check, and EMU lesson are complete.** From Day 2 onward you may leave with unfinished preparation or tasks, including during storms. Preparation saves across reloads and re-entry, and resets after sleep. Weather can be checked before breakfast on later days.

Astronaut energy includes hunger: food restores the single astronaut energy meter. There is no separate hunger resource. Walking and running consume more energy; a slow baseline drain represents needing food. Spaceship power appears beside astronaut energy as EU.

At the start of each Sol, ORBI opens the Power Plan. One shared battery holds 100 EU. Normal / Reduced / Critical costs are greenhouse 30 / 18 / 8 EU, habitat 40 / 26 / 12 EU, and EMU 20 / 12 / 6 EU. Indoor plans reserve no EMU power. Weather predicts 80 EU clear, 60 normal, 35 dusty, and 10 during storms. Dusty panels collect 70% of that forecast; clean panels collect 100%. Recharge is capped before daily reservations, with overflow shown. Confirming applies sunlight once; power can be rebalanced before the first EVA without another recharge. The planner is also available from the HUD.

Normal greenhouse power grows crops fastest and repairs health; Reduced grows slowly; Critical causes slow deterioration. Shortfalls reduce growth and health gradually. Better power restores health in later Sols. Health and growth affect food yields. Habitat power gets priority; Reduced dims lights, Critical retains essential air, heat and water with emergency backup. EMU budgets give 240 / 150 / 75 active outdoor seconds per Sol, shared across trips, reduced further by shortages. Running out ends the expedition. Plan, allocations, crop condition and outdoor time save across reloads. Sleep still requires daily missions, preparation and a confirmed plan. Storm exposure remains independently fatal after 12 seconds outside.

Food, water and oxygen now have separate supply chains. Storage loads up to 70 food-stock points once per Sol and does not add water. At the ice deposit, collect up to 3 crystals per Sol into a 6-crystal cargo hold. Bring them to the habitat's new ICE TO WATER machine: each processed crystal is consumed and adds up to 30 water-stock points (capacity 100). A full tank preserves your ice. Research samples stay separate from water-making cargo. The habitat machine runs within the existing habitat power allocation. Cargo and processing progress save across reloads, as does your position inside the habitat or greenhouse.

Greenhouse oxygen is collected as portable canisters (one per Sol, up to 3 carried). Carry them to the spaceship's LIFE SUPPORT machine and install them (+80 reservoir oxygen per canister). Then choose Charge EMU oxygen from life support to transfer reservoir oxygen into the suit. Collecting or installing a canister does not directly refill the EMU. Installation waits if the reservoir cannot hold the full canister.

Before sleeping, stock enough water for the following consecutive storm days plus the next clear morning. ORBI's objective marker directs you to ice or the habitat processor when water is short. This keeps the fifteen-day mission playable after separating food from water.

When the day's objectives and preparation are complete, return to the spaceship's **sleep pod** and choose **Sleep · Start Day 2**. Days advance by sleeping. Day 2 has ORBI's storm drill; later days alternate cabin maintenance, solar cleaning, oxygen collection, rover surveys, resupply, and greenhouse harvesting and planting. The fifteen-day story ends with the restored Earth transmission. Sleeping still requires today's preparation and tasks, plus tomorrow's breakfast supplies. Leaving the ship from Day 2 does not require those tasks to be complete.

To leave, approach the airlock and choose **Step outside**. To return, approach the rocket on the landing pad, press **E**, and choose **Enter spaceship**. You can enter and leave repeatedly. The cabin position, current location, Earth connection, and expedition progress all save. The introduction stays completed when you re-enter.

Use **WASD / arrow keys** to walk, **Shift** to move faster, **E / Space** to interact, **M** for your mission log, **H** for the field guide, and **Esc** to pause. Click or tap a place to walk there automatically. Touch movement buttons are available on phones.

The camera follows your astronaut through an open world. Terrain generates as you explore in any direction, with rocks, ice deposits, craters, and desert regions beyond the original outpost. **Scroll / + / −** to zoom. The surface scanner shows nearby terrain and your direction, and marks home in green. Press **B** or use the home button to return to base immediately. Your saved position can be anywhere in the world.

Restore the solar panels, start the greenhouse, collect ice, transmit your report from the habitat, and return to the landing pad to finish. The rover and flag have optional discoveries. Progress saves locally on the current device. Start a fresh expedition from the pause menu.

All eight surface stations are separated by at least 1,800 world units (about one and a half screen widths at the default zoom). Each has its own building or landmark, collision area, and road entrance. Follow the roads or click the gold direction-and-distance marker to walk to the day's objective. The station scanner fits all stations. The storage warehouse is drawn in code; the original stations use the supplied outpost scene artwork. Home recall returns you near the habitat; enter a building for shelter.

`dist/index.html`, `dist/home.js`, and `dist/menu.css` provide the homepage. `dist/game.html` hosts the game. `dist/intro.js` draws the pixel-art spaceship cabin and supplies the opening dialogue. `dist/core.js` contains terrain generation, navigation, collision, mission rules, and save validation. `dist/world.js` renders terrain as needed, with bounded caches for continuous exploration. `dist/character.js` loads and draws the supplied astronaut SVG animations. `dist/game.js` contains the camera, input, story progression, audio, and UI. `dist/style.css` contains the responsive game interface.

Run all simulation checks with `node --test tests/*.test.cjs`.

The outpost artwork at `dist/assets/mars-outpost.png` was created using the built-in image generation tool, using the user's image as a style and layout reference. The final prompt is recorded in `ASSET-PROMPT.md`. The world renderer uses its buildings and scenery as sprites over generated terrain.

The character uses the five user-supplied SVGs, with four walk frames per direction and the supplied idle pose. See `dist/assets/astronaut/README.md` for the source mapping. Prepared frames remain native SVGs with transparent backgrounds and a consistent size. Walking stops when the character stops, retains its facing direction, and animates faster while sprinting.

Indoors, including the opening wake-up scene, she wears the supplied trainer outfit without a spacesuit. Walking outside automatically selects the astronaut suit; entering the spaceship selects the indoor clothes again. Both outfits support all four walking directions and idle poses. The indoor artwork mapping is recorded in `dist/assets/indoor/README.md`.
