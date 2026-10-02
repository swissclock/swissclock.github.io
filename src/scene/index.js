/**
 * The model: a point-sampled mouse brain from the Allen Common Coordinate
 * Framework, with the trigeminal nerve and its sensory nucleus loaded
 * separately so the therapeutic target can be lit on its own. On the research
 * framing the shell gives way to the same brain's vasculature (vessels.js),
 * and the light arrives through the cortical surface instead of the fiber. On
 * the side projects the shell's dots leave the brain and become data
 * (fun/).
 *
 * Geometry ships as Int16 binaries (6 bytes per point, 1/160 mm per unit) and
 * is fetched after first paint, so the text never waits on it.
 */

import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture,
  Color, ColorManagement, Euler, Group, Line, LineBasicMaterial, Matrix4, NormalBlending,
  PerspectiveCamera, Points, Scene, ShaderMaterial, Sprite, SpriteMaterial,
  Vector3, WebGLRenderer
} from 'three'

// The palette is authored in sRGB and the point shader does its own luminance
// maths, so three's linear working space would darken every colour on the way
// through. Working directly in sRGB keeps what the design specifies.
ColorManagement.enabled = false

import { pointVertex, pointFragment } from './shaders.js'
import { frames as wideFrames, phoneFrames } from './frames.js'
import { loadVessels, createVessels, SPOT } from './vessels.js'
import { loadFun, createFun } from './fun/index.js'
import { loadTracts, createTracts } from './tracts.js'

/** The section whose framing shows the vessels rather than the shell. */
const RESEARCH = 2
/** And the one whose framing reorganises the shell's dots into data. */
const FUN = 5
/** The last: the brain's long-range connections. */
const CONTACT = 6
/** Where the corpus callosum crosses the midline, in model mm. */
const CALLOSUM = new Vector3(1.93, 2.1, 0)

const SCALE = 160

/** Where the fiber tip sits, in millimetres, next to the trigeminal nerve. */
const TIP = new Vector3(-3.35, -1.65, 2.15)

/** The fiber's path in from off-screen, above and behind the animal. */
const CORD_PATH = [
  new Vector3(-1.2, 7.4, 7.6),
  new Vector3(-2.4, 3.1, 5.4),
  new Vector3(-3.1, 0.2, 3.4),
  TIP
]

const BASE_FOV = 34
/**
 * The aspect the camera framings in frames.js were solved against. Narrower
 * than this and the vertical field of view is widened to hold the horizontal
 * one, so the brain keeps the same width in the canvas however tall or narrow
 * that canvas becomes, rather than being sliced off at the right edge.
 *
 * It has to be at least the widest canvas the framings were composed on
 * (a 1920 window gives 52vw x 100vh, about 0.92), or every narrower window
 * frames the model tighter than the one it was solved for. At 0.83 it did,
 * and frame 01 ran a few pixels past the edge at every width below 1600.
 */
const REFERENCE_ASPECT = 0.95

const GEOMETRY = [
  { url: '/data/brain-shell.bin', hot: 0, blending: NormalBlending },
  { url: '/data/trigeminal-nerve.bin', hot: 1, blending: AdditiveBlending },
  { url: '/data/sensory-nucleus.bin', hot: 1, blending: AdditiveBlending },
  { url: '/data/sensory-root.bin', hot: 1, blending: AdditiveBlending }
]

async function loadPoints (url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const raw = new Int16Array(await response.arrayBuffer())
  const out = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] / SCALE
  return out
}

function glowTexture () {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,.95)')
  gradient.addColorStop(0.18, 'rgba(255,255,255,.35)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

/**
 * Centripetal Catmull-Rom through the cord's control points. three has a curve
 * class for this, but it is the only curve in the scene and it is not worth the
 * interpolation module it pulls into the bundle.
 */
function cordPoints (controls, divisions) {
  const first = controls[0].clone().multiplyScalar(2).sub(controls[1])
  const last = controls[controls.length - 1].clone().multiplyScalar(2).sub(controls[controls.length - 2])
  const p = [first, ...controls, last]

  // Knots spaced by the square root of chord length: the centripetal
  // parameterisation, which is what keeps a curve this asymmetric from looping
  // back on itself near the tip.
  const knots = [0]
  for (let i = 1; i < p.length; i++) knots.push(knots[i - 1] + Math.sqrt(p[i].distanceTo(p[i - 1])))

  const a = new Vector3(); const b = new Vector3(); const c = new Vector3()
  const out = []
  const segments = controls.length - 1
  for (let step = 0; step <= divisions; step++) {
    const u = (step / divisions) * segments
    const seg = Math.min(Math.floor(u), segments - 1)
    const i = seg + 1 // index into the padded array
    const t = knots[i] + (u - seg) * (knots[i + 1] - knots[i])

    // Barry-Goldman pyramid: three nested lerps over the four control points.
    const A = []
    for (let k = 0; k < 3; k++) {
      const j = i - 1 + k
      A.push(new Vector3().lerpVectors(p[j], p[j + 1], (t - knots[j]) / (knots[j + 1] - knots[j])))
    }
    b.lerpVectors(A[0], A[1], (t - knots[i - 1]) / (knots[i + 1] - knots[i - 1]))
    c.lerpVectors(A[1], A[2], (t - knots[i]) / (knots[i + 2] - knots[i]))
    a.lerpVectors(b, c, (t - knots[i]) / (knots[i + 1] - knots[i]))
    out.push(a.clone())
  }
  return out
}

function smoothstep01 (x) {
  return x * x * (3 - 2 * x)
}

/** Frame-rate independent smoothing: the fraction of the gap to close in `dt`. */
function approach (rate, dt) {
  return 1 - Math.exp(-rate * dt)
}

/**
 * What `createScene` returns when there is no WebGL to draw into. The page is
 * complete without the model, so every call is absorbed and nothing is logged.
 */
function inertScene () {
  return {
    setFrame () {},
    setPointer () {},
    resize () {},
    update () {},
    render () {}
  }
}

/**
 * Asks for the context here rather than letting three do it: three logs an
 * error and throws when a context cannot be created, and an old machine or a
 * VM without WebGL is not an error the reader should ever hear about. These
 * are the attributes three would have requested for the options below, so the
 * renderer finds exactly the context it expects.
 */
function createRenderer (canvas) {
  let context = null
  try {
    context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    })
  } catch {
    // Some browsers throw from getContext instead of returning null.
  }
  if (context === null) return null
  return new WebGLRenderer({ canvas, context, antialias: true, alpha: true, powerPreference: 'high-performance' })
}

/**
 * `cool`, `warm` and `cord` are the state colours, `ink` the vessels' response
 * colour, and `dim`, `label` and `ground` the data views' quieter tones, read
 * out of tokens.css by main.js: the palette is authored there and nowhere else.
 * `onFit` hears where the side-projects views were placed on the canvas.
 */
export function createScene ({ canvas, cool, warm, cord, ink, dim, label, ground, onFit, light = false }) {
  const COOL = new Color(cool)
  const WARM = new Color(warm)
  const CORD = new Color(cord)

  const renderer = createRenderer(canvas)
  if (renderer === null) {
    // Mark the canvas so the stylesheet can take it out of the picture, and
    // hand back a scene that does nothing: main.js keeps driving the signal,
    // the control and the rules exactly as it would otherwise.
    canvas.classList.add('is-inert')
    return inertScene()
  }
  // A phone's screen is dense enough that every point drawn at its full pixel
  // ratio is mostly fill the eye cannot resolve.
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, light ? 1.6 : 2))

  const stillness = matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = stillness.matches

  const scene = new Scene()
  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 200)
  camera.position.copy(wideFrames[0].position)

  const brain = new Group()
  scene.add(brain)

  // Shared uniforms. `uHot` is per-material, everything else is one object.
  const shared = {
    uTime: { value: 0 },
    uActivity: { value: 1 },
    uSuppression: { value: 0 },
    uBurst: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uDepthRef: { value: wideFrames[0].position.distanceTo(wideFrames[0].target) },
    uFocus: { value: TIP.clone() },
    uCool: { value: COOL.clone() },
    uWarm: { value: WARM.clone() },
    uJitter: { value: reduced ? 0 : 1 },
    uShellFade: { value: 1 }
  }

  const materials = []

  function addPoints (positions, { hot, blending }) {
    const count = positions.length / 3
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) seeds[i] = Math.random()

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))

    const material = new ShaderMaterial({
      uniforms: { ...shared, uHot: { value: hot } },
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending
    })
    material.userData.hot = hot
    materials.push(material)
    brain.add(new Points(geometry, material))
  }

  // --- fiber ------------------------------------------------------------
  const cordMaterial = new LineBasicMaterial({ color: CORD.clone(), transparent: true, opacity: 0.85 })
  const cordLine = new Line(new BufferGeometry().setFromPoints(cordPoints(CORD_PATH, 60)), cordMaterial)
  brain.add(cordLine)

  const tipMaterial = new SpriteMaterial({
    map: glowTexture(), color: WARM.clone(), transparent: true,
    opacity: 0, blending: AdditiveBlending, depthWrite: false
  })
  const tip = new Sprite(tipMaterial)
  tip.scale.set(1.5, 1.5, 1)
  tip.position.copy(TIP)
  brain.add(tip)

  brain.rotation.set(0.06, wideFrames[0].spin, 0)

  // --- state ------------------------------------------------------------
  /** The framings in use: the wide ones, or a phone's (see setPhone). */
  let frames = wideFrames
  let frame = 0
  let hotMix = frames[0].hot
  const pointer = { x: 0, y: 0 }
  const smoothed = { x: 0, y: 0 }
  const camTarget = frames[0].target.clone()
  const scratch = new Vector3()
  const scratchColour = new Color()
  stillness.addEventListener('change', (event) => {
    reduced = event.matches
    // The per-point breathing is ambient motion nobody asked for, so it stops
    // with the idle drift rather than shimmering on underneath it.
    shared.uJitter.value = reduced ? 0 : 1
  })

  // Settled rather than all-or-nothing: one missing highlight file used to
  // take the 24,000-point shell down with it.
  Promise.allSettled(GEOMETRY.map((g) => loadPoints(g.url))).then((results) => {
    const missing = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        addPoints(result.value, GEOMETRY[i])
        if (i === 0) shellPositions = result.value
      } else missing.push(GEOMETRY[i].url)
    })
    if (frame > 0) requestVessels()
    if (frame > 2) requestFun()
    if (frame > 3) requestTracts()
    const loaded = results.length - missing.length
    // A portfolio without its ornament is still a portfolio, but a fetch that
    // failed is worth saying out loud once.
    if (missing.length) console.warn(`Model geometry unavailable: ${missing.join(', ')}`)
    canvas.classList.add(loaded ? 'is-loaded' : 'is-failed')
  })

  // --- vessels ------------------------------------------------------------
  // The heaviest geometry on the page and only seen two sections down, so it
  // is fetched once the reader has left the opening, not with the shell.
  let vessels = null
  let vesselMix = 0
  let vesselsRequested = false
  const focus = new Vector3()

  // --- side projects --------------------------------------------------------
  // Small, but only needed near the end of the page, and it borrows the
  // shell's own positions as its starting points.
  let shellPositions = null
  let fun = null
  let funMix = 0
  let funRequested = false
  let funView = null
  let funBox = null

  /**
   * Maps a point in the brain group's frame to the screen as the side-projects
   * framing settles: that frame's camera and spin, without the pointer's
   * parallax or the idle drift, which are small and should move the views
   * rather than be fitted away.
   */
  function fitFun () {
    if (!fun || !funBox) return
    const f = frames[FUN]
    const view = camera.clone()
    view.position.copy(f.position)
    view.lookAt(f.target)
    view.updateMatrixWorld()
    const turn = new Matrix4().makeRotationFromEuler(new Euler(0.06, f.spin, 0))
    onFit?.(fun.fit((point) => point.clone().applyMatrix4(turn).project(view), funBox))
  }

  function requestFun () {
    if (funRequested || !shellPositions) return
    funRequested = true
    loadFun('/data/fun.json').then((data) => {
      fun = createFun(data, brain, shared, shellPositions, {
        ink: new Color(ink), dim: new Color(dim), warm: WARM.clone(), inkCss: ink, labelCss: label, ground: ground
      }, { light })
      fun.setView(funView)
      fitFun()
    }).catch((error) => console.warn(`Side-project data unavailable: ${error.message}`))
  }

  // --- tracts ---------------------------------------------------------------
  let tracts = null
  let tractsMix = 0
  let tractsRequested = false
  // The reader can turn the brain on this framing; the turn eases away on
  // any other.
  const turn = { yaw: 0, pitch: 0, at: -99 }
  let lastTime = 0

  function requestTracts () {
    if (tractsRequested || !materials.length) return
    tractsRequested = true
    loadTracts('/data/tracts.bin').then((data) => {
      tracts = createTracts(data, brain, shared, { ink: new Color(ink) })
    }).catch((error) => console.warn(`Tract geometry unavailable: ${error.message}`))
  }

  function requestVessels () {
    if (vesselsRequested || !materials.length) return
    vesselsRequested = true
    loadVessels('/data/vessels.bin').then((data) => {
      vessels = createVessels(data, brain, shared, { lift: new Color(ink), spark: new Color(ink), light })
    }).catch((error) => console.warn(`Vessel geometry unavailable: ${error.message}`))
  }

  return {
    setFrame (index) {
      frame = Math.max(0, Math.min(frames.length - 1, index))
      if (frame > 0) requestVessels()
      if (frame > 2) requestFun()
      if (frame > 3) requestTracts()
    },

    /** Turns the brain by a drag, in radians; only the contact framing listens. */
    turn (dx, dy) {
      if (frame !== CONTACT) return
      turn.yaw += dx
      turn.pitch = Math.max(-0.7, Math.min(0.7, turn.pitch + dy))
      turn.at = lastTime
    },

    /** Which side project's data to show: 'lotto', 'football', or null for the landscape. */
    setView (name) {
      funView = name
      fun?.setView(name)
    },

    /**
     * Where the side-projects views may stand, in normalised device coordinates
     * of the canvas: `top` is the section's label, `bottom` its last project.
     */
    setFitBox (box) {
      funBox = box
      fitFun()
    },

    /** A line describing what the side-projects view shows right now. */
    get live () {
      return fun?.live ?? ''
    },

    setPointer (x, y) {
      pointer.x = x
      pointer.y = y
    },

    resize (width, height) {
      renderer.setSize(width, height, false)
      const aspect = Math.max(0.1, width / Math.max(1, height))
      camera.aspect = aspect
      // Below the reference aspect — the full-width canvas on a phone, mostly —
      // hold the horizontal field of view and let the vertical one open up, so
      // a narrow window shows more sky rather than less brain.
      const widen = aspect < REFERENCE_ASPECT ? REFERENCE_ASPECT / aspect : 1
      camera.fov = 2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * widen) * (180 / Math.PI)
      camera.updateProjectionMatrix()
      shared.uPixelRatio.value = renderer.getPixelRatio()
      fitFun()
    },

    /** Uses the framings composed for a phone's full-width stage, or not. */
    setPhone (on) {
      frames = on ? phoneFrames : wideFrames
      fitFun()
    },

    /**
     * @param {number} dt seconds
     * @param {{time:number, activity:number, suppression:number, burst:number, lit:boolean}} state
     */
    update (dt, state) {
      const f = frames[frame]

      shared.uTime.value = state.time
      shared.uActivity.value = state.activity
      shared.uSuppression.value = state.suppression
      shared.uBurst.value = state.burst

      hotMix += (f.hot - hotMix) * approach(1.8, dt)
      for (const material of materials) {
        material.uniforms.uHot.value = material.userData.hot ? Math.max(f.hot, 0.55) : hotMix
      }

      const follow = approach(2.4, dt)
      smoothed.x += (pointer.x - smoothed.x) * follow
      smoothed.y += (pointer.y - smoothed.y) * follow

      const ease = approach(2.1, dt)
      scratch.copy(f.position)
      scratch.x += smoothed.x * 1.8
      scratch.y += -smoothed.y * 1.2
      camera.position.lerp(scratch, ease)
      camTarget.lerp(f.target, ease)
      camera.lookAt(camTarget)
      shared.uDepthRef.value = camera.position.distanceTo(camTarget)

      // The idle drift wanders rather than accumulates. An open-ended rotation
      // reads the same for ten seconds and then quietly destroys the framing
      // every section was composed for.
      const drift = reduced ? 0 : Math.sin(state.time * 0.11) * 0.06
      // A drag on the contact framing turns the brain, and follows the hand
      // closely while it lasts; elsewhere the turn unwinds on its own.
      const turning = state.time - turn.at < 0.2
      if (frame !== CONTACT) {
        turn.yaw = Math.atan2(Math.sin(turn.yaw), Math.cos(turn.yaw))
        turn.yaw *= 1 - approach(1.2, dt)
        turn.pitch *= 1 - approach(1.2, dt)
      }
      const hold = turning ? approach(9, dt) : ease
      const spin = f.spin + drift + smoothed.x * 0.1 + turn.yaw
      brain.rotation.y += (spin - brain.rotation.y) * hold
      brain.rotation.x += (0.06 + smoothed.y * 0.05 + turn.pitch - brain.rotation.x) * hold
      lastTime = state.time

      // Into the vessel view on the research framing. The shell recedes to a
      // trace, the fiber withdraws, and the light's front starts from where
      // the beam meets the cortex rather than from the fiber tip.
      vesselMix += ((frame === RESEARCH && vessels ? 1 : 0) - vesselMix) * approach(1.6, dt)
      const mix = smoothstep01(vesselMix)
      // The data view takes the shell's dots away entirely: they are the data.
      funMix += ((frame === FUN && fun ? 1 : 0) - funMix) * approach(1.3, dt)
      const data = smoothstep01(funMix)
      tractsMix += ((frame === CONTACT && tracts ? 1 : 0) - tractsMix) * approach(1.4, dt)
      const connect = smoothstep01(tractsMix)
      // The shell stays at half strength: clear enough to read as the brain the
      // paths sit in, quiet enough not to compete with them.
      shared.uShellFade.value = (1 - mix * 0.86) * (1 - data) * (1 - connect * 0.5)
      focus.lerpVectors(TIP, SPOT, mix).lerp(CALLOSUM, connect)
      shared.uFocus.value.copy(focus)
      vessels?.update(dt, state, mix)
      fun?.update(dt, state, data)
      tracts?.update(dt, state, connect)

      const lit = state.lit ? 1 : 0
      const fiber = 1 - Math.max(mix, data, connect)
      tipMaterial.opacity += ((lit * 0.62 + state.suppression * 0.22) * fiber - tipMaterial.opacity) * approach(7.6, dt)
      tip.scale.setScalar(1.3 + lit * 1.15 + state.suppression * 0.45)
      cordMaterial.color.copy(scratchColour.copy(CORD).lerp(WARM, state.suppression * 0.5))
      cordMaterial.opacity = 0.85 * fiber
      cordLine.visible = fiber > 0.002
    },

    render () {
      renderer.render(scene, camera)
    }
  }
}
