import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'

import { Signal } from './signal/generator.js'
import { Stim } from './signal/stim.js'
import { Rules } from './signal/rules.js'

const canvas = document.getElementById('gl')
const stimButton = document.getElementById('stim')
const stimLabel = document.getElementById('stim-label')
const hint = document.getElementById('hint')
const mState = document.getElementById('m-state')
const mBar = document.getElementById('m-bar')
const mValue = document.getElementById('m-value')
const stimState = document.getElementById('stim-state')

/**
 * The design language lives in tokens.css and nowhere else, so the model, the
 * traces and the rules read their colours out of it once at startup rather
 * than repeating the hex values here. Read before the frame loop begins: this
 * is the only place the page asks the engine for a computed style.
 */
const rootStyle = getComputedStyle(document.documentElement)
const token = (name) => rootStyle.getPropertyValue(name).trim()

const COLOURS = { lit: token('--warm'), recovering: token('--fade'), resting: token('--cool') }
const RULE = token('--rule')

const signal = new Signal()
const stim = new Stim({ button: stimButton, hint, canvas })
const rules = new Rules(document.querySelectorAll('.sig'))

/**
 * three is by far the heaviest thing on the page and nothing the reader can do
 * depends on it, so it loads on its own. Until it arrives `scene` absorbs every
 * call and the control, the signal and the rules are already live; `tick` reads
 * the binding each frame, so reassigning it is all the handover needs.
 */
let scene = {
  setFrame () {},
  setPointer () {},
  resize () {},
  update () {},
  render () {}
}

import('./scene/index.js').then(({ createScene }) => {
  scene = createScene({ canvas, cool: COLOURS.resting, warm: COLOURS.lit, cord: token('--cord'), ink: token('--ink'), dim: token('--ink-4'), label: token('--ink-3'), ground: token('--bg'), onFit: placeCaption, light: matchMedia('(hover: none) and (pointer: coarse)').matches })
  // Replay the viewport and the section the reader is already on; a scene that
  // starts at frame 0 with a square aspect would visibly snap into place. On a
  // phone that is the block the canvas already stands in.
  sizeScene()
  if (phone.matches && host) {
    const fig = host
    host = null
    hostFig(fig)
  } else scene.setFrame(active)
  scene.setView(shownViz)
  measureFun()
})

const LABELS = { lit: '620 nm · on', recovering: 'recovering', resting: '620 nm · hold' }

/**
 * Spoken state. The rail's meter is decorative and aria-hidden, and the press
 * itself is over long before the interesting part, so these three sentences
 * plus the checkpoints in `tick` are the only way the recovery reaches a
 * reader who cannot see it.
 */
const SPOKEN = {
  lit: 'Light on.',
  recovering: 'Light off. Transmitter release recovering.',
  resting: 'Recovered. Transmitter release 100%.'
}

/** Percentages of release the recovery is worth interrupting for, as it climbs. */
const CHECKPOINTS = [25, 50, 75]
let nextCheckpoint = CHECKPOINTS.length

stim.addEventListener('change', (event) => {
  const state = event.detail
  document.documentElement.classList.toggle('is-lit', state === 'lit')
  document.documentElement.classList.toggle('is-recovering', state === 'recovering')
  stimLabel.textContent = LABELS[state]
  mState.textContent = state === 'lit' ? 'illuminated' : state
  mState.classList.toggle('hot', state === 'lit')
  // Start above whatever release the press actually reached, so a short tap
  // that only took it to 60% does not announce the marks it began past.
  const from = CHECKPOINTS.findIndex((mark) => mark > stim.release)
  nextCheckpoint = state === 'recovering' && from >= 0 ? from : CHECKPOINTS.length
  stimState.textContent = SPOKEN[state]
})

/* --- section tracking --------------------------------------------------- */
const sections = [...document.querySelectorAll('main > section')]
const navLinks = [...document.querySelectorAll('#nav a')]
let active = -1

function trackSection () {
  const mid = innerHeight * 0.45
  let best = 0
  let bestDistance = Infinity
  sections.forEach((section, i) => {
    const box = section.getBoundingClientRect()
    const centre = box.top + Math.min(box.height, innerHeight) * 0.5
    const distance = Math.abs(centre - mid)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  })
  if (best === active) return
  active = best
  navLinks.forEach((link, i) => {
    link.classList.toggle('on', i === active)
    if (i === active) link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  })
  if (!phone.matches) scene.setFrame(active)
  syncCaption()
}

addEventListener('scroll', trackSection, { passive: true })

/* --- the model's place on a phone --------------------------------------- */

/**
 * Below the layout change there is no side for the model to stand on, so each
 * section with a view has a block of its own (.fig) and the one canvas moves
 * into whichever block is coming on screen. Moving the element keeps its GL
 * context, and inside a block it scrolls with the page natively. The framing
 * follows the block rather than the section the reader is in, and nothing is
 * drawn while no block is on screen: on a phone that is most of the page.
 */
const phone = matchMedia('(max-width: 1080px)')
const figs = [...document.querySelectorAll('.fig')]
const canvasHome = { parent: canvas.parentNode, next: canvas.nextSibling }
const nearness = new Map()
const visible = new Set()
let host = null

/** Mockup round: which of the three layouts this page is showing. */
const variant = (document.documentElement.className.match(/\bm-([abc])\b/) || [])[1] || 'a'

/**
 * How each layout wants the view placed in its block, as a vertical shift of
 * the image in normalised coordinates: an opener keeps its heading's room
 * clear at the foot of the block.
 */
const LENS = { a: 0, b: 0.3, c: 0 }

function hostFig (fig) {
  if (fig === host) return
  host = fig
  fig.prepend(canvas)
  hostNote = fig.querySelector('.fig-note')
  scene.setLens?.({ shift: Number(fig.dataset.frame) === FUN ? 0 : LENS[variant], phone: true })
  scene.setFrame(Number(fig.dataset.frame))
  measureFun()
}

function pickFig () {
  if (!phone.matches) return
  let best = null
  let bestRatio = 0
  for (const fig of figs) {
    const ratio = nearness.get(fig) || 0
    if (ratio > bestRatio) { best = fig; bestRatio = ratio }
  }
  if (best) hostFig(best)
}

// Chosen a little ahead, over a margin below the screen, so the framing has
// settled by the time the block scrolls into view…
const ahead = new IntersectionObserver((entries) => {
  for (const entry of entries) nearness.set(entry.target, entry.isIntersecting ? entry.intersectionRatio || 0.001 : 0)
  pickFig()
}, { rootMargin: '0px 0px 60% 0px', threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] })
// …and drawn only while it is actually on screen.
const seen = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) visible.add(entry.target)
    else visible.delete(entry.target)
  }
})
for (const fig of figs) { ahead.observe(fig); seen.observe(fig) }

phone.addEventListener('change', () => {
  if (phone.matches) {
    host = null
    pickFig()
    return
  }
  canvasHome.parent.insertBefore(canvas, canvasHome.next)
  host = null
  scene.setLens?.({ shift: 0 })
  scene.setFrame(active)
  measureFun()
})

let hostNote = null

// Mockup round only: the chooser between the three phone layouts.
{
  const chooser = document.createElement('nav')
  chooser.className = 'mock-switch'
  chooser.setAttribute('aria-label', 'Mockup layouts')
  chooser.innerHTML = ['a', 'b', 'c'].map((m) => `<a href="?m=${m}"${m === variant ? ' class="on"' : ''}>${m}</a>`).join('')
  document.body.append(chooser)
}

addEventListener('pointermove', (event) => {
  scene.setPointer((event.clientX / innerWidth - 0.5) * 2, (event.clientY / innerHeight - 0.5) * 2)
}, { passive: true })

/* --- sizing -------------------------------------------------------------- */

/**
 * The stylesheet owns the canvas box — its width, and the breakpoint where that
 * width changes. Measuring the element rather than recomputing the rule from
 * innerWidth keeps the drawing buffer matched to the box on platforms with a
 * classic scrollbar, where the two differ by its width.
 */
function sizeScene () {
  const box = canvas.getBoundingClientRect()
  scene.resize(Math.max(1, box.width), Math.max(1, box.height))
}

new ResizeObserver(([entry]) => {
  const box = entry.contentBoxSize?.[0]
  const width = box ? box.inlineSize : entry.contentRect.width
  const height = box ? box.blockSize : entry.contentRect.height
  scene.resize(Math.max(1, width), Math.max(1, height))
}).observe(canvas)

const footer = document.querySelector('footer')

function resize () {
  if (footer) document.documentElement.style.setProperty('--footer-h', `${Math.ceil(footer.getBoundingClientRect().height)}px`)
  const rail = document.querySelector('.rail')
  if (rail) document.documentElement.style.setProperty('--bar-h', `${Math.ceil(rail.getBoundingClientRect().height)}px`)
  measureFun()
  rules.resize()
  trackSection()
}
addEventListener('resize', resize)
addEventListener('orientationchange', resize)

/* --- side projects ------------------------------------------------------- */

/**
 * At rest the section's model is its general view. Pointing at a project, or
 * tabbing to its link, puts that project's description in the caption under
 * the model, and the two with data behind them bring up their own views. With
 * no hover to point with, the view takes turns on its own while the section is
 * on screen, so a phone still sees both.
 */
const projectRows = [...document.querySelectorAll('.project')]
const vizRows = projectRows.filter((row) => row.dataset.viz)
const caption = document.getElementById('fun-caption')
const captionKind = caption?.querySelector('[data-kind]')
const captionAbout = caption?.querySelector('[data-about]')
const captionLive = caption?.querySelector('[data-live]')
const FUN = sections.findIndex((section) => section.id === 'fun')
let pointedRow = null
let shownViz
let shownLive = null

function showViz (name) {
  if (name === shownViz) return
  shownViz = name
  vizRows.forEach((row) => row.classList.toggle('showing', row.dataset.viz === name))
  scene.setView?.(name)
}

function point (row) {
  pointedRow = row
  showViz(row?.dataset.viz ?? null)
  placeCaption()
  if (row && caption) {
    captionKind.textContent = row.querySelector('.when').textContent
    captionAbout.textContent = row.querySelector('p')?.textContent ?? ''
    shownLive = null
  }
  syncCaption()
}

/**
 * The caption stands right under the view it describes: left-aligned to it,
 * no wider than it, a little below its foot. The scene reports where each view
 * was placed, in normalised coordinates of the canvas, whenever it refits.
 */
let placedViews = {}
const CAPTION_GAP = 26

function placeCaption (boxes) {
  if (boxes) placedViews = boxes
  const box = placedViews[pointedRow?.dataset.viz] ?? placedViews.lotto
  if (!caption || !box) return
  const frame = canvas.getBoundingClientRect()
  const left = frame.left + ((box.x0 + 1) / 2) * frame.width
  const width = ((box.x1 - box.x0) / 2) * frame.width
  const foot = frame.top + ((1 - box.y0) / 2) * frame.height
  caption.style.setProperty('--cap-left', `${Math.round(left)}px`)
  caption.style.setProperty('--cap-top', `${Math.round(foot + CAPTION_GAP)}px`)
  caption.style.setProperty('--cap-width', `${Math.round(Math.max(280, width))}px`)
}

function syncCaption () {
  document.documentElement.classList.toggle('caption-on', Boolean(pointedRow) && active === FUN)
}

// Pointing is for a mouse; a finger's taps fire the same enter and leave, and
// would bring a view up only to drop it again as the finger lifts.
for (const row of projectRows) {
  row.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch') point(row) })
  row.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') point(null) })
  row.addEventListener('focusin', () => { if (!phone.matches) point(row) })
  row.addEventListener('focusout', () => { if (!phone.matches) point(null) })
}
showViz(null)

/**
 * On a phone there is no pointing, so a project with data behind it carries a
 * button that brings its view up in the section's block, and its title stays
 * the link it always was. Tapping it again, or another, puts the view back.
 */
let picked = null
const peeks = vizRows.map((row) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'peek'
  button.setAttribute('aria-pressed', 'false')
  button.textContent = 'Show the data'
  button.addEventListener('click', () => pick(picked === row ? null : row))
  row.querySelector('h3').after(button)
  return button
})

function pick (row) {
  picked = row
  showViz(row?.dataset.viz ?? null)
  shownLive = null
  vizRows.forEach((r, i) => {
    peeks[i].setAttribute('aria-pressed', String(r === row))
    peeks[i].textContent = r === row ? 'Showing, above' : 'Show the data'
  })
}

/**
 * Where the section's views may stand, measured as the section reads when the
 * rail's link brings it in: its top at the top of the window. They are fitted
 * between its label and its last project, so a view never rises over the
 * heading or sinks into the caption's room. A layout read, so only on resize
 * and once the fonts have landed.
 */
const funSection = document.getElementById('fun')
// The section's last row only finds its height once the display face is in.
document.fonts?.ready.then(() => measureFun())

function measureFun () {
  if (!funSection || !projectRows.length) return
  // On a phone the views fill their own block, inside a margin, and leave
  // the foot of an opener to its heading.
  if (phone.matches) {
    const foot = variant === 'b' ? -0.05 : -0.74
    scene.setFitBox?.({ top: 0.7, bottom: foot, left: -0.84, right: 0.84 })
    return
  }
  const origin = funSection.getBoundingClientRect().top
  const top = funSection.querySelector('.tag').getBoundingClientRect().top - origin
  const bottom = projectRows[projectRows.length - 1].getBoundingClientRect().bottom - origin
  const height = canvas.getBoundingClientRect().height || innerHeight
  scene.setFitBox?.({ top: 1 - (2 * top) / height, bottom: 1 - (2 * bottom) / height })
}

/* --- turning the brain on the last section -------------------------------- */

/**
 * On the contact section the brain can be turned: press on the model's side of
 * the page and drag. Mouse and pen only, so a finger still scrolls the page;
 * and never from a link, a button or the text, which keep their own gestures.
 * Here the press belongs to the turn, so it is taken before the canvas would
 * read it as holding the light: the corner control still delivers light.
 * The scene does nothing with a turn on any other section.
 */
const CONTACT = sections.findIndex((section) => section.id === 'contact')
let dragging = null

function overModel (event) {
  // On a phone the model has its own block, so a finger can turn it there:
  // the block takes sideways moves and leaves upright ones to the page.
  if (phone.matches) return Number(host?.dataset.frame) === CONTACT && Boolean(host?.contains(event.target))
  if (active !== CONTACT || event.pointerType === 'touch') return false
  if (event.target.closest?.('a, button, input, textarea, label, .col, footer')) return false
  const box = canvas.getBoundingClientRect()
  return event.clientX > box.left + box.width * 0.08
}

addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !overModel(event)) return
  dragging = { x: event.clientX, y: event.clientY }
  document.documentElement.classList.add('is-turning')
  event.preventDefault()
  event.stopPropagation()
}, { capture: true })

addEventListener('pointermove', (event) => {
  if (dragging) {
    scene.turn?.(((event.clientX - dragging.x) / innerWidth) * 5, ((event.clientY - dragging.y) / innerHeight) * 2.5)
    dragging.x = event.clientX
    dragging.y = event.clientY
    return
  }
  document.documentElement.classList.toggle('can-turn', overModel(event))
}, { passive: true })

function stopTurning () {
  dragging = null
  document.documentElement.classList.remove('is-turning')
}
addEventListener('pointerup', stopTurning)
addEventListener('pointercancel', stopTurning)

/* --- earlier papers ------------------------------------------------------ */
const moreButton = document.getElementById('more-papers')
if (moreButton) {
  const collapsedLabel = moreButton.textContent
  moreButton.addEventListener('click', () => {
    const hidden = [...document.querySelectorAll('#pubs li[hidden]')]
    if (hidden.length) {
      hidden.forEach((row) => { row.hidden = false })
      moreButton.textContent = 'Show fewer papers'
      moreButton.setAttribute('aria-expanded', 'true')
    } else {
      document.querySelectorAll('#pubs li[data-rest]').forEach((row) => { row.hidden = true })
      moreButton.textContent = collapsedLabel
      moreButton.setAttribute('aria-expanded', 'false')
      // Follow the rows that just left, not the top of the section: scrolling
      // to the heading can carry the button — and the focus on it — off screen.
      moreButton.scrollIntoView({ block: 'nearest' })
    }
  })
}

/* --- loop ---------------------------------------------------------------- */
let last = performance.now()
let frameHandle = 0
let shownRelease = -1

/** One object, rewritten each frame: `scene.update` only reads it synchronously. */
const frameState = { time: 0, activity: 1, suppression: 0, burst: 0, lit: false }

function tick (now) {
  frameHandle = requestAnimationFrame(tick)
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  const suppression = stim.update(dt)
  signal.push(dt, suppression)

  // The readout changes at most a hundred times over a whole recovery; writing
  // it every frame would dirty the rail's layout sixty times a second for nothing.
  const release = stim.release
  if (release !== shownRelease) {
    shownRelease = release
    mValue.textContent = `${release}%`
    mBar.style.width = `${release}%`
    // Same gate for the spoken readout, and only at the checkpoints, so the
    // recovery is narrated three times rather than a hundred.
    if (stim.state === 'recovering' && nextCheckpoint < CHECKPOINTS.length && release >= CHECKPOINTS[nextCheckpoint]) {
      stimState.textContent = `Recovering. Transmitter release ${CHECKPOINTS[nextCheckpoint]}%.`
      nextCheckpoint++
    }
  }

  frameState.time = now / 1000
  frameState.activity = signal.activity
  frameState.suppression = suppression
  frameState.burst = signal.burstAmplitude
  frameState.lit = stim.held

  scene.update(dt, frameState)
  // On a phone the canvas is only ever inside a block, so with its block off
  // screen there is nothing to draw.
  if (!phone.matches || visible.has(host)) scene.render()
  // What the project's view shows right now: in the caption beside it, or on
  // a phone at the head of its block.
  const onPhone = phone.matches
  const liveLine = onPhone ? (Number(host?.dataset.frame) === FUN ? hostNote : null) : captionLive
  const describing = onPhone ? Boolean(picked) : Boolean(pointedRow?.dataset.viz) && active === FUN
  if (describing && liveLine) {
    const live = scene.live ?? ''
    if (live !== shownLive) {
      shownLive = live
      liveLine.textContent = live
    }
  } else if (shownLive !== '') {
    shownLive = ''
    if (captionLive) captionLive.textContent = ''
    if (hostNote) hostNote.textContent = ''
  }
  rules.draw(signal, COLOURS[stim.state], RULE)
}

/**
 * A hidden tab gets no frames. Most browsers already throttle
 * requestAnimationFrame to nothing there, but an occluded or fully covered
 * window is not always treated as hidden, and this site would otherwise sit in
 * a background tab running a shader at 60fps on someone's battery.
 */
function start () {
  if (frameHandle) return
  last = performance.now()   // a paused tab is not a four-minute-long frame
  frameHandle = requestAnimationFrame(tick)
}

function stop () {
  if (!frameHandle) return
  cancelAnimationFrame(frameHandle)
  frameHandle = 0
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop()
  else start()
})

resize()
start()
