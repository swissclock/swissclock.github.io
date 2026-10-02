/**
 * The resting view: the shell's dots settle into a loss landscape, a dotted
 * surface of hills and basins that slowly shift. With every run an optimiser
 * sets off from somewhere high and rolls downhill; each spike pushes it a step
 * and sends a ripple out across the surface from where it is.
 */

import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Group, Points, ShaderMaterial, Vector3, Vector4 } from 'three'
import { approach, glslCommon, glslDot, spikes } from './common.js'

const NX = 160
const NZ = 150
const X0 = -5.4
const X1 = 5.4
const Z0 = -6.8
const Z1 = 2.6
const FLOOR = -1.7
const BUMPS = 5
const TRAIL = 90

/* Hills and basins: [x, z, height, width]. They wander on slow Lissajous paths. */
const BASE = [
  [-2.6, -3.6, 1.15, 1.5],
  [2.4, -4.2, 0.95, 1.3],
  [0.4, -1.4, -0.9, 1.6],
  [-1.8, 0.6, 0.55, 1.1],
  [3.1, -0.4, -0.55, 1.2]
]

const vertex = /* glsl */ `
attribute vec3 aShell;
attribute float aSeed;
uniform float uMorph;
uniform float uAmount;
uniform float uTime;
uniform vec4  uBump[${BUMPS}];
uniform vec4  uRipple;     // x, z, start time, strength
${glslCommon}
varying float vAlpha;
varying float vLift;

float height (vec2 p) {
  float h = 0.0;
  for (int k = 0; k < ${BUMPS}; k++) {
    vec2 d = p - uBump[k].xy;
    h += uBump[k].z * exp(-dot(d, d) / (2.0 * uBump[k].w * uBump[k].w));
  }
  return h + sin(p.x * 0.9 + uTime * 0.21) * sin(p.y * 0.8 - uTime * 0.17) * 0.12;
}

void main() {
  vec2 g = position.xz;
  float h = height(g);
  float age = uTime - uRipple.z;
  float r = distance(g, uRipple.xy);
  float front = r - age * 2.6;
  float ripple = sin(front * 9.0) * exp(-front * front * 3.0) * exp(-age * 1.2) * uRipple.w * step(0.0, age);
  vec3 surface = vec3(g.x, ${FLOOR.toFixed(2)} + h + ripple * 0.12, g.y);
  vec3 p = mix(aShell, surface, uMorph);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  // Brighter on the heights, so the relief reads without any lighting.
  vLift = clamp(0.45 + h * 0.4 + abs(ripple) * 0.8, 0.0, 1.0);
  vAlpha = (0.16 + vLift * 0.34) * depthFade(depth) * uAmount;
  gl_PointSize = (0.9 + aSeed * 0.4) * uPixelRatio * (25.0 / depth);
}
`

const fragment = /* glsl */ `
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uInk;
uniform float uSuppression;
${glslDot}
varying float vAlpha;
varying float vLift;

void main() {
  float shape = dot2(0.0);
  vec3 colour = mix(uCool, uInk, smoothstep(0.75, 1.0, vLift) * 0.5);
  gl_FragColor = vec4(mix(colour, uWarm, uSuppression * 0.7), vAlpha * shape);
}
`

const markerVertex = /* glsl */ `
attribute float aAge;     // 0 for the optimiser itself, rising along its trail
uniform float uAmount;
${glslCommon}
varying float vAlpha;
varying float vAge;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  vAge = aAge;
  vAlpha = (1.0 - aAge) * uAmount * depthFade(depth);
  gl_PointSize = mix(7.0, 1.6, sqrt(aAge)) * uPixelRatio * (25.0 / depth);
}
`

const markerFragment = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uWarm;
uniform float uSuppression;
${glslDot}
varying float vAlpha;
varying float vAge;

void main() {
  float shape = dot2(vAge < 0.01 ? 1.0 : 0.0);
  gl_FragColor = vec4(mix(uInk, uWarm, uSuppression * 0.7), vAlpha * shape * (vAge < 0.01 ? 1.0 : 0.6));
}
`

export function createLandscape ({ shared, shell, colours }) {
  const count = NX * NZ
  const grid = new Float32Array(count * 3)
  const from = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  const shellCount = shell.length / 3
  for (let i = 0; i < count; i++) {
    const ix = i % NX
    const iz = (i / NX) | 0
    grid[i * 3] = X0 + (ix / (NX - 1)) * (X1 - X0)
    grid[i * 3 + 1] = FLOOR
    grid[i * 3 + 2] = Z0 + (iz / (NZ - 1)) * (Z1 - Z0)
    // Each grid point leaves from one point of the brain, in the shell's own
    // (unordered) sampling, so the dots swirl into place rather than slide.
    const s = (i % shellCount) * 3
    from[i * 3] = shell[s]; from[i * 3 + 1] = shell[s + 1]; from[i * 3 + 2] = shell[s + 2]
    seed[i] = Math.random()
  }

  const bumps = BASE.map((b) => [b[0], b[1], b[2], b[3]])
  const bumpUniform = bumps.map(() => new Vector4())

  const uniforms = {
    uTime: shared.uTime,
    uPixelRatio: shared.uPixelRatio,
    uDepthRef: shared.uDepthRef,
    uSuppression: shared.uSuppression,
    uCool: shared.uCool,
    uWarm: shared.uWarm,
    uInk: { value: colours.ink },
    uMorph: { value: 0 },
    uAmount: { value: 0 },
    uBump: { value: bumpUniform },
    uRipple: { value: new Vector4(0, 0, -99, 0) }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(grid, 3))
  geometry.setAttribute('aShell', new BufferAttribute(from, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1))
  const surface = new Points(geometry, new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))
  surface.frustumCulled = false

  // The optimiser and its trail, one buffer: index 0 is the ball.
  const trail = new Float32Array(TRAIL * 3)
  const ages = new Float32Array(TRAIL)
  for (let i = 0; i < TRAIL; i++) ages[i] = i / (TRAIL - 1)
  const markerGeometry = new BufferGeometry()
  markerGeometry.setAttribute('position', new BufferAttribute(trail, 3))
  markerGeometry.setAttribute('aAge', new BufferAttribute(ages, 1))
  const markerUniforms = { ...uniforms, uAmount: { value: 0 } }
  const marker = new Points(markerGeometry, new ShaderMaterial({
    uniforms: markerUniforms, vertexShader: markerVertex, fragmentShader: markerFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  }))
  marker.frustumCulled = false

  const group = new Group()
  group.add(surface, marker)

  function height (x, z, t) {
    let h = 0
    for (const b of bumps) {
      const dx = x - b[0]; const dz = z - b[1]
      h += b[2] * Math.exp(-(dx * dx + dz * dz) / (2 * b[3] * b[3]))
    }
    return h + Math.sin(x * 0.9 + t * 0.21) * Math.sin(z * 0.8 - t * 0.17) * 0.12
  }

  const ball = { x: -3, z: -4, vx: 0, vz: 0 }
  let trailFilled = false
  let sample = 0
  const watch = spikes()

  function restart () {
    // Start somewhere high: the best of a few random tries.
    let best = null
    for (let k = 0; k < 12; k++) {
      const x = X0 + 0.8 + Math.random() * (X1 - X0 - 1.6)
      const z = Z0 + 0.8 + Math.random() * (Z1 - Z0 - 1.6)
      const h = height(x, z, uniforms.uTime.value)
      if (!best || h > best.h) best = { x, z, h }
    }
    ball.x = best.x; ball.z = best.z; ball.vx = 0; ball.vz = 0
    trailFilled = false
  }
  restart()

  return {
    group,
    /** What the surface covers, hills included: the reference the project views are fitted to. */
    bounds: new Box3(new Vector3(X0, FLOOR, Z0), new Vector3(X1, FLOOR + 1.2, Z1)),

    /**
     * `morph` brings the dots out of the brain, `amount` is how present the
     * surface is, and `focus` how present the optimiser is: it leaves entirely
     * when a project's view stands on the surface.
     */
    update (dt, state, morph, amount, focus) {
      const t = uniforms.uTime.value
      uniforms.uMorph.value = morph
      uniforms.uAmount.value = amount
      markerUniforms.uAmount.value = focus * morph
      group.visible = amount > 0.001

      bumps.forEach((b, k) => {
        const base = BASE[k]
        b[0] = base[0] + Math.sin(t * 0.05 + k * 1.7) * 0.9
        b[1] = base[1] + Math.cos(t * 0.04 + k * 2.3) * 0.7
        const u = bumpUniform[k]
        u.x = b[0]; u.y = b[1]; u.z = b[2]; u.w = b[3]
      })

      const spike = watch(state)
      const quiet = state.suppression > 0.35
      if (spike && !quiet) {
        if (spike.run) restart()
        // A spike is a kick along the slope, and a ripple from the ball.
        const e = 0.02
        const gx = (height(ball.x + e, ball.z, t) - height(ball.x - e, ball.z, t)) / (2 * e)
        const gz = (height(ball.x, ball.z + e, t) - height(ball.x, ball.z - e, t)) / (2 * e)
        ball.vx -= gx * 0.9; ball.vz -= gz * 0.9
        const r = uniforms.uRipple.value
        r.x = ball.x; r.y = ball.z; r.z = t; r.w = 1
      }

      // Gradient descent with momentum, slowed while the light is held.
      const e = 0.02
      const gx = (height(ball.x + e, ball.z, t) - height(ball.x - e, ball.z, t)) / (2 * e)
      const gz = (height(ball.x, ball.z + e, t) - height(ball.x, ball.z - e, t)) / (2 * e)
      const pace = 1 - state.suppression * 0.85
      ball.vx = (ball.vx - gx * 1.6 * dt * pace) * Math.exp(-dt * 1.4)
      ball.vz = (ball.vz - gz * 1.6 * dt * pace) * Math.exp(-dt * 1.4)
      ball.x = Math.min(X1, Math.max(X0, ball.x + ball.vx * dt * pace))
      ball.z = Math.min(Z1, Math.max(Z0, ball.z + ball.vz * dt * pace))
      const y = FLOOR + height(ball.x, ball.z, t) + 0.05

      sample += dt
      if (sample > 0.04 || !trailFilled) {
        sample = 0
        trail.copyWithin(3, 0, (TRAIL - 1) * 3)
        if (!trailFilled) for (let i = 1; i < TRAIL; i++) { trail[i * 3] = ball.x; trail[i * 3 + 1] = y; trail[i * 3 + 2] = ball.z }
        trailFilled = true
      }
      trail[0] = ball.x; trail[1] = y; trail[2] = ball.z
      markerGeometry.attributes.position.needsUpdate = true
    }
  }
}
