# Evyatar Swissa — site specification

This is the contract for the redesign. Read it before changing anything.
The site is live at <https://swissclock.github.io/> and is the personal site of a
working neuroscientist. Peers, collaborators and hiring managers read it.

---

## 1. Who this is for and what it must convey

Evyatar Swissa. Director of In-vivo Research at **Modulight Bio** (since 2022) and
Research Associate at the **Weizmann Institute**. PhD in Brain and Cognitive
Sciences, Ben-Gurion University, February 2022, in Alon Friedman's blood-brain
barrier lab. Ten years on the blood-brain barrier in epilepsy and plasticity, now
building an optogenetic therapy.

The site should read as **credible, restrained and specific**. A peer should find
nothing to wince at; a non-specialist should still follow the story.

## 2. Hard content rules

These came directly from Evyatar and are not open to reinterpretation.

- **No boasting.** No publication counts, no "11 papers", no first-author badges,
  no stats rows, no metrics tiles. Papers are a plain reverse-chronological list.
- **Side projects stay quiet.** They are hobbies. One line each under "Also, for
  fun". No screenshots, no cards, no descriptions of features.
- **No invented facts.** Titles, dates, journals, mechanisms and wavelengths come
  from `src/content/data.js`, which was built from his CV and PubMed. If you think
  something is wrong, flag it, do not silently change it.
- The GitHub account is **swissclock**. `evyatarsw` is an abandoned empty account
  and must never be linked.

## 3. The science, stated correctly

- **eOPN3** is a mosquito-derived rhodopsin that couples to **Gi/o** and suppresses
  **neurotransmitter release at the presynaptic terminal**. It does *not*
  hyperpolarise the cell, and it is not a pump or a channel. It is bistable: a
  brief pulse of light produces suppression that **outlasts the light and recovers
  spontaneously**.
- Modulight's platform is described publicly as **optoGPCRs**; first indication is
  **trigeminal neuropathic pain**.
- The site labels the light **620 nm**, which is Evyatar's number. Note that the
  published eOPN3 action spectrum peaks nearer 500–550 nm. Do not "correct" the
  copy; this has been raised with him and 620 nm stands.
- The highlighted geometry is the **trigeminal nerve, its sensory root and the
  principal sensory nucleus**, from the Allen Mouse Brain CCF v3. That is the
  therapeutic target, which is why the fiber points at it.

## 4. The interaction that carries the whole design

The stim control is **momentary, not a toggle**. This is the single most important
interaction on the site and it encodes real biology:

1. Press and hold the control (also Space, also pointer-down on the model).
2. Suppression rises quickly. The model warms to 620 nm red, activity drops, the
   signal trace flattens.
3. **On release nothing snaps back.** Suppression decays slowly and with
   deceleration, about fifteen seconds to resting, and the rail shows the
   percentage of transmitter release recovering as it goes.

Never replace this with an on/off switch, and never make the recovery instant.

## 5. One signal, many views

`src/signal/generator.js` is the only source of activity in the site. The model's
point jitter and burst brightness, and every hairline rule drawn between sections,
read from that one object each frame.

An earlier draft animated the trace and the model independently and the desync was
immediately obvious. **Do not introduce a second generator, a second clock, or a
CSS animation that pretends to be part of the signal.**

## 6. Design language

Authored in `src/styles/tokens.css`. Change tokens, not scattered literals.

| Role | Token | Value |
| --- | --- | --- |
| Ground | `--bg` | `#080a0e` |
| Primary text | `--ink` | `#e9ecf1` |
| Secondary text | `--ink-2` | `#a8b0bd` |
| Resting state | `--cool` | `#7fa3c9` |
| Delivered light | `--warm` | `#ff5c33` |
| Recovering | `--fade` | `#b8734f` |

- **Explicitly rejected:** green phosphor, matrix character rain, CRT scanlines,
  monospace display faces, neon. The earlier "terminal" direction read as costume.
- Typography is **Newsreader** (serif, weights 200/300/400 plus italic) for
  everything read, and **Geist Mono** for labels, data and metadata only.
  Journal typography driven by an instrument.
- Hierarchy comes from **size, weight and tracking contrast**, not from borders or
  boxes. A 122px display at weight 200 sits against 10.5px uppercase mono at
  0.2em tracking. Keep that contrast; do not flatten it.
- The model lives on the right, the reading column on the left, and `.veil`
  guarantees text never sits on busy pixels. **Legibility beats spectacle.**
- Dark only. There is no light theme and none should be added.

## 7. Architecture

```
index.html            shell with <!--@slot--> markers
vite.config.js        plugin renders content into the HTML at build and dev time
public/data/*.bin     Int16 point clouds, 1/160 mm per unit, 6 bytes per point
src/content/data.js   every word and fact on the site
src/content/render.js data -> HTML, runs in Node, no browser APIs
src/signal/           generator (the one source), stim control, rule renderer
src/scene/            three.js: loader, shaders, camera frames
src/styles/           tokens, base, layout, components
legacy/               the previous site, kept for reference only
```

Content is prerendered into `dist/index.html`, so the text is present with
JavaScript disabled and for crawlers. Geometry is fetched after first paint; if
that fetch fails the page must still be complete and readable.

## 8. Definition of done

A change is finished when all of these hold.

**Correctness**
- `npm run build` passes with no errors.
- No console errors or warnings on load, on scroll, or while using the control.
- With `public/data/*.bin` returning 404, the page still renders and reads
  correctly.

**Responsive**
- Works at 390px, 768px, 1280px and 1920px wide.
- No horizontal page scroll at any width.
- At least a 16px gutter at every width.
- The rail collapses to a top bar below 1080px; the model drops behind the text.

**Accessibility**
- Every control reachable and operable by keyboard, with a visible focus ring.
- The stim control works by keyboard and announces its state.
- `prefers-reduced-motion` removes idle drift and smooth scrolling.
- Text contrast at least 4.5:1 for body copy against its actual background.
- The canvas is `aria-hidden`; nothing meaningful is conveyed by the model alone.

**Performance**
- Sustains 60fps on a 2019-class laptop at 1440x900; never drops below 30.
- No layout thrash: no reads of layout properties inside the animation loop.
- Geometry fetch does not block first paint.

**Craft**
- No lorem, no placeholder, no TODO left in shipped code.
- Comments explain *why*, not *what*.
- No dead code, no unused CSS selectors, no commented-out blocks.

## 9. Deployment, and what not to do

GitHub Pages currently serves the **root of `main`** in `swissclock/swissclock.github.io`.
`.github/workflows/deploy.yml` builds and deploys instead, but it requires the
repository's Pages source to be switched to "GitHub Actions" in settings, which is
Evyatar's call.

**Do not push, do not merge, do not deploy, and do not change repository settings.**
Work stays on the `redesign` branch until he says otherwise.
