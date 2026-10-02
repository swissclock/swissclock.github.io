/**
 * The contact section's view: the brain's long-range connections, as the Allen
 * Mouse Brain Connectivity Atlas traced them. Every line is a real path from a
 * tracer injection in cortex to where its axons arrive: across the corpus
 * callosum to the other hemisphere, or down through the internal capsule to
 * the thalamus, striatum, midbrain and pons. The shell fades to a faint outline
 * for them to sit in. Each spike sends impulses out along them, source to
 * target; held light quiets them.
 *
 * File layout (tracts.bin): Uint32 [paths, points, outline points, units per
 * mm], Uint16 [length, kind] per path (1 callosal, 0 descending), Int16 xyz per
 * path point (injection first), then an outline section this view leaves empty.
 */

import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineSegments, ShaderMaterial } from 'three'

const VOLLEYS = 4

const vertex = /* glsl */ `
attribute float aT;       // 0 at the injection, 1 where the path arrives
attribute float aKind;    // 1 callosal, 0 descending
attribute float aSeed;
uniform float uAmount;
uniform float uTime;
uniform float uDepthRef;
uniform float uSuppression;
uniform vec4  uVolley;    // start times of the last four volleys
varying float vAlpha;
varying float vPulse;

void main() {
  // An impulse runs the length of a path in about a second and a half. Each
  // volley recruits a different half of the paths.
  float pulse = 0.0;
  for (int k = 0; k < ${VOLLEYS}; k++) {
    float age = uTime - uVolley[k];
    float recruited = step(0.5, fract(aSeed * 13.7 + uVolley[k] * 0.37));
    float d = (aT - (age / 1.5 - aSeed * 0.25)) * 9.0;
    pulse += exp(-d * d) * recruited * step(0.0, age) * (1.0 - smoothstep(1.4, 2.0, age));
  }
  vPulse = clamp(pulse, 0.0, 1.0) * (1.0 - uSuppression * 0.9);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = clamp(1.0 - (-mv.z - uDepthRef * 0.86) / (uDepthRef * 0.5), 0.3, 1.0);
  vAlpha = (mix(0.07, 0.1, aKind) + vPulse * 0.85) * fade * uAmount;
}
`

const fragment = /* glsl */ `
uniform vec3 uCool;
uniform vec3 uInk;
uniform vec3 uWarm;
uniform float uSuppression;
varying float vAlpha;
varying float vPulse;
void main() {
  vec3 c = mix(uCool, uInk, vPulse);
  gl_FragColor = vec4(mix(c, uWarm, uSuppression * 0.6), vAlpha);
}
`

export async function loadTracts (url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const [paths, points, , units] = new Uint32Array(buffer, 0, 4)
  const meta = new Uint16Array(buffer, 16, paths * 2)
  const raw = new Int16Array(buffer, 16 + paths * 4, points * 3)
  const list = []
  let at = 0
  for (let i = 0; i < paths; i++) {
    const n = meta[i * 2]
    const p = new Float32Array(n * 3)
    for (let k = 0; k < n * 3; k++) p[k] = raw[at * 3 + k] / units
    list.push({ points: p, kind: meta[i * 2 + 1] })
    at += n
  }
  return list
}

export function createTracts (paths, parent, shared, { ink }) {
  // Segments, two vertices each, with how far along its path each vertex is.
  let segments = 0
  for (const p of paths) segments += p.points.length / 3 - 1
  const positions = new Float32Array(segments * 6)
  const t = new Float32Array(segments * 2)
  const kind = new Float32Array(segments * 2)
  const seed = new Float32Array(segments * 2)
  let v = 0
  for (const p of paths) {
    const n = p.points.length / 3
    const s = Math.random()
    for (let i = 0; i < n - 1; i++) {
      for (const j of [i, i + 1]) {
        positions[v * 3] = p.points[j * 3]
        positions[v * 3 + 1] = p.points[j * 3 + 1]
        positions[v * 3 + 2] = p.points[j * 3 + 2]
        t[v] = j / (n - 1)
        kind[v] = p.kind
        seed[v] = s
        v++
      }
    }
  }

  const uniforms = {
    uTime: shared.uTime, uDepthRef: shared.uDepthRef, uSuppression: shared.uSuppression,
    uCool: shared.uCool, uWarm: shared.uWarm, uInk: { value: ink },
    uAmount: { value: 0 }, uVolley: { value: { x: -99, y: -99, z: -99, w: -99 } }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aT', new BufferAttribute(t, 1))
  geometry.setAttribute('aKind', new BufferAttribute(kind, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1))
  const lines = new LineSegments(geometry, new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))

  const group = new Group()
  group.add(lines)
  parent.add(group)

  let previous = 0
  let slot = 0
  const slots = ['x', 'y', 'z', 'w']

  return {
    /** `presence` is 0..1, how far into the contact framing we are. */
    update (dt, state, presence) {
      uniforms.uAmount.value = presence
      group.visible = presence > 0.001
      // Every spike that rises out of quiet sends a volley along the paths.
      const rising = state.burst > 0.45 && previous <= 0.45
      previous = state.burst
      if (rising && state.suppression < 0.35) {
        uniforms.uVolley.value[slots[slot]] = state.time
        slot = (slot + 1) % VOLLEYS
      }
    }
  }
}
