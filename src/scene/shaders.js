/**
 * One shader pair draws both the whole-brain shell and the highlighted
 * trigeminal structures. What separates them is `uHot`, which is near zero for
 * the shell and high for the target, and `vNear`, the distance from the point
 * where the fiber delivers light.
 */

export const pointVertex = /* glsl */ `
attribute float aSeed;

uniform float uTime;
uniform float uActivity;    // 1 at rest, toward 0 when suppressed
uniform float uSuppression; // 0..1, rises under light and decays slowly after
uniform float uBurst;       // 0..1, momentary during a spike-wave complex
uniform float uPixelRatio;
uniform float uJitter;      // 1 normally, 0 under prefers-reduced-motion
uniform float uDepthRef;    // camera-to-subject distance for this framing
uniform vec3  uFocus;       // where the light lands

varying float vFade;
varying float vSeed;
varying float vNear;
varying float vWarm;
varying float vFront;

// The furthest shell point sits about 14.6mm from the fiber tip, so a front at
// uSuppression * REACH has crossed the whole model exactly as suppression
// saturates: full suppression still means a fully warmed brain.
const float REACH = 15.5;

void main() {
  vec3 p = position;

  // Points breathe along their own radius while the tissue is active. This is
  // the last continuous motion on the page, so it is the one uJitter stops.
  float jitter = (sin(uTime * 1.7 + aSeed * 61.0) + sin(uTime * 2.9 + aSeed * 23.0)) * 0.5;
  p += normalize(p + vec3(0.001)) * jitter * 0.05 * uActivity * uJitter;

  float away = distance(position, uFocus);
  vNear = 1.0 - smoothstep(0.0, 2.6, away);

  // Light reaches the tissue rather than appearing in all of it at once. The
  // front sits at uSuppression * REACH, so it travels outward while the reader
  // holds and withdraws over the long recovery; a point only warms once the
  // front has passed it. The leading ridge is scaled by 4s(1-s), which is zero
  // at rest and zero again at saturation, so it exists only while the front is
  // actually moving. That is what keeps this from reading as a pulse.
  float reach = smoothstep(0.0, 1.0, uSuppression) * REACH;
  float arrived = 1.0 - smoothstep(reach - 0.7, reach + 0.7, away);
  float edge = (away - reach) * 1.9;
  vWarm = uSuppression * arrived;
  vFront = exp(-edge * edge) * 4.0 * uSuppression * (1.0 - uSuppression);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Fade with distance behind the subject rather than at a fixed depth: the
  // framings range from 22 to 37 units out, and a fixed ramp either flattens
  // the near ones into a single sheet or drowns the far ones.
  float depth = -mv.z;
  vFade = clamp(1.0 - (depth - uDepthRef * 0.86) / (uDepthRef * 0.5), 0.16, 1.0);
  vSeed = aSeed;

  gl_PointSize = (0.95 + aSeed * 0.55 + uBurst * 0.8 + vNear * 1.2 + vFront * 0.3) * uPixelRatio * (25.0 / depth);
}
`

export const pointFragment = /* glsl */ `
uniform float uSuppression;
uniform float uBurst;
uniform float uHot;
uniform vec3  uCool;
uniform vec3  uWarm;

varying float vFade;
varying float vSeed;
varying float vNear;
varying float vWarm;
varying float vFront;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;

  float alpha = smoothstep(0.25, 0.02, r);
  vec3 colour = mix(uCool, uWarm, clamp(vWarm * 0.85 + vNear * uHot * 0.9 + vFront * 0.22, 0.0, 1.0));
  float lum = 0.70 + vSeed * 0.26 + uBurst * 0.40 * (1.0 - uSuppression) + vNear * uHot * 0.95 + vFront * 0.2;

  gl_FragColor = vec4(colour * lum, alpha * vFade * (0.84 - uSuppression * 0.20) * (1.0 + vFront * 0.18));
}
`
