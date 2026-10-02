/**
 * NextPredictor, as its season simulations: the league played out 20,000
 * times, one ridge per club for its chance of finishing in each position,
 * stacked so the nearer ridges hide the ones behind. Each spike drops one
 * sampled finish onto every ridge, the way the simulation builds them.
 * The Premier League and Ligat HaAl take turns each time the view arrives.
 */

import {
  AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Line, Mesh,
  Points, ShaderMaterial, Vector3
} from 'three'
import { glslCommon, glslDot, spikes, textSprite } from './common.js'

const LEFT = -2.9
const RIGHT = 4.5
const SAMPLES = 140
const SMOOTH = 0.42      // positions, the width of the kernel that turns bins into a curve
const PEAK = 2.1         // height of each league's tallest ridge
const ROW = 0.24
const DEPTH = 0.07
const TOP = 2.55
const PLANE = -1.4

const lineVertex = /* glsl */ `
uniform float uAmount;
uniform float uReveal;
attribute float aT;
${glslCommon}
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = step(aT, uReveal) * uAmount * depthFade(-mv.z);
}
`

const lineFragment = /* glsl */ `
uniform vec3 uColour;
uniform vec3 uWarm;
uniform float uSuppression;
uniform float uLift;
varying float vAlpha;
void main() { gl_FragColor = vec4(mix(uColour, uWarm, uSuppression * 0.7), vAlpha * (0.75 + uLift * 0.25)); }
`

// The fill is written raw, like every other material here: three's built-in
// materials convert their colour for the screen, which turns the ground grey.
const fillVertex = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const fillFragment = /* glsl */ `
uniform vec3 uGround;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uGround, uOpacity); }
`

const dropVertex = /* glsl */ `
attribute float aLife;
uniform float uAmount;
${glslCommon}
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = aLife * uAmount;
  gl_PointSize = 4.5 * uPixelRatio * (25.0 / -mv.z);
}
`

const dropFragment = /* glsl */ `
uniform vec3 uInk;
${glslDot}
varying float vAlpha;
void main() { gl_FragColor = vec4(uInk, vAlpha * dot2(1.0)); }
`

function curve (dist) {
  const n = dist.length
  const ys = new Float32Array(SAMPLES)
  for (let s = 0; s < SAMPLES; s++) {
    const pos = (s / (SAMPLES - 1)) * (n - 1)
    let y = 0
    for (let k = 0; k < n; k++) {
      const d = pos - k
      y += dist[k] * Math.exp(-(d * d) / (2 * SMOOTH * SMOOTH))
    }
    ys[s] = y
  }
  return ys
}

export function createSeasons (seasons, { shared, colours }) {
  const group = new Group()
  const leagues = seasons.map((league) => ({ league, ...buildLeague(league) }))
  // Each league to its own tallest ridge: a runaway leader in one league
  // should not flatten the other into a row of lines.
  for (const l of leagues) for (const r of l.ridges) r.setScale(PEAK / l.tallest)
  leagues.forEach((l) => group.add(l.root))

  function buildLeague (league) {
    const root = new Group()
    const teams = [...league.teams].sort((a, b) => b.exp_pts - a.exp_pts)
    const n = teams[0].pos_dist.length
    const x = (s) => LEFT + (s / (SAMPLES - 1)) * (RIGHT - LEFT)
    let tallest = 0
    const ridges = teams.map((team, k) => {
      const ys = curve(team.pos_dist)
      tallest = Math.max(tallest, ...ys)
      const base = TOP - k * ROW
      const z = PLANE + k * DEPTH

      const linePositions = new Float32Array(SAMPLES * 3)
      const t = new Float32Array(SAMPLES)
      const fill = new Float32Array(SAMPLES * 2 * 3)
      const lineGeometry = new BufferGeometry()
      lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3))
      lineGeometry.setAttribute('aT', new BufferAttribute(t, 1))
      const fillGeometry = new BufferGeometry()
      fillGeometry.setAttribute('position', new BufferAttribute(fill, 3))
      const index = []
      for (let s = 0; s < SAMPLES - 1; s++) {
        const a = s * 2
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
      fillGeometry.setIndex(index)

      const uniforms = {
        uPixelRatio: shared.uPixelRatio, uDepthRef: shared.uDepthRef, uSuppression: shared.uSuppression,
        uWarm: shared.uWarm, uAmount: { value: 0 }, uReveal: { value: 0 }, uLift: { value: 0 },
        uColour: { value: shared.uCool.value.clone() }
      }
      const line = new Line(lineGeometry, new ShaderMaterial({
        uniforms, vertexShader: lineVertex, fragmentShader: lineFragment,
        transparent: true, depthWrite: false, blending: AdditiveBlending
      }))
      // The ground colour under each ridge, so the ridge in front hides the
      // part of the one behind it, which is what makes the stack read.
      const fillMaterial = new ShaderMaterial({
        uniforms: { uGround: { value: new Color(colours.ground) }, uOpacity: { value: 0 } },
        vertexShader: fillVertex, fragmentShader: fillFragment,
        side: DoubleSide, transparent: true, depthWrite: true
      })
      const mesh = new Mesh(fillGeometry, fillMaterial)
      mesh.renderOrder = 1
      line.renderOrder = 2
      root.add(mesh, line)

      // Named only while featured, just above its peak.
      const label = textSprite(team.short || team.name, { colour: colours.inkCss, height: 0.2 })
      // Over the ridges in front of it, which would otherwise hide it.
      label.material.depthTest = false
      label.renderOrder = 4
      root.add(label)
      let peak = 0
      for (let s = 1; s < SAMPLES; s++) if (ys[s] > ys[peak]) peak = s

      function setScale (gain) {
        for (let s = 0; s < SAMPLES; s++) {
          const y = base + ys[s] * gain
          linePositions[s * 3] = x(s); linePositions[s * 3 + 1] = y; linePositions[s * 3 + 2] = z
          t[s] = s / (SAMPLES - 1)
          fill[s * 6] = x(s); fill[s * 6 + 1] = y; fill[s * 6 + 2] = z
          fill[s * 6 + 3] = x(s); fill[s * 6 + 4] = base - 0.02; fill[s * 6 + 5] = z
        }
        label.position.set(x(peak), base + ys[peak] * gain + 0.2, z + 0.02)
        lineGeometry.attributes.position.needsUpdate = true
        lineGeometry.attributes.aT.needsUpdate = true
        fillGeometry.attributes.position.needsUpdate = true
        ridge.gain = gain
      }

      const ridge = { team, base, z, uniforms, fillMaterial, mesh, label, setScale, gain: 1, ys, k }
      return ridge
    })

    const axis = ['1st', `${n}th`].map((text, i) => {
      const s = textSprite(text, { colour: colours.labelCss, height: 0.17 })
      s.position.set(i ? RIGHT : LEFT, TOP - teams.length * ROW - 0.12, PLANE + teams.length * DEPTH)
      root.add(s)
      return s
    })
    return { root, ridges, axis, tallest, n }
  }

  // Monte Carlo drops: one per club per spike, falling onto its ridge.
  const MAX = 24
  const drops = new Float32Array(MAX * 3)
  const life = new Float32Array(MAX)
  const dropGeometry = new BufferGeometry()
  dropGeometry.setAttribute('position', new BufferAttribute(drops, 3))
  dropGeometry.setAttribute('aLife', new BufferAttribute(life, 1))
  const dropUniforms = {
    uPixelRatio: shared.uPixelRatio, uDepthRef: shared.uDepthRef, uSuppression: shared.uSuppression,
    uInk: { value: colours.ink }, uAmount: { value: 0 }
  }
  const dropPoints = new Points(dropGeometry, new ShaderMaterial({
    uniforms: dropUniforms, vertexShader: dropVertex, fragmentShader: dropFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))
  dropPoints.frustumCulled = false
  dropPoints.renderOrder = 3
  group.add(dropPoints)
  const falling = Array.from({ length: MAX }, () => ({ t: 1, from: 0, to: 0, x: 0, z: 0 }))

  let shown = 0
  let wasShown = false
  let featured = 0
  let reveal = 0
  let live = ''
  const watch = spikes()
  const pct = (p) => (p >= 0.995 ? '99%+' : p < 0.005 ? 'under 1%' : `${Math.round(p * 100)}%`)

  function describe () {
    const { league, ridges } = leagues[shown]
    const r = ridges[featured]
    const t = r.team
    const parts = [`${t.name}: title ${pct(t.p_title)}`]
    if (t.p_top4 != null && league.comp === 'EPL') parts.push(`top four ${pct(t.p_top4)}`)
    if (t.p_relegation > 0.005) parts.push(`relegated ${pct(t.p_relegation)}`)
    live = `${league.name}, played out ${league.simulated.toLocaleString('en-US')} times · ${parts.join(' · ')}`
  }

  // The larger league decides the space: its ridges, the leader's peak and its
  // label, and the axis under the front ridge.
  const rows = Math.max(...leagues.map((l) => l.ridges.length))

  return {
    group,
    bounds: new Box3(new Vector3(LEFT, TOP - rows * ROW - 0.3, PLANE), new Vector3(RIGHT, TOP + PEAK + 0.45, PLANE + rows * DEPTH)),
    get live () { return live },

    update (dt, state, amount) {
      group.visible = amount > 0.001
      if (amount > 0.05 && !wasShown) {
        // A new arrival: the other league, drawn in from the left again.
        shown = (shown + (leagues.length > 1 && reveal > 0 ? 1 : 0)) % leagues.length
        reveal = 0
        featured = 0
        describe()
      }
      wasShown = amount > 0.05
      if (wasShown) reveal = Math.min(1, reveal + dt / 1.6)

      const spike = watch(state)
      const current = leagues[shown]
      if (spike && amount > 0.5 && state.suppression < 0.35 && reveal >= 1) {
        if (spike.run) {
          featured = (Math.random() * Math.min(8, current.ridges.length)) | 0
          describe()
        }
        // Sample one finish for every club from its own distribution.
        current.ridges.forEach((r, k) => {
          if (k >= MAX) return
          let u = Math.random()
          let pos = 0
          while (pos < r.team.pos_dist.length - 1 && u > r.team.pos_dist[pos]) { u -= r.team.pos_dist[pos]; pos++ }
          const s = Math.round((pos / (current.n - 1)) * (SAMPLES - 1))
          const f = falling[k]
          f.t = 0
          f.x = LEFT + (s / (SAMPLES - 1)) * (RIGHT - LEFT)
          f.to = r.base + r.ys[s] * r.gain + 0.02
          f.from = f.to + 0.9
          f.z = r.z + 0.01
        })
      }
      for (let k = 0; k < MAX; k++) {
        const f = falling[k]
        f.t = Math.min(1, f.t + dt / 0.9)
        const fall = Math.min(1, f.t / 0.45)
        drops[k * 3] = f.x
        drops[k * 3 + 1] = f.from + (f.to - f.from) * fall * fall
        drops[k * 3 + 2] = f.z
        life[k] = f.t >= 1 ? 0 : 1 - Math.max(0, (f.t - 0.45) / 0.55)
      }
      dropGeometry.attributes.position.needsUpdate = true
      dropGeometry.attributes.aLife.needsUpdate = true
      dropUniforms.uAmount.value = amount

      leagues.forEach((l, i) => {
        const a = i === shown ? amount : 0
        l.root.visible = a > 0.001
        for (const r of l.ridges) {
          r.uniforms.uAmount.value = a
          r.uniforms.uReveal.value = reveal
          const lift = r.k === featured ? 1 : 0
          r.uniforms.uLift.value = lift
          r.uniforms.uColour.value.copy(shared.uCool.value).lerp(colours.ink, lift * 0.7)
          r.fillMaterial.uniforms.uOpacity.value = a
          r.fillMaterial.depthWrite = a > 0.6
          r.mesh.visible = a > 0.02
          r.label.material.opacity = a * lift * Math.min(1, reveal * 2)
        }
        for (const s of l.axis) s.material.opacity = a * 0.7
      })
    }
  }
}
