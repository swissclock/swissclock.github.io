import { Vector3 } from 'three'

/**
 * One camera framing per section, in the same order as `sections` in the
 * content data. `hot` decides how strongly the trigeminal target reads: the
 * section about the therapy brings the camera in and lights the target up.
 */
export const frames = [
  // 01 Opening — the whole brain, lateral, calm
  { position: new Vector3(2.4, 1.6, 28.0), target: new Vector3(0.3, 0, 0), spin: -0.55, hot: 0.16 },
  // 02 Now — in on the trigeminal nerve, the therapeutic target
  { position: new Vector3(-1.0, -0.4, 12.5), target: new Vector3(-2.8, -1.5, 0), spin: -1.1, hot: 1.0 },
  // 03 Research — pulled back and rotated toward the cortex
  { position: new Vector3(3.0, 2.8, 22.0), target: new Vector3(0.4, 0, 0), spin: -0.05, hot: 0.22 },
  // 04 Path — the long view
  { position: new Vector3(-2.6, 1.2, 23.5), target: new Vector3(0, 0.2, 0), spin: -0.95, hot: 0.14 },
  // 05 Papers — low angle, out of the way of a long list
  { position: new Vector3(1.6, -2.0, 21.0), target: new Vector3(0, -0.3, 0), spin: -1.55, hot: 0.18 },
  // 06 Contact — centred, closer, facing away
  { position: new Vector3(0, 0.8, 19.0), target: new Vector3(0, 0, 0), spin: -2.3, hot: 0.3 }
]
