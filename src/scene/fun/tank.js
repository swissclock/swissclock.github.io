/**
 * Aquascape Studio, as its showcase tank: the "Iwagumi Study", a 60 × 30 × 36
 * cm rimless tank laid out the way the game lays it out (scape.js). Seiryu
 * stones in a sanzon iwagumi, the main one on the golden-ratio line and all
 * leaning left; aqua soil rising to the back with a hill under the main stone;
 * a band of grey sand along the front glass; hairgrass at the back, thickest
 * behind the main stone, and HC carpeting the rest; fourteen rummynose tetras.
 *
 * The tank runs a day, an hour every couple of seconds, on the game's own
 * CO₂ and pH rules at its default settings: the solenoid opens two hours
 * before the lights, the lights fade up for seven hours, and the drop in pH
 * follows the CO₂. Spikes release CO₂ mist from the diffuser while it runs,
 * and set the carpet pearling while the light is on.
 */

import { Box3, BufferAttribute, BufferGeometry, Group, Line, LineSegments, Mesh, Points, ShaderMaterial, AdditiveBlending, Vector3 } from 'three'
import { dotsMaterial, glslCommon, groundMaterial, seeded, spikes, traceMaterial } from './common.js'
import { BPS, D, KH, TANK_H, W, WATER, co2Running, ground, lightLevel, litres, perBubble, portions, sandEdge, STONES, WIDTH } from './scape.js'

const K = 0.14            // scene units per cm
const PLANE = -1.4
const X = (cm) => (cm - W / 2) * K
const Y = (cm) => (cm - TANK_H / 2) * K
const Z = (fz) => PLANE - 0.3 + fz * 0.6   // fz: 0 at the back glass, 1 at the front
const SECONDS_PER_HOUR = 2.2

const grassVertex = /* glsl */ `
attribute float aBend;
attribute float aLen;
attribute float aPhase;
uniform float uAmount;
uniform float uTime;
uniform float uSway;
uniform float uCurrent;
${glslCommon}
varying float vAlpha;
void main() {
  vec3 p = position;
  float b = aBend * aBend;
  float push = (uCurrent + uSway * sin(uTime * 1.15 + aPhase + p.x * 0.7)) * b * aLen;
  p.x += push;
  p.y -= abs(push) * 0.35 * aBend;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = uAmount * depthFade(-mv.z) * (0.55 + 0.45 * aBend);
}
`

const grassFragment = /* glsl */ `
uniform vec3 uColour;
uniform vec3 uWarm;
uniform float uSuppression;
uniform float uOpacity;
varying float vAlpha;
void main() { gl_FragColor = vec4(mix(uColour, uWarm, uSuppression * 0.7), vAlpha * uOpacity); }
`

function lineOf (points, material, Kind = Line) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  const object = new Kind(geometry, material)
  object.frustumCulled = false
  return object
}

function dotsOf (count, material) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aSize', new BufferAttribute(new Float32Array(count), 1))
  geometry.setAttribute('aAlpha', new BufferAttribute(new Float32Array(count), 1))
  const object = new Points(geometry, material)
  object.frustumCulled = false
  return object
}

/** A seiryu outline: tall, angular, tapering, and leaning with the rest. */
function stoneShape (rng, size, h) {
  const w = h * WIDTH[size]
  const hw = (v) => (w / 2) * (1 - 0.62 * Math.pow(v, 1.25))
  const jag = () => 1 + (rng() - 0.5) * 0.3
  const left = []
  const right = []
  const steps = size === 'XS' ? 3 : 6
  for (let i = 0; i < steps; i++) {
    const v = 0.08 + (i / steps) * 0.84 + (rng() - 0.5) * 0.06
    left.push([-hw(v) * jag(), v * h])
    right.push([hw(v) * jag(), v * h])
  }
  const peak = [(rng() - 0.35) * w * 0.25, h]
  const outline = [[-w / 2, -2], ...left, peak, ...right.reverse(), [w / 2, -2]]
  // Seiryu's veins run up the stone with its grain.
  const veins = []
  const count = size === 'XS' ? 0 : size === 'S' ? 2 : 3
  for (let k = 0; k < count; k++) {
    const v0 = 0.08 + rng() * 0.25
    const v1 = Math.min(0.92, v0 + 0.3 + rng() * 0.3)
    const s = (k / Math.max(1, count - 1) - 0.5) * 1.1 + (rng() - 0.5) * 0.2
    veins.push([[s * hw(v0), v0 * h], [s * hw(v1) * 0.8 + (rng() - 0.5) * w * 0.08, v1 * h]])
  }
  return { outline, veins, centre: [0, h * 0.35] }
}

export function createTank ({ shared, colours, light: phone }) {
  const group = new Group()
  const cool = shared.uCool.value
  const traces = []
  const trace = (colour, opacity) => {
    const m = traceMaterial(shared, colour, opacity)
    traces.push({ m, opacity })
    return m
  }
  const rng = seeded(20261004)

  // --- glass, water and the light over it ------------------------------------
  const front = Z(1) + 0.02
  const g = 0.6
  const glass = lineOf([
    X(-g), Y(0), front, X(W + g), Y(0), front,
    X(W + g), Y(0), front, X(W + g), Y(TANK_H), front,
    X(W + g), Y(TANK_H), front, X(-g), Y(TANK_H), front,
    X(-g), Y(TANK_H), front, X(-g), Y(0), front
  ], trace(cool, 0.45), LineSegments)
  const SURFACE = 90
  const surface = lineOf(new Float32Array(SURFACE * 3), trace(cool, 0.6))
  const lamp = lineOf([X(5), Y(TANK_H + 6), Z(0.5), X(W - 5), Y(TANK_H + 6), Z(0.5)], trace(colours.ink, 0.8))
  group.add(glass, surface, lamp)

  // --- substrate: the slope's crest against the back, and the cut at the front glass
  const crest = []
  const cut = []
  for (let i = 0; i <= 80; i++) {
    const fx = i / 80
    let top = 0
    for (let j = 0; j <= 20; j++) top = Math.max(top, ground(fx, j / 20))
    crest.push(X(fx * W), Y(top), Z(0))
    cut.push(X(fx * W), Y(ground(fx, 1)), front)
  }
  group.add(lineOf(crest, trace(cool, 0.35)), lineOf(cut, trace(cool, 0.8)))
  const GRAINS = phone ? 260 : 520
  const grains = dotsOf(GRAINS, dotsMaterial(shared, cool))
  {
    const p = grains.geometry.attributes.position.array
    const s = grains.geometry.attributes.aSize.array
    const a = grains.geometry.attributes.aAlpha.array
    for (let i = 0; i < GRAINS; i++) {
      const fx = rng()
      const top = ground(fx, 1)
      const y = rng() * top
      p[i * 3] = X(fx * W); p[i * 3 + 1] = Y(y); p[i * 3 + 2] = front
      // Grey sand in the top few millimetres, dark soil under it.
      const sand = y > top - 0.6
      s[i] = sand ? 1.2 + rng() * 0.6 : 1.6 + rng() * 1.2
      a[i] = sand ? 0.55 : 0.18 + rng() * 0.2
    }
  }
  group.add(grains)
  // The sand foreground's surface, from the carpet's edge to the glass.
  const SAND = phone ? 160 : 340
  const sand = dotsOf(SAND, dotsMaterial(shared, cool))
  {
    const p = sand.geometry.attributes.position.array
    const s = sand.geometry.attributes.aSize.array
    const a = sand.geometry.attributes.aAlpha.array
    for (let i = 0; i < SAND; i++) {
      const fx = rng()
      const fz = sandEdge(fx) + rng() * (1 - sandEdge(fx))
      p[i * 3] = X(fx * W); p[i * 3 + 1] = Y(ground(fx, fz)); p[i * 3 + 2] = Z(fz)
      s[i] = 1.1 + rng() * 0.7
      a[i] = 0.3 + rng() * 0.3
    }
  }
  group.add(sand)

  // --- stones -----------------------------------------------------------------
  const fills = []
  for (const { size, x: sx, fz: sfz, lean, h, seed } of STONES) {
    const shape = stoneShape(seeded(seed), size, h)
    // Bedded 2 cm into the soil, as placed by hand; the fragments sit nearer the top.
    const by = ground(sx / W, sfz) + (size === 'XS' ? 1.5 : 0)
    const c = Math.cos(lean)
    const sn = Math.sin(lean)
    const at = ([x, y]) => [X(sx + x * c + y * sn), Y(by + (-x * sn + y * c))]
    const z = Z(sfz)
    const outline = shape.outline.map(at)
    group.add(lineOf(outline.flatMap(([x, y]) => [x, y, z]), trace(cool, 0.95)))
    if (shape.veins.length) {
      group.add(lineOf(shape.veins.flatMap(([a, b]) => [...at(a), z, ...at(b), z]), trace(cool, 0.4), LineSegments))
    }
    // The ground colour inside, so a stone hides the grass behind it.
    const centre = at(shape.centre)
    const fan = [centre[0], centre[1], z - 0.001]
    for (const [x, y] of outline) fan.push(x, y, z - 0.001)
    const index = []
    for (let k = 1; k < outline.length; k++) index.push(0, k, k + 1)
    index.push(0, outline.length, 1)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(fan), 3))
    geometry.setIndex(index)
    const fill = new Mesh(geometry, groundMaterial(colours.ground))
    fill.renderOrder = -1
    fills.push(fill)
    group.add(fill)
  }

  // --- plants, portion by portion on the game's 2.6 cm grid --------------------
  const blades = []
  const carpet = []
  for (const { x, fz, kind } of portions(rng)) {
    const y0 = ground(x / W, fz)
    if (kind !== 'hc') {
      const tall = kind === 'hairgrass'
      for (let b = 0; b < 6; b++) {
        blades.push({
          x: x + (rng() - 0.5) * 2.2, y: y0, fz,
          len: tall ? 7 + rng() * 5 : 3 + rng() * 2.5,
          tilt: (rng() - 0.5) * 0.35, phase: rng() * 6.28
        })
      }
    } else {
      for (let d = 0; d < (phone ? 5 : 9); d++) {
        const r = Math.sqrt(rng()) * 1.4
        const t = rng() * 6.28
        carpet.push({ x: x + Math.cos(t) * r, y: y0 + 0.3 + rng() * 1.1, fz: Math.min(1, fz + Math.sin(t) * r / D) })
      }
    }
  }

  const grassGeometry = new BufferGeometry()
  const gp = new Float32Array(blades.length * 4 * 3)
  const gBend = new Float32Array(blades.length * 4)
  const gLen = new Float32Array(blades.length * 4)
  const gPhase = new Float32Array(blades.length * 4)
  blades.forEach((b, i) => {
    const along = [0, 0.5, 0.5, 1]
    along.forEach((f, k) => {
      const v = i * 4 + k
      const curl = f * f * b.tilt
      gp[v * 3] = X(b.x + Math.sin(curl) * b.len * f); gp[v * 3 + 1] = Y(b.y + Math.cos(curl) * b.len * f); gp[v * 3 + 2] = Z(b.fz)
      gBend[v] = f; gLen[v] = b.len * K; gPhase[v] = b.phase
    })
  })
  grassGeometry.setAttribute('position', new BufferAttribute(gp, 3))
  grassGeometry.setAttribute('aBend', new BufferAttribute(gBend, 1))
  grassGeometry.setAttribute('aLen', new BufferAttribute(gLen, 1))
  grassGeometry.setAttribute('aPhase', new BufferAttribute(gPhase, 1))
  const grassUniforms = {
    uPixelRatio: shared.uPixelRatio, uDepthRef: shared.uDepthRef, uSuppression: shared.uSuppression,
    uWarm: shared.uWarm, uAmount: { value: 0 }, uTime: { value: 0 }, uSway: { value: 0.06 }, uCurrent: { value: 0.05 },
    uColour: { value: cool.clone() }, uOpacity: { value: 0.7 }
  }
  const grass = new LineSegments(grassGeometry, new ShaderMaterial({
    uniforms: grassUniforms, vertexShader: grassVertex, fragmentShader: grassFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))
  grass.frustumCulled = false

  const hcMaterial = dotsMaterial(shared, cool)
  const hc = dotsOf(carpet.length, hcMaterial)
  {
    const p = hc.geometry.attributes.position.array
    const s = hc.geometry.attributes.aSize.array
    const a = hc.geometry.attributes.aAlpha.array
    carpet.forEach((c, i) => {
      p[i * 3] = X(c.x); p[i * 3 + 1] = Y(c.y); p[i * 3 + 2] = Z(c.fz)
      s[i] = 1.6 + rng() * 1.1
      a[i] = 0.4 + rng() * 0.45
    })
  }
  group.add(grass, hc)

  // --- the diffuser, and what rises: CO₂ mist and pearls of oxygen -------------
  const DIFFUSER = { x: W - 5, fz: 0.12 }
  DIFFUSER.y = ground(DIFFUSER.x / W, DIFFUSER.fz) + 2.5
  group.add(lineOf([
    X(DIFFUSER.x - 1.2), Y(DIFFUSER.y), Z(DIFFUSER.fz), X(DIFFUSER.x + 1.2), Y(DIFFUSER.y), Z(DIFFUSER.fz),
    X(DIFFUSER.x), Y(DIFFUSER.y), Z(DIFFUSER.fz), X(DIFFUSER.x), Y(DIFFUSER.y - 2.5), Z(DIFFUSER.fz)
  ], trace(cool, 0.7), LineSegments))
  const BUBBLES = 120
  const bubbleMaterial = dotsMaterial(shared, colours.ink, 1)
  const bubbleDots = dotsOf(BUBBLES, bubbleMaterial)
  group.add(bubbleDots)
  const bubbles = Array.from({ length: BUBBLES }, () => ({ alive: false, x: 0, y: 0, fz: 0, vy: 0, phase: 0, size: 0, alpha: 0 }))
  let nextBubble = 0
  function release (x, y, fz, vy, size, alpha) {
    const b = bubbles[nextBubble]
    nextBubble = (nextBubble + 1) % BUBBLES
    Object.assign(b, { alive: true, x, y, fz, vy, size, alpha, phase: Math.random() * 6.28 })
  }
  const mist = () => release(DIFFUSER.x + (Math.random() - 0.5) * 2, DIFFUSER.y + 0.3, DIFFUSER.fz, 4 + Math.random() * 3, 1.3 + Math.random() * 0.9, 0.55)
  const pearl = () => {
    const c = carpet[(Math.random() * carpet.length) | 0]
    if (c) release(c.x, c.y + 0.2, c.fz, 2.2 + Math.random() * 1.6, 1.6 + Math.random() * 0.6, 0.9)
  }

  // --- fourteen rummynose tetras ------------------------------------------------
  const FISH = 14
  const fishRng = seeded(14)
  const fish = Array.from({ length: FISH }, () => ({
    ox: (fishRng() - 0.5) * 9, oy: (fishRng() - 0.5) * 3.2, phase: fishRng() * 6.28, heading: 1, len: 3.2 + fishRng() * 0.6
  }))
  // Each fish: a body and a forked tail.
  const bodies = lineOf(new Float32Array(FISH * 6 * 3), trace(cool, 0.95), LineSegments)
  const heads = dotsOf(FISH, dotsMaterial(shared, colours.ink, 1))
  for (let i = 0; i < FISH; i++) { heads.geometry.attributes.aSize.array[i] = 2.6; heads.geometry.attributes.aAlpha.array[i] = 0.9 }
  group.add(bodies, heads)

  // --- the day ---------------------------------------------------------------------
  let hour = 10.5
  let co2 = 3
  const stepCo2 = (dtH) => {
    const target = 3 + (co2Running(hour) ? BPS * perBubble : 0)
    co2 += (target - co2) * (1 - Math.exp(-dtH / 1.0))
  }
  // Settle into the daily rhythm before anyone looks.
  for (let k = 0; k < 24 * 3 * 10; k++) { hour = (hour + 0.1) % 24; stepCo2(0.1) }
  hour = 10.5

  let live = ''
  let wasShown = false
  let school = 0
  let startle = 0
  let clock = 0
  let mistDue = 0
  let pearlDue = 0
  const watch = spikes()

  function describe () {
    const ph = 7 - Math.log10(Math.max(co2, 0.5) / (3 * KH))
    const h = Math.floor(hour)
    const m = Math.floor((hour - h) * 6) * 10
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const lit = lightLevel(hour) > 0 ? 'lights on' : co2Running(hour) ? 'CO₂ on, lights off' : 'lights off'
    live = `Iwagumi Study, ${Math.round(litres)} L · ${time} · ${lit} · CO₂ ${Math.round(co2)} ppm · pH ${ph.toFixed(1)}`
  }
  describe()

  return {
    group,
    bounds: new Box3(new Vector3(X(-g), Y(0), Z(0)), new Vector3(X(W + g), Y(TANK_H + 6), Z(1))),
    get live () { return live },

    update (dt, state, amount) {
      group.visible = amount > 0.001
      const motion = shared.uJitter.value ? 1 : 0.15
      if (amount > 0.05 && !wasShown) {
        // Each visit starts before the solenoid opens, to see the day begin.
        hour = 10.5
        for (const b of bubbles) b.alive = false
      }
      wasShown = amount > 0.05
      clock += dt * motion

      if (wasShown) {
        const dtH = dt / SECONDS_PER_HOUR
        hour = (hour + dtH) % 24
        stepCo2(dtH)
        describe()
      }
      const lit = lightLevel(hour)
      const running = co2Running(hour)
      const pearling = lit > 0.6 && co2 > 20

      const spike = watch(state)
      if (spike && amount > 0.5 && state.suppression < 0.35) {
        if (running) for (let k = 0; k < 10; k++) mist()
        if (pearling) for (let k = 0; k < 7; k++) pearl()
        startle = 1
      }
      if (wasShown && running) {
        mistDue += dt * 5
        while (mistDue > 1) { mist(); mistDue-- }
      }
      if (wasShown && pearling) {
        pearlDue += dt * 2.5
        while (pearlDue > 1) { pearl(); pearlDue-- }
      }

      // Rising: a wobble, and gone at the surface.
      const bp = bubbleDots.geometry.attributes.position.array
      const bs = bubbleDots.geometry.attributes.aSize.array
      const ba = bubbleDots.geometry.attributes.aAlpha.array
      bubbles.forEach((b, i) => {
        if (b.alive) {
          b.y += b.vy * dt * motion
          if (b.y > WATER) b.alive = false
        }
        bp[i * 3] = X(b.x + Math.sin(clock * 5 + b.phase) * 0.35); bp[i * 3 + 1] = Y(b.y); bp[i * 3 + 2] = Z(b.fz) + 0.01
        bs[i] = b.size
        ba[i] = b.alive ? b.alpha * Math.min(1, (WATER - b.y) / 3) : 0
      })
      bubbleDots.geometry.attributes.position.needsUpdate = true
      bubbleDots.geometry.attributes.aSize.needsUpdate = true
      bubbleDots.geometry.attributes.aAlpha.needsUpdate = true

      // The school swims the open water in front of the stones, and darts on a spike.
      startle *= Math.exp(-dt * 1.5)
      school += dt * motion * (1 + startle * 2.5)
      const cx = W / 2 + 16 * Math.sin(school * 0.09)
      const cy = 24 + 3.5 * Math.sin(school * 0.21 + 1)
      const vx = 16 * 0.09 * Math.cos(school * 0.09)
      const vy = 3.5 * 0.21 * Math.cos(school * 0.21 + 1)
      const spread = 1 + startle * 0.5
      const fp = bodies.geometry.attributes.position.array
      const hp = heads.geometry.attributes.position.array
      fish.forEach((f, i) => {
        const wob = Math.sin(clock * 1.7 + f.phase)
        const px = cx + f.ox * spread + wob * 0.9
        const py = cy + f.oy * spread + Math.cos(clock * 1.3 + f.phase) * 0.5
        const want = vx + wob * 0.4 >= 0 ? 1 : -1
        f.heading += (want - f.heading) * Math.min(1, dt * 3)
        const tilt = Math.max(-0.2, Math.min(0.2, vy / Math.max(0.6, Math.abs(vx))))
        const half = (f.len / 2) * f.heading
        const wag = Math.sin(clock * 9 + f.phase) * 0.2
        const z = Z(0.72)
        const head = [px + half, py + Math.abs(half) * tilt]
        const tail = [px - half, py - Math.abs(half) * tilt + wag]
        const fork = 0.45 * f.heading
        const segments = [
          head, tail,
          tail, [tail[0] - fork, tail[1] + 0.45 + wag],
          tail, [tail[0] - fork, tail[1] - 0.45 + wag]
        ]
        segments.forEach(([x, y], k) => { fp[(i * 6 + k) * 3] = X(x); fp[(i * 6 + k) * 3 + 1] = Y(y); fp[(i * 6 + k) * 3 + 2] = z })
        hp[i * 3] = X(head[0]); hp[i * 3 + 1] = Y(head[1]); hp[i * 3 + 2] = z + 0.01
      })
      bodies.geometry.attributes.position.needsUpdate = true
      heads.geometry.attributes.position.needsUpdate = true

      // The surface, rippled most where the outflow sits on the left.
      const sp = surface.geometry.attributes.position.array
      for (let i = 0; i < SURFACE; i++) {
        const u = i / (SURFACE - 1)
        const ripple = (0.12 + 0.25 * Math.exp(-u * 6)) * Math.sin(clock * 2.1 - u * 26) + 0.06 * Math.sin(clock * 1.3 + u * 11)
        sp[i * 3] = X(u * W); sp[i * 3 + 1] = Y(WATER + ripple); sp[i * 3 + 2] = front
      }
      surface.geometry.attributes.position.needsUpdate = true

      // Day and night: everything planted is brighter under the light.
      const glow = 0.5 + 0.5 * lit
      for (const { m, opacity } of traces) {
        m.uniforms.uAmount.value = amount
        m.uniforms.uOpacity.value = opacity * (m === lamp.material ? 0.2 + 0.8 * lit : glow)
      }
      grassUniforms.uAmount.value = amount * glow
      grassUniforms.uTime.value = clock
      grassUniforms.uSway.value = 0.07 * motion
      grassUniforms.uColour.value.copy(cool).lerp(colours.ink, lit * 0.2)
      hcMaterial.uniforms.uAmount.value = amount * glow
      hcMaterial.uniforms.uColour.value.copy(cool).lerp(colours.ink, lit * 0.2)
      grains.material.uniforms.uAmount.value = amount
      sand.material.uniforms.uAmount.value = amount * glow
      bubbleMaterial.uniforms.uAmount.value = amount
      heads.material.uniforms.uAmount.value = amount
      for (const f of fills) {
        f.material.uniforms.uOpacity.value = amount
        f.material.depthWrite = amount > 0.6
        f.visible = amount > 0.02
      }
    }
  }
}
