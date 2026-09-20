import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'

import { Signal } from './signal/generator.js'
import { Stim } from './signal/stim.js'
import { Rules } from './signal/rules.js'
import { createScene } from './scene/index.js'

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const canvas = document.getElementById('gl')
const stimButton = document.getElementById('stim')
const stimLabel = document.getElementById('stim-label')
const hint = document.getElementById('hint')
const mState = document.getElementById('m-state')
const mBar = document.getElementById('m-bar')
const mValue = document.getElementById('m-value')

const signal = new Signal()
const stim = new Stim({ button: stimButton, hint, canvas })
const rules = new Rules(document.querySelectorAll('.sig'))
const scene = createScene({ canvas })

/* --- state colour, read once per frame by the rules -------------------- */
const COLOURS = { lit: '#ff5c33', recovering: '#b8734f', resting: '#7fa3c9' }

const LABELS = { lit: '620 nm · on', recovering: 'recovering', resting: '620 nm · hold' }

stim.addEventListener('change', (event) => {
  const state = event.detail
  document.documentElement.classList.toggle('is-lit', state === 'lit')
  document.documentElement.classList.toggle('is-recovering', state === 'recovering')
  stimLabel.textContent = LABELS[state]
  stimButton.setAttribute('aria-pressed', String(state === 'lit'))
  mState.textContent = state === 'lit' ? 'illuminated' : state
  mState.classList.toggle('hot', state === 'lit')
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
  navLinks.forEach((link, i) => link.classList.toggle('on', i === active))
  scene.setFrame(active)
}

addEventListener('scroll', trackSection, { passive: true })

addEventListener('pointermove', (event) => {
  scene.setPointer((event.clientX / innerWidth - 0.5) * 2, (event.clientY / innerHeight - 0.5) * 2)
}, { passive: true })

/* --- sizing -------------------------------------------------------------- */
function resize () {
  const wide = innerWidth > 1080
  scene.resize(wide ? innerWidth * 0.52 : innerWidth, innerHeight)
  rules.resize()
  trackSection()
}
addEventListener('resize', resize)
addEventListener('orientationchange', resize)

/* --- earlier papers ------------------------------------------------------ */
const moreButton = document.getElementById('more-papers')
if (moreButton) {
  const collapsedLabel = moreButton.textContent
  moreButton.addEventListener('click', () => {
    const hidden = [...document.querySelectorAll('#pubs .pub[hidden]')]
    if (hidden.length) {
      hidden.forEach((row) => { row.hidden = false })
      moreButton.textContent = 'Show fewer'
      moreButton.setAttribute('aria-expanded', 'true')
    } else {
      const rows = [...document.querySelectorAll('#pubs .pub')]
      rows.slice(5).forEach((row) => { row.hidden = true })
      moreButton.textContent = collapsedLabel
      moreButton.setAttribute('aria-expanded', 'false')
      document.getElementById('papers').scrollIntoView({ block: 'start' })
    }
  })
}

/* --- loop ---------------------------------------------------------------- */
let last = performance.now()

function tick (now) {
  requestAnimationFrame(tick)
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  const suppression = stim.update(dt)
  signal.push(dt, suppression)

  mValue.textContent = `${stim.release}%`
  mBar.style.width = `${stim.release}%`

  scene.update(dt, {
    time: now / 1000,
    activity: signal.activity,
    suppression,
    burst: signal.burstAmplitude,
    lit: stim.held
  })
  scene.render()
  rules.draw(signal, COLOURS[stim.state])
}

resize()
trackSection()
requestAnimationFrame(tick)

// Reduced motion still gets the model, just without the idle drift; that is
// handled inside the scene. Nothing here needs to branch on it.
void reduced
