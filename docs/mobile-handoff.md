# Handoff: the mobile overhaul

> **Status, 2 October 2026 (later the same day).** On branch `mobile-overhaul`,
> not pushed. Of three mockups (figures, openers, stage) Evyatar chose **C, the
> stage**: each section with a view opens on a block held under the bar
> (`position: sticky`, 44svh) while its text scrolls beneath; the one canvas
> moves into whichever block is on screen and nothing is drawn between them.
> For fun follows the scroll: the row passing just under the stage chooses the
> view (his request, instead of a "Show the data" button). Phone framings are
> `phoneFrames` in `src/scene/frames.js`. Phones also draw a third of the
> capillaries and every third Lotto draw. The light fix (a
> `lostpointercapture` bubbling up from the button's labels) is unconfirmed on
> iOS: the Simulator runtime still has to be installed. Desktop was checked
> pixel-identical to `main`. Everything below is the original brief.

Written 2 October 2026, at the end of the session that built the Research
vasculature, the For fun section and the Connect tracts. **The desktop site is
approved and live. The phone experience is not, and needs a proper redesign,
not more patching.** Read `SPEC.md` first; it holds the content rules, the
science and the design language, and none of that changes for mobile.

## What Evyatar said about mobile

On his iPhone, after this round:

1. The animations do not run well. They feel awkward.
2. They are too dense.
3. **The red light does not work.** (Holding the 620 nm control does nothing on
   the phone. In desktop WebKit with an emulated iPhone the hold works, so this
   is something a real touch screen does differently: start here.)
4. The model always hides behind the text, so it cannot really be seen.
5. Hover does not exist on a phone, so the For fun section does not work.

His words: "we need to think of a serious overhaul to the mobile page. The
desktop one is fine though." Treat the desktop as a reference to keep, not
something to change while fixing mobile. Every mobile change should be scoped
to the phone breakpoint, and the desktop must look identical afterwards.

## How mobile works today (what to replace)

Everything below is in `src/main.js`, `src/styles/layout.css` and
`src/styles/components.css`, behind `@media (max-width: 1080px)` (and, for the
band, `and (orientation: portrait)`).

- **One fixed canvas behind the text.** Portrait phones get a band from just
  under the lede to the bottom of the screen (`--band-top`, `--band-h`,
  measured by `placeBand()` in main.js). Its opacity is `--gl-presence`: 1 at the
  top of the page, falling to **0.2 after a third of a screen of scrolling**
  (`updatePresence()`), 0.85 while the light is held, 0.55 while recovering.
  That 0.2 is why every section's view is nearly invisible on a phone: the
  rule was written when the site had one brain, before Research, For fun and
  Connect had views of their own.
- **Section views.** Each one reuses the desktop camera framing from
  `src/scene/frames.js`, which was composed for a canvas on the right half of
  a wide screen. Nothing is reframed for a phone.
- **For fun.** No hover, so `main.js` cycles rest, Lotto and football every
  8 s while the section is active. The caption (`#fun-caption`) is hidden
  below 1081 px and the descriptions stay in the list. The views are fitted to
  a fixed band (`measureFun()` passes `{ top: 0.55, bottom: -0.35 }` below
  1081 px) rather than to the layout.
- **Connect.** Drag-to-turn ignores touch on purpose (a finger must still
  scroll). `#contact`'s full-height rule is desktop only.
- **The light control.** `src/signal/stim.js`: pointerdown on `#stim` (and on
  the canvas) begins, lostpointercapture/pointerup ends; a long press must not
  open a menu (`contextmenu` is prevented). Look at what iOS Safari does with a
  long touch on a button: callouts, text selection, `touch-action`, and
  whether pointer capture is lost early.

## Load on a phone

All of it is lazy: each section's data is fetched once the reader is close,
and only the visible section's layer is drawn (`group.visible` follows its
presence). Pixel ratio is capped at 2.

| Layer | File (gzip) | Drawn |
| --- | --- | --- |
| Shell and trigeminal highlights | `public/data/*.bin` (~170 KB) | 30k points |
| Research vessels | `vessels.bin` (1.08 MB) | 265k line and point vertices, 7k neurons, leak halos |
| For fun | `fun.json` (17 KB) | 24k landscape points; walks 145k line vertices; seasons 34 ridges |
| Connect tracts | `tracts.bin` (152 KB) | 75k line vertices |

The vessels and the walks are the heavy ones. "Too dense" and "does not run
well" probably both point there: a phone could take a third of the vertices,
fewer and larger dots, and thinner fields of lines. The data-prep pipelines in
`tools/data-prep/` take the counts as parameters (see `vessels/prep.py`'s
arguments), so a lighter mobile file is a re-run, not a rewrite.

## Directions worth weighing (none decided)

Bring options to Evyatar as mockups before building, the way every round in
this project has gone. He decides from seeing them, not from descriptions.

- **Give the model its own space on a phone.** For example a figure block in
  each section that has a view (Research, For fun, Connect), with the canvas at
  full strength while that block is on screen and reframed to fill it. That is
  the lesson he already gave once (memory: never hide the model behind the text
  to protect legibility; give it its own space).
- **Reframe for portrait.** New camera frames per section for a tall, narrow
  canvas instead of the desktop ones.
- **For fun by tap.** A tap on a project row could show its view, with an
  explicit link affordance to visit the project, instead of an automatic cycle.
- **A lighter mobile data set,** as above, and possibly a reduced-motion or
  low-power fallback.
- **Fix the light first.** It is the site's central interaction and it is
  broken on the device that matters most.

## Verifying

- `tools/verify/mobile.mjs`: the iPhone 14 Pro profile in Playwright's WebKit,
  through every section; frame timing, overflow, presence, errors, the For fun
  cycle, a light hold, a tap on Connect. Desktop GPU, so frame rates there say
  nothing about the phone. Usage is in the file's header.
- **iOS Simulator**: needs full Xcode. Evyatar is installing it, then running
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **His phone**: `npm run dev -- --host`, then `http://<the Mac's IP>:5173` on
  the iPhone over the same Wi-Fi. This is the only real test of speed and touch.

## Also open

- **Footer.** Evyatar has a new idea for it (not yet described). Its line
  border was removed in anticipation. At 1440 px on desktop the footer's last
  credit runs under the light control in the corner; the redesign should fix
  that too.
- **Credits that must stay visible:** Allen Mouse Brain Atlas (CCF v3 and the
  Connectivity Atlas), and VesSAP / VesselGraph under CC BY-NC 4.0, which
  requires attribution on the page.

## Map of this round's code

- `src/scene/index.js`: the shell, frames, and the hand-offs between views
  (`vesselMix`, `funMix`, `tractsMix`), the light's focus, the fiber's fade,
  drag-to-turn (`turn`), and `fitFun()` for the For fun layout.
- `src/scene/vessels.js`: Research. Barrel-cortex activity, the leak, the
  dilation wake, the beam onto the cortical surface.
- `src/scene/fun/`: `landscape.js` (rest), `walks.js` (sikui), `seasons.js`
  (NextPredictor), `index.js` (switching and the shared fit), `common.js`.
- `src/scene/tracts.js`: Connect.
- `src/main.js`: section tracking, the For fun hover/caption/cycle, the fit
  measurement, drag-to-turn, the footer height for `#contact`.
