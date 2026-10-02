/**
 * The research section's view of the same brain: its vasculature, as a cleared
 * and light-sheet-imaged mouse brain shows it. The network is real — VesSAP
 * (Todorov et al., Nature Methods 2020), from the VesselGraph release
 * (Paetzold et al. 2021, CC BY-NC 4.0) — registered onto the Allen frame the
 * shell already uses, so the two occupy the same brain.
 *
 * What it shows is the claim the section makes. Barrel cortex fires with each
 * spike-wave run; its vessels answer a beat later, a faint dilation runs out
 * along the network from there, and with sustained activity the barrier opens:
 * tracer haze gathers around the local capillaries and clears once the activity
 * stops. Everything reads the shell's frame state, so the cells flash on
 * exactly the spikes the rules draw.
 *
 * Here the light arrives from outside rather than down the fiber: a beam onto
 * the cortical surface above barrel cortex, caught first by the surface
 * vessels, dimming with depth and spreading as it scatters while it is held.
 *
 * File layout (vessels.bin), arranged for gzip rather than for reading:
 *   Uint32 [lineVerts, pointVerts, neurons, units per mm]
 *   Int16 positions for every vertex, split into planes — the high bytes of
 *   all x, all y, all z, then the low bytes likewise — and spatially sorted,
 *   which is what lets GitHub Pages' gzip halve them
 *   Uint8 per vessel vertex: radius (4 bits) | depth below the surface (4 bits,
 *   0.16 mm steps), then Uint8: distance along the network from barrel cortex
 *   (7 bits, 0.1 mm steps) | inside isocortex (1 bit)
 * Line vertices pair up into segments; points draw the largest vessels' walls.
 */

import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry,
  CylinderGeometry, DoubleSide, FrontSide, Group, LineSegments, Mesh, Points, Quaternion,
  ShaderMaterial, Vector3
} from 'three'

/** Right-hemisphere barrel field centroid (SSp-bfd, Allen id 329), in model mm. */
const S1 = new Vector3(1.09, 2.55, 3.32)

/** Where the beam meets the cortical surface above it, and the surface normal there. */
export const SPOT = new Vector3(1.175, 3.025, 3.675)
const NORMAL = new Vector3(0.186, 0.773, 0.607).normalize()

const common = /* glsl */ `
uniform float uTime;
uniform float uBurst;
uniform float uActivity;
uniform float uSuppression;
uniform float uPixelRatio;
uniform float uDepthRef;
uniform float uVasc;
uniform float uHemo;
uniform float uLeak;
uniform float uFront;
uniform float uWave;
uniform float uLight;
uniform float uScatter;
uniform vec3  uS1;
uniform vec3  uSpot;
uniform vec3  uNormal;
uniform vec3  uFocus;

float hash (vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

// How strongly this spot of tissue takes part in a run: barrel cortex,
// falling off over a millimetre or so.
float engaged (vec3 p) {
  float d = distance(p, uS1);
  return exp(-d * d / 1.3);
}

float depthFade (float depth) {
  return clamp(1.0 - (depth - uDepthRef * 0.86) / (uDepthRef * 0.5), 0.16, 1.0);
}

// The suppression the light leaves behind, spreading from where it entered,
// on the same schedule as the shell's front.
float warmth (vec3 p) {
  float away = distance(p, uFocus);
  float reach = smoothstep(0.0, 1.0, uSuppression) * 15.5;
  return uSuppression * (1.0 - smoothstep(reach - 0.7, reach + 0.7, away));
}

// The light itself while it is delivered: a beam along -uNormal, widening with
// depth and with how long it has been held, and attenuated within a millimetre.
// Red light reaches a few millimetres into cortex; this keeps the order of it.
float beam (vec3 p, float depth) {
  vec3 d = p - uSpot;
  float along = dot(d, uNormal);
  vec3 lateral = d - along * uNormal;
  float w = 0.62 + depth * 0.6 + uScatter * 0.55;
  // Depth below the nearest surface, but also distance travelled along the
  // beam, so the far side of the brain does not catch it again.
  float travelled = max(depth, -along);
  return exp(-dot(lateral, lateral) / (2.0 * w * w)) * exp(-travelled / 0.8) * uLight;
}
`

const vesselVertex = /* glsl */ `
attribute vec4 aInfo;   // radius, graph distance, cortex, depth (all 0..1)
uniform float uPoint;   // 1 for the vessel-wall points, 0 for the lines
${common}
varying float vAlpha;
varying float vLift;
varying float vWarm;

void main() {
  float radius = aInfo.x;
  float graph = aInfo.y * 12.75;
  float cortex = aInfo.z;
  float depth = aInfo.w * 2.55;

  // The local vessels follow the activity with a haemodynamic lag (uHemo is
  // the smoothed, delayed burst energy).
  float coupled = engaged(position) * cortex * uHemo * 1.5;

  // And a dilation runs out along the network from there: a faint leading
  // edge with a dimmer wake, gone within a few millimetres.
  float ahead = graph - uFront;
  float band = exp(-ahead * ahead * 1.6) + (ahead < 0.0 ? 0.35 * exp(ahead * 0.9) : 0.0);
  float wave = 0.3 * uWave * band * (1.0 - smoothstep(3.0, 7.0, graph));

  vLift = clamp(coupled + wave, 0.0, 1.0);
  float lit = beam(position, depth);
  vWarm = clamp(max(warmth(position) * 0.14, lit * 1.4), 0.0, 1.0);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float eye = -mv.z;

  // Big vessels carry the picture; capillaries are the haze between them.
  float body = mix(0.07, 0.62, pow(radius, 1.1));
  vAlpha = body * depthFade(eye) * uVasc * (1.0 + vLift * 3.2 + lit * 2.6);

  gl_PointSize = uPoint * (0.6 + radius * 2.6 + vLift * 1.4 + lit * 0.8) * uPixelRatio * (25.0 / eye);
}
`

const vesselFragment = /* glsl */ `
uniform float uPoint;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uLift;
varying float vAlpha;
varying float vLift;
varying float vWarm;

void main() {
  float a = vAlpha;
  if (uPoint > 0.5) {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    a *= smoothstep(0.25, 0.0, r);
  }
  vec3 colour = mix(uCool, uLift, min(1.0, vLift * 1.2));
  colour = mix(colour, uWarm, vWarm);
  gl_FragColor = vec4(colour, a * (uPoint > 0.5 ? 0.22 : 0.42));
}
`

const neuronVertex = /* glsl */ `
attribute float aSeed;
${common}
varying float vAlpha;
varying float vWarm;
varying float vFire;

void main() {
  float e = engaged(position);
  // Only some of the cells in barrel cortex fire on a given spike.
  float recruited = step(0.35, fract(aSeed * 7.13 + floor(uTime * 3.0) * 0.618));
  float spike = uBurst * e * recruited * (1.0 - uSuppression * 0.9);
  // Sparse background firing everywhere, quieter as release is suppressed.
  float slot = floor(uTime * 6.0 + aSeed * 40.0);
  float ongoing = step(0.992, hash(vec3(aSeed * 91.0, slot, 2.0))) * uActivity * 0.6;
  vFire = clamp(spike * 1.4 + ongoing, 0.0, 1.0);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float eye = -mv.z;
  vAlpha = (0.07 + vFire * 0.95) * depthFade(eye) * uVasc;
  float depth = max(0.0, -dot(position - uSpot, uNormal));
  vWarm = clamp(max(warmth(position) * 0.16, beam(position, depth) * 1.4), 0.0, 1.0);
  gl_PointSize = (1.1 + vFire * 6.0) * uPixelRatio * (25.0 / eye);
}
`

const neuronFragment = /* glsl */ `
uniform vec3 uSpark;
uniform vec3 uWarm;
varying float vAlpha;
varying float vWarm;
varying float vFire;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  // A firing cell is a hard core inside a soft bloom.
  float core = smoothstep(0.03, 0.0, r);
  float bloom = pow(smoothstep(0.25, 0.0, r), 2.2) * 0.55;
  float shape = mix(smoothstep(0.25, 0.02, r), core + bloom, vFire);
  gl_FragColor = vec4(mix(uSpark, uWarm, vWarm * 0.7), vAlpha * shape);
}
`

const leakVertex = /* glsl */ `
attribute float aSeed;
${common}
varying float vAlpha;

void main() {
  float d = distance(position, uS1);
  float field = exp(-d * d / 1.1);
  // Each halo appears at its own threshold, so the haze spreads as the
  // leak builds rather than fading in everywhere at once.
  float shown = smoothstep(aSeed * 0.75, aSeed * 0.75 + 0.25, uLeak * field * 1.6);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float eye = -mv.z;
  vAlpha = shown * depthFade(eye) * uVasc;
  gl_PointSize = (4.0 + aSeed * 6.0) * uPixelRatio * (25.0 / eye);
}
`

const leakFragment = /* glsl */ `
uniform vec3 uLift;
varying float vAlpha;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  gl_FragColor = vec4(uLift, vAlpha * 0.1 * pow(smoothstep(0.25, 0.0, r), 1.4));
}
`

/* The beam above the skull: an open cone, densest along its axis and toward
   the tissue, gone well before its source. */
const beamVertex = /* glsl */ `
varying float vAlong;
varying float vEdge;

void main() {
  vAlong = uv.y; // 0 at the surface, 1 at the far end
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vEdge = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`

const beamFragment = /* glsl */ `
uniform vec3 uWarm;
uniform float uLight;
uniform float uVasc;
varying float vAlong;
varying float vEdge;

void main() {
  float a = pow(vEdge, 1.6) * pow(1.0 - vAlong, 1.4) * smoothstep(0.0, 0.03, vAlong);
  gl_FragColor = vec4(uWarm, a * uLight * uVasc * 0.32);
}
`

/* Where it lands: a soft disc lying on the surface, widening as it scatters. */
const spotVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv - 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const spotFragment = /* glsl */ `
uniform vec3 uWarm;
uniform float uLight;
uniform float uVasc;
varying vec2 vUv;

void main() {
  float r = dot(vUv, vUv) * 4.0;
  gl_FragColor = vec4(uWarm, exp(-r * 3.0) * uLight * uVasc * 0.22);
}
`

function seeds (count) {
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) out[i] = Math.random()
  return out
}

function approach (rate, dt) {
  return 1 - Math.exp(-rate * dt)
}

export async function loadVessels (url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const [lines, points, neurons, units] = new Uint32Array(buffer, 0, 4)
  const total = lines + points + neurons
  const bytes = new Uint8Array(buffer, 16)

  const positions = new Float32Array(total * 3)
  const low = total * 3
  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < total; i++) {
      const at = axis * total + i
      const value = (bytes[at] << 8) | bytes[low + at]
      positions[i * 3 + axis] = (value > 32767 ? value - 65536 : value) / units
    }
  }

  // Unpacked to the byte ranges the shaders read as normalised 0..1: radius,
  // graph distance (12.75 mm full scale), cortex, depth (2.55 mm full scale).
  const vessels = lines + points
  const packed = 6 * total
  const info = new Uint8Array(vessels * 4)
  for (let i = 0; i < vessels; i++) {
    const a = bytes[packed + i]
    const b = bytes[packed + vessels + i]
    info[i * 4] = (a >> 4) * 17
    info[i * 4 + 1] = (b & 127) * 2
    info[i * 4 + 2] = b & 128 ? 255 : 0
    info[i * 4 + 3] = (a & 15) * 16
  }
  return {
    lines: { positions: positions.subarray(0, lines * 3), info: info.subarray(0, lines * 4) },
    points: { positions: positions.subarray(lines * 3, (lines + points) * 3), info: info.subarray(lines * 4) },
    neurons: positions.subarray((lines + points) * 3)
  }
}

/**
 * Builds the layer into `parent` (the rotating brain group). `shared` is the
 * shell's uniform object, so time, burst, suppression and depth all arrive
 * from the same place.
 */
export function createVessels (data, parent, shared, { lift, spark }) {
  const uniforms = {
    ...shared,
    uVasc: { value: 0 },
    uHemo: { value: 0 },
    uLeak: { value: 0 },
    uFront: { value: 0 },
    uWave: { value: 0 },
    uLight: { value: 0 },
    uScatter: { value: 0 },
    uS1: { value: S1.clone() },
    uSpot: { value: SPOT.clone() },
    uNormal: { value: NORMAL.clone() },
    uLift: { value: lift },
    uSpark: { value: spark }
  }

  const group = new Group()
  parent.add(group)

  const material = (vertexShader, fragmentShader, extra = {}, side = FrontSide) => new ShaderMaterial({
    uniforms: { ...uniforms, ...extra },
    vertexShader,
    fragmentShader,
    side,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending
  })

  function vesselGeometry ({ positions, info }) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aInfo', new BufferAttribute(info, 4, true))
    return geometry
  }

  group.add(new LineSegments(vesselGeometry(data.lines), material(vesselVertex, vesselFragment, { uPoint: { value: 0 } })))
  group.add(new Points(vesselGeometry(data.points), material(vesselVertex, vesselFragment, { uPoint: { value: 1 } })))

  const neuronGeometry = new BufferGeometry()
  neuronGeometry.setAttribute('position', new BufferAttribute(data.neurons, 3))
  neuronGeometry.setAttribute('aSeed', new BufferAttribute(seeds(data.neurons.length / 3), 1))
  group.add(new Points(neuronGeometry, material(neuronVertex, neuronFragment)))

  // Leak halos: capillary vertices in and around barrel cortex.
  const halo = []
  const p = data.lines.positions
  const scratch = new Vector3()
  for (let i = 0; i < p.length / 3; i++) {
    scratch.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
    if (data.lines.info[i * 4] < 110 && scratch.distanceTo(S1) < 2.2 && Math.random() < 0.6) halo.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
  }
  const haloGeometry = new BufferGeometry()
  haloGeometry.setAttribute('position', new BufferAttribute(new Float32Array(halo), 3))
  haloGeometry.setAttribute('aSeed', new BufferAttribute(seeds(halo.length / 3), 1))
  group.add(new Points(haloGeometry, material(leakVertex, leakFragment)))

  // The beam and its landing spot, both lying along the surface normal.
  const along = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), NORMAL)
  const LENGTH = 7
  const cone = new Mesh(new CylinderGeometry(0.3, 0.85, LENGTH, 48, 1, true), material(beamVertex, beamFragment, {}, DoubleSide))
  // The cylinder's wide bottom (v = 0) touches the tissue, its narrow top
  // points back toward the source.
  cone.quaternion.copy(along)
  cone.position.copy(SPOT).addScaledVector(NORMAL, LENGTH / 2 + 0.05)
  group.add(cone)

  const spot = new Mesh(new CircleGeometry(1, 48), material(spotVertex, spotFragment))
  spot.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), NORMAL))
  spot.position.copy(SPOT).addScaledVector(NORMAL, 0.03)
  group.add(spot)

  let lastBurst = -99
  let runStart = -99
  let energy = 0
  let hemo = 0

  return {
    /** `presence` is 0..1, how far into the research framing we are. */
    update (dt, state, presence) {
      uniforms.uVasc.value = presence
      const t = state.time

      // A run begins with the first strong spike after a quiet spell. Spikes
      // inside a run are a third of a second apart, runs several seconds.
      if (state.burst > 0.25) {
        if (t - lastBurst > 0.9) runStart = t
        lastBurst = t
      }

      // Fast envelope of the spikes, then a slower, lagging one for the
      // vessels: neurovascular coupling arrives about a second behind.
      energy += (state.burst - energy) * approach(3.0, dt)
      hemo += (Math.min(1, energy * 2.2) - hemo) * approach(0.9, dt)
      uniforms.uHemo.value = hemo

      // The barrier opens with sustained activity and closes slowly after.
      const leak = uniforms.uLeak.value + energy * dt * 0.7 * (1 - state.suppression) * presence
      uniforms.uLeak.value = Math.min(1, leak * Math.exp(-dt / 16))

      const since = t - runStart
      uniforms.uFront.value = since * 1.25
      uniforms.uWave.value = Math.exp(-since / 3.4) * (1 - state.suppression * 0.9)

      // The beam comes on fast and goes off a little slower; its spot widens
      // while it is held, the way scattered light fills tissue.
      const lit = state.lit ? 1 : 0
      uniforms.uLight.value += (lit - uniforms.uLight.value) * approach(lit ? 9 : 5, dt)
      const scatter = uniforms.uScatter.value
      uniforms.uScatter.value = lit ? scatter + (1 - scatter) * approach(0.7, dt) : scatter * (1 - approach(1.5, dt))
      spot.scale.setScalar(1.3 + uniforms.uScatter.value * 1.0)

      const visible = presence > 0.001
      group.visible = visible
    }
  }
}
