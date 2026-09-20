/**
 * The model: a point-sampled mouse brain from the Allen Common Coordinate
 * Framework, with the trigeminal nerve and its sensory nucleus loaded
 * separately so the therapeutic target can be lit on its own.
 *
 * Geometry ships as Int16 binaries (6 bytes per point, 1/160 mm per unit) and
 * is fetched after first paint, so the text never waits on it.
 */

import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture,
  CatmullRomCurve3, Color, Group, Line, LineBasicMaterial, NormalBlending,
  ColorManagement, PerspectiveCamera, Points, Scene, ShaderMaterial, Sprite,
  SpriteMaterial, Vector3, WebGLRenderer
} from 'three'

// The palette is authored in sRGB and the point shader does its own luminance
// maths, so three's linear working space would darken every colour on the way
// through. Working directly in sRGB keeps what the design specifies.
ColorManagement.enabled = false

import { pointVertex, pointFragment } from './shaders.js'
import { frames } from './frames.js'

const SCALE = 160
const COOL = new Color('#7fa3c9')
const WARM = new Color('#ff5c33')
const CORD = new Color('#2c3644')

/** Where the fiber tip sits, in millimetres, next to the trigeminal nerve. */
const TIP = new Vector3(-3.35, -1.65, 2.15)

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

export function createScene ({ canvas }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(34, 1, 0.1, 200)
  camera.position.copy(frames[0].position)

  const brain = new Group()
  scene.add(brain)

  // Shared uniforms. `uHot` is per-material, everything else is one object.
  const shared = {
    uTime: { value: 0 },
    uActivity: { value: 1 },
    uSuppression: { value: 0 },
    uBurst: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uFocus: { value: TIP.clone() },
    uCool: { value: COOL.clone() },
    uWarm: { value: WARM.clone() }
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
  const cordCurve = new CatmullRomCurve3([
    new Vector3(-1.2, 7.4, 7.6),
    new Vector3(-2.4, 3.1, 5.4),
    new Vector3(-3.1, 0.2, 3.4),
    TIP
  ])
  brain.add(new Line(new BufferGeometry().setFromPoints(cordCurve.getPoints(60)), cordMaterial))

  const tipMaterial = new SpriteMaterial({
    map: glowTexture(), color: WARM.clone(), transparent: true,
    opacity: 0, blending: AdditiveBlending, depthWrite: false
  })
  const tip = new Sprite(tipMaterial)
  tip.scale.set(1.5, 1.5, 1)
  tip.position.copy(TIP)
  brain.add(tip)

  brain.rotation.set(0.06, frames[0].spin, 0)

  // --- state ------------------------------------------------------------
  let frame = 0
  let hotMix = frames[0].hot
  const pointer = { x: 0, y: 0 }
  const smoothed = { x: 0, y: 0 }
  const camTarget = frames[0].target.clone()
  const scratch = new Vector3()
  const scratchColour = new Color()
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let loaded = false

  const ready = Promise.all(GEOMETRY.map((g) => loadPoints(g.url)))
    .then((sets) => {
      sets.forEach((positions, i) => addPoints(positions, GEOMETRY[i]))
      loaded = true
      canvas.classList.add('is-loaded')
    })
    .catch((error) => {
      // A portfolio without its ornament is still a portfolio.
      console.warn('Model geometry unavailable:', error.message)
      canvas.classList.add('is-failed')
    })

  return {
    ready,
    get loaded () { return loaded },

    setFrame (index) {
      frame = Math.max(0, Math.min(frames.length - 1, index))
    },

    setPointer (x, y) {
      pointer.x = x
      pointer.y = y
    },

    resize (width, height) {
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      shared.uPixelRatio.value = renderer.getPixelRatio()
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

      hotMix += (f.hot - hotMix) * 0.03
      for (const material of materials) {
        material.uniforms.uHot.value = material.userData.hot ? Math.max(f.hot, 0.55) : hotMix
      }

      smoothed.x += (pointer.x - smoothed.x) * 0.04
      smoothed.y += (pointer.y - smoothed.y) * 0.04

      scratch.copy(f.position)
      scratch.x += smoothed.x * 1.8
      scratch.y += -smoothed.y * 1.2
      camera.position.lerp(scratch, 0.035)
      camTarget.lerp(f.target, 0.035)
      camera.lookAt(camTarget)

      const drift = reduced ? 0 : state.time * 0.028
      const spin = f.spin + drift + smoothed.x * 0.1
      brain.rotation.y += (spin - brain.rotation.y) * 0.035
      brain.rotation.x += (0.06 + smoothed.y * 0.05 - brain.rotation.x) * 0.035

      const lit = state.lit ? 1 : 0
      tipMaterial.opacity += (lit * 0.62 + state.suppression * 0.22 - tipMaterial.opacity) * 0.12
      tip.scale.setScalar(1.3 + lit * 1.15 + state.suppression * 0.45)
      cordMaterial.color.copy(scratchColour.copy(CORD).lerp(WARM, state.suppression * 0.5))
    },

    render () {
      renderer.render(scene, camera)
    },

    dispose () {
      renderer.dispose()
    }
  }
}
