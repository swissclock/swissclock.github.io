/**
 * Tuner, as what it does with a plucked string. The six strings of standard
 * tuning lie across the top; each spike plucks one, and it rings with the
 * shape a pluck gives it, its overtones slowed until the eye can follow them.
 * Underneath, the note as a microphone hears it, and the YIN curve the tuner
 * computes from that: how unlike the signal is to itself shifted by each lag.
 * Its first deep dip is one period of the string, which is the pitch. The
 * cursor runs through both, so the period on the signal stands over the dip.
 * Each run takes one string and tunes it in, a pluck at a time.
 */

import { Box3, BufferAttribute, BufferGeometry, Group, Line, LineSegments, Points, Vector3 } from 'three'
import { dotsMaterial, spikes, textSprite, traceMaterial } from './common.js'

const LEFT = -4.4
const RIGHT = 4.4
const PLANE = -1.4
const STRING_TOP = 2.75
const STRING_GAP = 0.3
const SCOPE_Y = 0.15
const SCOPE_GAIN = 0.5
const YIN_BASE = -2.4
const YIN_SPAN = 1.35       // height of d' = YIN_TOP
const YIN_TOP = 2.2
const VERTS = 140
const MODES = 10
const PLUCK = 0.8           // across from the nut: a fifth of the way from the bridge
const HEIGHT = 0.24

// The tuner's own settings: a 4096-sample window at 44.1 kHz, lags from 1 kHz
// down to 60 Hz, and within five cents counts as in tune.
const RATE = 44100
const WINDOW = 4096
const IN_TUNE = 5

// Top to bottom as tab writes them: high e first.
const STRINGS = [
  { name: 'E4', label: 'e', hz: 329.63 },
  { name: 'B3', label: 'B', hz: 246.94 },
  { name: 'G3', label: 'G', hz: 196.0 },
  { name: 'D3', label: 'D', hz: 146.83 },
  { name: 'A2', label: 'A', hz: 110.0 },
  { name: 'E2', label: 'E', hz: 82.41 }
]

const cents = (f, ref) => 1200 * Math.log2(f / ref)

/**
 * YIN, as the tuner runs it (tuner.js detectPitch): the difference function,
 * its cumulative mean normalisation, the first dip under a threshold that
 * adapts to the clearest one, an octave check and a parabolic fit.
 */
function yin (data) {
  const half = data.length >> 1
  const minTau = Math.floor(RATE / 1000)
  const maxTau = Math.min(half - 1, Math.floor(RATE / 60))
  const d = new Float32Array(maxTau + 1)
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0
    for (let i = 0; i < half; i++) {
      const delta = data[i] - data[i + tau]
      sum += delta * delta
    }
    d[tau] = sum
  }
  d[0] = 1
  let running = 0
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau]
    d[tau] = running ? (d[tau] * tau) / running : 1
  }
  let lowest = Infinity
  for (let t = minTau; t <= maxTau; t++) lowest = Math.min(lowest, d[t])
  const threshold = Math.max(0.1, lowest + 0.08)
  let tau = -1
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) return { d, maxTau, threshold, tau: -1, hz: -1 }
  const around = 2 * tau
  if (around + 3 <= maxTau) {
    let t2 = around
    for (let t = around - 3; t <= around + 3; t++) if (d[t] < d[t2]) t2 = t
    if (d[tau] > 0.05 && d[t2] < 0.3 * d[tau]) tau = t2
  }
  let better = tau
  if (tau > 1 && tau < maxTau) {
    const s0 = d[tau - 1]; const s1 = d[tau]; const s2 = d[tau + 1]
    const denom = 2 * (2 * s1 - s2 - s0)
    if (denom) better = tau + (s2 - s0) / denom
  }
  return { d, maxTau, threshold, tau: better, hz: RATE / better }
}

/** A plucked string as the microphone hears it: overtones from the pluck point, a little room noise. */
function pluckedNote (hz) {
  const data = new Float32Array(WINDOW)
  const phase = Array.from({ length: MODES }, () => Math.random() * Math.PI * 2)
  let peak = 0
  for (let i = 0; i < WINDOW; i++) {
    let s = 0
    for (let n = 1; n <= MODES; n++) {
      s += Math.abs(Math.sin(n * Math.PI * (1 - PLUCK))) / n * Math.sin(2 * Math.PI * n * hz * i / RATE + phase[n - 1])
    }
    data[i] = s + (Math.random() - 0.5) * 0.03
    peak = Math.max(peak, Math.abs(data[i]))
  }
  for (let i = 0; i < WINDOW; i++) data[i] /= peak
  return data
}

function line (points, material, withT = false) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points * 3), 3))
  if (withT) {
    const t = new Float32Array(points)
    for (let i = 0; i < points; i++) t[i] = i / (points - 1)
    geometry.setAttribute('aT', new BufferAttribute(t, 1))
  }
  const object = new Line(geometry, material)
  object.frustumCulled = false
  return object
}

export function createStrings ({ shared, colours }) {
  const group = new Group()
  const cool = shared.uCool.value
  const materials = []
  const make = (colour, opacity) => {
    const m = traceMaterial(shared, colour, opacity)
    materials.push(m)
    return m
  }

  const strings = STRINGS.map((s, k) => {
    const object = line(VERTS, make(cool, 0.6))
    group.add(object)
    return { ...s, y: STRING_TOP - k * STRING_GAP, object, at: -99, modes: [] }
  })

  const maxTau = Math.min((WINDOW >> 1) - 1, Math.floor(RATE / 60))
  const lagX = (tau) => LEFT + (tau / maxTau) * (RIGHT - LEFT)
  const yinY = (v) => YIN_BASE + Math.min(v, YIN_TOP) / YIN_TOP * YIN_SPAN

  const SCOPE = 220
  const scope = line(SCOPE, make(cool, 0.4))
  const period = line(60, make(colours.ink, 0.9))
  const curve = line(SCOPE, make(cool, 0.85), true)
  const threshold = line(2, make(cool, 0.3))
  const cursorGeometry = new BufferGeometry()
  cursorGeometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
  const cursor = new LineSegments(cursorGeometry, make(colours.ink, 0.35))
  cursor.frustumCulled = false
  const dipGeometry = new BufferGeometry()
  dipGeometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3))
  dipGeometry.setAttribute('aSize', new BufferAttribute(new Float32Array([6]), 1))
  dipGeometry.setAttribute('aAlpha', new BufferAttribute(new Float32Array([1]), 1))
  const dipMaterial = dotsMaterial(shared, colours.ink, 1)
  const dip = new Points(dipGeometry, dipMaterial)
  dip.frustumCulled = false
  group.add(scope, period, curve, threshold, cursor, dip)

  const labels = []
  const place = (text, x, y, height = 0.2) => {
    const s = textSprite(text, { colour: colours.labelCss, height })
    s.position.set(x, y, PLANE)
    group.add(s)
    labels.push(s)
  }
  for (const s of strings) place(s.label, LEFT - 0.3, s.y)
  place('mic', LEFT - 0.45, SCOPE_Y, 0.18)
  place('YIN', LEFT - 0.45, YIN_BASE + YIN_SPAN * 0.5, 0.18)
  place('0', LEFT + 0.1, YIN_BASE - 0.3, 0.17)
  place(`${(maxTau / RATE * 1000).toFixed(1)} ms`, RIGHT - 0.45, YIN_BASE - 0.3, 0.17)

  let plucked = null
  let reading = null
  let tuning = 0
  let sinceReading = 99
  let lastPluck = -99
  let clock = 0
  let wasShown = false
  let live = 'Standard tuning, E2 to E4, at A4 = 440 Hz'
  const watch = spikes()

  function pluck (string) {
    plucked = string
    string.at = clock
    // The pluck's triangle, as the string's own modes.
    const u = PLUCK
    string.modes = Array.from({ length: MODES }, (_, i) => {
      const n = i + 1
      return 2 * HEIGHT * Math.sin(n * Math.PI * u) / (n * n * Math.PI * Math.PI * u * (1 - u))
    })
    const heard = string.hz * Math.pow(2, tuning / 1200)
    const data = pluckedNote(heard)
    reading = { data, ...yin(data) }
    sinceReading = 0
    lastPluck = clock
    const c = cents(reading.hz, string.hz)
    const off = Math.abs(c) <= IN_TUNE ? 'in tune' : `${c > 0 ? '+' : '−'}${Math.abs(Math.round(c))} cents`
    live = `${string.name} · a period of ${(reading.tau / RATE * 1000).toFixed(2)} ms · ${reading.hz.toFixed(1)} Hz · ${off}`

    // The signal and the curve stay put until the next pluck.
    const sp = scope.geometry.attributes.position.array
    for (let i = 0; i < SCOPE; i++) {
      const tau = (i / (SCOPE - 1)) * maxTau
      sp[i * 3] = lagX(tau); sp[i * 3 + 2] = PLANE
    }
    const cp = curve.geometry.attributes.position.array
    for (let i = 0; i < SCOPE; i++) {
      const tau = 1 + (i / (SCOPE - 1)) * (maxTau - 1)
      const a = Math.floor(tau); const f = tau - a
      const v = reading.d[a] * (1 - f) + reading.d[Math.min(a + 1, maxTau)] * f
      cp[i * 3] = lagX(tau); cp[i * 3 + 1] = yinY(v); cp[i * 3 + 2] = PLANE
    }
    curve.geometry.attributes.position.needsUpdate = true
    const tp = threshold.geometry.attributes.position.array
    tp[0] = LEFT; tp[1] = yinY(reading.threshold); tp[2] = PLANE
    tp[3] = RIGHT; tp[4] = yinY(reading.threshold); tp[5] = PLANE
    threshold.geometry.attributes.position.needsUpdate = true
    const x = lagX(reading.tau)
    const c3 = cursorGeometry.attributes.position.array
    c3[0] = x; c3[1] = SCOPE_Y + SCOPE_GAIN + 0.2; c3[2] = PLANE; c3[3] = x; c3[4] = YIN_BASE; c3[5] = PLANE
    cursorGeometry.attributes.position.needsUpdate = true
    const a = Math.floor(reading.tau)
    const dp = dipGeometry.attributes.position.array
    dp[0] = x; dp[1] = yinY(reading.d[a] + (reading.d[a + 1] - reading.d[a]) * (reading.tau - a)); dp[2] = PLANE
    dipGeometry.attributes.position.needsUpdate = true
  }

  /** A new string, somewhere between twelve and thirty cents out. */
  function nextString () {
    const others = strings.filter((s) => s !== plucked)
    tuning = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 20)
    pluck(others[(Math.random() * others.length) | 0])
  }

  return {
    group,
    bounds: new Box3(new Vector3(LEFT - 0.7, YIN_BASE - 0.45, PLANE), new Vector3(RIGHT + 0.1, STRING_TOP + 0.3, PLANE)),
    get live () { return live },

    update (dt, state, amount) {
      group.visible = amount > 0.001
      const motion = shared.uJitter.value ? 1 : 0.15
      clock += dt
      if (amount > 0.05 && !wasShown) {
        // Arriving: the first string is plucked straight away.
        nextString()
      }
      wasShown = amount > 0.05
      if (!wasShown) {
        for (const m of materials) m.uniforms.uAmount.value = amount
        dipMaterial.uniforms.uAmount.value = 0
        for (const s of labels) s.material.opacity = amount * 0.8
        return
      }

      const spike = watch(state)
      if (spike && amount > 0.5 && state.suppression < 0.35 && clock - lastPluck > 1.2) {
        if (spike.run) nextString()
        else {
          // The same string again, the peg turned a little closer each time.
          tuning = Math.abs(tuning) <= IN_TUNE ? (Math.random() - 0.5) * 3 : tuning * (0.35 + Math.random() * 0.2)
          pluck(plucked)
        }
      }

      // The strings: each one's modes, slowed to a few hertz and dying away.
      for (const s of strings) {
        const t = clock - s.at
        const p = s.object.geometry.attributes.position.array
        const slow = 1.3 * Math.sqrt(s.hz / 82.41) * motion
        for (let v = 0; v < VERTS; v++) {
          const u = v / (VERTS - 1)
          let y = 0
          if (t < 14) {
            for (let n = 1; n <= MODES; n++) {
              y += s.modes[n - 1] * Math.sin(n * Math.PI * u) * Math.cos(2 * Math.PI * n * slow * t) * Math.exp(-t * (0.2 + 0.15 * n))
            }
          }
          p[v * 3] = LEFT + u * (RIGHT - LEFT); p[v * 3 + 1] = s.y + y; p[v * 3 + 2] = PLANE
        }
        s.object.geometry.attributes.position.needsUpdate = true
        const lift = s === plucked ? Math.exp(-Math.max(0, t - 3) * 0.4) : 0
        s.object.material.uniforms.uColour.value.copy(cool).lerp(colours.ink, lift * 0.75)
        s.object.material.uniforms.uOpacity.value = 0.55 + lift * 0.45
      }

      // The signal fades with the string; the curve draws in as it is computed.
      sinceReading += dt
      if (reading) {
        const ring = Math.exp(-(clock - lastPluck) * 0.2)
        const sp = scope.geometry.attributes.position.array
        for (let i = 0; i < SCOPE; i++) {
          const k = Math.round((i / (SCOPE - 1)) * maxTau)
          sp[i * 3 + 1] = SCOPE_Y + reading.data[k] * SCOPE_GAIN * (0.25 + 0.75 * ring)
        }
        scope.geometry.attributes.position.needsUpdate = true
        const pp = period.geometry.attributes.position.array
        for (let i = 0; i < 60; i++) {
          const tau = (i / 59) * reading.tau
          const k = Math.min(maxTau, Math.round(tau))
          pp[i * 3] = lagX(tau); pp[i * 3 + 1] = SCOPE_Y + reading.data[k] * SCOPE_GAIN * (0.25 + 0.75 * ring); pp[i * 3 + 2] = PLANE + 0.01
        }
        period.geometry.attributes.position.needsUpdate = true
      }
      const reveal = Math.min(1, sinceReading / 0.7)
      const found = reading ? (reveal >= (reading.tau - 1) / (maxTau - 1) ? 1 : 0) : 0

      for (const m of materials) m.uniforms.uAmount.value = amount
      curve.material.uniforms.uReveal.value = reveal
      period.material.uniforms.uOpacity.value = 0.9 * found
      cursor.material.uniforms.uOpacity.value = 0.35 * found
      dipMaterial.uniforms.uAmount.value = amount * found
      for (const s of labels) s.material.opacity = amount * 0.8
    }
  }
}
