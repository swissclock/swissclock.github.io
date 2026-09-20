/**
 * One shader pair draws both the whole-brain shell and the highlighted
 * trigeminal structures. What separates them is `uHot`, which is near zero for
 * the shell and high for the target, and `vNear`, the distance from the point
 * where the fiber delivers light.
 */

export const pointVertex = /* glsl */ `
attribute float aSeed;

uniform float uTime;
uniform float uActivity;   // 1 at rest, toward 0 when suppressed
uniform float uBurst;      // 0..1, momentary during a spike-wave complex
uniform float uPixelRatio;
uniform vec3  uFocus;      // where the light lands

varying float vFade;
varying float vSeed;
varying float vNear;

void main() {
  vec3 p = position;

  // Points breathe along their own radius while the tissue is active.
  float jitter = (sin(uTime * 1.7 + aSeed * 61.0) + sin(uTime * 2.9 + aSeed * 23.0)) * 0.5;
  p += normalize(p + vec3(0.001)) * jitter * 0.05 * uActivity;

  vNear = 1.0 - smoothstep(0.0, 2.6, distance(position, uFocus));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float depth = -mv.z;
  vFade = clamp(1.0 - (depth - 17.0) / 24.0, 0.16, 1.0);
  vSeed = aSeed;

  gl_PointSize = (0.95 + aSeed * 0.55 + uBurst * 0.8 + vNear * 1.2) * uPixelRatio * (25.0 / depth);
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

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;

  float alpha = smoothstep(0.25, 0.02, r);
  vec3 colour = mix(uCool, uWarm, clamp(uSuppression * 0.85 + vNear * uHot * 0.9, 0.0, 1.0));
  float lum = 0.70 + vSeed * 0.26 + uBurst * 0.40 * (1.0 - uSuppression) + vNear * uHot * 0.95;

  gl_FragColor = vec4(colour * lum, alpha * vFade * (0.84 - uSuppression * 0.20));
}
`
