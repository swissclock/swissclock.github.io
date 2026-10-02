/**
 * Lotto, as random walks: for each of the 37 numbers, how far its tally has run
 * ahead of or behind chance over every draw of today's game, stacked like the
 * channels of a recording. None of them pulls away, which is the point. Each
 * spike marks one real draw across the channels it hit.
 */

import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Group, LineSegments, Points, ShaderMaterial, Vector3 } from 'three'
import { dayLabel, glslCommon, glslDot, spikes, textSprite, two } from './common.js'

const LEFT = -4.4
const RIGHT = 4.4
const TOP = 2.75
const GAP = 0.15
const PLANE = -1.4

const traceVertex = /* glsl */ `
attribute float aT;
attribute float aNum;
uniform float uAmount;
uniform float uReveal;
uniform float uGlowNum[6];
uniform float uGlow;
${glslCommon}
varying float vAlpha;
varying float vLit;

void main() {
  float lit = 0.0;
  for (int k = 0; k < 6; k++) lit += step(abs(aNum - uGlowNum[k]), 0.5);
  vLit = min(1.0, lit) * uGlow;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float shown = step(aT, uReveal);
  vAlpha = (0.42 + vLit * 0.58) * shown * uAmount * depthFade(-mv.z);
}
`

const traceFragment = /* glsl */ `
uniform vec3 uCool;
uniform vec3 uInk;
uniform vec3 uWarm;
uniform float uSuppression;
varying float vAlpha;
varying float vLit;
void main() {
  vec3 c = mix(uCool, uInk, vLit);
  gl_FragColor = vec4(mix(c, uWarm, uSuppression * 0.7), vAlpha);
}
`

const markVertex = /* glsl */ `
uniform float uAmount;
uniform float uGlow;
${glslCommon}
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = uGlow * uAmount;
  gl_PointSize = 6.0 * uPixelRatio * (25.0 / -mv.z);
}
`

const cursorVertex = /* glsl */ `
uniform float uAmount;
uniform float uGlow;
${glslCommon}
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = uGlow * uAmount * 0.35;
}
`

const cursorFragment = /* glsl */ `
uniform vec3 uInk;
varying float vAlpha;
void main() { gl_FragColor = vec4(uInk, vAlpha); }
`

const markFragment = /* glsl */ `
uniform vec3 uInk;
${glslDot}
varying float vAlpha;
void main() { gl_FragColor = vec4(uInk, vAlpha * dot2(1.0)); }
`

export function createWalks (lotto, { shared, colours }) {
  const { pool, numbers, days } = lotto
  const draws = days.length
  const expected = 6 / pool

  // Deviation of each number's running count from chance, draw by draw.
  const dev = Array.from({ length: pool + 1 }, () => new Float32Array(draws))
  const count = new Float32Array(pool + 1)
  for (let d = 0; d < draws; d++) {
    for (let k = 0; k < 6; k++) count[numbers[d * 6 + k]]++
    for (let n = 1; n <= pool; n++) dev[n][d] = count[n] - (d + 1) * expected
  }
  let worst = 1
  for (let n = 1; n <= pool; n++) for (let d = 0; d < draws; d++) worst = Math.max(worst, Math.abs(dev[n][d]))
  // The largest excursion reaches three channels over: crowded, like a montage.
  const gain = (GAP * 3) / worst

  const x = (d) => LEFT + (d / (draws - 1)) * (RIGHT - LEFT)
  const y = (n, d) => TOP - (n - 1) * GAP + dev[n][d] * gain

  const segments = pool * (draws - 1)
  const positions = new Float32Array(segments * 6)
  const t = new Float32Array(segments * 2)
  const num = new Float32Array(segments * 2)
  let v = 0
  for (let n = 1; n <= pool; n++) {
    for (let d = 0; d < draws - 1; d++) {
      for (const e of [d, d + 1]) {
        positions[v * 3] = x(e); positions[v * 3 + 1] = y(n, e); positions[v * 3 + 2] = PLANE
        t[v] = e / (draws - 1)
        num[v] = n
        v++
      }
    }
  }

  const uniforms = {
    uPixelRatio: shared.uPixelRatio, uDepthRef: shared.uDepthRef, uSuppression: shared.uSuppression,
    uCool: shared.uCool, uWarm: shared.uWarm, uInk: { value: colours.ink },
    uAmount: { value: 0 }, uReveal: { value: 0 }, uGlowNum: { value: [0, 0, 0, 0, 0, 0] }, uGlow: { value: 0 }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aT', new BufferAttribute(t, 1))
  geometry.setAttribute('aNum', new BufferAttribute(num, 1))
  const traces = new LineSegments(geometry, new ShaderMaterial({
    uniforms, vertexShader: traceVertex, fragmentShader: traceFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))

  // Where a draw hit each of its six channels, and a cursor through them all.
  const marks = new Float32Array(6 * 3)
  const markGeometry = new BufferGeometry()
  markGeometry.setAttribute('position', new BufferAttribute(marks, 3))
  const markPoints = new Points(markGeometry, new ShaderMaterial({
    uniforms, vertexShader: markVertex, fragmentShader: markFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))
  markPoints.frustumCulled = false
  const cursorGeometry = new BufferGeometry()
  cursorGeometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
  const cursor = new LineSegments(cursorGeometry, new ShaderMaterial({
    uniforms, vertexShader: cursorVertex, fragmentShader: cursorFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))
  cursor.frustumCulled = false

  const group = new Group()
  group.add(traces, cursor, markPoints)

  const labels = []
  const place = (text, px, py) => {
    const s = textSprite(text, { colour: colours.labelCss, height: 0.2 })
    s.position.set(px, py, PLANE)
    group.add(s)
    labels.push(s)
  }
  place('1', LEFT - 0.3, y(1, 0))
  place(String(pool), LEFT - 0.35, TOP - (pool - 1) * GAP)
  const lastYear = dayLabel(days[draws - 1]).slice(-4)
  place(dayLabel(days[0]).slice(-4), LEFT + 0.25, TOP - pool * GAP - 0.35)
  place(lastYear, RIGHT - 0.25, TOP - pool * GAP - 0.35)

  let live = `${draws.toLocaleString('en-US')} draws since ${dayLabel(days[0]).slice(-4)}, one line per number`
  const watch = spikes()
  let wasShown = false

  return {
    group,
    // Traces, their excursions, the number labels to the left and the years below.
    bounds: new Box3(new Vector3(LEFT - 0.6, TOP - pool * GAP - 0.5, PLANE), new Vector3(RIGHT + 0.1, TOP + 0.45, PLANE)),
    get live () { return live },

    update (dt, state, amount) {
      uniforms.uAmount.value = amount
      group.visible = amount > 0.001
      // Draw the traces in from the left each time the view arrives.
      if (amount > 0.05 && !wasShown) uniforms.uReveal.value = 0
      wasShown = amount > 0.05
      uniforms.uReveal.value = Math.min(1, uniforms.uReveal.value + dt / 1.8)
      uniforms.uGlow.value *= Math.exp(-dt * 1.6)
      for (const s of labels) s.material.opacity = amount * 0.8

      const spike = watch(state)
      if (spike && amount > 0.5 && state.suppression < 0.35 && uniforms.uReveal.value >= 1) {
        const d = (Math.random() * draws) | 0
        const hit = numbers.slice(d * 6, d * 6 + 6)
        uniforms.uGlowNum.value = Array.from(hit)
        uniforms.uGlow.value = 1
        hit.forEach((n, k) => { marks[k * 3] = x(d); marks[k * 3 + 1] = y(n, d); marks[k * 3 + 2] = PLANE + 0.01 })
        markGeometry.attributes.position.needsUpdate = true
        const c = cursorGeometry.attributes.position.array
        c[0] = x(d); c[1] = TOP + 0.25; c[2] = PLANE; c[3] = x(d); c[4] = TOP - (pool - 1) * GAP - 0.25; c[5] = PLANE
        cursorGeometry.attributes.position.needsUpdate = true
        live = `Draw ${(lotto.firstId + d).toLocaleString('en-US')} · ${dayLabel(days[d])} · ${Array.from(hit, two).join(' ')}`
      }
    }
  }
}
