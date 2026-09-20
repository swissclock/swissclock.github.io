import { Vector3 } from 'three'

/**
 * One camera framing per section, in the same order as `sections` in the
 * content data. `hot` decides how strongly the trigeminal target reads: the
 * section about the therapy brings the camera in and lights the target up.
 *
 * Two things constrain every pair below.
 *
 * The model is rotated by `spin` before the camera sees it, so a framing has to
 * be solved against the rotated point cloud — aiming at a structure's own
 * coordinates misses it by however far the spin has carried it, which is how
 * the trigeminal target used to end up behind the reading column.
 *
 * Above 1080px the model is drawn into the right 52% of the viewport, the
 * reading column takes roughly the left half, and the veil holds solid ground
 * under that column and only clears a little way past it. So each framing puts
 * the whole brain inside its canvas rather than bleeding off the right edge,
 * and puts the trigeminal target no further left than about a quarter of the
 * canvas width — past the veil's ramp at every viewport size, never behind the
 * text. That first guarantee holds only because the camera widens its vertical
 * field of view on a narrow canvas: see REFERENCE_ASPECT in scene/index.js.
 */
export const frames = [
  // 01 Opening — the whole brain, lateral, calm
  { position: new Vector3(2.33, 1.39, 31.87), target: new Vector3(-0.06, -0.42, 0), spin: -0.55, hot: 0.16 },
  // 02 Now — the therapeutic target, held inside a brain that still reads as one
  { position: new Vector3(4.32, 0.35, 22.01), target: new Vector3(2.1, -1.65, -0.18), spin: -2.85, hot: 1.0 },
  // 03 Research — pulled back and raised, looking down onto the cortex
  { position: new Vector3(3.51, 10.47, 33.13), target: new Vector3(-0.41, -0.64, 0.46), spin: -0.3, hot: 0.22 },
  // 04 Path — the long view, from the other side
  { position: new Vector3(-4.47, 0.85, 37.27), target: new Vector3(-0.41, -0.73, 0.61), spin: -0.95, hot: 0.14 },
  // 05 Papers — low angle, oblique, out of the way of a long list
  { position: new Vector3(1.35, -4.03, 28.31), target: new Vector3(-0.73, -0.76, 0.99), spin: -1.8, hot: 0.18 },
  // 06 Contact — centred, facing away
  { position: new Vector3(-0.81, 1.06, 30.39), target: new Vector3(-0.81, -0.2, 0.45), spin: -2.3, hot: 0.3 }
]
